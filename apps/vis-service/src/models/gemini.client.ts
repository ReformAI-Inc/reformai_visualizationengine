// Compatibility shim — callGemini() predates the provider abstraction.
// Pipelines may keep using it; it executes DEFAULT_IMAGE_MODEL through the
// provider registry. New call sites should use callImageModel() directly
// (models/image-model.client.ts), which accepts a per-request modelId.

import type { GeminiPart } from '../shared/generation-parts.js';
import { callImageModel } from './image-model.client.js';

export interface GeminiResult {
    image: string; // base64-encoded image data
}

export const callGemini = async (parts: GeminiPart[]): Promise<GeminiResult> => {
    const { image } = await callImageModel({ parts });
    return { image };
};
