import * as baselineService from '../legacy-services/baseline/geminiService.js';
import * as improvedService from '../legacy-services/improved/geminiService.js';
import * as balancedService from '../legacy-services/balanced/geminiService.js';
import * as balancedV2Service from '../legacy-services/balanced_v2/geminiService.js';
import * as balancedV2_1Service from '../legacy-services/balanced_v2_1/geminiService.js';
import * as balancedV2_2Service from '../legacy-services/balanced_v2_2/geminiService.js';
import * as balancedV3_0Service from '../legacy-services/balanced_v3_0/geminiService.js';
import * as balancedV4_0Service from '../legacy-services/balanced_v4_0/geminiService.js';
import * as balancedV4_1Service from '../legacy-services/balanced_v4_1/geminiService.js';
import * as balancedV5Service from '../versions/balanced-v5/index.js';
import * as balancedV7Service from '../versions/balanced-v7/index.js';
import * as balancedV8Service from '../versions/balanced-v8/index.js';
import { resolveDispatchModes, resolveHandlerMode, resolvePipelineMode } from './pipeline-routing.js';
const PIPELINE_HANDLERS = {
    baseline_original: baselineService.generateVisualization,
    balanced_v1: balancedService.generateVisualization,
    balanced_v2: balancedV2Service.generateVisualization,
    balanced_v2_1: balancedV2_1Service.generateVisualization,
    balanced_v2_2: balancedV2_2Service.generateVisualization,
    balanced_v3_0: balancedV3_0Service.generateVisualization,
    balanced_v4_0: balancedV4_0Service.generateVisualization,
    balanced_v4_1: balancedV4_1Service.generateVisualization,
    balanced_v5: balancedV5Service.generateVisualization,
    balanced_v6: balancedV5Service.generateVisualization, // aliased: resolveHandlerMode maps balanced_v6 -> balanced_v5
    balanced_v7: balancedV7Service.generateVisualization,
    balanced_v8: balancedV8Service.generateVisualization,
    improved_current: improvedService.generateVisualization,
};
const PIPELINE_LOGS = {
    baseline_original: '[Dispatcher] Routing to BASELINE pipeline',
    balanced_v1: '[Dispatcher] Routing to BALANCED V1 pipeline',
    balanced_v2: '[Dispatcher] Routing to BALANCED V2 pipeline',
    balanced_v2_1: '[Dispatcher] Routing to BALANCED V2.1 pipeline',
    balanced_v2_2: '[Dispatcher] Routing to BALANCED V2.2 pipeline',
    balanced_v3_0: '[Dispatcher] Routing to BALANCED V3.0 pipeline',
    balanced_v4_0: '[Dispatcher] Routing to BALANCED V4.0 pipeline',
    balanced_v4_1: '[Dispatcher] Routing to BALANCED V4.1 pipeline',
    balanced_v5: '[Dispatcher] Routing to BALANCED V5 pipeline (Lean V5 - moodboard integration)',
    balanced_v6: '[Dispatcher] Routing BALANCED V6 (explicit alias of V5 handler)',
    balanced_v7: '[Dispatcher] Routing to BALANCED V7 pipeline (AGT confidence-gated enforcement)',
    balanced_v8: '[Dispatcher] Routing to BALANCED V8 pipeline (catalogue-first, installer framing)',
    improved_current: '[Dispatcher] Routing to IMPROVED pipeline',
};
export const getPipelineHandlerForMode = (mode) => PIPELINE_HANDLERS[resolveHandlerMode(mode)];
export const dispatchWithHandlers = async (params, handlers) => {
    const mode = resolvePipelineMode(params.pipelineMode);
    const handlerMode = resolveHandlerMode(mode);
    return handlers[handlerMode](params);
};
export const generateVisualization = async (params) => {
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
//# sourceMappingURL=pipeline-dispatcher.js.map