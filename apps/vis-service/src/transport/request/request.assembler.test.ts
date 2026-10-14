import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import type { Multipart } from '@fastify/multipart';
import {
    resolveRegisteredStyle,
    processVisualizationFormData,
    parseProductDescriptions,
    buildInjectedItems,
} from './request.assembler.js';
import { parseMultipartForm, classifyMultipartLimitError } from './multipart.parser.js';
import { ValidationError } from '../../shared/validation/validation.utils.js';
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


// ── Multipart helpers ─────────────────────────────────────────────────────────

type FakePart =
    | { type: 'file'; fieldname: string; filename: string; mimetype: string; data: string }
    | { type: 'field'; fieldname: string; value: string };

const file = (fieldname: string, name: string, mimetype = 'image/png'): FakePart =>
    ({ type: 'file', fieldname, filename: `${name}.png`, mimetype, data: name });
const field = (fieldname: string, value: string): FakePart => ({ type: 'field', fieldname, value });

async function* toParts(parts: FakePart[]): AsyncIterableIterator<Multipart> {
    for (const part of parts) {
        if (part.type === 'file') {
            const buffer = Buffer.from(part.data);
            yield {
                type: 'file',
                fieldname: part.fieldname,
                filename: part.filename,
                mimetype: part.mimetype,
                encoding: '7bit',
                toBuffer: async () => buffer,
            } as unknown as Multipart;
        } else {
            yield { type: 'field', fieldname: part.fieldname, value: part.value } as unknown as Multipart;
        }
    }
}

const baseFields = (): FakePart[] => [
    file('roomImage', 'room'),
    field('roomType', 'living_room'),
    field('stylePreset', JSON.stringify({ name: 'contemporary' })),
    field('styleInfluence', '50'),
    field('textPrompt', 'Paint the walls light grey.'),
];

const products = (count: number): FakePart[] =>
    Array.from({ length: count }, (_, i) => file('productImages', `product-${i + 1}`));

const assemble = (extra: FakePart[], mode?: Parameters<typeof processVisualizationFormData>[1]) =>
    processVisualizationFormData(toParts([...baseFields(), ...extra]), mode);

const rejectsWith400 = async (promise: Promise<unknown>, message: RegExp) =>
    assert.rejects(promise, (error: unknown) => error instanceof ValidationError && message.test(error.message));

describe('parseMultipartForm — productImages', () => {
    test('collects repeated productImages in order and defaults to []', async () => {
        const withProducts = await parseMultipartForm(toParts([...baseFields(), ...products(3)]));
        assert.deepEqual(withProducts.files.productImages.map(f => f.buffer.toString()), ['product-1', 'product-2', 'product-3']);

        const without = await parseMultipartForm(toParts(baseFields()));
        assert.deepEqual(without.files.productImages, []);
    });
});

describe('processVisualizationFormData — product injection contract', () => {
    test('legacy furnitureImage still yields exactly one unlabeled item', async () => {
        const data = await assemble([file('furnitureImage', 'sofa')]);
        assert.equal(data.injectedItems.length, 1);
        assert.equal(data.injectedItems[0].image.buffer.toString(), 'sofa');
        assert.equal(data.injectedItems[0].description, undefined);
        assert.equal(data.furnitureImage?.buffer.toString(), 'sofa');
    });

    test('productImages + productDescriptions become labeled items in order', async () => {
        const data = await assemble([
            ...products(2),
            field('productDescriptions', JSON.stringify(['Sofá Cusco — sofa, grey linen', 'Lámpara Nórdica — floor lamp'])),
        ]);
        assert.deepEqual(
            data.injectedItems.map(i => [i.image.buffer.toString(), i.description]),
            [['product-1', 'Sofá Cusco — sofa, grey linen'], ['product-2', 'Lámpara Nórdica — floor lamp']],
        );
        assert.equal(data.furnitureImage, undefined);
        assert.equal(data.pipelineMode, 'balanced_v7');
        assert.equal(data.textPrompt, 'Paint the walls light grey.', 'surfaces stay in textPrompt untouched');
    });

    test('productImages without descriptions are unlabeled; 5 is accepted', async () => {
        const data = await assemble(products(5));
        assert.equal(data.injectedItems.length, 5);
        assert.ok(data.injectedItems.every(i => i.description === undefined));
    });

    test('blank descriptions leave that item unlabeled', async () => {
        const data = await assemble([...products(2), field('productDescriptions', JSON.stringify(['  ', 'Lamp']))]);
        assert.deepEqual(data.injectedItems.map(i => i.description), [undefined, 'Lamp']);
    });

    test('400: furnitureImage and productImages together', async () => {
        await rejectsWith400(assemble([file('furnitureImage', 'sofa'), ...products(1)]), /'furnitureImage' o 'productImages', no ambos/);
    });

    test('400: more than 5 productImages', async () => {
        await rejectsWith400(assemble(products(6)), /más de 5 archivo\(s\) en 'productImages'/);
    });

    test('400: a non-image productImages file', async () => {
        await rejectsWith400(
            assemble([...products(1), file('productImages', 'spec-sheet', 'application/pdf')]),
            /'productImages\[1\]' debe ser una imagen/,
        );
    });

    test('400: productDescriptions not JSON / not a string array / wrong length / without images', async () => {
        await rejectsWith400(assemble([...products(2), field('productDescriptions', 'Sofa, Lamp')]), /no es un JSON válido/);
        await rejectsWith400(assemble([...products(2), field('productDescriptions', '{"a":"b"}')]), /arreglo JSON de strings/);
        await rejectsWith400(assemble([...products(2), field('productDescriptions', '["Sofa", 3]')]), /arreglo JSON de strings/);
        await rejectsWith400(assemble([...products(2), field('productDescriptions', '["Sofa"]')]), /misma cantidad.*\(2\); recibidos 1/);
        await rejectsWith400(assemble([field('productDescriptions', '["Sofa"]')]), /requiere al menos un archivo en 'productImages'/);
    });

    test('400: productImages on the frozen baseline_original pipeline', async () => {
        await rejectsWith400(assemble(products(2), 'baseline_original'), /'baseline_original' no soporta 'productImages'/);
        // furnitureImage on baseline keeps working.
        const data = await assemble([file('furnitureImage', 'sofa')], 'baseline_original');
        assert.equal(data.injectedItems.length, 1);
    });
});

describe('parseProductDescriptions / buildInjectedItems', () => {
    test('absent or empty field → undefined', () => {
        assert.equal(parseProductDescriptions(undefined, 2), undefined);
        assert.equal(parseProductDescriptions('', 2), undefined);
    });

    test('a boolean-coerced field value is rejected', () => {
        // The parser turns the literal strings "true"/"false" into booleans.
        assert.throws(() => parseProductDescriptions(true, 1), ValidationError);
    });

    test('no images → no items', () => {
        assert.deepEqual(buildInjectedItems(undefined, [], undefined), []);
    });
});

describe('classifyMultipartLimitError', () => {
    test('count limits → 400, other FST 4xx pass through, anything else → null', () => {
        assert.deepEqual(
            classifyMultipartLimitError({ code: 'FST_FILES_LIMIT', statusCode: 413, message: 'reach files limit' }),
            { status: 400, message: 'reach files limit' },
        );
        assert.equal(classifyMultipartLimitError({ code: 'FST_PARTS_LIMIT', statusCode: 413 })?.status, 400);
        assert.deepEqual(
            classifyMultipartLimitError({ code: 'FST_REQ_FILE_TOO_LARGE', statusCode: 413, message: 'request file too large' }),
            { status: 413, message: 'request file too large' },
        );
        assert.equal(classifyMultipartLimitError({ code: 'FST_NO_FORM_DATA', statusCode: 500 }), null);
        assert.equal(classifyMultipartLimitError(new Error('boom')), null);
        assert.equal(classifyMultipartLimitError(undefined), null);
    });
});
