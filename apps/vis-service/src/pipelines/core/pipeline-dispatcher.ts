import { GenerateVisualizationParams } from '../../shared/types/index.js';
import * as baselineService from '../legacy-services/baseline/geminiService.js';
import * as balancedV5Service from '../versions/balanced-v5/index.js';
import * as balancedV7Service from '../versions/balanced-v7/index.js';
import * as balancedV8Service from '../versions/balanced-v8/index.js';
import { resolveDispatchModes, resolveHandlerMode, resolvePipelineMode, type PipelineMode } from './pipeline-routing.js';

// Legacy modes balanced_v1..balanced_v4_1 and improved_current were archived
// 2026-07-02 (repo-root archive/legacy-pipelines/) ahead of the 2026-10-02
// gemini-2.5-flash-image shutdown they all hardcoded. baseline_original stays:
// it is the regression gate's fixed visual anchor.

// `model` is the image model that actually generated `image`, so callers can
// report it without knowing which pipeline or environment default applied.
export type PipelineResult = { image: string; model: string; debug: any };

type PipelineHandler = (params: GenerateVisualizationParams) => Promise<PipelineResult>;

const PIPELINE_HANDLERS: Record<PipelineMode, PipelineHandler> = {
    baseline_original: baselineService.generateVisualization,
    balanced_v5: balancedV5Service.generateVisualization,
    balanced_v6: balancedV5Service.generateVisualization, // aliased: resolveHandlerMode maps balanced_v6 -> balanced_v5
    balanced_v7: balancedV7Service.generateVisualization,
    balanced_v8: balancedV8Service.generateVisualization,
};

const PIPELINE_LOGS: Record<PipelineMode, string> = {
    baseline_original: '[Dispatcher] Routing to BASELINE pipeline (regression anchor)',
    balanced_v5: '[Dispatcher] Routing to BALANCED V5 pipeline (Lean V5 - moodboard integration)',
    balanced_v6: '[Dispatcher] Routing BALANCED V6 (explicit alias of V5 handler)',
    balanced_v7: '[Dispatcher] Routing to BALANCED V7 pipeline (AGT confidence-gated enforcement)',
    balanced_v8: '[Dispatcher] Routing to BALANCED V8 pipeline (catalogue-first, installer framing)',
};

export const getPipelineHandlerForMode = (mode: PipelineMode): PipelineHandler =>
    PIPELINE_HANDLERS[resolveHandlerMode(mode)];

export const dispatchWithHandlers = async (
    params: GenerateVisualizationParams,
    handlers: Record<PipelineMode, PipelineHandler>,
): Promise<PipelineResult> => {
    const mode = resolvePipelineMode(params.pipelineMode);
    const handlerMode = resolveHandlerMode(mode);
    return handlers[handlerMode](params);
};

export const generateVisualization = async (
    params: GenerateVisualizationParams,
): Promise<PipelineResult> => {
    const { logMode, handlerMode } = resolveDispatchModes(params.pipelineMode);
    console.log(PIPELINE_LOGS[logMode]);
    const result = await dispatchWithHandlers(params, PIPELINE_HANDLERS);
    if (logMode !== handlerMode) {
        return {
            ...result,
            debug: { ...result.debug, pipelineMode: logMode, aliasedToHandler: handlerMode },
        };
    }
    return result;
};


