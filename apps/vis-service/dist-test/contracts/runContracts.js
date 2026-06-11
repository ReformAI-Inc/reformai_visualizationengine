import assert from 'node:assert/strict';
import { normalizePipelineModeInput, resolveDispatchModes, resolveHandlerMode, resolvePipelineMode, } from '../pipelines/core/pipeline-routing.js';
import { classifyAGTConfidence } from '../guardrails/classify.js';
import { buildViolationFeedback, diffAGT } from '../guardrails/verify.js';
import { resolveProvider } from '../models/provider-registry.js';
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
// ── AGT verification contracts ────────────────────────────────────────────────
const hardInputAGT = {
    window_count: { value: 2, confidence: 'high', instances: [
            { location: 'left wall', type: 'external_glazed' },
            { location: 'rear wall', type: 'external_glazed' },
        ] },
    door_count: { value: 1, confidence: 'high', instances: [{ location: 'right wall', type: 'solid_door' }] },
    has_ceiling_fixture: { value: true, confidence: 'high' },
    has_built_in_niches: { value: false, confidence: 'high' },
    camera_perspective: { value: 'corner', confidence: 'high' },
    extraction_confidence_overall: 'high',
    uncertain_fields: [],
};
const hardInputClassified = classifyAGTConfidence(hardInputAGT);
const outputAGT = (overrides) => ({
    ...hardInputAGT,
    window_count: { ...hardInputAGT.window_count },
    door_count: { ...hardInputAGT.door_count },
    has_ceiling_fixture: { ...hardInputAGT.has_ceiling_fixture },
    has_built_in_niches: { ...hardInputAGT.has_built_in_niches },
    camera_perspective: { ...hardInputAGT.camera_perspective },
    ...overrides,
});
{
    const diff = diffAGT(hardInputAGT, hardInputClassified, outputAGT({}));
    assert.equal(diff.violations.length, 0, 'identical AGT produces no violations');
    assert.equal(diff.inconclusiveFields.length, 0, 'identical AGT is fully conclusive');
    console.log('PASS verify: identical AGT produces no violations');
}
{
    const diff = diffAGT(hardInputAGT, hardInputClassified, outputAGT({
        window_count: { value: 3, confidence: 'high', instances: [] },
    }));
    assert.equal(diff.violations.length, 1, 'hard window count mismatch violates');
    assert.equal(diff.violations[0].field, 'window_count');
    assert.ok(diff.violations[0].detail.includes('left wall'), 'violation carries spatial anchors');
    console.log('PASS verify: hard window-count mismatch produces violation with anchors');
}
{
    // Advisory input fact (high confidence but incomplete instances) must never violate.
    const advisoryInput = outputAGT({ window_count: { value: 2, confidence: 'high', instances: [] } });
    const advisoryClassified = classifyAGTConfidence(advisoryInput);
    const diff = diffAGT(advisoryInput, advisoryClassified, outputAGT({
        window_count: { value: 5, confidence: 'high', instances: [] },
    }));
    assert.equal(diff.violations.length, 0, 'advisory facts never violate');
    console.log('PASS verify: advisory input facts never violate');
}
{
    // Low-confidence OUTPUT extraction is inconclusive, not a violation.
    const diff = diffAGT(hardInputAGT, hardInputClassified, outputAGT({
        window_count: { value: 0, confidence: 'low', instances: [] },
    }));
    assert.equal(diff.violations.length, 0, 'low-confidence output never violates');
    assert.deepEqual(diff.inconclusiveFields, ['window_count'], 'field recorded as inconclusive');
    console.log('PASS verify: low-confidence output extraction is inconclusive, not violating');
}
{
    // Removing a hard-present boolean feature violates; adding one never does.
    const removed = diffAGT(hardInputAGT, hardInputClassified, outputAGT({
        has_ceiling_fixture: { value: false, confidence: 'high' },
    }));
    assert.equal(removed.violations.length, 1, 'removed ceiling fixture violates');
    const added = diffAGT(hardInputAGT, hardInputClassified, outputAGT({
        has_built_in_niches: { value: true, confidence: 'high' },
    }));
    assert.equal(added.violations.length, 0, 'added feature never violates');
    console.log('PASS verify: boolean removal violates, addition allowed');
}
{
    const diff = diffAGT(hardInputAGT, hardInputClassified, outputAGT({
        window_count: { value: 3, confidence: 'high', instances: [] },
    }));
    const feedback = buildViolationFeedback(diff.violations);
    assert.ok(feedback.includes('VIOLATION FEEDBACK'), 'feedback has correction header');
    assert.ok(feedback.includes('source room has 2'), 'feedback states expected count');
    assert.equal(buildViolationFeedback([]), '', 'no violations produces empty feedback');
    console.log('PASS verify: violation feedback block well-formed');
}
// ── Provider registry contracts ───────────────────────────────────────────────
{
    const providers = [{ id: 'gemini', supports: (m) => m.startsWith('gemini-') }];
    assert.equal(resolveProvider('gemini-2.5-flash-image', providers), 'gemini', 'current model routes to gemini');
    assert.equal(resolveProvider('gemini-3.1-flash-image', providers), 'gemini', 'NB2 model routes to gemini');
    assert.throws(() => resolveProvider('flux-2-pro', providers), /No provider registered/, 'unknown model id throws');
    console.log('PASS provider registry routes gemini-* and rejects unknown model ids');
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
console.log(`\nContract checks passed: 20/20`);
//# sourceMappingURL=runContracts.js.map