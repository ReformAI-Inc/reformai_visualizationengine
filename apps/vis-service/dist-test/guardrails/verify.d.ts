import type { AGTViolation, ArchitecturalGroundTruth, ClassifiedAGT } from '../shared/types/agt.js';
export interface AGTDiff {
    violations: AGTViolation[];
    inconclusiveFields: string[];
}
export declare const diffAGT: (input: ArchitecturalGroundTruth, inputClassified: ClassifiedAGT, output: ArchitecturalGroundTruth) => AGTDiff;
export declare const buildViolationFeedback: (violations: AGTViolation[]) => string;
//# sourceMappingURL=verify.d.ts.map