export const resolvePipelineMode = (pipelineMode) => pipelineMode ?? 'balanced_v7';
export const resolveHandlerMode = (mode) => mode;
export const resolveDispatchModes = (pipelineMode) => {
    const logMode = resolvePipelineMode(pipelineMode);
    const handlerMode = resolveHandlerMode(logMode);
    return { logMode, handlerMode };
};
const VALID_PIPELINE_MODES = [
    'baseline_original',
    'balanced_v1',
    'balanced_v2',
    'balanced_v2_1',
    'balanced_v2_2',
    'balanced_v3_0',
    'balanced_v4_0',
    'balanced_v4_1',
    'balanced_v5',
    'balanced_v6',
    'balanced_v7',
    'balanced_v8',
    'improved_current',
];
export const normalizePipelineModeInput = (pipelineMode) => {
    if (pipelineMode === undefined || pipelineMode === null || pipelineMode === '') {
        return 'balanced_v7';
    }
    if (typeof pipelineMode !== 'string') {
        throw new Error(`Unsupported pipeline mode type: ${typeof pipelineMode}`);
    }
    if (!VALID_PIPELINE_MODES.includes(pipelineMode)) {
        throw new Error(`Unsupported pipeline mode: ${pipelineMode}`);
    }
    return pipelineMode;
};
//# sourceMappingURL=pipeline-routing.js.map