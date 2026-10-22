// ============================================================
// ROOM TYPE REGISTRY
// Single source of truth for room-specific prompt fields.
// Injection layer introduced in balanced_v3_0 (archived); consumed by the
// active V5/V7/V8 prompt builders.
// ============================================================

export interface RoomTypeEntry {
    /** Canonical key — lowercase_snake_case */
    roomType: string;
    /** Comma-separated string injected into FURNISHING STRATEGY */
    roomFunctionUses: string;
    /** Comma-separated string injected into OBJECT JUSTIFICATION RULE */
    functionalAnchorExamples: string;
    /** Reserved for future room-specific constraint blocks. Empty = not used. */
    roomSpecificConstraints?: string;
}

const entry = (roomType: string, roomFunctionUses: string, functionalAnchorExamples: string): RoomTypeEntry => ({
    roomType,
    roomFunctionUses,
    functionalAnchorExamples,
});

// Keys are canonical lowercase_snake_case.
// Lookup normalizes input via normalizeRoomType() before accessing this map.
// Covers every room type the Reform-AI app can send: the generator's menu
// (apps/web/src/data/commonStyles.json) and the Spaces types
// (apps/api/src/constants/Space.constants.ts). Anything else — a room type the
// user typed in — resolves through resolveRoomTypeEntry()'s generic entry.
export const ROOM_TYPE_REGISTRY: Record<string, RoomTypeEntry> = {
    bedroom: {
        roomType: 'bedroom',
        roomFunctionUses: 'sleeping, storage, circulation',
        functionalAnchorExamples: 'bed, dresser, seating',
    },
    living_room: {
        roomType: 'living_room',
        roomFunctionUses: 'seating, lounging, display',
        functionalAnchorExamples: 'sofa, coffee table, shelving',
    },
    kitchen: {
        roomType: 'kitchen',
        roomFunctionUses: 'cooking, prep, storage',
        functionalAnchorExamples: 'island, counters, cabinetry',
    },
    dining_room: {
        roomType: 'dining_room',
        roomFunctionUses: 'dining, serving, storage',
        functionalAnchorExamples: 'dining table, sideboard, buffet',
    },
    home_office: {
        roomType: 'home_office',
        roomFunctionUses: 'working, storage, reference',
        functionalAnchorExamples: 'desk, shelving, seating',
    },
    bathroom: {
        roomType: 'bathroom',
        roomFunctionUses: 'bathing, grooming, storage',
        functionalAnchorExamples: 'vanity, bathtub, storage unit',
    },

    // ── Residential ──────────────────────────────────────────
    master_bedroom: entry('master_bedroom', 'sleeping, dressing, storage, relaxing', 'bed, nightstands, dresser, accent chair'),
    kids_room: entry('kids_room', 'sleeping, playing, studying, toy storage', 'child-sized bed, toy storage, desk, play rug'),
    walk_in_closet: entry('walk_in_closet', 'dressing, clothing storage, display', 'wardrobe shelving, hanging rails, island dresser, mirror'),
    balcony: entry('balcony', 'sitting, relaxing, plants', 'outdoor chairs, small table, planters'),
    mudroom: entry('mudroom', 'entering, coat and shoe storage, cleanup', 'bench, coat hooks, cubbies, shoe storage'),
    entryway_mudroom: entry('entryway_mudroom', 'entering, greeting, coat and shoe storage', 'console table, bench, coat hooks, mirror'),
    garage: entry('garage', 'parking, tool storage, workspace', 'storage shelving, workbench, wall-mounted organizers'),
    basement: entry('basement', 'recreation, storage, lounging', 'sectional sofa, storage shelving, game table'),
    laundry_room: entry('laundry_room', 'washing, drying, folding, storage', 'washer, dryer, folding counter, cabinetry'),
    media_room: entry('media_room', 'watching, lounging, listening', 'media console, sectional sofa, screen'),
    home_gym_wellness: entry('home_gym_wellness', 'exercising, stretching, recovery', 'exercise equipment, mats, mirror, storage rack'),
    home_gym: entry('home_gym', 'exercising, stretching, equipment storage', 'exercise equipment, mats, mirror, weight rack'),

    // ── Outdoor Residential ──────────────────────────────────
    facade: entry('facade', 'entry, curb appeal, exterior expression', 'front door, cladding, exterior lighting, planters'),
    outdoor_area: entry('outdoor_area', 'lounging, dining, gardening', 'outdoor seating, outdoor table, planters'),
    outdoor_patio: entry('outdoor_patio', 'lounging, dining, entertaining', 'outdoor seating, outdoor table, planters'),
    outdoor_lounge_area: entry('outdoor_lounge_area', 'lounging, relaxing, conversation', 'outdoor sofa, lounge chairs, coffee table'),
    outdoor_dining: entry('outdoor_dining', 'dining, serving, entertaining', 'outdoor dining table, chairs, shade structure'),
    outdoor_bbq_area: entry('outdoor_bbq_area', 'grilling, prep, dining', 'grill, outdoor counter, outdoor dining table'),
    outdoor_garden: entry('outdoor_garden', 'gardening, strolling, relaxing', 'planting beds, pathways, garden seating'),
    garden: entry('garden', 'gardening, strolling, relaxing', 'planting beds, pathways, garden seating'),
    outdoor_pool_area: entry('outdoor_pool_area', 'swimming, sunbathing, lounging', 'pool, sun loungers, umbrellas'),
    greenhouse: entry('greenhouse', 'growing plants, potting, propagation', 'potting bench, plant shelving, planters'),

    // ── Office & Workspaces ──────────────────────────────────
    office: entry('office', 'working, meeting, storage', 'desks, task chairs, storage cabinets'),
    executive_office: entry('executive_office', 'working, private meetings, display', 'executive desk, desk chair, guest seating, shelving'),
    business_office: entry('business_office', 'working, collaboration, storage', 'workstations, task chairs, filing storage'),
    coworking_space: entry('coworking_space', 'working, collaboration, lounging', 'shared desks, task chairs, lounge seating'),
    meeting_room: entry('meeting_room', 'meeting, presenting, collaboration', 'meeting table, chairs, display screen'),
    conference_room: entry('conference_room', 'meeting, presenting, video calls', 'conference table, chairs, display screen'),
    conference_hall: entry('conference_hall', 'presenting, audience seating, events', 'stage or podium, rows of seating, screen'),
    medical_office_waiting_room: entry('medical_office_waiting_room', 'waiting, check-in, consultation', 'reception desk, waiting chairs, side tables'),
    start_up_incubator: entry('start_up_incubator', 'working, collaboration, pitching', 'shared desks, meeting pods, lounge seating'),

    // ── Hospitality ──────────────────────────────────────────
    luxury_suite: entry('luxury_suite', 'sleeping, lounging, dressing', 'king bed, lounge seating, nightstands'),
    standard_hotel_room: entry('standard_hotel_room', 'sleeping, working, storage', 'bed, nightstands, desk, luggage bench'),
    boutique_hotel_room: entry('boutique_hotel_room', 'sleeping, lounging, working', 'statement bed, accent chair, nightstands'),
    hotel_lobby: entry('hotel_lobby', 'check-in, waiting, socializing', 'reception desk, lounge seating, coffee tables'),
    airport_lounge: entry('airport_lounge', 'waiting, working, refreshments', 'lounge chairs, work counters, buffet counter'),
    co_living_space: entry('co_living_space', 'lounging, socializing, working', 'shared sofa, communal table, storage'),

    // ── Food & Beverage ──────────────────────────────────────
    restaurant: entry('restaurant', 'dining, serving, waiting', 'dining tables, chairs, service counter'),
    fine_dining_restaurant: entry('fine_dining_restaurant', 'dining, serving, hosting', 'dining tables, upholstered chairs, host stand'),
    casual_dining_restaurant: entry('casual_dining_restaurant', 'dining, serving, socializing', 'dining tables, booths, service counter'),
    fast_food_restaurant: entry('fast_food_restaurant', 'ordering, quick dining, queuing', 'order counter, tables, fixed seating'),
    family_style_restaurant: entry('family_style_restaurant', 'group dining, serving, socializing', 'large dining tables, chairs, booths'),
    rooftop_bar_restaurant: entry('rooftop_bar_restaurant', 'dining, drinking, socializing', 'bar counter, bar stools, lounge seating'),
    coffee_shop: entry('coffee_shop', 'ordering, sitting, working', 'coffee counter, small tables, chairs'),

    // ── Retail & Commercial ──────────────────────────────────
    retail_store: entry('retail_store', 'browsing, display, checkout', 'display shelving, display tables, checkout counter'),
    shopping_mall_space: entry('shopping_mall_space', 'circulation, display, seating', 'storefronts, benches, planters'),
    showroom: entry('showroom', 'display, browsing, consultation', 'display platforms, shelving, consultation table'),
    pop_up_shop: entry('pop_up_shop', 'display, browsing, checkout', 'modular display units, display tables, counter'),
    reception_area: entry('reception_area', 'greeting, waiting, check-in', 'reception desk, waiting seating, side tables'),

    // ── Creative & Specialty ─────────────────────────────────
    art_gallery: entry('art_gallery', 'exhibiting, viewing, circulation', 'display walls, plinths, benches'),
    photography_studio: entry('photography_studio', 'shooting, editing, storage', 'backdrops, lighting stands, work desk'),
    recording_studio: entry('recording_studio', 'recording, mixing, listening', 'mixing desk, acoustic panels, seating'),
    cinema_room: entry('cinema_room', 'watching, lounging, listening', 'screen, tiered seating, acoustic panels'),
    virtual_reality_experience_room: entry('virtual_reality_experience_room', 'immersive play, waiting, equipment storage', 'open play zone, equipment station, seating'),
    makerspace: entry('makerspace', 'building, prototyping, tool storage', 'workbenches, tool storage, stools'),
    library_reading_room: entry('library_reading_room', 'reading, studying, book storage', 'bookshelves, reading tables, armchairs'),
    historical_exhibition_space: entry('historical_exhibition_space', 'exhibiting, viewing, circulation', 'display cases, plinths, information panels'),

    // ── Industrial & Utility ─────────────────────────────────
    warehouse: entry('warehouse', 'storage, logistics, circulation', 'pallet racking, shelving, loading area'),
    workshop: entry('workshop', 'building, repairing, tool storage', 'workbench, tool wall, storage shelving'),
    industrial_workshop: entry('industrial_workshop', 'fabrication, repairing, tool storage', 'heavy workbenches, machinery, tool storage'),
    fitness_gym: entry('fitness_gym', 'exercising, training, changing', 'exercise machines, weight racks, mats'),
    yoga_studio: entry('yoga_studio', 'yoga, stretching, meditation', 'yoga mats, props storage, mirrors'),
    spa_area: entry('spa_area', 'relaxing, treatments, bathing', 'treatment beds, lounge chairs, plunge pool'),
    theater_auditorium: entry('theater_auditorium', 'performing, audience seating, presenting', 'stage, rows of seating, lighting rig'),
    educational_classroom: entry('educational_classroom', 'teaching, studying, presenting', 'student desks, chairs, teaching wall'),
    barbershop: entry('barbershop', 'haircuts, grooming, waiting', 'barber chairs, mirrors, waiting bench'),
    hair_salon: entry('hair_salon', 'styling, washing, waiting', 'styling chairs, mirrors, wash basins'),
    banquet_hall: entry('banquet_hall', 'banquets, events, dancing', 'banquet tables, chairs, stage area'),
    event_space: entry('event_space', 'events, gatherings, presenting', 'flexible tables, chairs, stage area'),
};

/**
 * Normalizes a roomType string to the canonical registry key.
 * Accepts: "bedroom", "Bedroom", "living room", "Living Room", "living_room",
 * "Walk-in Closet", "Medical Office/Waiting Room", etc. — every run of spaces
 * or punctuation becomes one underscore.
 */
export const normalizeRoomType = (roomType: string): string => {
    return roomType
        .trim()
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '');
};

/**
 * Looks up a room type entry, normalizing the input key first.
 * Returns null if the room type is not registered.
 */
export const getRoomTypeEntry = (roomType: string): RoomTypeEntry | null => {
    const key = normalizeRoomType(roomType);
    return ROOM_TYPE_REGISTRY[key] ?? null;
};

/**
 * The registered entry for a room type, or — for one the registry does not
 * know, such as a room type the user typed in — a generic entry built from its
 * own name, so an unknown room type still renders instead of failing.
 */
export const resolveRoomTypeEntry = (roomType: string): RoomTypeEntry => {
    const registered = getRoomTypeEntry(roomType);
    if (registered) return registered;

    const key = normalizeRoomType(roomType);
    const label = key.replace(/_/g, ' ');
    return entry(
        key,
        `the everyday uses of a ${label}, storage, circulation`,
        `furniture and fixtures typical of a ${label}`,
    );
};
