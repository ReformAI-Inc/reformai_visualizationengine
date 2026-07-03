import {
    MAIN_PROMPT_ROOM_REDESIGN,
    MAIN_PROMPT_IMAGE_REFINEMENT,
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    INSTRUCTION_INTEGRATE_FURNITURE,
    DEFAULT_USER_REQUEST,
    GEOMETRY_PRESERVATION_PROTOCOL,
    PHASE_ANCHOR_STRUCTURE,
    PHASE_ANCHOR_STRUCTURE_V2,
    PHASE_ANCHOR_STYLE,
    BEHAVIORAL_CONSTRAINTS,
    PROTOCOL_RIGID_BASE,
    PROTOCOL_RIGID_APERTURE_LOCK,
    PROTOCOL_SURFACE_ONLY_TRANSFORM,
    GLOBAL_STYLE_CONSTRAINTS,
    LIGHTING_GEOMETRY_SAFETY,
} from './visualization.constants.js';
import { StylePreset } from '../../shared/types/index.js';

export interface VisualizationPromptParams {
    isRefinement: boolean;
    roomType: string;
    stylePresetName: string;
    influencePrompt: string;
    textPrompt: string;
    furniturePrompt: string;
    geometryPreservation: boolean;
    phaseAnchoring: boolean;
    phaseAnchoringV2: boolean;
    stylePreset: StylePreset;
    pipelineMode?: string;
}

export interface BuiltVisualizationPrompt {
    fullPrompt: string;
    structuralPart?: string;
    stylePart?: string;
}

const buildBulletedStyleBlock = (modelInputs: StylePreset['model_inputs']): string => {
    const lines = [
        '**STYLE DEFINITION:**',
        'Style Materials:',
        ...modelInputs.core_materials.map((m: string) => `- ${m}`),
        '',
        'Color Palette:',
        ...modelInputs.color_palette.map((c: string) => `- ${c}`),
        '',
        `Lighting: - ${modelInputs.lighting_style}`,
        '',
        `Material Finish: - ${modelInputs.material_finish}`
    ];

    if (modelInputs.aperture_look) {
        lines.push('', `Aperture Look: - ${modelInputs.aperture_look}`);
    }

    lines.push('', 'Do Not:');
    lines.push(...modelInputs.dont.map((d: string) => `- ${d}`));

    return lines.join('\n');
};

const getProtocolInstructions = (protocol: string): string => {
    switch (protocol) {
        case 'rigid_aperture_lock':
            return PROTOCOL_RIGID_APERTURE_LOCK;
        case 'surface_only_transform':
            return PROTOCOL_SURFACE_ONLY_TRANSFORM;
        case 'rigid_base':
        default:
            return PROTOCOL_RIGID_BASE;
    }
};

const buildImprovedPrompt = (params: VisualizationPromptParams): BuiltVisualizationPrompt => {
    const {
        roomType,
        stylePreset,
        textPrompt,
        phaseAnchoringV2,
    } = params;

    const styleBlock = buildBulletedStyleBlock(stylePreset.model_inputs);
    const protocolInstructions = getProtocolInstructions(stylePreset.pipeline_config.structural_protocol);

    return {
        fullPrompt: '', // Not used in phase anchoring
        structuralPart: phaseAnchoringV2 ? PHASE_ANCHOR_STRUCTURE_V2 : PHASE_ANCHOR_STRUCTURE,
        stylePart: PHASE_ANCHOR_STYLE
            .replace(/\{\{ROOM_TYPE\}\}/g, roomType)
            .replace(/\{\{STYLE_NAME\}\}/g, stylePreset.name)
            .replace(/\{\{USER_REQUEST\}\}/g, textPrompt || DEFAULT_USER_REQUEST)
            .replace(/\{\{STYLE_BLOCK\}\}/g, styleBlock)
            .replace(/\{\{BEHAVIORAL_CONSTRAINTS\}\}/g, BEHAVIORAL_CONSTRAINTS)
            .replace(/\{\{GLOBAL_STYLE_CONSTRAINTS\}\}/g, GLOBAL_STYLE_CONSTRAINTS)
            .replace(/\{\{PROTOCOL_INSTRUCTIONS\}\}/g, protocolInstructions)
            .replace(/\{\{LIGHTING_GEOMETRY_SAFETY\}\}/g, LIGHTING_GEOMETRY_SAFETY)
    };
};

const buildBaselinePrompt = (params: VisualizationPromptParams): BuiltVisualizationPrompt => {
    const {
        isRefinement,
        roomType,
        stylePreset,
        influencePrompt,
        textPrompt,
        furniturePrompt,
    } = params;

    const template = isRefinement ? MAIN_PROMPT_IMAGE_REFINEMENT : MAIN_PROMPT_ROOM_REDESIGN;

    const fullPrompt = template
        .replace(/\{\{ROOM_TYPE\}\}/g, roomType)
        .replace(/\{\{STYLE_NAME\}\}/g, stylePreset.name)
        .replace(/\{\{INFLUENCE_INSTRUCTION\}\}/g, influencePrompt)
        .replace(/\{\{GEOMETRY_PROTOCOL\}\}/g, '') // Baseline has no geometry preservation
        .replace(/\{\{USER_REQUEST\}\}/g, textPrompt || DEFAULT_USER_REQUEST)
        .replace(/\{\{FURNITURE_INSTRUCTION\}\}/g, furniturePrompt);

    return { fullPrompt };
};

export const buildVisualizationPrompt = (params: VisualizationPromptParams): BuiltVisualizationPrompt => {
    if (params.pipelineMode === 'baseline_original') {
        return buildBaselinePrompt(params);
    }

    // Default to improved (including phase anchoring logic)
    if (params.phaseAnchoring || params.phaseAnchoringV2) {
        return buildImprovedPrompt(params);
    }

    // Fallback if phase anchoring is off but improved mode is on
    return buildBaselinePrompt({ ...params, geometryPreservation: params.geometryPreservation });
};

export const buildInfluencePrompt = (
    moodBoardImagesCount: number,
    styleInfluence: number,
    stylePresetName: string
): string => {
    if (moodBoardImagesCount > 0) {
        if (styleInfluence < 33) {
            return INFLUENCE_PRIORITIZE_PRESET_STYLE.replace(/\{\{STYLE_NAME\}\}/g, stylePresetName);
        } else if (styleInfluence > 66) {
            return INFLUENCE_PRIORITIZE_MOOD_BOARD;
        } else {
            return INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD.replace(/\{\{STYLE_NAME\}\}/g, stylePresetName);
        }
    }
    return INFLUENCE_PRESET_STYLE_ONLY;
};

export const buildFurniturePrompt = (hasFurnitureImage: boolean, roomType: string): string => {
    if (!hasFurnitureImage) {
        return '';
    }

    return INSTRUCTION_INTEGRATE_FURNITURE.replace(/\{\{ROOM_TYPE\}\}/g, roomType);
};



