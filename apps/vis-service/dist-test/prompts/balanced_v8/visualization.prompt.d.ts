import type { StylePreset } from '../../shared/types/index.js';
export declare class PromptInjectionError extends Error {
    constructor(message: string);
}
export interface BalancedV8PromptParams {
    roomType: string;
    stylePreset: StylePreset;
    textPrompt: string;
    hasInjectedItem: boolean;
}
export interface BuiltBalancedV8Prompt {
    structuralPart: string;
    stylePart: string;
    rawApertureLook: string;
    safeApertureLook: string;
    apertureSanitized: boolean;
    stagingDensityTier: string;
}
export declare const buildVisualizationPrompt: (params: BalancedV8PromptParams) => BuiltBalancedV8Prompt;
export declare const buildInfluencePrompt: (moodBoardImagesCount: number, _styleInfluence: number, _stylePresetName: string) => string;
export declare const buildMoodboardBlock: (styleName: string, _stagingDensity: "low" | "medium" | "high", hasMoodboards: boolean) => string;
//# sourceMappingURL=visualization.prompt.d.ts.map