import type { GeminiPart } from '../shared/generation-parts.js';
export interface ImageModelProvider {
    id: string;
    supports: (modelId: string) => boolean;
    generateImage: (parts: GeminiPart[], modelId: string) => Promise<{
        image: string;
        modelId: string;
    }>;
    generateText: (parts: GeminiPart[], modelId: string) => Promise<{
        text: string;
        modelId: string;
    }>;
}
export declare const providerFor: (modelId: string) => Promise<ImageModelProvider>;
export declare const resolveProvider: (modelId: string, providers: Pick<ImageModelProvider, "id" | "supports">[]) => string;
//# sourceMappingURL=provider-registry.d.ts.map