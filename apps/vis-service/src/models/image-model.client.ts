// Shared image-model execution layer — the only entry point pipelines use.
// Model selection and provider routing live here; SDK specifics live in
// providers/. Future concerns that belong here: retry logic, latency telemetry.

import type { GeminiPart } from '../shared/generation-parts.js';
import { providerFor } from './provider-registry.js';

// The active image generation model for every pipeline that does not name one.
//
// Env-driven so a model migration is an environment change rather than a code
// change: QA runs `IMAGE_MODEL=gemini-3.1-flash-image` while production stays on
// the 2.5 default until the comparison says otherwise. Unset anywhere else, so
// local runs and the sandbox keep today's behaviour.
//
// Any `gemini-*` id routes through the Gemini provider (see provider-registry),
// so switching does not need a code path of its own.
export const DEFAULT_IMAGE_MODEL = process.env.IMAGE_MODEL || 'gemini-2.5-flash-image';

// Text-output model used by AGT extraction.
export const AGT_EXTRACTION_MODEL = process.env.AGT_EXTRACTION_MODEL || 'gemini-2.5-flash';

export interface ImageGenRequest {
    parts: GeminiPart[];
    modelId?: string; // defaults to DEFAULT_IMAGE_MODEL
}

export interface ImageGenResult {
    image: string; // base64-encoded image data
    mimeType: string; // actual mime of the returned image (provider-reported; png fallback)
    modelId: string;
}

export const callImageModel = async (req: ImageGenRequest): Promise<ImageGenResult> => {
    const modelId = req.modelId ?? DEFAULT_IMAGE_MODEL;
    const provider = await providerFor(modelId);
    const startedAt = Date.now();
    try {
        const result = await provider.generateImage(req.parts, modelId);
        console.log('[telemetry]', JSON.stringify({
            event: 'image_generation',
            provider: provider.id,
            modelId,
            latencyMs: Date.now() - startedAt,
            ok: true,
            imageBytes: Math.floor(result.image.length * 0.75),
        }));
        return { image: result.image, mimeType: result.mimeType ?? 'image/png', modelId: result.modelId };
    } catch (err) {
        console.log('[telemetry]', JSON.stringify({
            event: 'image_generation',
            provider: provider.id,
            modelId,
            latencyMs: Date.now() - startedAt,
            ok: false,
            error: err instanceof Error ? err.message.slice(0, 200) : String(err),
        }));
        throw err;
    }
};

export const callTextModel = async (parts: GeminiPart[], modelId: string): Promise<string> => {
    const provider = await providerFor(modelId);
    const { text } = await provider.generateText(parts, modelId);
    return text;
};
