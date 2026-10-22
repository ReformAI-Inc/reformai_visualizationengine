// ============================================================
// BALANCED V5 — INJECTION LAYER
// Implements the prompt engine for pipelineMode 'balanced_v5'.
//
// Derived from balanced_v4_1/visualization.prompt.ts.
// All V4.1 injection logic is preserved unchanged.
//
// V5 additions:
//   - buildInfluencePrompt: ignores styleInfluence param; branches only on
//     moodboard count. Returns V5_MOODBOARD_INFLUENCE_STATEMENT when moodboards
//     are present, INFLUENCE_PRESET_STYLE_ONLY when not.
//   - buildMoodboardBlock: returns the moodboard scope block string when
//     moodboards are present; returns empty string when not. The service uses
//     the empty-string return to decide whether to push a parts entry.
//
// Processing order (unchanged from V4.1):
//   1. Validate required fields
//   2. Validate enum fields against canonical value sets
//   3. Resolve registry lookups
//   4. Apply rendering contracts
//   5. Evaluate conditional fields
//   6. Inject all placeholders
//   7. Apply whitespace normalization for conditional blocks
//   8. Inject INJECTED_ITEM_AUDIT_BLOCK
//   9. Run post-injection validation (regex scan for remaining {{...}})
//  10. Return { structuralPart, stylePart }
//
// INVARIANT: Hard-fail on missing required fields. No silent empty injection.
// ============================================================

import { StylePreset } from '../../shared/types/index.js';
import {
    TEMPLATE_VERSION,
    PIPELINE_MODE,
    BALANCED_V5_STRUCTURAL_PART,
    BALANCED_V5_STYLE_TEMPLATE,
    buildInjectedItemAuditText,
    buildMoodboardScopeBlock,
    V5_MOODBOARD_INFLUENCE_STATEMENT,
    INFLUENCE_PRESET_STYLE_ONLY,
    DEFAULT_USER_REQUEST,
} from './visualization.constants.js';
import { resolveRoomTypeEntry } from '../../shared/room-types.registry.js';
import { getDensityBlockEntry } from '../../shared/density-blocks.registry.js';

// ── Error class ───────────────────────────────────────────────────────────────

export class PromptInjectionError extends Error {
    constructor(message: string) {
        super(`[PromptInjectionError v${TEMPLATE_VERSION}] ${message}`);
        this.name = 'PromptInjectionError';
    }
}

// ── Validation helpers ────────────────────────────────────────────────────────

const requireString = (value: unknown, fieldPath: string): string => {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new PromptInjectionError(`Required field '${fieldPath}' is missing or empty.`);
    }
    return value;
};

const requireNonEmptyArray = (value: unknown, fieldPath: string): string[] => {
    if (!Array.isArray(value) || value.length === 0) {
        throw new PromptInjectionError(`Required field '${fieldPath}' must be a non-empty array.`);
    }
    return value as string[];
};

// ── Rendering contracts ───────────────────────────────────────────────────────

const renderInlineList = (arr: string[]): string => arr.join(', ');

const renderDontsBlock = (donts: string[]): string => {
    if (!donts || donts.length === 0) return '';
    return '**Do Not:**\n' + donts.map(d => `- ${d}`).join('\n');
};

const renderUserRequest = (textPrompt: string): string =>
    textPrompt?.trim() || DEFAULT_USER_REQUEST;

// ── Aperture sanitizer ────────────────────────────────────────────────────────
// Carried over from V4.1. aperture_look has no injection point in V5 —
// sanitizer runs for debug metadata only.

const STRUCTURAL_APERTURE_TERMS = [
    'divided-pane', 'divided pane', 'mullion', 'arched', 'arch',
    'steel-framed', 'steel framed', 'floor-to-ceiling', 'floor to ceiling',
    'bay window', 'colonial', 'shoji', 'new window', 'enlarged window', 'glazing band',
];

const SAFE_APERTURE_FALLBACK =
    'Preserve existing window geometry and pane structure. Express the aperture styling only through window treatments, trim finish, surrounding wall materials, and nearby decor.';

const SAFE_APERTURE_SUFFIX =
    ' while preserving existing window geometry, pane structure, and exterior view.';

export const sanitizeApertureLook = (
    raw: string,
): { safeApertureLook: string; apertureSanitized: boolean } => {
    if (!raw || raw.trim() === '') {
        return { safeApertureLook: '', apertureSanitized: false };
    }

    console.warn(
        `[balanced_v5] aperture_look is set ("${raw.slice(0, 60)}...") but has no injection point in template v${TEMPLATE_VERSION}. Value is excluded from the rendered prompt.`,
    );

    const lower = raw.toLowerCase();
    const hasStructuralTerm = STRUCTURAL_APERTURE_TERMS.some(term => lower.includes(term));

    if (hasStructuralTerm) {
        return { safeApertureLook: SAFE_APERTURE_FALLBACK, apertureSanitized: true };
    }
    return { safeApertureLook: raw.trimEnd() + SAFE_APERTURE_SUFFIX, apertureSanitized: false };
};

// ── Post-injection validation ─────────────────────────────────────────────────

const UNRESOLVED_PLACEHOLDER_RE = /\{\{[A-Z_]+\}\}/g;

const validateNoUnresolvedPlaceholders = (rendered: string, partName: string): void => {
    const remaining = rendered.match(UNRESOLVED_PLACEHOLDER_RE);
    if (remaining) {
        throw new PromptInjectionError(
            `Unresolved placeholder(s) in ${partName} after injection: ${remaining.join(', ')}`,
        );
    }
};

// ── Params / return types ─────────────────────────────────────────────────────

export interface BalancedV5PromptParams {
    roomType: string;
    stylePreset: StylePreset;
    textPrompt: string;
    hasInjectedItem: boolean;
    // Number of injected items (1..MAX_INJECTED_ITEMS). Defaults to 1 when
    // hasInjectedItem is true, which keeps the single-item audit text unchanged.
    injectedItemCount?: number;
}

export interface BuiltBalancedV5Prompt {
    structuralPart: string;
    stylePart: string;
    rawApertureLook: string;
    safeApertureLook: string;
    apertureSanitized: boolean;
    stagingDensityTier: string;
}

// ── Main prompt builder ───────────────────────────────────────────────────────

export const buildVisualizationPrompt = (params: BalancedV5PromptParams): BuiltBalancedV5Prompt => {
    const { roomType, stylePreset, textPrompt, hasInjectedItem } = params;
    const injectedItemCount = hasInjectedItem ? (params.injectedItemCount ?? 1) : 0;

    // ── Step 1: Validate required fields ─────────────────────────────────────
    requireString(stylePreset?.name, 'stylePreset.name');
    requireString(roomType, 'roomType');
    requireNonEmptyArray(stylePreset?.model_inputs?.core_materials, 'stylePreset.model_inputs.core_materials');
    requireNonEmptyArray(stylePreset?.model_inputs?.color_palette, 'stylePreset.model_inputs.color_palette');
    requireString(stylePreset?.model_inputs?.lighting_style, 'stylePreset.model_inputs.lighting_style');
    requireString(stylePreset?.model_inputs?.material_finish, 'stylePreset.model_inputs.material_finish');
    const validatedSignatureElements = requireNonEmptyArray(
        stylePreset?.model_inputs?.signature_elements,
        'stylePreset.model_inputs.signature_elements',
    );

    // ── Step 2: Validate enum fields ──────────────────────────────────────────
    const rawDensity = stylePreset?.pipeline_config?.staging_density;
    const densityTier: string = rawDensity ?? 'medium';
    if (!['low', 'medium', 'high'].includes(densityTier)) {
        throw new PromptInjectionError(
            `Invalid staging_density value '${densityTier}'. Must be 'low', 'medium', or 'high'.`,
        );
    }

    // ── Step 3: Resolve registry lookups ─────────────────────────────────────
    // Never fails: a room type outside the registry gets a generic entry.
    const roomEntry = resolveRoomTypeEntry(roomType);

    const densityEntry = getDensityBlockEntry(densityTier);
    if (!densityEntry) {
        throw new PromptInjectionError(
            `Density tier '${densityTier}' is not registered in DENSITY_BLOCK_REGISTRY.`,
        );
    }

    // ── Step 4: Apply rendering contracts ────────────────────────────────────
    const styleName = stylePreset.name;
    const resolvedRoomType = roomEntry.roomType;
    const userRequest = renderUserRequest(textPrompt);
    const roomFunctionUses = roomEntry.roomFunctionUses;
    const functionalAnchorExamples = roomEntry.functionalAnchorExamples;
    const stagingDensityLabel = densityEntry.label;
    const stagingDensityBlock = densityEntry.block;
    const coreMaterials = renderInlineList(stylePreset.model_inputs.core_materials);
    const colorPalette = renderInlineList(stylePreset.model_inputs.color_palette);
    const lightingStyle = stylePreset.model_inputs.lighting_style;
    const materialFinish = stylePreset.model_inputs.material_finish;
    const signatureElements = renderInlineList(validatedSignatureElements);

    // ── Step 5: Evaluate conditional fields ───────────────────────────────────
    const highDensityGroupBlock = densityEntry.highDensityGroupBlock;
    const dontsBlock = renderDontsBlock(stylePreset.model_inputs?.dont ?? []);

    // Aperture sanitizer — debug metadata only, not injected
    const rawApertureLook = stylePreset.model_inputs?.aperture_look ?? '';
    const { safeApertureLook, apertureSanitized } = rawApertureLook
        ? sanitizeApertureLook(rawApertureLook)
        : { safeApertureLook: '', apertureSanitized: false };

    // ── Step 6: Inject all non-conditional placeholders ───────────────────────
    let rendered = BALANCED_V5_STYLE_TEMPLATE
        .replace(/\{\{STYLE_NAME\}\}/g, styleName)
        .replace(/\{\{ROOM_TYPE\}\}/g, resolvedRoomType)
        .replace(/\{\{USER_REQUEST\}\}/g, userRequest)
        .replace(/\{\{ROOM_FUNCTION_USES\}\}/g, roomFunctionUses)
        .replace(/\{\{STAGING_DENSITY_LABEL\}\}/g, stagingDensityLabel)
        .replace(/\{\{STAGING_DENSITY_BLOCK\}\}/g, stagingDensityBlock)
        .replace(/\{\{FUNCTIONAL_ANCHOR_EXAMPLES\}\}/g, functionalAnchorExamples)
        .replace(/\{\{CORE_MATERIALS\}\}/g, coreMaterials)
        .replace(/\{\{COLOR_PALETTE\}\}/g, colorPalette)
        .replace(/\{\{LIGHTING_STYLE\}\}/g, lightingStyle)
        .replace(/\{\{MATERIAL_FINISH\}\}/g, materialFinish)
        .replace(/\{\{STYLE_SIGNATURE_ELEMENTS\}\}/g, signatureElements);

    // ── Step 7: Whitespace-normalizing injection for conditional blocks ────────
    if (highDensityGroupBlock) {
        rendered = rendered.replace('{{HIGH_DENSITY_GROUP_BLOCK}}', highDensityGroupBlock + '\n');
    } else {
        rendered = rendered.replace('{{HIGH_DENSITY_GROUP_BLOCK}}\n', '');
    }

    if (dontsBlock) {
        rendered = rendered.replace('{{STYLE_DONTS_BLOCK}}', dontsBlock);
    } else {
        rendered = rendered.replace('{{STYLE_DONTS_BLOCK}}\n\n', '');
    }

    // ── Step 8: Inject INJECTED_ITEM_AUDIT_BLOCK ──────────────────────────────
    if (hasInjectedItem) {
        rendered = rendered.replace('{{INJECTED_ITEM_AUDIT_BLOCK}}', buildInjectedItemAuditText(injectedItemCount));
    } else {
        rendered = rendered.replace('\n{{INJECTED_ITEM_AUDIT_BLOCK}}', '');
    }

    // ── Step 9: Post-injection validation ─────────────────────────────────────
    validateNoUnresolvedPlaceholders(rendered, 'stylePart');

    const structuralPart = BALANCED_V5_STRUCTURAL_PART;

    // ── Step 10: Return ───────────────────────────────────────────────────────
    return {
        structuralPart,
        stylePart: rendered,
        rawApertureLook,
        safeApertureLook,
        apertureSanitized,
        stagingDensityTier: densityTier,
    };
};

// ── Influence prompt builder ───────────────────────────────────────────────────
// V5: styleInfluence param is intentionally ignored.
// Branching is on moodboard presence only — no slider logic.

export const buildInfluencePrompt = (
    moodBoardImagesCount: number,
    _styleInfluence: number,    // ignored in V5 — no slider; kept for signature compatibility
    _stylePresetName: string,   // ignored in V5 — style name embedded in scope block
): string => {
    return moodBoardImagesCount > 0
        ? V5_MOODBOARD_INFLUENCE_STATEMENT
        : INFLUENCE_PRESET_STYLE_ONLY;
};

// ── Moodboard block builder ───────────────────────────────────────────────────
// Returns the moodboard scope block string when hasMoodboards is true.
// Returns empty string when false — the service checks for empty string before
// pushing a parts entry, so no conditional logic is needed in the service itself.

export const buildMoodboardBlock = (
    styleName: string,
    stagingDensity: 'low' | 'medium' | 'high',
    hasMoodboards: boolean,
): string => {
    if (!hasMoodboards) return '';
    return buildMoodboardScopeBlock(styleName, stagingDensity);
};



