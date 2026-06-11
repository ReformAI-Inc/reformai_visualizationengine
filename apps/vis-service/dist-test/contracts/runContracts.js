import assert from 'node:assert/strict';
import { normalizePipelineModeInput, resolveDispatchModes, resolveHandlerMode, resolvePipelineMode, } from '../pipelines/core/pipeline-routing.js';
import { classifyAGTConfidence } from '../guardrails/classify.js';
import { composeCanonicalGenerationParts } from '../pipelines/core/pipeline-composer.js';
import { buildConstraintHierarchyBlock } from '../prompts/balanced_v7/visualization.constants.js';
import { dispatchWithHandlers } from '../pipelines/core/pipeline-dispatcher.js';
const fakeImage = (name) => ({
    fieldname: name,
    filename: `${name}.png`,
    encoding: '7bit',
    mimetype: 'image/png',
    file: {},
    fields: {},
    toBuffer: async () => Buffer.from('x'),
    buffer: Buffer.from('x'),
});
const baseRequest = {
    roomImage: fakeImage('room'),
    roomType: 'living_room',
    stylePreset: {
        name: 'Modern',
        model_inputs: {
            core_materials: ['white plaster'],
            color_palette: ['white'],
            lighting_style: 'soft',
            material_finish: 'matte',
            aperture_look: '',
            dont: [],
            signature_elements: ['clean lines'],
        },
        pipeline_config: { structural_protocol: 'rigid_base' },
    },
    moodBoardImages: [],
    textPrompt: '',
    styleInfluence: 50,
};
// ── Routing contracts ─────────────────────────────────────────────────────────
{
    const result = resolvePipelineMode(undefined);
    assert.equal(result, 'balanced_v7', 'default mode resolves to balanced_v7');
    console.log('PASS default mode resolves to balanced_v7');
}
{
    const result = resolveHandlerMode('balanced_v6');
    assert.equal(result, 'balanced_v5', 'balanced_v6 is an explicit alias of the balanced_v5 handler');
    console.log('PASS balanced_v6 aliases to balanced_v5 handler explicitly');
}
{
    const { logMode, handlerMode } = resolveDispatchModes('balanced_v6');
    assert.equal(logMode, 'balanced_v6', 'balanced_v6 keeps explicit log mode');
    assert.equal(handlerMode, 'balanced_v5', 'while executing the aliased balanced_v5 handler');
    console.log('PASS balanced_v6 keeps explicit log mode while executing aliased balanced_v5 handler');
}
{
    const result = resolveHandlerMode('balanced_v7');
    assert.equal(result, 'balanced_v7', 'balanced_v7 handler mode remains balanced_v7');
    console.log('PASS balanced_v7 handler mode remains balanced_v7');
}
// ── AGT classification contracts ──────────────────────────────────────────────
{
    const agt = {
        window_count: { value: 2, confidence: 'high', instances: [] },
        door_count: { value: 1, confidence: 'high', instances: [] },
        has_ceiling_fixture: { value: true, confidence: 'high' },
        has_built_in_niches: { value: false, confidence: 'medium' },
        camera_perspective: { value: 'corner', confidence: 'medium' },
        extraction_confidence_overall: 'high',
        uncertain_fields: [],
    };
    const result = classifyAGTConfidence(agt);
    assert.equal(result.window_count.enforcement, 'advisory', 'high-confidence count without instances should be advisory');
    assert.equal(result.door_count.enforcement, 'advisory', 'same for door_count');
    console.log('PASS AGT high-confidence counts downgrade when instances missing');
}
{
    const agt = {
        window_count: { value: 1, confidence: 'high', instances: [{ location: 'left wall', type: 'external_glazed' }] },
        door_count: { value: 1, confidence: 'high', instances: [{ location: 'rear', type: 'solid_door' }] },
        has_ceiling_fixture: { value: false, confidence: 'low' },
        has_built_in_niches: { value: false, confidence: 'low' },
        camera_perspective: { value: 'corner', confidence: 'medium' },
        extraction_confidence_overall: 'medium',
        uncertain_fields: [],
    };
    const result = classifyAGTConfidence(agt);
    assert.equal(result.window_count.enforcement, 'hard');
    assert.equal(result.door_count.enforcement, 'hard');
    console.log('PASS AGT high-confidence counts remain hard when instances match');
}
// ── Input normalization contracts ─────────────────────────────────────────────
{
    assert.throws(() => normalizePipelineModeInput('unknown_mode'), /Unsupported pipeline mode/, 'invalid mode should throw');
    console.log('PASS invalid mode input fails predictably');
}
// ── Dispatcher contracts ──────────────────────────────────────────────────────
{
    let calledWith = null;
    const fakeHandlers = Object.fromEntries(['baseline_original', 'balanced_v1', 'balanced_v2', 'balanced_v2_1', 'balanced_v2_2',
        'balanced_v3_0', 'balanced_v4_0', 'balanced_v4_1', 'balanced_v5', 'balanced_v6',
        'balanced_v7', 'improved_current'].map(k => [
        k,
        async (p) => {
            calledWith = k;
            return { image: '', debug: {} };
        },
    ]));
    await dispatchWithHandlers({ ...baseRequest, pipelineMode: 'balanced_v4_1' }, fakeHandlers);
    assert.equal(calledWith, 'balanced_v4_1', 'dispatcher routes explicit mode to expected handler');
    console.log('PASS dispatcher routes explicit mode to expected handler');
}
{
    let calledWith = null;
    const fakeHandlers = Object.fromEntries(['baseline_original', 'balanced_v1', 'balanced_v2', 'balanced_v2_1', 'balanced_v2_2',
        'balanced_v3_0', 'balanced_v4_0', 'balanced_v4_1', 'balanced_v5', 'balanced_v6',
        'balanced_v7', 'improved_current'].map(k => [
        k,
        async () => { calledWith = k; return { image: '', debug: {} }; },
    ]));
    await dispatchWithHandlers({ ...baseRequest, pipelineMode: undefined }, fakeHandlers);
    assert.equal(calledWith, 'balanced_v7', 'dispatcher uses balanced_v7 when mode omitted');
    console.log('PASS dispatcher uses balanced_v7 when mode omitted');
}
{
    let calledWith = null;
    const fakeHandlers = Object.fromEntries(['baseline_original', 'balanced_v1', 'balanced_v2', 'balanced_v2_1', 'balanced_v2_2',
        'balanced_v3_0', 'balanced_v4_0', 'balanced_v4_1', 'balanced_v5', 'balanced_v6',
        'balanced_v7', 'improved_current'].map(k => [
        k,
        async () => { calledWith = k; return { image: '', debug: {} }; },
    ]));
    await dispatchWithHandlers({ ...baseRequest, pipelineMode: 'balanced_v6' }, fakeHandlers);
    assert.equal(calledWith, 'balanced_v5', 'dispatcher resolves balanced_v6 to aliased balanced_v5 handler');
    console.log('PASS dispatcher resolves balanced_v6 to aliased balanced_v5 handler');
}
{
    const historicalModes = ['baseline_original', 'balanced_v1', 'balanced_v2', 'balanced_v2_1', 'balanced_v2_2', 'balanced_v3_0', 'balanced_v4_0', 'balanced_v4_1', 'improved_current'];
    for (const mode of historicalModes) {
        const called = [];
        const fakeHandlers = Object.fromEntries(['baseline_original', 'balanced_v1', 'balanced_v2', 'balanced_v2_1', 'balanced_v2_2',
            'balanced_v3_0', 'balanced_v4_0', 'balanced_v4_1', 'balanced_v5', 'balanced_v6',
            'balanced_v7', 'improved_current'].map(k => [
            k,
            async () => { called.push(k); return { image: '', debug: {} }; },
        ]));
        await dispatchWithHandlers({ ...baseRequest, pipelineMode: mode }, fakeHandlers);
        assert.equal(called[0], mode, `${mode} should route to itself`);
    }
    console.log('PASS historical benchmark modes remain callable in dispatcher');
}
// ── Composer contracts ────────────────────────────────────────────────────────
{
    const parts = composeCanonicalGenerationParts({
        request: baseRequest,
        common: {
            structuralPart: 'STRUCTURAL',
            stylePart: 'STYLE',
            moodboardScopeBlock: '',
            influencePrompt: 'INFLUENCE',
        },
        optional: {
            agtConstraintBlock: 'AGT_CONSTRAINT',
            agtEchoBlock: 'AGT_ECHO',
            constraintHierarchyBlock: 'HIERARCHY',
            renovationAnchorsBlock: '',
            injectedItemBlockHeader: '',
        },
        itemImage: null,
    });
    const textParts = parts
        .filter((p) => 'text' in p)
        .map(p => p.text);
    const agtIdx = textParts.indexOf('AGT_CONSTRAINT');
    const hierarchyIdx = textParts.indexOf('HIERARCHY');
    const structuralIdx = textParts.indexOf('STRUCTURAL');
    const styleIdx = textParts.indexOf('STYLE');
    const influenceIdx = textParts.indexOf('INFLUENCE');
    const echoIdx = textParts.indexOf('AGT_ECHO');
    assert.ok(agtIdx < hierarchyIdx && hierarchyIdx < structuralIdx && structuralIdx < styleIdx && styleIdx < influenceIdx && influenceIdx < echoIdx, 'canonical part order preserved');
    console.log('PASS canonical parts preserve expected ordering');
}
// ── V7 constraint hierarchy contracts ─────────────────────────────────────────
{
    const withFacts = buildConstraintHierarchyBlock(0, false, true);
    const withoutFacts = buildConstraintHierarchyBlock(0, false, false);
    assert.ok(withFacts.includes('Verified hard facts'), 'AGT line present when hard facts exist');
    assert.ok(!withoutFacts.includes('Verified hard facts'), 'AGT line absent when no hard facts');
    console.log('PASS V7 hierarchy inserts AGT line only with hard facts');
}
console.log(`\nContract checks passed: 13/13`);
//# sourceMappingURL=runContracts.js.map