// ============================================================
// BALANCED V7 — PROMPT CONSTANTS
// TEMPLATE VERSION: 7.0.0
// COMPATIBLE WITH: pipelineMode "balanced_v7"
//
// V7 adds three AGT-driven blocks on top of V5/V6.0.
// All three now live in prompts/blocks/ alongside the V5 blocks.
//
// V5/V6.0 constants (BALANCED_V5_STRUCTURAL_PART, BALANCED_V5_STYLE_TEMPLATE,
// buildMoodboardScopeBlock, buildRenovationAnchorsBlock, etc.) are re-exported
// unchanged via shared/canonicalPromptPrimitives. V5 pipeline is frozen.
//
// The V7 buildConstraintHierarchyBlock extends the base block with an AGT tier
// line when hard facts exist. This V7-specific extension stays here since it
// contains V7-only orchestration logic (AGT awareness).
// ============================================================

import type { ClassifiedAGT } from '../../shared/types/index.js';
import { buildCanonicalConstraintHierarchy } from '../shared/canonicalPromptPrimitives.js';
import type {
    AGTConstraintBlockBuilder,
    AGTEchoBlockBuilder,
    ConflictClausesBlockBuilder,
} from '../shared/contracts.js';

export const TEMPLATE_VERSION = '7.0.0';
export const PIPELINE_MODE    = 'balanced_v7';


// ── RE-EXPORTS FROM V5 (unchanged) ───────────────────────────────────────────

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
} from '../shared/canonicalPromptPrimitives.js';


// ── AGT BLOCKS (from prompts/blocks/) ────────────────────────────────────────

export { buildAGTConstraintBlock } from '../blocks/agt-constraint.js';
export { buildAGTEchoBlock } from '../blocks/agt-echo.js';
export { buildConflictClausesBlock } from '../blocks/conflict-clauses.js';


// ── CONSTRAINT HIERARCHY BLOCK (V7 extension) ────────────────────────────────
// Extends the base block with an AGT tier line when hard facts exist.
// The base block lives in prompts/blocks/constraint-hierarchy.ts.
// ─────────────────────────────────────────────────────────────────────────────

export const buildConstraintHierarchyBlock = (
    injectedItemCount: number,
    hasRenovationAnchors = false,
    hasHardAGTFacts = false,
): string => {
    const base = buildCanonicalConstraintHierarchy(
        {
            injectedItemCount,
            hasRenovationAnchors,
        },
    );

    if (!hasHardAGTFacts) {
        return base;
    }

    const agtTierLine =
        '  Verified hard facts from the structural assessment above are TIER 1 constraints - they supersede model visual judgment.';

    const lines = base.split('\n');
    const insertionIndex = lines.findIndex((line: string) =>
        line.includes('All elements defined in Phase 1: Architectural Anchoring are immutable.'),
    );

    if (insertionIndex === -1) {
        return base;
    }

    lines.splice(insertionIndex + 1, 0, agtTierLine);
    return lines.join('\n');
};



