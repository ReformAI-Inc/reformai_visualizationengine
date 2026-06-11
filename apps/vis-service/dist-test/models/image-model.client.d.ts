import type { GeminiPart } from '../shared/generation-parts.js';
export declare const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
export declare const AGT_EXTRACTION_MODEL: string;
export interface ImageGenRequest {
    parts: GeminiPart[];
    modelId?: string;
}
export interface ImageGenResult {
    image: string;
    modelId: string;
}
export declare const callImageModel: (req: ImageGenRequest) => Promise<ImageGenResult>;
export declare const callTextModel: (parts: GeminiPart[], modelId: string) => Promise<string>;
//# sourceMappingURL=image-model.client.d.ts.map