// Compatibility shim — callGemini() predates the provider abstraction.
// Pipelines may keep using it; it executes DEFAULT_IMAGE_MODEL through the
// provider registry. New call sites should use callImageModel() directly
// (models/image-model.client.ts), which accepts a per-request modelId.
import { callImageModel } from './image-model.client.js';
export const callGemini = async (parts) => {
    const { image } = await callImageModel({ parts });
    return { image };
};
//# sourceMappingURL=gemini.client.js.map