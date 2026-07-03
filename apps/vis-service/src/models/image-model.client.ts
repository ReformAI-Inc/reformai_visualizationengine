// Shared image-model execution layer — the only entry point pipelines use.
// Model selection and provider routing live here; SDK specifics live in
// providers/. Future concerns that belong here: retry logic, latency telemetry.

import type { GeminiPart } from '../shared/generation-parts.js';
import { providerFor } from './provider-registry.js';

// The active image generation model. Update to switch models across all
// pipelines (per-mode overrides arrive with the migration comparison modes).
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';

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
