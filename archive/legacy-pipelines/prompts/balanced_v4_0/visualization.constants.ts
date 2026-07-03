// ============================================================
// BALANCED V4.0 — PROMPT CONSTANTS
// TEMPLATE VERSION: 4.0
// COMPATIBLE WITH: pipelineMode "balanced_v4_0"
//
// Changes from v3.0 (template 3.1):
//   - Constraint hierarchy block introduced as a standalone system
//   - Image role labeling system (declared in imageRoles.ts, assembled in service)
//   - Injected item identity preservation block (replaces INSTRUCTION_INTEGRATE_FURNITURE)
//   - PRIORITY ORDER updated: injected item identity inserted as item 2
//   - STYLE CONFLICT RESOLUTION: injected item resolution rule added
//   - FURNISHING STRATEGY: scoped to non-injected furniture only
//   - PHASE 2 SELF-AUDIT: {{INJECTED_ITEM_AUDIT_BLOCK}} placeholder added
//   - Structural part: unchanged from v3.0 (re-exported)
//
// INVARIANT: v3.0 files are frozen. This file does not import mutable state
// from v3.0 — structural part is re-exported; influence constants are
// re-exported from improved/visualization.constants.
// ============================================================

export const TEMPLATE_VERSION = '4.0';
export const PIPELINE_MODE = 'balanced_v4_0';

// ── STRUCTURAL PART ───────────────────────────────────────────────────────────
// Identical to v3.0. Re-exported to avoid duplication.
// Changes to architectural constraints require a new template version.
// ─────────────────────────────────────────────────────────────────────────────
export { BALANCED_V3_0_STRUCTURAL_PART as BALANCED_V4_0_STRUCTURAL_PART } from '../balanced_v3_0/visualization.constants.js';


// ── CONSTRAINT HIERARCHY BLOCK ────────────────────────────────────────────────
// Assembled dynamically based on whether an injected item is present.
// Always inserted as the first text block after the base room image.
// Tier 2 explicitly states active/inactive — the block is always present.
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
        '  Fixed elements that cannot change under any instruction from any tier below:',
        '  - Wall planes, floor, ceiling, and room geometry',
        '  - Window and door geometry, position, and size',
        '  - Camera angle, perspective vanishing points, and room proportions',
        '  - Built-in light fixtures present in the source image',
        '  No style instruction, injected item, or user request may alter these.',
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
// Inserted into the request only when an injected item is present.
// Follows the image role label and the item image directly.
// ─────────────────────────────────────────────────────────────────────────────
export const INJECTED_ITEM_BLOCK_HEADER = `**INJECTED ITEM — IDENTITY PRESERVATION REQUIRED:**

One item has been provided and MUST appear in the final output.

PRESERVE (these are non-negotiable):
  - Overall silhouette, proportions, and profile
  - Color and material identity — if the item is walnut with brass hardware, render it as
    walnut with brass hardware, not the nearest style-compatible alternative
  - Surface finish — matte stays matte, gloss stays gloss, textured stays textured
  - Recognizable design features: leg style, arm shape, back profile, hardware details,
    upholstery pattern or texture if visible

APPLY (required for scene integration):
  - Placement: position in a functionally correct location for the room type shown
    (infer from the room's layout, spatial logic, and the item's visible characteristics)
  - Scale: realistic proportions relative to the room and its vanishing points
  - Lighting direction: match existing room light sources — direction and shadow geometry only
  - Shadows: cast natural, accurate shadows to ground the item in the scene

NEVER:
  - Substitute with a generic version of the same item type
  - Restyle, recolor, or refinish the item to match the active style preset
  - Omit or replace the item because it conflicts with the room's aesthetic
  - Generate a "similar" item — generate the EXACT item shown in the reference image
  - Shift the item's color temperature to match the room's ambient warmth
  - Apply the active style's materials or finishes to this item`.trim();


// ── INJECTED ITEM SELF-AUDIT TEXT ─────────────────────────────────────────────
// Injected into {{INJECTED_ITEM_AUDIT_BLOCK}} in the style template when an
// item is present. Empty string is injected when no item is present.
// ─────────────────────────────────────────────────────────────────────────────
export const INJECTED_ITEM_AUDIT_TEXT = `
5. Injected Item Identity:
   - Is the injected item present in the output?
   - Does the item's color, material, and silhouette match its reference image?
   - Has the item been restyled, substituted, or omitted?
   - If any failure → correct before generating.
   Note: an injected item that conflicts with the active style is not a style fidelity failure.
   It is intentional. Tier 2 takes precedence over Tier 4.`;


// ── STYLE PART TEMPLATE ───────────────────────────────────────────────────────
// Derived from BALANCED_V3_0_STYLE_TEMPLATE (template v3.1) with targeted
// modifications. Changes are marked with [V4.0 CHANGE] comments.
//
// Modifications from v3.0:
//   1. PRIORITY ORDER: item 2 added (injected item identity); items renumbered
//   2. STYLE CONFLICT RESOLUTION: injected item rule added
//   3. FURNISHING STRATEGY: "furniture" → "non-injected furniture" + Tier 2 note
//   4. PHASE 2 SELF-AUDIT: {{INJECTED_ITEM_AUDIT_BLOCK}} placeholder appended
//
// Placeholder inventory (identical to v3.0 plus one new):
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
//   {{INJECTED_ITEM_AUDIT_BLOCK}} — NEW: INJECTED_ITEM_AUDIT_TEXT or empty string
// ─────────────────────────────────────────────────────────────────────────────
export const BALANCED_V4_0_STYLE_TEMPLATE = `
**PRIORITY ORDER — READ BEFORE PROCEEDING:**
1. Structural constraints (Phase 1 rules — highest priority, override all below)
2. Injected item identity (Tier 2 — if item present, its identity overrides style; see Constraint Hierarchy)
3. Room function and furniture layout
4. Style expression
5. Decorative details

**STYLE CONFLICT RESOLUTION:**
Ignore any style instruction that conflicts with fixed architecture.
Resolve through movable or surface-level elements only:
- furniture, textiles, movable lighting (floor lamps, table lamps)
- paint and wall treatments
- rugs and soft furnishings
- decor, cabinetry, storage furniture

Injected items (if present) must not be restyled — resolve style conflicts through surrounding non-injected furniture, surfaces, and decor.

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
- Reuse, adapt, or replace non-injected furniture to match the target style.
  Injected items (if any) are governed by Tier 2 constraints — do not apply style transformation to them.
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
{{INJECTED_ITEM_AUDIT_BLOCK}}`;


// ── PASS-THROUGH: INFLUENCE + DEFAULT REQUEST ─────────────────────────────────
// Re-exported from improved/visualization.constants — unchanged from v3.0.
// ─────────────────────────────────────────────────────────────────────────────
export {
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    DEFAULT_USER_REQUEST,
} from '../improved/visualization.constants.js';



