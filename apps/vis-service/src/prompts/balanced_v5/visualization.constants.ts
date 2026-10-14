// ============================================================
// BALANCED V5 / V6.0 — PROMPT CONSTANTS
// TEMPLATE VERSION: 6.0
// COMPATIBLE WITH: pipelineMode "balanced_v5"
//
// All prompt block implementations now live in prompts/blocks/.
// This file is the backward-compatible re-export surface for anything
// that imports from balanced_v5 directly (shared/builders.ts, visualization.prompt.ts,
// and archived pipeline V4.1 which re-exports the structural part from here).
//
// Do not add implementations here. Add new blocks to prompts/blocks/ instead.
// ============================================================

export const TEMPLATE_VERSION = '6.0.0';
export const PIPELINE_MODE = 'balanced_v5';

export { STRUCTURAL_BLOCK as BALANCED_V5_STRUCTURAL_PART } from '../blocks/structural.js';
export { STYLE_TEMPLATE as BALANCED_V5_STYLE_TEMPLATE } from '../blocks/style.js';
export { buildConstraintHierarchyBlock } from '../blocks/constraint-hierarchy.js';
export { buildMoodboardScopeBlock } from '../blocks/moodboard-scope.js';
export {
    V5_MOODBOARD_INFLUENCE_STATEMENT,
    INFLUENCE_PRESET_STYLE_ONLY,
    DEFAULT_USER_REQUEST,
} from '../blocks/influence.js';
export { buildRenovationAnchorsBlock } from '../blocks/renovation-anchors.js';
export {
    INJECTED_ITEM_BLOCK_HEADER,
    INJECTED_ITEM_AUDIT_TEXT,
    buildInjectedItemBlockHeader,
    buildInjectedItemAuditText,
} from '../blocks/injected-items.js';



