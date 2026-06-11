// ============================================================
// VERIFIED GENERATION — orchestration for AGT post-generation
// verification with bounded retry.
//
// Flow (when enabled and hard facts exist):
//   generate → re-extract AGT from the output image → diffAGT
//   → on hard-fact violation: ONE retry with a violation-feedback
//     block appended to the original parts → re-verify
//   → return the better attempt (fewer violations) + metadata.
//
// Failure posture: never block users on guardrail infrastructure.
// If output extraction itself fails or is low-confidence, the
// result passes with conclusive=false rather than erroring.
//
// Retry budget is 1 by design: the Netlify proxy in front of
// Cloud Run has a 26s function timeout; each retry costs one
// extraction (~2-3s) plus one generation (~5-10s).
// ============================================================
import { callImageModel } from '../models/image-model.client.js';
import { extractAGTFromImageData } from './extract.js';
import { buildViolationFeedback, diffAGT } from './verify.js';
const MAX_RETRIES = 1;
// Gemini image generation returns PNG data.
const GENERATED_IMAGE_MIME = 'image/png';
export const generateWithVerification = async (parts, inputAGT, inputClassified, opts) => {
    if (!opts.enabled || inputClassified.hard_fact_fields.length === 0) {
        const { image } = await callImageModel({ parts, modelId: opts.modelId });
        return { image, verification: null };
    }
    let attempts = 0;
    let currentParts = parts;
    let best = null;
    while (true) {
        attempts++;
        const { image } = await callImageModel({ parts: currentParts, modelId: opts.modelId });
        let diff;
        try {
            const outputAGT = await extractAGTFromImageData(image, GENERATED_IMAGE_MIME);
            diff = diffAGT(inputAGT, inputClassified, outputAGT);
        }
        catch {
            // Extraction infra failure on the output image: inconclusive pass.
            return {
                image,
                verification: {
                    verified: true,
                    conclusive: false,
                    violations: [],
                    inconclusive_fields: [...inputClassified.hard_fact_fields],
                    attempts,
                },
            };
        }
        if (!best || diff.violations.length < best.diff.violations.length) {
            best = { image, diff };
        }
        if (diff.violations.length === 0 || attempts > MAX_RETRIES)
            break;
        currentParts = [...parts, { text: buildViolationFeedback(diff.violations) }];
    }
    return {
        image: best.image,
        verification: {
            verified: best.diff.violations.length === 0,
            conclusive: best.diff.inconclusiveFields.length === 0,
            violations: best.diff.violations,
            inconclusive_fields: best.diff.inconclusiveFields,
            attempts,
        },
    };
};
//# sourceMappingURL=verified-generation.js.map