// The original production pipeline (baseline_original): its parts — images and
// the one prompt, in the original order — are pure and need no Gemini call.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { assembleBaselineParts } from './geminiService.js';
import { buildFurniturePrompt, buildInfluencePrompt, buildVisualizationPrompt } from '../../../prompts/baseline/visualization.prompt.js';
import { STYLE_REGISTRY } from '../../../shared/styles.registry.js';
import type { GenerateVisualizationParams } from '../../../shared/types/index.js';
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

/** Each part as a label: the image's bytes as text, or TEXT. */
const shape = (parts: GeminiPart[]) =>
    parts.map((part) => ('text' in part ? 'TEXT' : Buffer.from(part.inlineData.data, 'base64').toString()));

describe('assembleBaselineParts', () => {
    test('room photo, then the one prompt, as the original service sent them', () => {
        const params = request();
        const { parts, fullPrompt } = assembleBaselineParts(params);

        assert.deepEqual(shape(parts), ['room', 'TEXT']);
        assert.equal((parts[0] as { inlineData: { mimeType: string } }).inlineData.mimeType, 'image/png');
        assert.equal(
            fullPrompt,
            buildVisualizationPrompt({
                isRefinement: false,
                roomType: 'living_room',
                stylePresetName: STYLE_REGISTRY[0].name,
                influencePrompt: buildInfluencePrompt(0, 50, STYLE_REGISTRY[0].name),
                textPrompt: 'Paint the walls light grey.',
                furniturePrompt: buildFurniturePrompt(false, 'living_room'),
            }),
        );
        assert.deepEqual(parts[1], { text: fullPrompt });
    });

    test('every input in the original order: room, previous result, prompt, mood boards, furniture', () => {
        const { parts, fullPrompt } = assembleBaselineParts(
            request({
                isRefinement: true,
                previousResultImage: image('previous'),
                moodBoardImages: [image('mood-1'), image('mood-2')],
                furnitureImage: image('sofa'),
                styleInfluence: 80,
            }),
        );

        assert.deepEqual(shape(parts), ['room', 'previous', 'TEXT', 'mood-1', 'mood-2', 'sofa']);
        assert.ok(fullPrompt.includes(buildFurniturePrompt(true, 'living_room')));
        assert.ok(fullPrompt.includes(buildInfluencePrompt(2, 80, STYLE_REGISTRY[0].name)));
    });

    test('leaves the previous result out unless it is a refinement', () => {
        const { parts } = assembleBaselineParts(request({ previousResultImage: image('previous') }));
        assert.deepEqual(shape(parts), ['room', 'TEXT']);
    });
});
