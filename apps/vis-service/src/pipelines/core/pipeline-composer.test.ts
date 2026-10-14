import test from 'node:test';
import assert from 'node:assert/strict';
import { composeCanonicalGenerationParts } from './pipeline-composer.js';
import type { GenerateVisualizationParams } from '../../shared/types/index.js';

const fakeImage = (name: string) => ({
    fieldname: name,
    filename: `${name}.png`,
    encoding: '7bit',
    mimetype: 'image/png',
    file: {} as any,
    fields: {} as any,
    toBuffer: async () => Buffer.from('x'),
    buffer: Buffer.from('x'),
});

const baseRequest: GenerateVisualizationParams = {
    roomImage: fakeImage('room') as any,
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

test('keeps canonical core ordering with AGT and re-anchor blocks', () => {
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
        injectedItems: [],
    });

    const textParts = parts
        .filter((p): p is { text: string } => 'text' in p)
        .map(p => p.text);

    const agtIdx = textParts.indexOf('AGT_CONSTRAINT');
    const hierarchyIdx = textParts.indexOf('HIERARCHY');
    const structuralIdx = textParts.indexOf('STRUCTURAL');
    const styleIdx = textParts.indexOf('STYLE');
    const influenceIdx = textParts.indexOf('INFLUENCE');
    const echoIdx = textParts.indexOf('AGT_ECHO');

    assert.ok(agtIdx < hierarchyIdx, 'AGT constraint before hierarchy');
    assert.ok(hierarchyIdx < structuralIdx, 'hierarchy before structural');
    assert.ok(structuralIdx < styleIdx, 'structural before style');
    assert.ok(styleIdx < influenceIdx, 'style before influence');
    assert.ok(influenceIdx < echoIdx, 'influence before AGT echo');
});



const composeWithItems = (injectedItems: { image: any; description?: string }[]) =>
    composeCanonicalGenerationParts({
        request: baseRequest,
        common: {
            structuralPart: 'STRUCTURAL',
            stylePart: 'STYLE',
            moodboardScopeBlock: '',
            influencePrompt: 'INFLUENCE',
        },
        optional: {
            constraintHierarchyBlock: 'HIERARCHY',
            renovationAnchorsBlock: '',
            injectedItemBlockHeader: 'ITEM_HEADER',
        },
        injectedItems,
    });

const describeParts = (parts: ReturnType<typeof composeCanonicalGenerationParts>) =>
    parts.map(p => ('text' in p ? p.text : `IMAGE:${Buffer.from(p.inlineData.data, 'base64').toString()}`));

test('one item: header, V4 label, image — between style and influence', () => {
    const sequence = describeParts(composeWithItems([{ image: { ...fakeImage('sofa'), buffer: Buffer.from('sofa') } }]));
    const headerIdx = sequence.indexOf('ITEM_HEADER');
    assert.deepEqual(sequence.slice(headerIdx, headerIdx + 4), [
        'ITEM_HEADER',
        '[INJECTED ITEM 1] — preserve identity exactly as shown in this image.',
        'IMAGE:sofa',
        'INFLUENCE',
    ]);
    assert.equal(sequence.filter(s => s === 'ITEM_HEADER').length, 1);
});

test('three items: one header, then a labeled image part per item in caller order', () => {
    const img = (name: string) => ({ ...fakeImage(name), buffer: Buffer.from(name) });
    const sequence = describeParts(composeWithItems([
        { image: img('sofa'), description: 'Sofá Cusco — sofa, grey linen' },
        { image: img('lamp'), description: 'Lámpara Nórdica — floor lamp' },
        { image: img('rug') },
    ]));
    const headerIdx = sequence.indexOf('ITEM_HEADER');
    const block = sequence.slice(headerIdx, headerIdx + 8);
    assert.equal(block[0], 'ITEM_HEADER');
    assert.match(block[1], /^\[PRODUCT 1: Sofá Cusco — sofa, grey linen\] — product reference 1 of 3\./);
    assert.equal(block[2], 'IMAGE:sofa');
    assert.match(block[3], /^\[PRODUCT 2: Lámpara Nórdica — floor lamp\] — product reference 2 of 3\./);
    assert.equal(block[4], 'IMAGE:lamp');
    assert.match(block[5], /^\[PRODUCT 3\] — product reference 3 of 3\./);
    assert.equal(block[6], 'IMAGE:rug');
    assert.equal(block[7], 'INFLUENCE');
});

test('no items: no header and no item images', () => {
    const sequence = describeParts(composeWithItems([]));
    assert.ok(!sequence.includes('ITEM_HEADER'));
    assert.deepEqual(sequence.filter(s => s.startsWith('IMAGE:')), ['IMAGE:x', 'IMAGE:x']); // base + re-anchor
});
