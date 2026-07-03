// ============================================================
// BALANCED V4.1 — PROMPT CONSTANTS
// TEMPLATE VERSION: 4.1
// COMPATIBLE WITH: pipelineMode "balanced_v4_1"
//
// Changes from v4.0 (template 4.0):
//   - Constraint hierarchy Tier 1: back-reference to Phase 1 (removes verbatim duplication)
//   - Priority Order block: compressed to one sentence
//   - Style Conflict Resolution: movable-elements list only; redundant framing removed
//   - Renovation Continuity: removed as standalone; absorbed into Furnishing Strategy
//   - Signature Elements: added as first-class field in STYLE DEFINITION block
//   - Style Priority: rewritten to 3-layer model (materials + palette + signatures)
//     "not decor or arbitrary objects" wording removed — caused Bohemian/Neoclassic regression
//   - Style fidelity failure conditions: merged into Style Priority block
//   - Material Hierarchy: failure condition absorbed into rule; one block
//   - Renovation Feasibility: compressed from 4 lines to 2 core principles
//   - Lighting: three blocks (Normalization, Enhancement, Source Immutability) → single block
//   - Self-Audit check 1: updated to 3-layer style fidelity check
//   - Structural part: unchanged from v4.0 (re-exported)
//   - Injected item blocks: unchanged from v4.0 (re-exported)
//
// Net size reduction: ~21% of total addressable prompt words.
//
// INVARIANT: v4.0 and v3.0 files are frozen. This file does not import mutable
// state from them — structural part re-exported; injected item constants
// re-exported; influence constants re-exported.
// ============================================================

export const TEMPLATE_VERSION = '4.1';
export const PIPELINE_MODE = 'balanced_v4_1';

// ── STRUCTURAL PART ───────────────────────────────────────────────────────────
// Identical to v4.0 / v3.0. Re-exported to avoid duplication.
// Changes to architectural constraints require a new template version.
// ─────────────────────────────────────────────────────────────────────────────
export { BALANCED_V3_0_STRUCTURAL_PART as BALANCED_V4_1_STRUCTURAL_PART } from '../balanced_v3_0/visualization.constants.js';


// ── CONSTRAINT HIERARCHY BLOCK ────────────────────────────────────────────────
// V4.1 change: Tier 1 body compressed to a back-reference + one-line enum.
// Phase 1 already defines all architectural immutables in full — repeating
// them here added ~50 words with no behavioral gain.
// ─────────────────────────────────────────────────────────────────────────────
export const buildConstraintHierarchyBlock = (injectedItemCount: number): string => {
    const tier2Active = injectedItemCount > 0;

    const tier2Header = tier2Active
        ? 'TIER 2 — INJECTED ITEM CONSTRAINTS [ACTIVE — 1 injected item present]'
        : 'TIER 2 — INJECTED ITEM CONSTRAINTS [INACTIVE — no injected items in this request]';

    const tier2Body = tier2Active
        ? '\n' +
          '  The uploaded item must be preserved exactly as shown in its reference image.\n' +
          '  - Silhouette, color, material, and finish are non-negotiable — they override style transformation\n' +
          '  - Do not restyle, recolor, or substitute the item to match the active style\n' +
          '  - If the item\'s aesthetic conflicts with the active style, keep the item as-is;\n' +
          '    resolve the conflict through surrounding furniture, surfaces, and decor\n' +
          '  - This behavior is intentional — it is not a style fidelity failure\n'
        : '\n';

    return [
        '**CONSTRAINT HIERARCHY — READ THIS BEFORE ALL OTHER INSTRUCTIONS:**',
        '',
        'Apply the following tiers in strict priority order.',
        'TIER 1 has the highest priority and overrides all other tiers without exception.',
        'When a conflict exists between tiers, the higher-priority tier always wins.',
        '',
        'TIER 1 — ARCHITECTURAL CONSTRAINTS [ALWAYS ACTIVE — highest priority]',
        '  All elements defined in Phase 1: Architectural Anchoring are immutable.',
        '  Immutable: wall/floor/ceiling planes, window/door geometry, camera perspective, built-in fixtures.',
        '  No instruction from any lower tier may override them.',
        '',
        tier2Header,
        tier2Body,
        'TIER 3 — ROOM FUNCTION AND SPATIAL LOGIC',
        '  - Furniture layout must support the room\'s functional purpose',
        '  - Spatial relationships must remain plausible and navigable',
        '',
        'TIER 4 — STYLE TRANSFORMATION',
        '  - Apply the selected style through non-injected furniture, surfaces, and decor',
        '  - Style expression must not override tiers 1, 2, or 3',
        '',
        'TIER 5 — MOODBOARD INFLUENCE',
        '  - Applied as directed by the influence setting',
        '  - Does not override tiers 1–4',
        '',
        'TIER 6 — USER TEXT REQUEST',
        '  - Honored within the constraints of all tiers above',
    ].join('\n');
};


// ── INJECTED ITEM IDENTITY PRESERVATION BLOCK ────────────────────────────────
// Unchanged from v4.0. Re-exported for use by the v4.1 service.
// ─────────────────────────────────────────────────────────────────────────────
export { INJECTED_ITEM_BLOCK_HEADER } from '../balanced_v4_0/visualization.constants.js';


// ── INJECTED ITEM SELF-AUDIT TEXT ─────────────────────────────────────────────
// Unchanged from v4.0. Re-exported for use by the v4.1 injection layer.
// ─────────────────────────────────────────────────────────────────────────────
export { INJECTED_ITEM_AUDIT_TEXT } from '../balanced_v4_0/visualization.constants.js';


// ── STYLE PART TEMPLATE ───────────────────────────────────────────────────────
// Derived from BALANCED_V4_0_STYLE_TEMPLATE with targeted modifications.
// All changes are noted inline with [V4.1 CHANGE] comments on the relevant line.
//
// Placeholder inventory (v4.0 inventory plus one new):
//   {{STYLE_NAME}}                — styleObject.name (appears 3×)
//   {{ROOM_TYPE}}                 — roomType input
//   {{USER_REQUEST}}              — textPrompt (empty → "No specific requests.")
//   {{ROOM_FUNCTION_USES}}        — derived from room-type registry
//   {{STAGING_DENSITY_LABEL}}     — derived from density block registry
//   {{STAGING_DENSITY_BLOCK}}     — derived from density block registry
//   {{HIGH_DENSITY_GROUP_BLOCK}}  — conditional: non-empty only when tier = 'high'
//   {{FUNCTIONAL_ANCHOR_EXAMPLES}}— derived from room-type registry
//   {{CORE_MATERIALS}}            — styleObject.model_inputs.core_materials (inline)
//   {{COLOR_PALETTE}}             — styleObject.model_inputs.color_palette (inline)
//   {{LIGHTING_STYLE}}            — styleObject.model_inputs.lighting_style
//   {{MATERIAL_FINISH}}           — styleObject.model_inputs.material_finish
//   {{STYLE_SIGNATURE_ELEMENTS}}  — NEW: styleObject.model_inputs.signature_elements (inline)
//   {{STYLE_DONTS_BLOCK}}         — styleObject.model_inputs.dont (bullet block)
//   {{INJECTED_ITEM_AUDIT_BLOCK}} — INJECTED_ITEM_AUDIT_TEXT or empty string
// ─────────────────────────────────────────────────────────────────────────────
export const BALANCED_V4_1_STYLE_TEMPLATE = `
Apply constraints in order: architectural integrity → object preservation → functional realism → style → detail.

**STYLE CONFLICT RESOLUTION:**
Resolve through movable or surface-level elements only:
- furniture, textiles, movable lighting (floor lamps, table lamps)
- paint and wall treatments
- rugs and soft furnishings
- decor, cabinetry, storage furniture

Injected items (if present) must not be restyled — resolve conflicts through surrounding non-injected furniture, surfaces, and decor.

**PHASE 2: STYLE TRANSFORMATION**
- Room Type: {{ROOM_TYPE}}
- Task: Transform the room into the {{STYLE_NAME}} aesthetic.
- Output: Photorealistic, fully-furnished renovation of the SAME room.
- User request: "{{USER_REQUEST}}"

**FURNISHING STRATEGY:**
- Furnish completely and realistically for the selected room type and style.
- Reuse, adapt, or replace non-injected furniture to match the target style.
  Injected items (if any) are governed by Tier 2 constraints — do not apply style transformation to them.
- Always furnish; if the room is empty, introduce a plausible layout. Do not leave it empty unless explicitly requested.
- Furnishing must reflect realistic use: {{ROOM_FUNCTION_USES}}.
- Maintain plausible placement relative to walls, windows, circulation paths, and focal points.

**STAGING DENSITY — {{STAGING_DENSITY_LABEL}} (applies to GENERATED objects only):**
{{STAGING_DENSITY_BLOCK}}

**OBJECT JUSTIFICATION RULE:**
Every object must meet ALL of the following:

1. Functional Anchor: directly tied to nearby furniture ({{FUNCTIONAL_ANCHOR_EXAMPLES}})
2. Spatial Purpose: supports a use (lighting, storage, seating, reflection, circulation)
3. Design Contribution: improves composition or usability

If any condition fails → DO NOT include the object. Prefer omission over arbitrary placement.

{{HIGH_DENSITY_GROUP_BLOCK}}
**MIRROR PLACEMENT RULE:**
Mirrors are ONLY allowed if:
- mounted above a dresser, console, or vanity
- OR part of a functional dressing or seating area

Mirrors must NOT:
- float on empty walls with no anchor furniture
- be placed without anchor furniture directly beneath
- exist solely to fill space or balance composition

If placement is unjustified → OMIT.

**STYLE DEFINITION:**
Core Materials: {{CORE_MATERIALS}}
Color Palette: {{COLOR_PALETTE}}
Lighting: {{LIGHTING_STYLE}}
Finish: {{MATERIAL_FINISH}}
Signature Elements: {{STYLE_SIGNATURE_ELEMENTS}}

{{STYLE_DONTS_BLOCK}}

**STYLE PRIORITY:**
Express the {{STYLE_NAME}} aesthetic through three coordinated layers — all must be present:

(a) Materials and finishes from the Style Definition
(b) Color palette applied to at least one primary surface or major furnishing
(c) Signature Elements — the archetypal objects, surface treatments, or material layerings that make the style immediately recognizable

Avoid generic interpretations.
An output without visible Signature Elements fails style fidelity, even if materials and palette are correct.

**MATERIAL HIERARCHY:**
Primary surfaces (walls, floor, ceiling, dominant furniture) must contrast in value, tone, or material identity. Do not collapse surfaces into the same neutral tone even if individually correct. Surfaces that are near-identical in value and saturation across the room constitute a material hierarchy failure — revise surface treatments to restore contrast.

**RENOVATION FEASIBILITY:**
- Adapt materials to fit existing geometry — never alter structure to fit materials.
- Match material weight to surface type (no heavy materials on thin or ornamental features).

**LIGHTING:**
- Preserve original brightness level, daylight direction, and warm-to-neutral color temperature.
- Maintain spatial depth and tonal variation — do not flatten to uniform illumination.
- Differentiate material qualities through lighting where appropriate.
- Do NOT introduce new light sources or fixtures.
- Achieve brightness through material reflectivity, not new lighting.
- Avoid cinematic contrast, heavy shadows, and overcast tones.

**PHASE 2 SELF-AUDIT — REVIEW BEFORE GENERATING:**

Run each check. Correct any failure before generating.

1. Style Fidelity:
   - Would a viewer identify this as {{STYLE_NAME}}?
   - Are core_materials visibly present?
   - Is the color_palette represented on at least one primary surface or major furnishing?
   - Are at least TWO Signature Elements clearly present in the output?
   - If any check fails → revise before generating.

2. Material Hierarchy:
   - Do primary surfaces contrast in value or material identity?
   - Are surfaces the same or near-identical neutral tone despite a varied palette?
   - If yes → revise surface treatments to restore contrast within the structural protocol.

3. Staging Density:
   - Does object count and grouping match the active STAGING DENSITY tier?
   - LAYERED: rich, composed, full groupings. BALANCED: intentional, clear focal point. SPARSE: restrained, deliberate negative space.
   - If off → add or remove objects to align with the active tier.

4. Structural Integrity:
   - Are all windows in their original geometry and positions?
   - Has the camera angle, perspective, or room proportions remained unchanged?
   - Has any new wall, column, partition, or architectural element been introduced?
   - Has any new built-in light fixture been added that was not present in the source?
   - If yes to any violation → remove it before generating.
{{INJECTED_ITEM_AUDIT_BLOCK}}`;


// ── PASS-THROUGH: INFLUENCE + DEFAULT REQUEST ─────────────────────────────────
// Re-exported from improved/visualization.constants — unchanged from v4.0.
// ─────────────────────────────────────────────────────────────────────────────
export {
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    DEFAULT_USER_REQUEST,
} from '../improved/visualization.constants.js';



