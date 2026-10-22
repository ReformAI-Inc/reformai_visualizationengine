// Room types as the Reform-AI app sends them: every one must resolve, so a
// render never fails over its room label (QA, 2026-10-20: "Kids Room" 500'd).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { ROOM_TYPE_REGISTRY, getRoomTypeEntry, normalizeRoomType, resolveRoomTypeEntry } from './room-types.registry.js';
import { buildVisualizationPrompt } from '../prompts/balanced_v5/visualization.prompt.js';
import { STYLE_REGISTRY } from './styles.registry.js';

// The generator's menu (Reform-AI apps/web/src/data/commonStyles.json).
const GENERATOR_ROOM_TYPES = [
    'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining Room', 'Home Office', 'Kids Room', 'Garage',
    'Walk-in Closet', 'Balcony', 'Mudroom',
    'Facade', 'Outdoor Patio', 'Outdoor BBQ Area', 'Outdoor Garden', 'Outdoor Pool Area', 'Greenhouse',
    'Office', 'Executive Office', 'Business Office', 'Coworking Space', 'Meeting Room', 'Conference Room',
    'Conference Hall', 'Medical Office/Waiting Room', 'Start-up Incubator',
    'Luxury Suite', 'Standard Hotel Room', 'Boutique Hotel Room', 'Hotel Lobby', 'Airport Lounge', 'Co-living Space',
    'Restaurant', 'Fine Dining Restaurant', 'Casual Dining Restaurant', 'Fast Food Restaurant',
    'Family Style Restaurant', 'Rooftop Bar/Restaurant', 'Coffee Shop',
    'Retail Store', 'Shopping Mall Space', 'Showroom', 'Pop-up Shop', 'Reception Area',
    'Art Gallery', 'Photography Studio', 'Recording Studio', 'Cinema Room', 'Virtual Reality Experience Room',
    'Makerspace', 'Library/Reading Room', 'Historical Exhibition Space',
    'Warehouse', 'Workshop', 'Industrial Workshop', 'Fitness Gym', 'Home Gym', 'Yoga Studio', 'Spa Area',
    'Theater/Auditorium', 'Educational Classroom', 'Barbershop', 'Hair Salon', 'Banquet Hall', 'Event Space',
];

// Spaces (Reform-AI apps/api/src/constants/Space.constants.ts) and the
// Inspiration Hub labels for them.
const SPACE_ROOM_TYPES = [
    'kitchen', 'bathroom', 'living_room', 'master_bedroom', 'bedroom', 'dining_room', 'home_office',
    'outdoor_area', 'basement', 'laundry_room', 'garage', 'entryway_mudroom', 'outdoor_lounge_area',
    'outdoor_dining', 'media_room', 'home_gym_wellness', 'garden',
    'Master Bedroom', 'Outdoor Area', 'Laundry Room', 'Entryway / Mudroom', 'Media Room', 'Home Gym / Wellness',
];

describe('normalizeRoomType', () => {
    test('every run of spaces or punctuation becomes one underscore', () => {
        assert.equal(normalizeRoomType('Living Room'), 'living_room');
        assert.equal(normalizeRoomType(' living_room '), 'living_room');
        assert.equal(normalizeRoomType('Walk-in Closet'), 'walk_in_closet');
        assert.equal(normalizeRoomType('Medical Office/Waiting Room'), 'medical_office_waiting_room');
        assert.equal(normalizeRoomType('Entryway / Mudroom'), 'entryway_mudroom');
        assert.equal(normalizeRoomType('Bed & Breakfast'), 'bed_and_breakfast');
        assert.equal(normalizeRoomType('Habitación Niños'), 'habitación_niños');
    });
});

describe('ROOM_TYPE_REGISTRY', () => {
    test('registers every room type the app can send', () => {
        const missing = [...GENERATOR_ROOM_TYPES, ...SPACE_ROOM_TYPES].filter((room) => !getRoomTypeEntry(room));
        assert.deepEqual(missing, []);
    });

    test('each entry is keyed by its own roomType', () => {
        for (const [key, value] of Object.entries(ROOM_TYPE_REGISTRY)) {
            assert.equal(value.roomType, key);
            assert.ok(value.roomFunctionUses && value.functionalAnchorExamples, key);
        }
    });

    test('Kids Room resolves to its own entry', () => {
        assert.equal(getRoomTypeEntry('Kids Room')?.roomType, 'kids_room');
    });
});

describe('resolveRoomTypeEntry', () => {
    test('returns the registered entry when there is one', () => {
        assert.equal(resolveRoomTypeEntry('Living Room'), ROOM_TYPE_REGISTRY.living_room);
    });

    test('builds a generic entry from the name of an unknown room type', () => {
        assert.deepEqual(resolveRoomTypeEntry('Wine Cellar'), {
            roomType: 'wine_cellar',
            roomFunctionUses: 'the everyday uses of a wine cellar, storage, circulation',
            functionalAnchorExamples: 'furniture and fixtures typical of a wine cellar',
        });
    });
});

describe('balanced_v5 prompt (balanced_v5/v6/v7)', () => {
    const build = (roomType: string) =>
        buildVisualizationPrompt({ roomType, stylePreset: STYLE_REGISTRY[0], textPrompt: '', hasInjectedItem: false });

    test('builds for every room type the app can send', () => {
        for (const room of [...GENERATOR_ROOM_TYPES, ...SPACE_ROOM_TYPES]) {
            assert.doesNotThrow(() => build(room), room);
        }
    });

    test('Kids Room carries its own room fields into the prompt', () => {
        const prompt = build('Kids Room');
        const text = prompt.structuralPart + prompt.stylePart;
        assert.ok(text.includes('kids_room'));
        assert.ok(text.includes(ROOM_TYPE_REGISTRY.kids_room.functionalAnchorExamples));
    });

    test('a room type the user typed in still builds', () => {
        assert.doesNotThrow(() => build('Wine Cellar'));
    });
});
