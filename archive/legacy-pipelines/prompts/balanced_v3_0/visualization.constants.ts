// ============================================================
// BALANCED V3.1 — PROMPT TEMPLATES
// TEMPLATE VERSION: 3.1
// COMPATIBLE WITH: pipelineMode "balanced_v3_0"
//
// Changes from v3.0:
//   - Fixed Element Immutability: light fixtures added to structural fixed elements list
//   - Lighting Source Immutability section added (positive redirection for lighting)
//   - STYLE CONFLICT RESOLUTION clarifies movable vs built-in lighting
//   - PHASE 2 SELF-AUDIT adds light fixture check
//
// Changes from v2.3:
//   - structuralPart: rewritten with v3.0 optimized wording (~30% shorter)
//   - stylePart: converted to template with {{PLACEHOLDERS}}
//   - Style fields injected from styleObject (no duplication)
//   - Room-specific fields injected from room-type registry
//   - Density block injected from density block registry
//   - HIGH DENSITY GROUP JUSTIFICATION is conditional (LAYERED only)
//   - Structural protocol block removed (redundant with Phase 1)
//   - aperture_look has no injection point in this template version
//
// INVARIANT RULE: Do NOT add hardcoded style/room/density values to this file.
// All variable content must flow through {{PLACEHOLDERS}} and the injection layer.
// ============================================================

export const TEMPLATE_VERSION = '3.1';
export const PIPELINE_MODE = 'balanced_v3_0';

// ── STRUCTURAL PART ───────────────────────────────────────────────────────────
// Fully static. No placeholders. Never modified per style, room, or density.
// Changes here require a new template version and full behavioral re-validation.
// ─────────────────────────────────────────────────────────────────────────────
export const BALANCED_V3_0_STRUCTURAL_PART = `
**PHASE 1: ARCHITECTURAL ANCHORING**

Fixed elements — DO NOT change:
- Wall planes, floor plane, ceiling plane
- Window and door frames, positions, and sizes
- Camera angle, focal length, perspective vanishing points
- Room spatial proportions and depth
- Built-in light fixtures (ceiling lights, pendant lights, recessed lights, sconces)

If the source image contains NO ceiling fixture, you MUST NOT add one — even if the style calls for overhead lighting.
Style requirements CANNOT be satisfied by adding missing elements. They must be satisfied through transformation of what already exists.

Modify surface finishes, furniture, and decor to match the selected style.
Do not alter spatial layout or structural logic.

**ARTIFACT REMOVAL:**
Remove all non-permanent artifacts from the input image:
- exposed cables, loose wires, power strips, temporary clutter
Replace with clean surfaces or staged alternatives.
This rule overrides general realism preservation.

**WINDOW IMMUTABILITY RULE:**
Preserve all window and glass opening geometry. Do not change:
- size, shape, or position
- pane count or mullion pattern
- frame divisions or grid

Do not add divided panes, grids, arches, shutters, new frames, or new openings.

Permitted changes only:
- curtains, blinds, soft treatments
- trim paint color
- surrounding wall finish
- frame color or finish (no geometry change)

Express window-style preferences through furniture, textiles, materials, colors, and decor — not window geometry.

**WINDOW SYSTEM INTEGRITY:**
Treat all windows as one continuous system. Preserve:
- total glazing span and width
- opening continuity
- spacing between sections
- relationship between frame, wall, trim, and exterior view

Do NOT:
- split continuous glazing into multiple windows
- insert walls, columns, posts, panels, or vertical breaks within an existing window span
- reduce, compress, redistribute, or fragment glazing area
- convert a wide opening into multiple smaller openings
- create wall segments where glass existed in the input

If the input shows a continuous horizontal window band, it MUST remain continuous.
Curtains, blinds, and furniture must not imply permanent wall structure or changed aperture geometry.

**EXTERIOR VIEW PRESERVATION:**
Preserve the visible exterior through all windows exactly as it appears in the input.
Do not replace, beautify, landscape, blur, or restyle the outdoor view.
The exterior must remain unchanged regardless of the selected style.
`;


// ── STYLE PART TEMPLATE ───────────────────────────────────────────────────────
// Contains {{PLACEHOLDERS}} replaced at runtime by the injection layer.
// All content between section headers is either static constraint text or a
// placeholder — never a hardcoded style, room, or density value.
//
// Placeholder inventory:
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
//   {{STYLE_DONTS_BLOCK}}         — styleObject.model_inputs.dont (bullet block)
//
// Whitespace contracts (enforced by injection layer, not this template):
//   {{HIGH_DENSITY_GROUP_BLOCK}}  — see injection layer §4.4
//   {{STYLE_DONTS_BLOCK}}         — see injection layer §4.4
// ─────────────────────────────────────────────────────────────────────────────
export const BALANCED_V3_0_STYLE_TEMPLATE = `
**PRIORITY ORDER — READ BEFORE PROCEEDING:**
1. Structural constraints (Phase 1 rules override all below)
2. Room function and furniture layout
3. Style expression
4. Decorative details

**STYLE CONFLICT RESOLUTION:**
Ignore any style instruction that conflicts with fixed architecture.
Resolve through movable or surface-level elements only:
- furniture, textiles, movable lighting (floor lamps, table lamps)
- paint and wall treatments
- rugs and soft furnishings
- decor, cabinetry, storage furniture

**PHASE 2: STYLE TRANSFORMATION**
- Room Type: {{ROOM_TYPE}}
- Task: Transform the room into the {{STYLE_NAME}} aesthetic.
- Output: Photorealistic, fully-furnished renovation of the SAME room.
- User request: "{{USER_REQUEST}}"

**RENOVATION CONTINUITY:**
Maintain plausible furniture placement relative to walls, windows, circulation paths, and focal points.
Avoid re-layouts that ignore original spatial logic.

**FURNISHING STRATEGY:**
- Furnish completely and realistically for the selected room type and style.
- Reuse, adapt, or replace furniture to match the target style.
- Always furnish; if the room is empty, introduce a plausible layout. Do not leave it empty unless explicitly requested.
- Furnishing must reflect realistic use: {{ROOM_FUNCTION_USES}}.

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

{{STYLE_DONTS_BLOCK}}

**STYLE PRIORITY:**
- Express the {{STYLE_NAME}} aesthetic recognizably.
- Express style through the specified materials, colors, and finishes — not decor or arbitrary objects. Avoid generic interpretations.

**Style fidelity failure conditions:**
- No core_materials are visible → style fidelity failed.
- The color_palette is not meaningfully represented on surfaces or major furnishings → style fidelity failed.
- Output is style-agnostic regardless of the Style Definition → style fidelity failed.

**MATERIAL HIERARCHY:**
Primary surfaces (walls, floor, ceiling, dominant furniture) must contrast in value, tone, or material identity. Do not collapse surfaces into the same neutral tone even if individually correct. Where core_materials span varied tones or textures, express those differences across primary surfaces through paint, wallcovering, flooring, and surface treatments.

**Material hierarchy failure condition:**
All major surfaces are the same or near-identical in value and saturation despite a varied Style Definition palette → material hierarchy failed.

**RENOVATION FEASIBILITY RULES:**
- Apply materials consistent with real-world construction.
- Do not apply heavy materials (stone, brick) to thin, ornamental, or detailed features.
- Large-scale materials must respect existing wall planes and proportions.
- If a material conflicts with geometry, adapt the material; do not distort the structure.

**LIGHTING NORMALIZATION:**
- Preserve the brightness level and daylight direction of the original image; do not darken the scene.
- Use bright, natural, residential lighting with warm-to-neutral white color temperature.
- Avoid cinematic lighting, heavy contrast, moody shadows, and overcast tones.
- Materials must remain well-lit, color-accurate, and visually readable.

**LIGHTING ENHANCEMENT:**
- Generate style-appropriate lighting that supports the target aesthetic.
- Maintain spatial depth; do not flatten the room by reducing tonal variation.
- Preserve tonal transitions between lit and unlit surfaces where they support spatial legibility.
- Use lighting to differentiate material qualities where the Style Definition specifies varied textures or finishes.
- Do not reduce to flat, uniform illumination as a side effect of brightness preservation.

**LIGHTING SOURCE IMMUTABILITY:**
- All lighting improvements must be achieved by modifying existing conditions only:
  - Adjust perceived brightness and exposure of the scene
  - Shift the color temperature of existing light sources
  - Increase surface reflectivity or finish luminosity through material choices
- Do NOT introduce new light sources, fixtures, or openings to achieve brightness or ambiance.
- If the style requires bright, airy, or natural-light-filled results and the source room lacks this,
  achieve it through material reflectivity and finish — not by adding windows or fixtures.

**PHASE 2 SELF-AUDIT — REVIEW BEFORE GENERATING:**

Run each check. Correct any failure before generating.

1. Style Recognizability:
   - Would a viewer identify this as {{STYLE_NAME}}?
   - Are core_materials visibly present?
   - Is the color_palette represented on at least one primary surface or major furnishing?
   - If no → revise material and color selection.

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
`;


// ── PASS-THROUGH HELPERS ──────────────────────────────────────────────────────
// Influence and furniture prompts are unchanged from v2.2.
// Re-exported here so the v3.0 service only needs to import from this module.
export {
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    INSTRUCTION_INTEGRATE_FURNITURE,
    DEFAULT_USER_REQUEST,
} from '../improved/visualization.constants.js';



