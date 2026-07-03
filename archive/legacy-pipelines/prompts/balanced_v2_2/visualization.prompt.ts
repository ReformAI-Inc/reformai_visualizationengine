import { StylePreset } from '../../shared/types/index.js';
import {
    BALANCED_V2_2_PHASE_1,
    STAGING_DENSITY_LOW,
    STAGING_DENSITY_MEDIUM,
    STAGING_DENSITY_HIGH,
    PRIORITY_HIERARCHY,
    STYLE_CONFLICT_RESOLUTION,
    BALANCED_V2_2_PHASE_2_HEADER,
    RENOVATION_CONTINUITY,
    FURNISHING_STRATEGY,
    OBJECT_JUSTIFICATION_RULE,
    MIRROR_PLACEMENT_RULE,
    STYLE_PRIORITY,
    MATERIAL_HIERARCHY_RULE,
    STAGING_QUALITY_RULE,
    RENOVATION_FEASIBILITY_RULES,
    LIGHTING_PRESERVATION_AND_NORMALIZATION,
    BALANCED_V2_2_PROTOCOL_RIGID_BASE,
    BALANCED_V2_2_PROTOCOL_RIGID_APERTURE_LOCK,
    BALANCED_V2_2_PROTOCOL_SURFACE_ONLY_TRANSFORM,
    SELF_AUDIT_CHECK,
    INPUT_CLEANUP_RULE,
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    INSTRUCTION_INTEGRATE_FURNITURE,
    DEFAULT_USER_REQUEST,
} from './visualization.constants.js';

export interface BalancedV2_2PromptParams {
    roomType: string;
    stylePresetName: string;
    stylePreset: StylePreset;
    influencePrompt: string;
    textPrompt: string;
    furniturePrompt: string;
    isRefinement?: boolean;
}

export interface BuiltBalancedV2_2Prompt {
    structuralPart: string;
    stylePart: string;
    fullPrompt: string;
    // Aperture sanitizer metadata — exposed in debug output
    rawApertureLook: string;
    safeApertureLook: string;
    apertureSanitized: boolean;
    // Staging density metadata — exposed in debug output
    stagingDensityTier: string;
}

// ── aperture sanitizer ────────────────────────────────────────────────────────
// Detects structural aperture terms in aperture_look and replaces them with a
// geometry-safe instruction. Non-structural values are passed through with a
// preservation suffix.

const STRUCTURAL_APERTURE_TERMS = [
    'divided-pane',
    'divided pane',
    'mullion',
    'arched',
    'arch',
    'steel-framed',
    'steel framed',
    'floor-to-ceiling',
    'floor to ceiling',
    'bay window',
    'colonial',
    'shoji',
    'new window',
    'enlarged window',
    'glazing band',
    // "grid" is intentionally omitted — too broad; catches "grid" in non-window contexts.
    // "steel" alone is also omitted for the same reason.
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

    const lower = raw.toLowerCase();
    const hasStructuralTerm = STRUCTURAL_APERTURE_TERMS.some(term => lower.includes(term));

    if (hasStructuralTerm) {
        return {
            safeApertureLook: SAFE_APERTURE_FALLBACK,
            apertureSanitized: true,
        };
    }

    return {
        safeApertureLook: raw.trimEnd() + SAFE_APERTURE_SUFFIX,
        apertureSanitized: false,
    };
};

// ── helpers ───────────────────────────────────────────────────────────────────

const buildStyleBlock = (
    modelInputs: StylePreset['model_inputs'],
    safeApertureLook: string,
): string => {
    const lines = [
        '**STYLE DEFINITION:**',
        'Style Materials:',
        ...(modelInputs?.core_materials ?? []).map((m: string) => `- ${m}`),
        '',
        'Color Palette:',
        ...(modelInputs?.color_palette ?? []).map((c: string) => `- ${c}`),
        '',
        `Lighting: ${modelInputs?.lighting_style ?? ''}`,
        `Material Finish: ${modelInputs?.material_finish ?? ''}`,
    ];

    // Use sanitized aperture_look — never the raw value
    if (safeApertureLook && safeApertureLook.trim() !== '') {
        lines.push(`Aperture Look: ${safeApertureLook}`);
    }

    if (modelInputs?.dont?.length) {
        lines.push('', 'Do Not:');
        lines.push(...(modelInputs.dont ?? []).map((d: string) => `- ${d}`));
    }

    return lines.join('\n');
};

const getProtocol = (protocol?: string): string => {
    switch (protocol) {
        case 'rigid_aperture_lock':    return BALANCED_V2_2_PROTOCOL_RIGID_APERTURE_LOCK;
        case 'surface_only_transform': return BALANCED_V2_2_PROTOCOL_SURFACE_ONLY_TRANSFORM;
        default:                       return BALANCED_V2_2_PROTOCOL_RIGID_BASE;
    }
};

// Resolved at build time — no conditional branching in the final prompt.
// Defaults to medium when staging_density is absent (safe fallback for older style objects).
const getStagingDensityBlock = (density?: string): string => {
    switch (density) {
        case 'low':  return STAGING_DENSITY_LOW;
        case 'high': return STAGING_DENSITY_HIGH;
        default:     return STAGING_DENSITY_MEDIUM;
    }
};

// ── builder ───────────────────────────────────────────────────────────────────

export const buildVisualizationPrompt = (params: BalancedV2_2PromptParams): BuiltBalancedV2_2Prompt => {
    const { roomType, stylePreset, textPrompt } = params;

    const rawApertureLook = stylePreset.model_inputs?.aperture_look ?? '';
    const { safeApertureLook, apertureSanitized } = sanitizeApertureLook(rawApertureLook);

    const styleBlock        = buildStyleBlock(stylePreset.model_inputs, safeApertureLook);
    const protocol          = getProtocol(stylePreset.pipeline_config?.structural_protocol);
    const stagingDensity    = getStagingDensityBlock(stylePreset.pipeline_config?.staging_density);
    const userRequest       = textPrompt?.trim() || DEFAULT_USER_REQUEST;

    // Phase 1: architectural anchor + window immutability + exterior view preservation
    //          + INPUT_CLEANUP_RULE (remove cables/clutter before style is applied)
    const structuralPart = [
        BALANCED_V2_2_PHASE_1,
        INPUT_CLEANUP_RULE,
    ].join('\n');

    // Phase 2 assembly order (15 blocks):
    //   Priority Hierarchy → Style Conflict Resolution → Header
    //   → Renovation Continuity → Furnishing Strategy → Staging Density [style-resolved]
    //   → Object Justification Rule (+ HIGH density group ext) → Mirror Placement Rule
    //   → Style Block (sanitized aperture_look) → Style Priority (+ failure conditions)
    //   → Material Hierarchy Rule [v2.3]
    //   → Staging Quality Rule (absorbs REALISM_CONSTRAINT + REALISM_FILTER)
    //   → Renovation Feasibility → Lighting (normalization + enhancement) [v2.3]
    //   → Structural Protocol → Self-Audit Check [v2.3, terminal]
    const stylePart = [
        PRIORITY_HIERARCHY,
        STYLE_CONFLICT_RESOLUTION,
        BALANCED_V2_2_PHASE_2_HEADER
            .replace(/\{\{ROOM_TYPE\}\}/g, roomType)
            .replace(/\{\{STYLE_NAME\}\}/g, stylePreset.name)
            .replace(/\{\{USER_REQUEST\}\}/g, userRequest),
        RENOVATION_CONTINUITY,
        FURNISHING_STRATEGY
            .replace(/\{\{ROOM_TYPE\}\}/g, roomType)
            .replace(/\{\{STYLE_NAME\}\}/g, stylePreset.name),
        stagingDensity,
        OBJECT_JUSTIFICATION_RULE,
        MIRROR_PLACEMENT_RULE,
        styleBlock,
        STYLE_PRIORITY,
        MATERIAL_HIERARCHY_RULE,
        STAGING_QUALITY_RULE,
        RENOVATION_FEASIBILITY_RULES,
        LIGHTING_PRESERVATION_AND_NORMALIZATION,
        protocol,
        SELF_AUDIT_CHECK
            .replace(/\{\{STYLE_NAME\}\}/g, stylePreset.name),
    ].join('\n');

    return {
        structuralPart,
        stylePart,
        fullPrompt: '',  // not used — parts sent separately
        rawApertureLook,
        safeApertureLook,
        apertureSanitized,
        stagingDensityTier: stylePreset.pipeline_config?.staging_density ?? 'medium',
    };
};

// ── influence / furniture (pass-through from improved) ────────────────────────

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

export const buildFurniturePrompt = (hasFurnitureImage: boolean, roomType: string): string => {
    if (!hasFurnitureImage) return '';
    return INSTRUCTION_INTEGRATE_FURNITURE.replace(/\{\{ROOM_TYPE\}\}/g, roomType);
};



