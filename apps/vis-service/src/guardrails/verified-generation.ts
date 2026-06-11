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

import { callGemini } from '../models/gemini.client.js';
import type { GeminiPart } from '../shared/generation-parts.js';
import type {
    AGTVerificationResult,
    ArchitecturalGroundTruth,
    ClassifiedAGT,
} from '../shared/types/agt.js';
import { extractAGTFromImageData } from './extract.js';
import { buildViolationFeedback, diffAGT, type AGTDiff } from './verify.js';

const MAX_RETRIES = 1;
// Gemini image generation returns PNG data.
const GENERATED_IMAGE_MIME = 'image/png';

export interface VerifiedGenerationResult {
    image: string;
    verification: AGTVerificationResult | null; // null = verification not run (disabled or no hard facts)
}

export const generateWithVerification = async (
    parts: GeminiPart[],
    inputAGT: ArchitecturalGroundTruth,
    inputClassified: ClassifiedAGT,
    opts: { enabled: boolean },
): Promise<VerifiedGenerationResult> => {
    if (!opts.enabled || inputClassified.hard_fact_fields.length === 0) {
        const { image } = await callGemini(parts);
        return { image, verification: null };
    }

    let attempts = 0;
    let currentParts = parts;
    let best: { image: string; diff: AGTDiff } | null = null;

    while (true) {
        attempts++;
        const { image } = await callGemini(currentParts);

        let diff: AGTDiff;
        try {
            const outputAGT = await extractAGTFromImageData(image, GENERATED_IMAGE_MIME);
            diff = diffAGT(inputAGT, inputClassified, outputAGT);
        } catch {
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
        if (diff.violations.length === 0 || attempts > MAX_RETRIES) break;

        currentParts = [...parts, { text: buildViolationFeedback(diff.violations) }];
    }

    return {
        image: best!.image,
        verification: {
            verified: best!.diff.violations.length === 0,
            conclusive: best!.diff.inconclusiveFields.length === 0,
            violations: best!.diff.violations,
            inconclusive_fields: best!.diff.inconclusiveFields,
            attempts,
        },
    };
};
