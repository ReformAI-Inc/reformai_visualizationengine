import type { GenerateVisualizationParams } from '../../shared/types/index.js';

export type PipelineMode = NonNullable<GenerateVisualizationParams['pipelineMode']>;

export const resolvePipelineMode = (
    pipelineMode?: GenerateVisualizationParams['pipelineMode'],
): PipelineMode => pipelineMode ?? 'balanced_v7';

// Explicit handler aliases. An aliased mode stays a distinct, valid request mode
// (kept for comparison workflows and historical manifests) but executes another
// version's handler. The dispatcher records both modes in the debug payload.
const HANDLER_ALIASES: Partial<Record<PipelineMode, PipelineMode>> = {
    balanced_v6: 'balanced_v5',
};

export const resolveHandlerMode = (mode: PipelineMode): PipelineMode =>
    HANDLER_ALIASES[mode] ?? mode;

export const resolveDispatchModes = (
    pipelineMode?: GenerateVisualizationParams['pipelineMode'],
): { logMode: PipelineMode; handlerMode: PipelineMode } => {
    const logMode = resolvePipelineMode(pipelineMode);
    const handlerMode = resolveHandlerMode(logMode);
    return { logMode, handlerMode };
};

// Legacy modes (balanced_v1..v4_1, improved_current) archived 2026-07-02 —
// see archive/legacy-pipelines/. Requests naming them now fail validation.
const VALID_PIPELINE_MODES: PipelineMode[] = [
    'baseline_original',
    'balanced_v5',
    'balanced_v6',
    'balanced_v7',
    'balanced_v7_nb2',
    'balanced_v8',
];

export const normalizePipelineModeInput = (pipelineMode: unknown): PipelineMode => {
    if (pipelineMode === undefined || pipelineMode === null || pipelineMode === '') {
        return 'balanced_v7';
    }
    if (typeof pipelineMode !== 'string') {
        throw new Error(`Unsupported pipeline mode type: ${typeof pipelineMode}`);
    }
    if (!VALID_PIPELINE_MODES.includes(pipelineMode as PipelineMode)) {
        throw new Error(`Unsupported pipeline mode: ${pipelineMode}`);
    }
    return pipelineMode as PipelineMode;
};


