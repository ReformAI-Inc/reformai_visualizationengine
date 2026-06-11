// Core domain types used across the entire system.
// Types specific to a feature (AGT, catalogue) live in their own files.

import type { MultipartFile } from '@fastify/multipart';

export type ItemFidelityMode = 'preserve' | 'exact';

export interface InjectedItem {
    image: MultipartFile & { buffer: Buffer };
    fidelityMode?: ItemFidelityMode;
}

export interface StylePreset {
    id?: string;
    name: string;
    model_inputs: {
        core_materials: string[];
        color_palette: string[];
        lighting_style: string;
        material_finish: string;
        aperture_look: string;
        dont: string[];
        signature_elements?: string[];
    };
    pipeline_config: {
        structural_protocol: string;
        staging_density?: 'low' | 'medium' | 'high';
    };
    conflict_resolution?: string[];
    imageUrl?: string;
}

export interface GenerateVisualizationParams {
    roomImage: MultipartFile & { buffer: Buffer };
    roomType: string;
    stylePreset: StylePreset;
    moodBoardImages: (MultipartFile & { buffer: Buffer })[];
    furnitureImage?: (MultipartFile & { buffer: Buffer }) | null;
    injectedItems?: InjectedItem[];
    textPrompt: string;
    styleInfluence: number;
    isRefinement?: boolean;
    geometryPreservation?: boolean;
    phaseAnchoring?: boolean;
    phaseAnchoringV2?: boolean;
    pipelineMode?: 'baseline_original' | 'balanced_v1' | 'balanced_v2' | 'balanced_v2_1' | 'balanced_v2_2' | 'balanced_v3_0' | 'balanced_v4_0' | 'balanced_v4_1' | 'balanced_v5' | 'balanced_v6' | 'balanced_v7' | 'balanced_v8' | 'improved_current';
    previousResultImage?: (MultipartFile & { buffer: Buffer }) | null;
    contractorId?: string;
    renovationSelectionIds?: import('./catalogue.js').RenovationSelectionIds;
    verifyAGT?: boolean; // post-generation AGT verification + bounded retry (default off)
}


