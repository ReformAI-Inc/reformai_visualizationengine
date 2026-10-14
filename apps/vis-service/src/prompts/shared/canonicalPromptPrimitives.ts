/**
 * Canonical prompt primitives shared by active/comparison pipelines.
 *
 * Current implementation sources these primitives from balanced_v5.
 * This module is the abstraction boundary so balanced_v7 and future
 * canonical work do not need to import balanced_v5 internals directly.
 */

export {
    BALANCED_V5_STRUCTURAL_PART,
    BALANCED_V5_STYLE_TEMPLATE,
    INJECTED_ITEM_BLOCK_HEADER,
    INJECTED_ITEM_AUDIT_TEXT,
    buildInjectedItemBlockHeader,
    buildInjectedItemAuditText,
    buildMoodboardScopeBlock,
    buildRenovationAnchorsBlock,
    V5_MOODBOARD_INFLUENCE_STATEMENT,
    INFLUENCE_PRESET_STYLE_ONLY,
    DEFAULT_USER_REQUEST,
    buildConstraintHierarchyBlock as buildCanonicalConstraintHierarchyBlock,
} from '../balanced_v5/visualization.constants.js';

export {
    buildCanonicalConstraintHierarchy,
    buildCanonicalMoodboardScope,
    buildCanonicalRenovationAnchors,
} from './builders.js';

export {
    buildVisualizationPrompt,
    buildInfluencePrompt,
    buildMoodboardBlock,
    PromptInjectionError,
    sanitizeApertureLook,
} from '../balanced_v5/visualization.prompt.js';

export type {
    BalancedV5PromptParams as CanonicalPromptParams,
    BuiltBalancedV5Prompt as BuiltCanonicalPrompt,
} from '../balanced_v5/visualization.prompt.js';



