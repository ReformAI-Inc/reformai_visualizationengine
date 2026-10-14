// Prompt/parts assembly for the default pipeline (balanced_v7) — pure, no Gemini calls.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assembleBalancedV7Parts } from './index.js';
import { normalizeInjectedItems } from '../../../shared/generation-parts.js';
import { classifyAGTConfidence } from '../../../guardrails/classify.js';
import { FALLBACK_AGT } from '../../../guardrails/extract.js';
import { STYLE_REGISTRY } from '../../../shared/styles.registry.js';
import {
    INJECTED_ITEM_BLOCK_HEADER,
    INJECTED_ITEM_AUDIT_TEXT,
} from '../../../prompts/balanced_v7/visualization.constants.js';
import type { GenerateVisualizationParams, InjectedItem } from '../../../shared/types/index.js';
import type { GeminiPart } from '../../../shared/generation-parts.js';

const image = (name: string) => ({
    fieldname: name,
    filename: `${name}.png`,
    mimetype: 'image/png',
    buffer: Buffer.from(name),
}) as unknown as GenerateVisualizationParams['roomImage'];

const request = (overrides: Partial<GenerateVisualizationParams> = {}): GenerateVisualizationParams => ({
    roomImage: image('room'),
    roomType: 'living_room',
    stylePreset: STYLE_REGISTRY[0],
    moodBoardImages: [],
    textPrompt: 'Paint the walls light grey.',
    styleInfluence: 50,
    ...overrides,
});

const assemble = (params: GenerateVisualizationParams) => {
    const { injectedItems } = normalizeInjectedItems(params, 'balanced_v7');
    return assembleBalancedV7Parts({
        params,
        injectedItems,
        classifiedAGT: classifyAGTConfidence(FALLBACK_AGT),
        resolvedRenovationSelections: null,
    });
};

const texts = (parts: GeminiPart[]) =>
    parts.filter((p): p is { text: string } => 'text' in p).map(p => p.text);

const decodedImages = (parts: GeminiPart[]) =>
    parts
        .filter((p): p is { inlineData: { data: string; mimeType: string } } => 'inlineData' in p)
        .map(p => Buffer.from(p.inlineData.data, 'base64').toString());

describe('balanced_v7 parts assembly', () => {
    test('one item (legacy furnitureImage): singular prompt, unchanged V4 label', () => {
        const { parts, stylePart } = assemble(request({ furnitureImage: image('sofa') }));
        const t = texts(parts);

        assert.equal(t.filter(x => x === INJECTED_ITEM_BLOCK_HEADER).length, 1);
        const headerIdx = parts.findIndex(p => 'text' in p && p.text === INJECTED_ITEM_BLOCK_HEADER);
        assert.deepEqual(parts[headerIdx + 1], {
            text: '[INJECTED ITEM 1] — preserve identity exactly as shown in this image.',
        });
        assert.deepEqual(parts[headerIdx + 2], {
            inlineData: { data: Buffer.from('sofa').toString('base64'), mimeType: 'image/png' },
        });

        assert.ok(stylePart.includes(INJECTED_ITEM_AUDIT_TEXT), 'singular audit text');
        assert.ok(t.some(x => x.includes('[ACTIVE — 1 injected item present]')));
        assert.ok(!t.some(x => x.includes('[PRODUCT ')), 'no plural labels');
        assert.deepEqual(decodedImages(parts), ['room', 'sofa', 'room']);
    });

    test('one item via productImages path is identical to furnitureImage path', () => {
        const viaFurniture = assemble(request({ furnitureImage: image('sofa') })).parts;
        const viaInjected = assemble(request({ injectedItems: [{ image: image('sofa') }] })).parts;
        assert.deepEqual(viaInjected, viaFurniture);
    });

    test('three items: three labeled image parts and a plural instruction', () => {
        const injectedItems: InjectedItem[] = [
            { image: image('sofa'), description: 'Sofá Cusco — sofa, grey linen' },
            { image: image('lamp'), description: 'Lámpara Nórdica — floor lamp' },
            { image: image('rug') },
        ];
        const { parts, stylePart } = assemble(request({ injectedItems }));
        const t = texts(parts);

        // Plural header + hierarchy + audit; the singular text is gone.
        const header = t.find(x => x.startsWith('**INJECTED PRODUCTS'));
        assert.ok(header, 'plural header present');
        assert.match(header!, /EVERY one of the 3 products MUST appear in the final output — exactly once each/);
        assert.match(header!, /Duplicate a product/);
        assert.ok(!t.includes(INJECTED_ITEM_BLOCK_HEADER));
        assert.ok(t.some(x => x.includes('[ACTIVE — 3 injected items present]')));
        assert.match(stylePart, /Are ALL 3 referenced products present/);
        assert.ok(!stylePart.includes(INJECTED_ITEM_AUDIT_TEXT));

        // Each product: label immediately followed by its own image, in order.
        const headerIdx = parts.findIndex(p => 'text' in p && p.text === header);
        const expected = [
            ['[PRODUCT 1: Sofá Cusco — sofa, grey linen]', 'sofa'],
            ['[PRODUCT 2: Lámpara Nórdica — floor lamp]', 'lamp'],
            ['[PRODUCT 3]', 'rug'],
        ];
        expected.forEach(([label, name], i) => {
            const labelPart = parts[headerIdx + 1 + i * 2];
            const imagePart = parts[headerIdx + 2 + i * 2];
            assert.ok('text' in labelPart && labelPart.text.startsWith(`${label} — product reference ${i + 1} of 3.`));
            assert.ok('inlineData' in imagePart && Buffer.from(imagePart.inlineData.data, 'base64').toString() === name);
        });

        assert.deepEqual(decodedImages(parts), ['room', 'sofa', 'lamp', 'rug', 'room']);
    });

    test('five items is accepted; six is rejected before any model call', () => {
        const five = Array.from({ length: 5 }, (_, i) => ({ image: image(`p${i + 1}`) }));
        const { parts } = assemble(request({ injectedItems: five }));
        assert.equal(texts(parts).filter(x => x.startsWith('[PRODUCT ')).length, 5);

        const six = [...five, { image: image('p6') }];
        assert.throws(() => assemble(request({ injectedItems: six })), /maximum of 5 injected items/);
    });
});
