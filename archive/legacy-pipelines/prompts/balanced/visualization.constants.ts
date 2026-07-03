// ============================================
// VISUALIZATION PROMPTS - BALANCED V1
// ============================================
// Balanced pipeline sits between baseline_original and improved_current.
// Phase 1 is a purpose-built lighter architectural anchor — NOT inherited from
// improved_current. It explicitly declares furniture as non-architectural so
// Phase 2 can do a full furnishing transformation without fighting Phase 1.

// --------------------------------------------
// PHASE 1 — ARCHITECTURAL ANCHOR (balanced-specific)
// Lighter than improved_current. Locks geometry only — explicitly releases
// all furniture, decor, and surface finishes to Phase 2.
// --------------------------------------------
export const BALANCED_PHASE_1 = `
**PHASE 1: ARCHITECTURAL ANCHORING**

The following elements are FIXED and must not change:
- Wall planes, floor plane, and ceiling plane
- Window and door frames, their exact positions and sizes
- Camera angle, focal length, and perspective vanishing points
- Room spatial proportions and overall depth

The following elements are NOT fixed — they will be fully replaced in Phase 2:
- All furniture, decor, rugs, accessories, and staging items (treat as absent)
- Surface finishes on walls, floors, and ceiling (will be restyled)
- Lighting fixtures and lamps (will be replaced)

Treat the image as an architectural shell with locked geometry. Do not carry over
any existing furnishing, sparseness, or decor into Phase 2. A complete interior
transformation follows.
`;

// Reuse influence / furniture helpers verbatim from improved
export {
    INFLUENCE_PRIORITIZE_PRESET_STYLE,
    INFLUENCE_PRIORITIZE_MOOD_BOARD,
    INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD,
    INFLUENCE_PRESET_STYLE_ONLY,
    INSTRUCTION_INTEGRATE_FURNITURE,
    DEFAULT_USER_REQUEST,
} from '../improved/visualization.constants.js';


// --------------------------------------------
// PHASE 2 HEADER (balanced variant)
// --------------------------------------------
export const BALANCED_PHASE_2_HEADER = `
**PHASE 2: STYLE TRANSFORMATION**
- Room Type: {{ROOM_TYPE}}
- Task: Transform the room into the {{STYLE_NAME}} aesthetic.
- Output Goal: A photorealistic, fully-furnished result of the SAME room.
- User request: "{{USER_REQUEST}}"
`;

// --------------------------------------------
// FURNISHING MANDATE — highest-priority Phase 2 instruction
// Placed first in the assembled prompt so the model reads it before anything else.
// --------------------------------------------
export const FURNISHING_MANDATE = `
**FURNISHING MANDATE — EXECUTE BEFORE ALL OTHER INSTRUCTIONS:**
- The source image is an architectural shell. All furniture has been cleared.
- You MUST introduce a complete, professionally staged furniture layout for the {{ROOM_TYPE}}.
- Furniture density target: a professionally staged, realistic residential interior with a complete furniture layout.
- Do NOT leave any part of the room empty, sparse, or understaged.
- Do NOT carry any existing furniture, sparseness, or staging from the source image into the output.
- Furnishing must clearly reflect the {{STYLE_NAME}} style — generic or neutral staging is not acceptable.
`;


// --------------------------------------------
// STYLE PRIORITY (new in balanced_v1)
// --------------------------------------------
export const STYLE_PRIORITY = `
**STYLE PRIORITY:**
- Ensure the design clearly reflects the defining characteristics of the selected style.
- Use the provided materials, colors, and finishes to create a distinctive and recognizable aesthetic.
- Avoid overly neutral or generic interpretations.
`;

// --------------------------------------------
// REALISM CONSTRAINT (new in balanced_v1)
// Placed immediately after STYLE PRIORITY.
// Ensures strong style expression is anchored to residential realism,
// not editorial or cinematic stylization.
// --------------------------------------------
export const REALISM_CONSTRAINT = `
**REALISM CONSTRAINT:**
- The room must feel like a real, livable residential interior, not a conceptual render or cinematic scene.
- Avoid dark, moody, or theatrically dim lighting. Warm, well-lit residential lighting is preferred and does not count as dramatic.
- Materials, lighting, and furniture should feel natural, vibrant, and appropriate for everyday living.
- The result should resemble a professionally staged home renovation visualization, not a stylized design showcase.
`;


// --------------------------------------------
// DESIGN RULES
// Merged from: BEHAVIORAL_CONSTRAINTS + GLOBAL_STYLE_CONSTRAINTS + LIGHTING_GEOMETRY_SAFETY
// Redundancy removed. MUST/STRICTLY replaced with Ensure/Keep where clarity is preserved.
// --------------------------------------------
export const DESIGN_RULES = `
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
   - Use warm, natural daylight as the primary light source — target a warm white to golden ambient color temperature.
   - Maintain bright, warm visibility that makes materials look rich and saturated, not washed out or desaturated.
   - Avoid cool, overcast, or blue-gray daylight renderings — the room should feel sun-warmed, not cloud-filtered.
   - Avoid dark, moody, theatrical, or cinematic lighting unless explicitly requested by the user.
   - Shadows should be soft, warm, and realistic — directional but not harsh.
`;


// --------------------------------------------
// RENOVATION FEASIBILITY RULES (new in balanced_v1)
// --------------------------------------------
export const RENOVATION_FEASIBILITY_RULES = `
**RENOVATION FEASIBILITY RULES:**
- Apply materials in ways consistent with real-world construction.
- Do not apply heavy materials (such as stone or brick) to thin, detailed, or ornamental architectural features.
- Large-scale materials must respect existing wall planes and proportions.
- If a material conflicts with geometry, adapt the material — do not distort the structure.
`;


// --------------------------------------------
// LIGHTING NORMALIZATION (new in balanced_v1)
// Global override — applied after all style-specific instructions.
// Prevents style lighting tokens (e.g. "hard directional", "raw") from
// pushing the output into darkness regardless of the selected style.
// --------------------------------------------
export const LIGHTING_NORMALIZATION = `
**LIGHTING NORMALIZATION:**
- Regardless of style, keep the final image warm, well-lit, and residential in color temperature.
- Avoid cool or overcast ambient light — use warm white to golden daylight as the base tone.
- Do not let style-specific lighting terms make the room significantly darker OR cooler than the source image.
- If the style suggests darker or rawer materials, balance them with warm ambient daylight to preserve material vibrancy.
- Rendered materials must appear rich and chromatic — walnut should look warm brown, not gray-brown; olive should read green, not khaki.
`;

// --------------------------------------------
// STRUCTURAL PROTOCOLS (concise versions for balanced)
// --------------------------------------------
export const BALANCED_PROTOCOL_RIGID_BASE = `
**STRUCTURAL PROTOCOL:**
- Preserve all walls, architectural openings, and the original spatial layout.
- No structural reinterpretation permitted.
`;

export const BALANCED_PROTOCOL_RIGID_APERTURE_LOCK = `
**STRUCTURAL PROTOCOL:**
- Preserve all walls, architectural openings, and the original spatial layout.
- Protect windows, glass areas, and uninterrupted wall spans.
- Do not insert partitions, dividers, or structural separators.
- Where a requested material conflicts with decorative trim, respect core wall geometry and apply the material as a flat surface treatment.
`;

export const BALANCED_PROTOCOL_SURFACE_ONLY_TRANSFORM = `
**STRUCTURAL PROTOCOL:**
- Preserve all architectural edges, junctions, and transitions.
- Maintain the 3D depth and complexity of the original room structure.
- Finishes and visual surfaces may be simplified, but do not flatten or erase existing architectural boundaries.
`;



