// Shared image-model execution layer — the only entry point pipelines use.
// Model selection and provider routing live here; SDK specifics live in
// providers/. Future concerns that belong here: retry logic, latency telemetry.
import { providerFor } from './provider-registry.js';
// The active image generation model. Update to switch models across all
// pipelines (per-mode overrides arrive with the migration comparison modes).
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image';
// Text-output model used by AGT extraction.
export const AGT_EXTRACTION_MODEL = process.env.AGT_EXTRACTION_MODEL || 'gemini-2.5-flash';
export const callImageModel = async (req) => {
    const modelId = req.modelId ?? DEFAULT_IMAGE_MODEL;
    const provider = await providerFor(modelId);
    return provider.generateImage(req.parts, modelId);
};
export const callTextModel = async (parts, modelId) => {
    const provider = await providerFor(modelId);
    const { text } = await provider.generateText(parts, modelId);
    return text;
};
//# sourceMappingURL=image-model.client.js.map