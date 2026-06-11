import type { MultipartFile } from '@fastify/multipart';
import type { GenerateVisualizationParams, InjectedItem } from './types/core.js';
export type GeminiPart = {
    inlineData: {
        data: string;
        mimeType: string;
    };
} | {
    text: string;
};
export declare const bufferToGenerativePart: (file: MultipartFile & {
    buffer: Buffer;
}) => GeminiPart;
export declare const normalizeInjectedItems: (params: GenerateVisualizationParams, pipelineMode: "balanced_v5" | "balanced_v7" | "balanced_v8") => {
    injectedItems: InjectedItem[];
    item: InjectedItem | null;
    hasInjectedItem: boolean;
    shimmedFromFurnitureImage: boolean;
};
export declare const buildRequestStructure: (parts: GeminiPart[]) => string[];
//# sourceMappingURL=generation-parts.d.ts.map