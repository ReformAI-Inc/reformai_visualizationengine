import { z } from 'zod';

export const stylePresetSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, 'El nombre del preset es requerido'),
    model_inputs: z.object({
        core_materials: z.array(z.string()).optional().default([]),
        color_palette: z.array(z.string()).optional().default([]),
        lighting_style: z.string().optional().default(''),
        material_finish: z.string().optional().default(''),
        aperture_look: z.string().optional().default(''),
        dont: z.array(z.string()).optional().default([]),
        signature_elements: z.array(z.string()).optional().default([]),
    }).optional().default({
        core_materials: [], color_palette: [], lighting_style: '',
        material_finish: '', aperture_look: '', dont: [], signature_elements: [],
    }),
    pipeline_config: z.object({
        structural_protocol: z.string().optional().default('rigid_base'),
        staging_density: z.enum(['low', 'medium', 'high']).optional(),
    }).optional().default({ structural_protocol: 'rigid_base' }),
    conflict_resolution: z.array(z.string()).optional(),
    imageUrl: z.union([z.string().url(), z.literal(''), z.undefined()]).optional(),
});

export const renovationSelectionIdsSchema = z.object({
    flooring:    z.string().optional(),
    walls:       z.string().optional(),
    countertops: z.string().optional(),
    cabinets:    z.string().optional(),
}).optional();

export const generateVisualizationSchema = z.object({
    roomType: z.string().min(1, 'El tipo de habitación es requerido'),
    textPrompt: z.string().optional(),
    styleInfluence: z.number().min(0, 'La influencia del estilo debe ser minimo 0'),
    isRefinement: z.boolean().optional().default(false),
    geometryPreservation: z.boolean().optional().default(false),
    verifyAGT: z.boolean().optional().default(false),
    phaseAnchoring: z.boolean().optional().default(false),
    phaseAnchoringV2: z.boolean().optional().default(false),
    pipelineMode: z.enum([
        'baseline_original', 'balanced_v1', 'balanced_v2', 'balanced_v2_1', 'balanced_v2_2',
        'balanced_v3_0', 'balanced_v4_0', 'balanced_v4_1', 'balanced_v5', 'balanced_v6',
        'balanced_v7', 'balanced_v8', 'improved_current',
    ]).optional().default('balanced_v7'),
    stylePreset: stylePresetSchema,
    renovationSelectionIds: renovationSelectionIdsSchema,
});

export type StylePresetInput = z.infer<typeof stylePresetSchema>;
export type GenerateVisualizationInput = z.infer<typeof generateVisualizationSchema>;


