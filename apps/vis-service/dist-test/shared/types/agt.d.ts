export type ConfidenceLevel = 'high' | 'medium' | 'low';
export interface CountFieldInstance {
    location: string;
    type: string;
}
export interface AGTCountField {
    value: number;
    confidence: ConfidenceLevel;
    instances: CountFieldInstance[];
}
export interface AGTBooleanField {
    value: boolean;
    confidence: ConfidenceLevel;
}
export interface AGTPerspectiveField {
    value: string;
    confidence: ConfidenceLevel;
}
export interface ArchitecturalGroundTruth {
    window_count: AGTCountField;
    door_count: AGTCountField;
    has_ceiling_fixture: AGTBooleanField;
    has_built_in_niches: AGTBooleanField;
    camera_perspective: AGTPerspectiveField;
    extraction_confidence_overall: ConfidenceLevel;
    uncertain_fields: string[];
}
export type FieldEnforcement = 'hard' | 'advisory' | 'suppressed';
export interface ClassifiedCountField {
    enforcement: FieldEnforcement;
    displayValue: string;
    spatialAnchors?: string[];
}
export interface ClassifiedBooleanField {
    enforcement: FieldEnforcement;
    displayValue: string;
}
export interface ClassifiedPerspectiveField {
    enforcement: FieldEnforcement;
    displayValue: string;
}
export interface ClassifiedAGT {
    window_count: ClassifiedCountField;
    door_count: ClassifiedCountField;
    has_ceiling_fixture: ClassifiedBooleanField;
    has_built_in_niches: ClassifiedBooleanField;
    camera_perspective: ClassifiedPerspectiveField;
    hard_fact_fields: string[];
    advisory_fields: string[];
    suppressed_fields: string[];
    confidence_distribution: Record<ConfidenceLevel, number>;
}
export interface AGTViolation {
    field: 'window_count' | 'door_count' | 'has_ceiling_fixture' | 'has_built_in_niches';
    expected: string;
    observed: string;
    detail: string;
}
export interface AGTVerificationResult {
    verified: boolean;
    conclusive: boolean;
    violations: AGTViolation[];
    inconclusive_fields: string[];
    attempts: number;
}
//# sourceMappingURL=agt.d.ts.map