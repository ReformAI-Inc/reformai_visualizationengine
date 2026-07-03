// ============================================
// VISUALIZATION PROMPTS - BALANCED V2.2 / V2.3
// ============================================
// balanced_v2_2 builds on balanced_v2_1.
// balanced_v2_1 fixed: arbitrary object placement, filler decor.
// balanced_v2_2 fixes: style objects overriding architectural constraints,
//   specifically aperture_look forcing window geometry changes (e.g. Farmhouse
//   "white divided-pane windows" mutating existing modern windows).
//
// New in v2.2 vs v2.1:
// - WINDOW_IMMUTABILITY_RULE: hard structural rule embedded in Phase 1
// - EXTERIOR_VIEW_PRESERVATION: preserves outdoor view through windows
// - PRIORITY_HIERARCHY: constraint > function > style > decor, placed first in Phase 2
// - STYLE_CONFLICT_RESOLUTION: how to resolve style vs structure conflicts
// - Aperture sanitizer in prompt builder (runtime, not a constant)
// - allowArchitecturalStyleMutation: false flag exposed in debug metadata
//
// New in v2.3 vs v2.2 (prompt-only, same pipeline mode):
// - STYLE_PRIORITY: added auditable failure conditions anchored to style object fields
// - OBJECT_JUSTIFICATION_RULE: added HIGH DENSITY GROUP JUSTIFICATION extension
// - LIGHTING_PRESERVATION_AND_NORMALIZATION: split into normalization + enhancement
// - MATERIAL_HIERARCHY_RULE: new block enforcing surface contrast with failure definition
// - SELF_AUDIT_CHECK: terminal Phase 2 self-review block (after structural protocol)
//
// Everything else (furnishing strategy, object placement logic, realism constraint,
// design rules, renovation feasibility) is identical to balanced_v2_2.

// Reuse influence / furniture / default helpers from improved
export {
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    INSTRUCTION_INTEGRATE_FURNITURE,
    DEFAULT_USER_REQUEST,
} from '../improved/visualization.constants.js';


// --------------------------------------------
// PHASE 1 — ARCHITECTURAL ANCHOR + WINDOW RULES
// Expands v2.1 Phase 1 with WINDOW_IMMUTABILITY_RULE
// and EXTERIOR_VIEW_PRESERVATION embedded as hard constraints.
// --------------------------------------------
export const BALANCED_V2_2_PHASE_1 = `
**PHASE 1: ARCHITECTURAL ANCHORING**

The following elements are FIXED and must not change:
- Wall planes, floor plane, and ceiling plane
- Window and door frames, their exact positions and sizes
- Camera angle, focal length, and perspective vanishing points
- Room spatial proportions and overall depth

Treat the input image as a real room undergoing renovation — not an empty architectural shell.
- Modify, replace, or upgrade surface finishes, furniture, and decor as needed for the selected style.
- Preserve the underlying spatial logic, layout, and lighting behavior of the original room.

Do NOT preserve incidental or low-quality real-world artifacts such as exposed cables, loose wires, power strips, or temporary clutter, even if they appear in the input image. These elements must be removed as part of the renovation and staging process.
- The result should feel like a before-and-after renovation of the same physical space, not a rebuilt scene.

**WINDOW IMMUTABILITY RULE:**
- Preserve the exact geometry of all windows and glass openings.
- Do not change:
  - window size, shape, or position
  - number of panes or mullion pattern
  - frame divisions or grid structure
  - the exterior view visible through the window
- Do not add divided panes, grids, arches, shutters, new frames, or new openings.
- Allowed window changes only:
  - curtains, blinds, and soft window treatments
  - trim paint color
  - surrounding wall finish or material
  - subtle frame color or finish changes that do not alter geometry
- If the selected style normally includes a different window type, express that style through furniture, textiles, materials, colors, and decor instead — not by modifying the window.

**WINDOW SYSTEM INTEGRITY:**
- Treat all windows and glass openings as one continuous architectural system.
- Preserve:
  - total span and width of glazing across the wall
  - continuity of the opening
  - relative spacing between window sections
  - relationship between window frame, wall, trim, and exterior view
- Do NOT:
  - split a continuous window into multiple separate windows
  - insert walls, columns, posts, solid panels, or vertical breaks inside an existing window span
  - reduce, compress, redistribute, or fragment glazing area
  - convert one wide opening into multiple smaller openings
  - create new wall segments where glass or window area existed in the input
- If the input shows a continuous horizontal window band, it MUST remain continuous in the output.
- Curtains, blinds, and furniture may overlap or partially cover windows, but they must not imply new permanent wall structure or changed aperture geometry.

**EXTERIOR VIEW PRESERVATION:**
- Preserve the visible exterior environment through all windows exactly as it appears in the input image.
- Do not replace, beautify, landscape, blur, or restyle the outdoor view.
- The window is a fixed aperture into the original real-world scene.
- The exterior must remain unchanged regardless of the selected style.
`;


// --------------------------------------------
// STAGING DENSITY (new in v2.3)
// Three pre-resolved constants injected at build time based on style preset.
// Governs GENERATED objects only — mandatory (Layer 0.5) objects are exempt.
// Each constant carries both a target character (prevents underpopulation)
// and numerical ceilings (prevents overpopulation).
// --------------------------------------------
export const STAGING_DENSITY_LOW = `
**STAGING DENSITY — SPARSE (applies to GENERATED objects only):**
Aim for deliberate, restrained population. Negative space is intentional and correct at this tier.
- Supporting furniture: 1 piece per primary unit (not bilateral)
- Secondary furniture: none
- Surface objects: maximum 1 per surface; must be functional
- Grouped decor: not permitted
- Wall art: maximum 1 piece, anchored to primary furniture
- Textiles: rug + primary pillow set only; no throw; no accent pillows
- Secondary zones: none
`;

export const STAGING_DENSITY_MEDIUM = `
**STAGING DENSITY — BALANCED (applies to GENERATED objects only):**
Aim for intentional, clear-focal-point population. Moderate presence without clutter.
- Supporting furniture: standard bilateral placement
- Secondary furniture: 1 piece if independently spatially justified
- Surface objects: maximum 2 per surface; at least 1 must be functional
- Grouped decor: pairs only (maximum 2 items per surface)
- Wall art: maximum 2 pieces, each anchored to a furniture zone
- Textiles: rug + standard pillows + up to 2 accent pillows + 1 throw (natural drape only)
- Secondary zones: 1, with functional anchor and supporting furniture
`;

export const STAGING_DENSITY_HIGH = `
**STAGING DENSITY — LAYERED (applies to GENERATED objects only):**
Aim for rich, composed population with strong material identity and a warm, expressive atmosphere. Still professionally staged — not cluttered.
- Supporting furniture: full bilateral and contextual placement
- Secondary furniture: maximum 2, each independently justified
- Surface objects: 3–4 per dedicated surface; within a composed grouping, the group is the condition-3 justification unit
- Grouped decor: 3–5 items per dedicated surface (tray, console top, dresser surface)
- Wall art: maximum 3 pieces; gallery wall permitted if anchored to a furniture zone
- Textiles: full layered arrangement (rug + layered pillows + throw styled as design element)
- Secondary zones: maximum 2, each with functional anchor and supporting furniture
`;


// --------------------------------------------
// PRIORITY HIERARCHY
// Placed at the very start of Phase 2, before any style content.
// Reinforces that Phase 1 structural constraints are non-negotiable.
// --------------------------------------------
export const PRIORITY_HIERARCHY = `
**PRIORITY ORDER — READ BEFORE PROCEEDING:**
1. Structural constraints are non-negotiable (Phase 1 rules override everything below)
2. Room function and furniture layout
3. Style expression
4. Decorative details

If any style instruction conflicts with structural preservation, structural preservation wins.
Adapt the style to the existing room. Do not adapt the room architecture to the style.
`;


// --------------------------------------------
// STYLE CONFLICT RESOLUTION
// Placed immediately after PRIORITY_HIERARCHY in Phase 2.
// Tells the model HOW to resolve conflicts — use movable elements only.
// --------------------------------------------
export const STYLE_CONFLICT_RESOLUTION = `
**STYLE CONFLICT RESOLUTION:**
- If a style definition requests or implies changes to fixed architecture, ignore that part of the style definition.
- Do not mention the conflict in the output image.
- Resolve the style using movable or surface-level elements only:
  - furniture
  - textiles
  - lighting fixtures
  - paint and wall treatments
  - rugs and soft furnishings
  - decor
  - cabinetry or storage furniture
- Window style preferences must be expressed through curtains, blinds, trim finish, and nearby materials — never through geometry changes.
`;


// --------------------------------------------
// PHASE 2 HEADER
// --------------------------------------------
export const BALANCED_V2_2_PHASE_2_HEADER = `
**PHASE 2: STYLE TRANSFORMATION**
- Room Type: {{ROOM_TYPE}}
- Task: Transform the room into the {{STYLE_NAME}} aesthetic.
- Output Goal: A photorealistic, fully-furnished renovation result of the SAME room.
- User request: "{{USER_REQUEST}}"
`;


// --------------------------------------------
// RENOVATION CONTINUITY
// Identical to v2.1.
// --------------------------------------------
export const RENOVATION_CONTINUITY = `
**RENOVATION CONTINUITY:**
- The output must feel like a real renovation of the input room, not a reimagined or rebuilt scene.
- Maintain plausible furniture placement relative to walls, windows, circulation paths, and focal points.
- Avoid dramatic re-layouts that ignore the original spatial logic.
- The result should feel like a before-and-after transformation of the same room.
`;


// --------------------------------------------
// FURNISHING STRATEGY
// Identical to v2.1.
// --------------------------------------------
export const FURNISHING_STRATEGY = `
**FURNISHING STRATEGY:**
- Furnish the room in a complete but realistic way for the selected room type and style.
- You may reuse, adapt, or replace furniture as needed to match the target style.
- If the source room is empty, introduce a plausible furniture layout appropriate for the style.
- Do not leave the room empty unless explicitly requested.
- Do not over-stage the room beyond what is realistic for a lived-in, professionally designed interior.
- Furnishing must reflect realistic use of the space (sleeping, storage, circulation).
- Avoid unnecessary or decorative-only objects that do not support the room's function.
`;


// --------------------------------------------
// OBJECT PLACEMENT LOGIC
// Identical to v2.1.
// --------------------------------------------
export const OBJECT_PLACEMENT_LOGIC = `
**OBJECT PLACEMENT LOGIC:**
- Every furniture or decor item must have a clear functional or spatial justification.
- Do NOT place objects solely to fill empty wall space or balance composition.
- Avoid isolated or unsupported items (e.g., standalone mirrors, chairs, or decor with no relationship to nearby furniture).
- Vertical elements (mirrors, art, shelving) must be anchored to a logical surface:
  - above a dresser or console
  - aligned with a bed or seating area
  - integrated into a cohesive wall composition
- Floor objects must respect circulation and not block natural movement paths.
- If a placement feels arbitrary or unsupported, omit the object instead of forcing it into the scene.
- Prefer omission over arbitrary placement.
`;


// --------------------------------------------
// STYLE PRIORITY
// Identical to v2.1.
// --------------------------------------------
export const STYLE_PRIORITY = `
**STYLE PRIORITY:**
- Ensure the design clearly reflects the defining characteristics of the selected style.
- Use the provided materials, colors, and finishes to create a distinctive and recognizable aesthetic.
- Avoid overly neutral or generic interpretations.
- Style must be expressed through materials, color palette, and furniture selection — not through excessive decor or arbitrary object placement.

**Failure conditions — style fidelity:**
- If none of the core_materials listed in the Style Definition are visibly present in the output, style fidelity has failed.
- If the color_palette listed in the Style Definition is not meaningfully represented across surfaces or major furnishings, style fidelity has failed.
- An output that could belong to any style regardless of the Style Definition has failed style fidelity, independent of structural correctness.
`;


// --------------------------------------------
// REALISM CONSTRAINT
// Identical to v2.1.
// --------------------------------------------
export const REALISM_CONSTRAINT = `
**REALISM CONSTRAINT:**
- The room must feel like a real, livable residential interior, not a conceptual render or cinematic scene.
- Avoid dark, moody, or theatrically dim lighting. Warm, well-lit residential lighting is preferred and does not count as dramatic.
- Materials, lighting, and furniture should feel natural, vibrant, and appropriate for everyday living.
- The result should resemble a professionally staged home renovation visualization, not a stylized design showcase.
`;


// --------------------------------------------
// DESIGN RULES V2.2
// Identical to v2.1.
// --------------------------------------------
export const DESIGN_RULES_V2_2 = `
**DESIGN RULES:**

1. **Architectural Priority:**
   - Furniture adapts to the room — not the reverse.
   - Do not alter walls, windows, doors, or architectural openings to fit furniture.
   - Apply all materials as surface treatments, not structural additions.
   - Do not introduce new walls, partitions, or dividers.

2. **Material Zoning:**
   - Apply materials selectively and realistically.
   - Balance dominant materials with quieter secondary surfaces — do not repeat one material on every surface.

3. **Lighting:**
   - Maintain the light directionality and spatial character of the original image.
   - Preserve material readability — surfaces should remain clearly visible and color-accurate.
   - Shadows should be soft and realistic, consistent with the original image's ambient conditions.
`;


// --------------------------------------------
// RENOVATION FEASIBILITY RULES
// Identical to v2.1.
// --------------------------------------------
export const RENOVATION_FEASIBILITY_RULES = `
**RENOVATION FEASIBILITY RULES:**
- Apply materials in ways consistent with real-world construction.
- Do not apply heavy materials (such as stone or brick) to thin, detailed, or ornamental architectural features.
- Large-scale materials must respect existing wall planes and proportions.
- If a material conflicts with geometry, adapt the material — do not distort the structure.
`;


// --------------------------------------------
// LIGHTING PRESERVATION AND NORMALIZATION
// v2.3: split into normalization (preservation) and enhancement (generation).
// Normalization block unchanged from v2.1. Enhancement section is additive.
// --------------------------------------------
export const LIGHTING_PRESERVATION_AND_NORMALIZATION = `
**LIGHTING NORMALIZATION:**
- Preserve the brightness level of the original image.
- Do not make the scene darker than the input unless explicitly requested.
- Maintain the same daylight direction and realistic daylight intensity.
- Use bright, natural, residential lighting with warm-to-neutral white color temperature.
- Avoid cinematic lighting, heavy contrast, moody shadows, and overcast gray tones.
- Materials must remain well-lit, color-accurate, and visually readable.
- The final image should feel like it was photographed in natural daylight, not dramatically lit for mood.

**LIGHTING ENHANCEMENT (generation objective):**
- Generate style-appropriate lighting quality that supports the target aesthetic.
- Maintain or improve spatial depth cues — do not flatten the room by reducing tonal variation across surfaces.
- Preserve tonal transitions between lit and unlit surfaces where they contribute to spatial legibility.
- Where the Style Definition specifies varied textures or finishes, use lighting to differentiate and reveal those material qualities.
- Do not reduce the room to flat, uniform illumination as a side effect of brightness preservation.
`;


// --------------------------------------------
// STRUCTURAL PROTOCOLS
// Same logic as v2.1, prefixed V2_2.
// --------------------------------------------
export const BALANCED_V2_2_PROTOCOL_RIGID_BASE = `
**STRUCTURAL PROTOCOL:**
- Preserve all walls, architectural openings, and the original spatial layout.
- No structural reinterpretation permitted.
`;

export const BALANCED_V2_2_PROTOCOL_RIGID_APERTURE_LOCK = `
**STRUCTURAL PROTOCOL:**
- Preserve all walls, architectural openings, and the original spatial layout.
- Protect windows, glass areas, and uninterrupted wall spans.
- Do not insert partitions, dividers, or structural separators.
- Where a requested material conflicts with decorative trim, respect core wall geometry and apply the material as a flat surface treatment.
`;

export const BALANCED_V2_2_PROTOCOL_SURFACE_ONLY_TRANSFORM = `
**STRUCTURAL PROTOCOL:**
- Preserve all architectural edges, junctions, and transitions.
- Maintain the 3D depth and complexity of the original room structure.
- Finishes and visual surfaces may be simplified, but do not flatten or erase existing architectural boundaries.
`;


// --------------------------------------------
// INPUT CLEANUP RULE (new in v2.2 update)
// Added to the structural part (Phase 1) so the model processes source-image
// cleanup before any style instructions are applied.
// --------------------------------------------
export const INPUT_CLEANUP_RULE = `
**INPUT CLEANUP RULE:**
- Preserve architectural elements and permanent features of the room.
- Remove all non-permanent, low-quality artifacts from the original image, including:
  - exposed cables or extension cords
  - loose wires
  - power strips
  - temporary floor clutter

- These elements are considered non-essential and MUST NOT be preserved.

- This rule takes precedence over general realism preservation.

- Replace removed elements with:
  - clean, uninterrupted surfaces
  - or properly staged alternatives where appropriate

- The final image should reflect a professionally cleaned and staged version of the same room.
`;


// --------------------------------------------
// STAGING QUALITY RULE (new in v2.2 update)
// Placed after REALISM_CONSTRAINT in Phase 2.
// Global quality gate — eliminates anything that reduces perceived quality.
// --------------------------------------------
export const STAGING_QUALITY_RULE = `
**STAGING AND REALISM:**
- The room must feel like a real, livable residential interior — not a concept render or editorial showcase.
- The output must look professionally staged: every object intentional, well-placed, and appropriate.
- Do NOT include visible cables, wiring, clutter, or accidental-looking elements.
- Lighting must be warm, well-lit, and residential — not dark, moody, or cinematic.
- Include only details that enhance material believability or support room function.
- Exclude anything that introduces visual noise, reduces perceived quality, or feels unintentional or temporary.
`;


// --------------------------------------------
// OBJECT JUSTIFICATION RULE (new in v2.2 update)
// Refinement of OBJECT_PLACEMENT_LOGIC — stricter, all-conditions test.
// Placed immediately after OBJECT_PLACEMENT_LOGIC in Phase 2.
// --------------------------------------------
export const OBJECT_JUSTIFICATION_RULE = `
**OBJECT JUSTIFICATION RULE:**
- Every object must meet ALL of the following conditions:

  1. Functional Anchor:
     - Directly tied to nearby furniture (bed, dresser, seating area)

  2. Spatial Purpose:
     - Supports a use (lighting, storage, seating, reflection, circulation)

  3. Design Contribution:
     - Improves composition or usability of the space

- If any condition fails → DO NOT include the object.
- Prefer omission over arbitrary placement.

**HIGH DENSITY GROUP JUSTIFICATION (applies only when STAGING DENSITY — LAYERED is active):**
- A composed grouping on a dedicated surface (tray, console, dresser, shelf) may satisfy condition 3 collectively as a unit — the group's design contribution is evaluated as a whole, not object by object.
- The group as a whole must still satisfy conditions 1 and 2.
- This does NOT increase density ceilings — object count limits in the active STAGING DENSITY block remain in force.
- Every object in the group must be anchored to a valid surface or furniture zone — no floating, free-standing, or structurally unsupported groupings.
`;


// --------------------------------------------
// MIRROR PLACEMENT RULE (new in v2.2 update)
// Placed immediately after OBJECT_JUSTIFICATION_RULE in Phase 2.
// Directly targets the random mirror issue observed in v2.2 outputs.
// --------------------------------------------
export const MIRROR_PLACEMENT_RULE = `
**MIRROR PLACEMENT RULE:**
- Mirrors are ONLY allowed if:
  - mounted above a dresser, console, or vanity
  - OR clearly part of a functional dressing or seating area
- Mirrors must NOT:
  - float on empty walls with no anchor furniture beneath or beside them
  - be centered above beds without a functional dresser or console below
  - exist solely to fill space or balance composition
- If mirror placement is not clearly justified → OMIT the mirror.
`;


// --------------------------------------------
// REALISM FILTER (new in v2.2 update)
// Placed after STAGING_QUALITY_RULE in Phase 2.
// Distinguishes good realism details from clutter-inducing ones.
// --------------------------------------------
export const REALISM_FILTER = `
**REALISM FILTER:**
- Include only realism details that:
  - enhance material believability
  - support the room's function
  - align with professional interior staging
- Exclude realism details that:
  - introduce clutter or visual noise
  - reduce perceived quality
  - feel accidental, temporary, or unintentional
`;


// --------------------------------------------
// MATERIAL HIERARCHY RULE (new in v2.3)
// Enforces surface-level contrast across primary room elements.
// Anchored to Style Definition fields — failure condition is auditable.
// Scoped to transformations permitted by the active structural protocol.
// --------------------------------------------
export const MATERIAL_HIERARCHY_RULE = `
**MATERIAL HIERARCHY:**
- Primary surfaces (walls, floor, ceiling, and dominant furniture) must show visible contrast in value, tone, or material identity.
- Do not collapse all major surfaces into the same neutral tone, even if each surface is individually correct.
- If the Style Definition specifies core_materials with varied tonal ranges or textures, those differences must be expressed across the primary surfaces.
- Apply material hierarchy within the bounds of the active structural protocol — use paint, wallcovering, flooring, and surface treatments that the protocol permits.

**Failure condition:**
- If all major surfaces are the same or nearly identical in value and saturation, and the Style Definition specifies a varied material palette, material hierarchy has failed.
`;


// --------------------------------------------
// SELF-AUDIT CHECK (new in v2.3)
// Terminal Phase 2 block, placed after the structural protocol.
// Uses {{STYLE_NAME}} placeholder — replaced at build time in the prompt builder.
// Asks the model to review its intended output against four concrete criteria
// before generating. No new constraints introduced — references existing rules only.
// --------------------------------------------
export const SELF_AUDIT_CHECK = `
**PHASE 2 SELF-AUDIT — REVIEW BEFORE GENERATING:**

Run the following checks on the intended output before generating. If a check fails, correct the output before proceeding.

  1. Style Recognizability:
     - Would a viewer immediately identify this as {{STYLE_NAME}}?
     - Are at least some of the core_materials from the Style Definition visibly present?
     - Is the color_palette from the Style Definition represented on at least one primary surface or major furnishing?
     - If no → revise material and color selection.

  2. Material Hierarchy:
     - Do the primary surfaces show visible contrast in value or material identity?
     - Are they all the same or nearly the same neutral tone despite a varied Style Definition palette?
     - If yes → revise surface treatments to restore contrast within the active structural protocol.

  3. Staging Density:
     - Does the object count and grouping match the active STAGING DENSITY tier?
     - LAYERED (HIGH): rich, composed, full groupings. BALANCED (MEDIUM): intentional, clear focal point. SPARSE (LOW): restrained, deliberate negative space.
     - If off → add or remove objects to align with the active tier.

  4. Structural Integrity:
     - Are all windows and glass openings in their original geometry and positions?
     - Has the camera angle, perspective, or room proportions remained unchanged?
     - Has any new wall, column, partition, or architectural element been introduced?
     - If yes to any violation → remove it before generating.
`;



