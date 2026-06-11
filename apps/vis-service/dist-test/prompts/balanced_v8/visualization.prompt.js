// ============================================================
// BALANCED V8 — PROMPT BUILDER
//
// Significantly simpler than V5's builder:
//   - No staging density validation (not used in catalogue-first flow)
//   - No core_materials / color_palette / signature_elements required
//   - Style is ambient context — only style name is consumed
//   - Room type is used for furnishing guidance only (no registry lookup required)
//   - Returns debug-compatible shape with n/a sentinels for unused V5 fields
// ============================================================
import { TEMPLATE_VERSION, BALANCED_V8_STRUCTURAL_PART, buildV8StylePart, buildMoodboardScopeBlock, V5_MOODBOARD_INFLUENCE_STATEMENT, INFLUENCE_PRESET_STYLE_ONLY, } from './visualization.constants.js';
export class PromptInjectionError extends Error {
    constructor(message) {
        super(`[PromptInjectionError v${TEMPLATE_VERSION}] ${message}`);
        this.name = 'PromptInjectionError';
    }
}
export const buildVisualizationPrompt = (params) => {
    const { roomType, stylePreset, textPrompt } = params;
    if (typeof roomType !== 'string' || roomType.trim() === '') {
        throw new PromptInjectionError(`Required field 'roomType' is missing or empty.`);
    }
    const styleName = stylePreset?.name?.trim() || null;
    return {
        structuralPart: BALANCED_V8_STRUCTURAL_PART,
        stylePart: buildV8StylePart(styleName, roomType.trim(), textPrompt),
        rawApertureLook: '',
        safeApertureLook: '',
        apertureSanitized: false,
        stagingDensityTier: 'n/a',
    };
};
// V8 ignores styleInfluence slider — branching is on moodboard presence only.
export const buildInfluencePrompt = (moodBoardImagesCount, _styleInfluence, _stylePresetName) => {
    return moodBoardImagesCount > 0
        ? V5_MOODBOARD_INFLUENCE_STATEMENT
        : INFLUENCE_PRESET_STYLE_ONLY;
};
// V8 uses medium density for moodboard scope (no staging density in catalogue flow).
export const buildMoodboardBlock = (styleName, _stagingDensity, hasMoodboards) => {
    if (!hasMoodboards)
        return '';
    return buildMoodboardScopeBlock(styleName, 'medium');
};
//# sourceMappingURL=visualization.prompt.js.map