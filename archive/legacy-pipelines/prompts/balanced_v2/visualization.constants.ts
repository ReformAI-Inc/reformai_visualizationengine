// ============================================
// VISUALIZATION PROMPTS - BALANCED V2
// ============================================
// balanced_v2 builds on balanced_v1 but fixes over-reconstruction behavior.
// Key change: the source room is treated as a real renovation job, not an
// empty architectural shell. Furniture, spatial logic, and ambient lighting
// from the original image are preserved where possible.
//
// Differences from balanced_v1:
// - BALANCED_V2_PHASE_1: renovation framing instead of shell framing
// - RENOVATION_CONTINUITY: new block enforcing spatial continuity
// - FURNISHING_STRATEGY: replaces aggressive FURNISHING_MANDATE
// - LIGHTING_PRESERVATION_AND_NORMALIZATION: replaces LIGHTING_NORMALIZATION,
//   adds explicit brightness-preservation relative to source image
// - DESIGN_RULES_V2: simplified lighting rule (no conflict with LPAN block)
//
// Everything else (style block, STYLE_PRIORITY, REALISM_CONSTRAINT,
// RENOVATION_FEASIBILITY_RULES, structural protocols) is shared with balanced_v1.

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
// PHASE 1 — ARCHITECTURAL ANCHOR (balanced_v2 variant)
// Same geometry locking as v1, but renovation framing — NOT empty-shell framing.
// --------------------------------------------
export const BALANCED_V2_PHASE_1 = `
**PHASE 1: ARCHITECTURAL ANCHORING**

The following elements are FIXED and must not change:
- Wall planes, floor plane, and ceiling plane
- Window and door frames, their exact positions and sizes
- Camera angle, focal length, and perspective vanishing points
- Room spatial proportions and overall depth

Treat the input image as a real room undergoing renovation — not an empty architectural shell.
- Modify, replace, or upgrade surface finishes, furniture, and decor as needed for the selected style.
- Preserve the underlying spatial logic, layout, lighting behavior, and realism of the original room.
- The result should feel like a before-and-after renovation of the same physical space, not a rebuilt scene.
`;


// --------------------------------------------
// PHASE 2 HEADER
// --------------------------------------------
export const BALANCED_V2_PHASE_2_HEADER = `
**PHASE 2: STYLE TRANSFORMATION**
- Room Type: {{ROOM_TYPE}}
- Task: Transform the room into the {{STYLE_NAME}} aesthetic.
- Output Goal: A photorealistic, fully-furnished renovation result of the SAME room.
- User request: "{{USER_REQUEST}}"
`;


// --------------------------------------------
// RENOVATION CONTINUITY (new in balanced_v2)
// Placed first in Phase 2 to set the renovation-vs-reconstruction frame
// before any style or furnishing instructions are read.
// --------------------------------------------
export const RENOVATION_CONTINUITY = `
**RENOVATION CONTINUITY:**
- The output must feel like a real renovation of the input room, not a reimagined or rebuilt scene.
- Maintain plausible furniture placement relative to walls, windows, circulation paths, and focal points.
- Avoid dramatic re-layouts that ignore the original spatial logic.
- The result should feel like a before-and-after transformation of the same room.
`;


// --------------------------------------------
// FURNISHING STRATEGY (replaces FURNISHING_MANDATE from balanced_v1)
// Renovation-continuity framing — reuse and adapt, do not reconstruct from scratch.
// --------------------------------------------
export const FURNISHING_STRATEGY = `
**FURNISHING STRATEGY:**
- Furnish the room in a complete but realistic way for the selected room type and style.
- You may reuse, adapt, or replace furniture as needed to match the target style.
- If the source room is empty, introduce a plausible furniture layout appropriate for the style.
- Do not leave the room empty unless explicitly requested.
- Do not over-stage the room beyond what is realistic for a lived-in, professionally designed interior.
`;


// --------------------------------------------
// STYLE PRIORITY
// --------------------------------------------
export const STYLE_PRIORITY = `
**STYLE PRIORITY:**
- Ensure the design clearly reflects the defining characteristics of the selected style.
- Use the provided materials, colors, and finishes to create a distinctive and recognizable aesthetic.
- Avoid overly neutral or generic interpretations.
`;


// --------------------------------------------
// REALISM CONSTRAINT
// --------------------------------------------
export const REALISM_CONSTRAINT = `
**REALISM CONSTRAINT:**
- The room must feel like a real, livable residential interior, not a conceptual render or cinematic scene.
- Avoid dark, moody, or theatrically dim lighting. Warm, well-lit residential lighting is preferred and does not count as dramatic.
- Materials, lighting, and furniture should feel natural, vibrant, and appropriate for everyday living.
- The result should resemble a professionally staged home renovation visualization, not a stylized design showcase.
`;


// --------------------------------------------
// DESIGN RULES V2
// Lighting section is simplified — brightness and color temperature are owned
// by LIGHTING_PRESERVATION_AND_NORMALIZATION below to avoid duplication.
// --------------------------------------------
export const DESIGN_RULES_V2 = `
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
// --------------------------------------------
export const RENOVATION_FEASIBILITY_RULES = `
**RENOVATION FEASIBILITY RULES:**
- Apply materials in ways consistent with real-world construction.
- Do not apply heavy materials (such as stone or brick) to thin, detailed, or ornamental architectural features.
- Large-scale materials must respect existing wall planes and proportions.
- If a material conflicts with geometry, adapt the material — do not distort the structure.
`;


// --------------------------------------------
// LIGHTING PRESERVATION AND NORMALIZATION (new in balanced_v2)
// Replaces LIGHTING_NORMALIZATION from balanced_v1.
// Adds explicit brightness-preservation relative to the source image.
// --------------------------------------------
export const LIGHTING_PRESERVATION_AND_NORMALIZATION = `
**LIGHTING PRESERVATION AND NORMALIZATION:**
- Preserve the brightness level of the original image.
- Do not make the scene darker than the input unless explicitly requested.
- Maintain the same daylight direction and realistic daylight intensity.
- Use bright, natural, residential lighting with warm-to-neutral white color temperature.
- Avoid cinematic lighting, heavy contrast, moody shadows, and overcast gray tones.
- Materials must remain well-lit, color-accurate, and visually readable.
- The final image should feel like it was photographed in natural daylight, not dramatically lit for mood.
`;


// --------------------------------------------
// STRUCTURAL PROTOCOLS (concise — same as balanced_v1)
// --------------------------------------------
export const BALANCED_V2_PROTOCOL_RIGID_BASE = `
**STRUCTURAL PROTOCOL:**
- Preserve all walls, architectural openings, and the original spatial layout.
- No structural reinterpretation permitted.
`;

export const BALANCED_V2_PROTOCOL_RIGID_APERTURE_LOCK = `
**STRUCTURAL PROTOCOL:**
- Preserve all walls, architectural openings, and the original spatial layout.
- Protect windows, glass areas, and uninterrupted wall spans.
- Do not insert partitions, dividers, or structural separators.
- Where a requested material conflicts with decorative trim, respect core wall geometry and apply the material as a flat surface treatment.
`;

export const BALANCED_V2_PROTOCOL_SURFACE_ONLY_TRANSFORM = `
**STRUCTURAL PROTOCOL:**
- Preserve all architectural edges, junctions, and transitions.
- Maintain the 3D depth and complexity of the original room structure.
- Finishes and visual surfaces may be simplified, but do not flatten or erase existing architectural boundaries.
`;



