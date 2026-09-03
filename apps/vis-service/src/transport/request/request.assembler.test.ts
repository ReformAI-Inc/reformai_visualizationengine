import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { resolveRegisteredStyle } from './request.assembler.js';
import { STYLE_REGISTRY } from '../../shared/styles.registry.js';
import type { StylePreset } from '../../shared/types/core.js';

const preset = (fields: Partial<StylePreset>): StylePreset => fields as StylePreset;

describe('resolveRegisteredStyle', () => {
    test('resolves the registry id sent in the name field (Reform-AI payload)', () => {
        // The exact shape production sends: {"name":"contemporary"} — a registry
        // id, lowercase, with no id field. This is what used to fall through and
        // 500 with "core_materials must be a non-empty array".
        const resolved = resolveRegisteredStyle(preset({ name: 'contemporary' }));

        assert.equal(resolved.name, 'Contemporary');
        assert.ok(
            resolved.model_inputs.core_materials.length > 0,
            'must arrive with the materials the V7 prompt builder requires',
        );
    });

    test('resolves the display name too (sandbox payload)', () => {
        const resolved = resolveRegisteredStyle(preset({ name: 'Contemporary' }));
        assert.equal(resolved.id, 'contemporary');
    });

    test('resolves by explicit id', () => {
        const resolved = resolveRegisteredStyle(preset({ id: 'japandi', name: 'whatever' }));
        assert.equal(resolved.name, 'Japandi');
    });

    test('ignores casing and surrounding whitespace', () => {
        const resolved = resolveRegisteredStyle(preset({ name: '  MIDCENTURY_MODERN ' }));
        assert.equal(resolved.id, 'midcentury_modern');
    });

    test('every registry style resolves from its id alone', () => {
        for (const style of STYLE_REGISTRY) {
            const resolved = resolveRegisteredStyle(preset({ name: style.id }));
            assert.equal(resolved.id, style.id, `${style.id} must resolve`);
            assert.ok(
                resolved.model_inputs.core_materials.length > 0,
                `${style.id} must carry core_materials`,
            );
        }
    });

    test('keeps the caller imageUrl rather than the registry one', () => {
        const resolved = resolveRegisteredStyle(
            preset({ name: 'modern', imageUrl: 'https://example.test/mine.jpg' }),
        );
        assert.equal(resolved.imageUrl, 'https://example.test/mine.jpg');
    });

    test('leaves an unknown style untouched so a bespoke preset still works', () => {
        const bespoke = preset({
            name: 'client-bespoke-2026',
            model_inputs: { core_materials: ['brushed brass'] } as StylePreset['model_inputs'],
        });

        const resolved = resolveRegisteredStyle(bespoke);

        assert.equal(resolved.name, 'client-bespoke-2026');
        assert.deepEqual(resolved.model_inputs.core_materials, ['brushed brass']);
    });

    test('returns the preset unchanged when it names nothing at all', () => {
        const empty = preset({ name: '' });
        assert.equal(resolveRegisteredStyle(empty), empty);
    });
});
