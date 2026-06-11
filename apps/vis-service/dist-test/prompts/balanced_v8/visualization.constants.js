// ============================================================
// BALANCED V8 — PROMPT CONSTANTS
// TEMPLATE VERSION: 8.0.0
// COMPATIBLE WITH: pipelineMode "balanced_v8"
//
// V8 is purpose-built for service provider catalogue visualization.
// The catalogue items ARE the primary render brief — not a style override.
// Style is ambient context that wraps around installed products.
//
// Key changes from V7:
//   - Contractor/installer role framing (not "interior designer")
//   - Structural part establishes catalogue-first principle from the start
//   - Style part is compact — applies only to non-catalogued surfaces
//   - Constraint hierarchy: Tier 2B = PRIMARY RENDER BRIEF, not style override
//   - No staging density complexity — renovation preview, not stylised staging
// ============================================================
export const TEMPLATE_VERSION = '8.0.0';
export const PIPELINE_MODE = 'balanced_v8';
// ── RE-EXPORTS FROM BLOCKS (unchanged from V7) ───────────────────────────────
export { buildMoodboardScopeBlock, buildRenovationAnchorsBlock, V5_MOODBOARD_INFLUENCE_STATEMENT, INFLUENCE_PRESET_STYLE_ONLY, INJECTED_ITEM_BLOCK_HEADER, DEFAULT_USER_REQUEST, } from '../shared/canonicalPromptPrimitives.js';
export { buildAGTConstraintBlock } from '../blocks/agt-constraint.js';
export { buildAGTEchoBlock } from '../blocks/agt-echo.js';
export { buildConflictClausesBlock } from '../blocks/conflict-clauses.js';
// ── V8 STRUCTURAL PART ───────────────────────────────────────────────────────
// Contractor/installer framing. Catalogue items are primary. Architecture is preserved.
export const BALANCED_V8_STRUCTURAL_PART = `**RENOVATION VISUALIZATION — INSTALLER BRIEF**

You are a professional renovation installer generating a photorealistic visualization for a client.

YOUR TASK: Show the client exactly how their room will look after the selected products are installed. This is an accurate visual preview of a real renovation — not a stylistic redesign or concept render. The catalogue products listed in the Installed Products section are the actual items being installed. They define what must appear in this render.

CATALOGUE-FIRST PRINCIPLE: All installed product specifications take absolute precedence over every other design decision. Style direction, material palette, and aesthetic choices are subordinate to and must not conflict with the installed products.

PRESERVE ARCHITECTURE — DO NOT change:
- Walls, floor plane, and ceiling plane
- Window and door count, geometry, positions, and sizes
- Camera angle, focal length, and perspective
- Room proportions and spatial depth
- Built-in light fixtures and structural niches

PHOTOREALISM REQUIRED: The output must look like a real photograph of the finished renovation — not an illustration or concept sketch.

ARTIFACT REMOVAL: Remove exposed cables, loose wires, and temporary clutter. Replace with clean surfaces.

WINDOW PRESERVATION: All window geometry is immutable — size, shape, position, pane count, and frame divisions. Do not add panes, arches, or new openings. Preserve the exterior view exactly as seen through any windows.`;
// ── V8 STYLE PART ───────────────────────────────────────────────────────────
// Style is ambient context only — applied to surfaces not covered by catalogue items.
// When no style is provided, a neutral contemporary aesthetic is used.
const STYLE_PART_WITH_STYLE = `**AMBIENT AESTHETIC — {{STYLE_NAME}}**

Apply the {{STYLE_NAME}} aesthetic to all surfaces and elements NOT covered by installed catalogue products: soft furnishings, movable furniture, decorative objects, lighting choices, and any unclaimed surfaces.

SCOPE BOUNDARY: Do NOT apply style transformation to surfaces covered by installed products. Installed products must appear exactly as specified — the style establishes ambient feel, it is not the primary material driver.

FURNISHING: Populate the room appropriately for a {{ROOM_TYPE}}. Maintain realistic placement relative to walls, windows, and circulation paths. Do not leave the room empty.

USER REQUEST: "{{USER_REQUEST}}"

LIGHTING: Preserve the original brightness level, daylight direction, and color temperature. Do not introduce new light sources or fixtures.`;
const STYLE_PART_NO_STYLE = `**AMBIENT AESTHETIC — Clean Contemporary**

Maintain a clean, contemporary residential aesthetic that complements the installed products. Avoid dramatic style transformations or period-specific decor. Let the installed products define the material direction of the space.

FURNISHING: Populate the room appropriately for a {{ROOM_TYPE}}. Maintain realistic placement relative to walls, windows, and circulation paths. Do not leave the room empty.

USER REQUEST: "{{USER_REQUEST}}"

LIGHTING: Preserve the original brightness level, daylight direction, and color temperature. Do not introduce new light sources or fixtures.`;
export const buildV8StylePart = (styleName, roomType, userRequest) => {
    const resolvedRequest = userRequest?.trim() || 'No specific requests.';
    const template = styleName ? STYLE_PART_WITH_STYLE : STYLE_PART_NO_STYLE;
    return template
        .replace(/\{\{STYLE_NAME\}\}/g, styleName ?? '')
        .replace(/\{\{ROOM_TYPE\}\}/g, roomType)
        .replace(/\{\{USER_REQUEST\}\}/g, resolvedRequest);
};
// ── V8 CONSTRAINT HIERARCHY ───────────────────────────────────────────────────
// Rewritten for catalogue-first framing.
// Tier 2B language updated: installed products = PRIMARY BRIEF, not style override.
// AGT hard facts line added when confidence-gated facts exist (same as V7).
export const buildConstraintHierarchyBlock = (injectedItemCount, hasRenovationAnchors = false, hasHardAGTFacts = false) => {
    const tier2Active = injectedItemCount > 0;
    const tier2Header = tier2Active
        ? 'TIER 2 — INJECTED ITEM CONSTRAINTS [ACTIVE — 1 injected item present]'
        : 'TIER 2 — INJECTED ITEM CONSTRAINTS [INACTIVE — no injected items in this request]';
    const tier2Body = tier2Active
        ? '\n' +
            '  Preserve the injected item exactly as shown. Silhouette, color, material, and finish are\n' +
            '  non-negotiable. Do not restyle, recolor, or substitute it. Resolve style conflicts\n' +
            '  through surrounding non-injected elements only.\n'
        : '\n';
    const tier2bHeader = hasRenovationAnchors
        ? 'TIER 2B — INSTALLED CATALOGUE PRODUCTS [ACTIVE — PRIMARY RENDER BRIEF]'
        : 'TIER 2B — INSTALLED CATALOGUE PRODUCTS [INACTIVE — no catalogue selections in this request]';
    const tier2bBody = hasRenovationAnchors
        ? '\n' +
            '  CATALOGUE ITEMS ARE THE PRIMARY RENDER BRIEF. These are real products being installed\n' +
            '  in the client\'s room. They define what must appear in the output — not as style overrides,\n' +
            '  but as the primary material specification. The ambient aesthetic (Tier 4) applies only\n' +
            '  to surfaces not covered by installed products. Full per-surface rules follow.\n'
        : '\n';
    const agtLine = hasHardAGTFacts
        ? '  Verified hard facts from the structural assessment are TIER 1 constraints — they supersede model visual judgment.\n'
        : '';
    return [
        '**CONSTRAINT HIERARCHY — READ THIS BEFORE ALL OTHER INSTRUCTIONS:**',
        'Apply in strict priority order. TIER 1 overrides all; each tier overrides those below it.',
        '',
        'TIER 1 — ARCHITECTURAL CONSTRAINTS [ALWAYS ACTIVE — highest priority]',
        `  All architectural elements defined in the installer brief are immutable.`,
        agtLine + `  Immutable: wall/floor/ceiling planes, window/door count, geometry and positions, camera perspective, built-in fixtures.`,
        '  No instruction from any lower tier may override them.',
        '',
        tier2Header,
        tier2Body,
        tier2bHeader,
        tier2bBody,
        'TIER 3 — ROOM FUNCTION AND SPATIAL LOGIC',
        '  Furniture layout must support room function; spatial relationships must remain plausible and navigable.',
        '',
        'TIER 4 — AMBIENT STYLE',
        '  Apply the ambient aesthetic to unclaimed surfaces, furniture, and decor. Must not override Tiers 1–2B.',
        '',
        'TIER 5 — MOODBOARD INFLUENCE',
        '  Apply moodboard influence as a tonal overlay — palette, light quality, surface finish. Does not override Tiers 1–4.',
        '',
        'TIER 6 — USER TEXT REQUEST',
        '  Honored within the constraints of all tiers above.',
    ].join('\n');
};
//# sourceMappingURL=visualization.constants.js.map