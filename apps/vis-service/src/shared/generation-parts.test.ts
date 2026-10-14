import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeInjectedItems } from './generation-parts.js';
import { MAX_INJECTED_ITEMS } from './injected-items.constants.js';
import { ValidationError } from './validation/validation.utils.js';
import type { GenerateVisualizationParams, InjectedItem } from './types/core.js';

const fakeImage = (name: string) => ({
    fieldname: name,
    filename: `${name}.png`,
    mimetype: 'image/png',
    buffer: Buffer.from(name),
}) as unknown as InjectedItem['image'];

const items = (count: number): InjectedItem[] =>
    Array.from({ length: count }, (_, i) => ({ image: fakeImage(`product-${i + 1}`) }));

const request = (overrides: Partial<GenerateVisualizationParams>): GenerateVisualizationParams => ({
    roomImage: fakeImage('room'),
    roomType: 'living_room',
    stylePreset: { name: 'modern' } as GenerateVisualizationParams['stylePreset'],
    moodBoardImages: [],
    textPrompt: '',
    styleInfluence: 50,
    ...overrides,
});

describe('normalizeInjectedItems', () => {
    test('the limit is 5', () => {
        assert.equal(MAX_INJECTED_ITEMS, 5);
    });

    test('no items → empty, inactive', () => {
        const result = normalizeInjectedItems(request({}), 'balanced_v7');
        assert.deepEqual(result.injectedItems, []);
        assert.equal(result.hasInjectedItem, false);
        assert.equal(result.shimmedFromFurnitureImage, false);
    });

    test('1 item passes through unchanged', () => {
        const one = items(1);
        const result = normalizeInjectedItems(request({ injectedItems: one }), 'balanced_v7');
        assert.equal(result.injectedItems.length, 1);
        assert.equal(result.injectedItems[0], one[0]);
        assert.equal(result.hasInjectedItem, true);
    });

    test('legacy furnitureImage is shimmed into a single item', () => {
        const furniture = fakeImage('sofa');
        const result = normalizeInjectedItems(request({ furnitureImage: furniture }), 'balanced_v7');
        assert.equal(result.injectedItems.length, 1);
        assert.equal(result.injectedItems[0].image, furniture);
        assert.equal(result.shimmedFromFurnitureImage, true);
    });

    test('5 items (the maximum) are accepted in order', () => {
        const five = items(5);
        for (const mode of ['balanced_v5', 'balanced_v7', 'balanced_v8'] as const) {
            const result = normalizeInjectedItems(request({ injectedItems: five }), mode);
            assert.deepEqual(result.injectedItems, five, `${mode} keeps all 5 in order`);
            assert.equal(result.hasInjectedItem, true);
        }
    });

    test('6 items is a ValidationError (→ 400), not a generic Error (→ 500)', () => {
        assert.throws(
            () => normalizeInjectedItems(request({ injectedItems: items(6) }), 'balanced_v7'),
            (error: unknown) =>
                error instanceof ValidationError &&
                /maximum of 5 injected items/.test(error.message) &&
                /Received 6/.test(error.message),
        );
    });
});
