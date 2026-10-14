// Shared request assembly utilities.
// Image encoding, injected item normalization, and parts-array introspection.
// Moved from services/shared/pipelineAssembly.ts.

import type { MultipartFile } from '@fastify/multipart';
import type { GenerateVisualizationParams, InjectedItem } from './types/core.js';
import { MAX_INJECTED_ITEMS } from './injected-items.constants.js';
import { ValidationError } from './validation/validation.utils.js';

export type GeminiPart =
    | { inlineData: { data: string; mimeType: string } }
    | { text: string };

export const bufferToGenerativePart = (file: MultipartFile & { buffer: Buffer }): GeminiPart => ({
    inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype },
});

export const normalizeInjectedItems = (
    params: GenerateVisualizationParams,
    pipelineMode: 'balanced_v5' | 'balanced_v7' | 'balanced_v8',
): {
    injectedItems: InjectedItem[];
    hasInjectedItem: boolean;
    shimmedFromFurnitureImage: boolean;
} => {
    let injectedItems: InjectedItem[] = params.injectedItems ?? [];
    const shimmedFromFurnitureImage = injectedItems.length === 0 && !!params.furnitureImage;
    if (shimmedFromFurnitureImage) {
        // Guarded by the !!params.furnitureImage check in shimmedFromFurnitureImage.
        injectedItems = [{ image: params.furnitureImage! }];
    }
    if (injectedItems.length > MAX_INJECTED_ITEMS) {
        // ValidationError → the controller answers 400, never a 500.
        throw new ValidationError(
            `${pipelineMode} supports a maximum of ${MAX_INJECTED_ITEMS} injected items. ` +
            `Received ${injectedItems.length}.`,
        );
    }
    return {
        injectedItems,
        hasInjectedItem: injectedItems.length > 0,
        shimmedFromFurnitureImage,
    };
};

export const buildRequestStructure = (parts: GeminiPart[]): string[] =>
    parts.map((part) => {
        if ('text' in part) {
            return part.text.startsWith('[')
                ? `LABEL:${part.text.slice(1, part.text.indexOf(']'))}`
                : 'TEXT';
        }
        return 'IMAGE';
    });



