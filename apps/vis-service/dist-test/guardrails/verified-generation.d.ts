import type { GeminiPart } from '../shared/generation-parts.js';
import type { AGTVerificationResult, ArchitecturalGroundTruth, ClassifiedAGT } from '../shared/types/agt.js';
export interface VerifiedGenerationResult {
    image: string;
    verification: AGTVerificationResult | null;
}
export declare const generateWithVerification: (parts: GeminiPart[], inputAGT: ArchitecturalGroundTruth, inputClassified: ClassifiedAGT, opts: {
    enabled: boolean;
    modelId?: string;
}) => Promise<VerifiedGenerationResult>;
//# sourceMappingURL=verified-generation.d.ts.map