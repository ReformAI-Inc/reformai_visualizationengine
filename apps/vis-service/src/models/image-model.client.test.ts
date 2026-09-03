import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

/**
 * DEFAULT_IMAGE_MODEL is read at module load, so each case imports a fresh copy
 * with the env already set — a cache-busting query on the specifier is what
 * makes that possible under node's ESM loader.
 */
const loadModelClient = async (imageModel?: string) => {
    const previous = process.env.IMAGE_MODEL;
    if (imageModel === undefined) delete process.env.IMAGE_MODEL;
    else process.env.IMAGE_MODEL = imageModel;

    try {
        return await import(`./image-model.client.js?case=${Math.random()}`);
    } finally {
        if (previous === undefined) delete process.env.IMAGE_MODEL;
        else process.env.IMAGE_MODEL = previous;
    }
};

describe('DEFAULT_IMAGE_MODEL', () => {
    test('stays on 2.5 when IMAGE_MODEL is unset (production, local, sandbox)', async () => {
        const { DEFAULT_IMAGE_MODEL } = await loadModelClient(undefined);
        assert.equal(DEFAULT_IMAGE_MODEL, 'gemini-2.5-flash-image');
    });

    test('honours IMAGE_MODEL so a migration is an env change, not a code change', async () => {
        const { DEFAULT_IMAGE_MODEL } = await loadModelClient('gemini-3.1-flash-image');
        assert.equal(DEFAULT_IMAGE_MODEL, 'gemini-3.1-flash-image');
    });

    test('an empty IMAGE_MODEL falls back rather than requesting an empty model id', async () => {
        const { DEFAULT_IMAGE_MODEL } = await loadModelClient('');
        assert.equal(DEFAULT_IMAGE_MODEL, 'gemini-2.5-flash-image');
    });
});
