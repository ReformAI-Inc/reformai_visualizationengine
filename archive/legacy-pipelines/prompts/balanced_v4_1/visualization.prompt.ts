// ============================================================
// BALANCED V4.1 — INJECTION LAYER
// Implements the template-driven prompt engine for pipelineMode 'balanced_v4_1'.
//
// Derived from balanced_v4_0/visualization.prompt.ts. All v4.0 injection
// logic is preserved. V4.1 additions:
//   - signature_elements field: validated as non-empty array, rendered inline
//   - {{STYLE_SIGNATURE_ELEMENTS}} placeholder injected in step 6
//   - BalancedV4_1PromptParams: extends v4.0 params (identical shape)
//   - Validation step 1: requires stylePreset.model_inputs.signature_elements
//
// Processing order (unchanged from v4.0):
//   1. Validate required fields
//   2. Validate enum fields against canonical value sets
//   3. Resolve registry lookups
//   4. Apply rendering contracts
//   5. Evaluate conditional fields
//   6. Inject all placeholders (adds {{STYLE_SIGNATURE_ELEMENTS}})
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
    BALANCED_V4_1_STRUCTURAL_PART,
    BALANCED_V4_1_STYLE_TEMPLATE,
    INJECTED_ITEM_AUDIT_TEXT,
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    DEFAULT_USER_REQUEST,
} from './visualization.constants.js';
import { getRoomTypeEntry } from '../../shared/room-types.registry.js';
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
// Carried over from v4.0. aperture_look has no injection point in v4.1 —
// sanitizer runs for debug metadata only. Non-empty values produce a warning.

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
        `[balanced_v4_1] aperture_look is set ("${raw.slice(0, 60)}...") but has no injection point in template v${TEMPLATE_VERSION}. Value is excluded from the rendered prompt.`,
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

export interface BalancedV4_1PromptParams {
    roomType: string;
    stylePreset: StylePreset;
    textPrompt: string;
    hasInjectedItem: boolean;
}

export interface BuiltBalancedV4_1Prompt {
    structuralPart: string;
    stylePart: string;
    rawApertureLook: string;
    safeApertureLook: string;
    apertureSanitized: boolean;
    stagingDensityTier: string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

export const buildVisualizationPrompt = (params: BalancedV4_1PromptParams): BuiltBalancedV4_1Prompt => {
    const { roomType, stylePreset, textPrompt, hasInjectedItem } = params;

    // ── Step 1: Validate required fields ─────────────────────────────────────
    requireString(stylePreset?.name, 'stylePreset.name');
    requireString(roomType, 'roomType');
    requireNonEmptyArray(stylePreset?.model_inputs?.core_materials, 'stylePreset.model_inputs.core_materials');
    requireNonEmptyArray(stylePreset?.model_inputs?.color_palette, 'stylePreset.model_inputs.color_palette');
    requireString(stylePreset?.model_inputs?.lighting_style, 'stylePreset.model_inputs.lighting_style');
    requireString(stylePreset?.model_inputs?.material_finish, 'stylePreset.model_inputs.material_finish');
    const validatedSignatureElements = requireNonEmptyArray(stylePreset?.model_inputs?.signature_elements, 'stylePreset.model_inputs.signature_elements');

    // ── Step 2: Validate enum fields ──────────────────────────────────────────
    const rawDensity = stylePreset?.pipeline_config?.staging_density;
    const densityTier: string = rawDensity ?? 'medium';
    if (!['low', 'medium', 'high'].includes(densityTier)) {
        throw new PromptInjectionError(
            `Invalid staging_density value '${densityTier}'. Must be 'low', 'medium', or 'high'.`,
        );
    }

    // ── Step 3: Resolve registry lookups ─────────────────────────────────────
    const roomEntry = getRoomTypeEntry(roomType);
    if (!roomEntry) {
        throw new PromptInjectionError(
            `Room type '${roomType}' is not registered in ROOM_TYPE_REGISTRY. ` +
            `Registered types: bedroom, living_room, kitchen, dining_room, home_office, bathroom.`,
        );
    }

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
    let rendered = BALANCED_V4_1_STYLE_TEMPLATE
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
        rendered = rendered.replace('{{INJECTED_ITEM_AUDIT_BLOCK}}', INJECTED_ITEM_AUDIT_TEXT);
    } else {
        rendered = rendered.replace('\n{{INJECTED_ITEM_AUDIT_BLOCK}}', '');
    }

    // ── Step 9: Post-injection validation ─────────────────────────────────────
    validateNoUnresolvedPlaceholders(rendered, 'stylePart');

    const structuralPart = BALANCED_V4_1_STRUCTURAL_PART;

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

export const buildInfluencePrompt = (
    moodBoardImagesCount: number,
    styleInfluence: number,
    stylePresetName: string,
): string => {
    if (moodBoardImagesCount > 0) {
        if (styleInfluence < 33) return INFLUENCE_PRIORITIZE_PRESET_STYLE.replace(/\{\{STYLE_NAME\}\}/g, stylePresetName);
        if (styleInfluence > 66) return INFLUENCE_PRIORITIZE_MOOD_BOARD;
        return INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD.replace(/\{\{STYLE_NAME\}\}/g, stylePresetName);
    }
    return INFLUENCE_PRESET_STYLE_ONLY;
};



