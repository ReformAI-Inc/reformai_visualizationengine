// ============================================
// VISUALIZATION PROMPTS - REFORMAI
// ============================================
// This file contains all the prompts used to generate
// interior design visualizations.
//
// EDITING INSTRUCTIONS:
// - You can freely modify the text of each prompt
// - Values between {{DOUBLE_BRACKETS}} will be replaced automatically
// - Do not delete the {{VARIABLES}}, just modify the text around them
// ============================================


// --------------------------------------------
// MAIN PROMPT - ROOM REDESIGN
// --------------------------------------------
// Used when the user wants to redesign a room from scratch
export const MAIN_PROMPT_ROOM_REDESIGN = `
Act as an expert interior designer. Redesign the provided room image.

**Primary Instructions:**
- Room Type: {{ROOM_TYPE}}
- Aesthetic Style: {{STYLE_NAME}}
- Style Influence: {{INFLUENCE_INSTRUCTION}}
- User's specific requests: "{{USER_REQUEST}}"
{{GEOMETRY_PROTOCOL}}
{{FURNITURE_INSTRUCTION}}

**Design Constraints:**
1.  The final image MUST be a photorealistic rendering.
2.  Do NOT change the room's core structure, such as walls, windows, or doors position.
3.  Mantain the amount of windows.
4.  Focus on changing materials (flooring, walls), furniture, lighting, and decor to match the requested style.
5.  Maintain the original room's geometry and proportions.
6.  Mantain the picture perspective

Generate the redesigned room image.
`;


// --------------------------------------------
// MAIN PROMPT - IMAGE REFINEMENT
// --------------------------------------------
// Used when the user wants to adjust an already generated image
export const MAIN_PROMPT_IMAGE_REFINEMENT = `
Act as an expert interior designer. Refine the provided image based on the user request.

**Primary Instructions:**
- Room Type: {{ROOM_TYPE}}
- Aesthetic Style: {{STYLE_NAME}}
- Style Influence: {{INFLUENCE_INSTRUCTION}}
- User's specific requests: "{{USER_REQUEST}}"
{{GEOMETRY_PROTOCOL}}
{{FURNITURE_INSTRUCTION}}

**Design Constraints:**
1.  The final image MUST be a photorealistic rendering.
2.  Do NOT change the room's core structure, such as walls, windows, or doors position.
3.  Mantain the amount of windows.
4.  Apply the requested changes to the image.
5.  Maintain the original room's geometry and proportions.
6.  Mantain the picture perspective

Generate the refined room image.
`;


// --------------------------------------------
// STYLE INFLUENCE - MOOD BOARD
// --------------------------------------------
// These prompts determine how much weight to give the mood board vs the preset style

// When user prefers the preset style (slider low, less than 33%)
export const INFLUENCE_PRIORITIZE_PRESET_STYLE = `Heavily prioritize the preset style ({{STYLE_NAME}}) over the mood board images.`;

// When user prefers the mood board images (slider high, more than 66%)
export const INFLUENCE_PRIORITIZE_MOOD_BOARD = `Heavily prioritize the provided mood board images for style inspiration over the preset style.`;

// When user wants a balance between both (slider middle, between 33% and 66%)
export const INFLUENCE_BALANCE_STYLE_AND_MOOD_BOARD = `Blend the preset style ({{STYLE_NAME}}) and the mood board images evenly.`;

// When there is no mood board, only use preset style
export const INFLUENCE_PRESET_STYLE_ONLY = `Use the preset style as the primary design guide.`;


// --------------------------------------------
// SPECIFIC FURNITURE INTEGRATION
// --------------------------------------------
// Used when the user uploads an image of a furniture piece they want to include
export const INSTRUCTION_INTEGRATE_FURNITURE = `
**Furniture Integration:**
- An image of a specific piece of furniture has been provided. You MUST incorporate this exact piece of furniture into the final design.
- **Crucial Placement Instructions:**
    1.  **Analyze Layout:** First, analyze the original room's layout, perspective, and existing furniture arrangement.
    2.  **Natural Placement:** Place the new furniture in a functionally appropriate and aesthetically pleasing position within the {{ROOM_TYPE}}. For example, a sofa should be against a wall or defining a seating area, not floating awkwardly in a corner.
    3.  **Correct Scale & Perspective:** The furniture MUST be scaled to realistic proportions relative to the room and other objects. Its perspective must perfectly align with the room's vanishing points.
    4.  **Seamless Integration:** The final result should be photorealistic and look like a single, cohesive photograph. The furniture should not look like it was digitally added.
    5.  **Lighting and Shadows:** Meticulously match the lighting on the new furniture to the room's existing light sources. It must cast accurate and soft shadows on the floor and surrounding objects to ground it in the scene.
`;


// --------------------------------------------
// GEOMETRY PRESERVATION PROTOCOL
// --------------------------------------------
export const GEOMETRY_PRESERVATION_PROTOCOL = `
**CRITICAL: STRUCTURAL PRESERVATION PROTOCOL**
- You are strictly prohibited from changing the camera angle, perspective, or room proportions.
- The original image serves as a rigid architectural template.
- Every wall, window frame, floor-to-wall junction, and ceiling boundary must remain at its EXACT pixel coordinates from the original image.
- Do NOT interpret the room structure; PRESERVE it.
- **Structural Anchoring**: Maintain clear visual definition of all architectural edges, corners, and junctions.
- **Lighting Integrity**: Use lighting and shadows to ANCHOR the geometry; do not allow high-key lighting or over-exposure to wash out structural boundaries.
- This is an "overpaint" task: apply new materials, furniture, and lighting to the existing 3D geometry while maintaining consistent depth cues.
- Vanishing points and focal length MUST be identical to the original image.
`;


// --------------------------------------------
// PHASE ANCHORING - REDESIGN (STRATEGY 1 + 2)
// --------------------------------------------

export const PHASE_ANCHOR_STRUCTURE = `
**PHASE 1: STRUCTURAL ANCHORING**
- The provided image is a FIXED ARCHITECTURAL TEMPLATE.
- You are strictly prohibited from moving walls, floors, ceilings, or window frames.
- Preserve the exact camera angle, focal length, and perspective lines.
- Maintain the original spatial layout and room proportions exactly.
- Do NOT interpret structure; simply ANCHOR to it.
`;

export const PHASE_ANCHOR_STRUCTURE_V2 = `
**PHASE 1: SEMANTIC STRUCTURAL ANCHORING**
- The provided image is a FIXED ARCHITECTURAL TEMPLATE.
- **Architectural Skeleton**: Preserve walls, floors, ceilings, and window/door frames exactly.
- **Architectural Continuity**:
    - Preserve uninterrupted wall surfaces and the exact negative space between windows and doors.
    - Maintain continuous wall planes; do NOT insert partitions, dividers, or false walls where none exist.
- **Incidental Noise Suppression**:
    - Ignore and suppress non-architectural visual noise such as exposed electrical cords, minor floor clutter, or temporary non-built-in elements.
    - Do NOT treat these as structural boundaries.
- **Void Integrity**:
    - Architectural openings (windows, doors, archways) must remain as open voids.
    - Do not fill them with solid objects or furniture.
- **Perspective**: Preserve the exact camera angle, focal length, and vanishing points.
`;

export const PHASE_ANCHOR_STYLE = `
**PHASE 2: STYLE TRANSFORMATION**
- Room Type: {{ROOM_TYPE}}
- Task: Perform a controlled transformation of the room using the {{STYLE_NAME}} aesthetic.
- Output Goal: A photorealistic, fully-furnished transformation of the SAME room.
- User specific requests: "{{USER_REQUEST}}"

{{STYLE_BLOCK}}

{{BEHAVIORAL_CONSTRAINTS}}

{{GLOBAL_STYLE_CONSTRAINTS}}

{{PROTOCOL_INSTRUCTIONS}}

{{LIGHTING_GEOMETRY_SAFETY}}
`;


// --------------------------------------------
// BEHAVIORAL CONSTRAINTS
// --------------------------------------------

export const BEHAVIORAL_CONSTRAINTS = `
**SYSTEM-LEVEL CONSTRAINTS:**

1. **Furnishing Mandate (Completeness)**:
- You MUST produce a fully furnished, realistic, and professionally staged {{ROOM_TYPE}}.
- If the source room is empty, introduce an appropriate furniture layout consistent with the room type and requested style.
- Do not leave the room as an empty shell unless explicitly requested.

2. **Architectural Priority (Anti-Drift)**:
- Furniture MUST adapt to the room, never the opposite.
- If a furniture piece does not fit against a wall without blocking a window or requiring a new wall, you MUST resize or reposition the furniture.
- You are strictly forbidden from altering architectural openings or wall planes to accommodate furniture.

3. **Material Zoning (Anti-Saturation)**:
- Apply materials selectively and realistically.
- Do NOT apply a single material uniformly to every surface.
- Preserve surface hierarchy by balancing dominant materials with secondary, visually quieter surfaces.

4. **Light Source Persistence (Geometry Sync)**:
- Preserve the apparent light origin and dominant daylight direction of the original image.
- Do not introduce new light behavior that creates false structural edges, corners, or separations.
`;


// --------------------------------------------
// STRUCTURAL PROTOCOLS
// --------------------------------------------

export const PROTOCOL_RIGID_BASE = `
**STRUCTURAL PROTOCOL: RIGID BASE**
- Standard structural anchoring.
- Preserve all walls, architectural openings, and the original spatial layout exactly.
- No structural reinterpretation is permitted.
`;

export const PROTOCOL_RIGID_APERTURE_LOCK = `
**STRUCTURAL PROTOCOL: RIGID APERTURE LOCK**
- All RIGID BASE behaviors apply.
- Enhanced protection of windows, glass areas, and uninterrupted wall spans.
- Strictly prevent the insertion of false partitions, dividers, or structural separators.
- **Material-Trim Priority**: If a requested material (e.g., brick) conflicts with decorative trim or minor ornamental surface detail, prioritize architectural continuity and core wall geometry over decorative detail. Apply materials as flat surface treatments that respect the underlying form.
`;

export const PROTOCOL_SURFACE_ONLY_TRANSFORM = `
**STRUCTURAL PROTOCOL: SURFACE-ONLY TRANSFORM**
- Preserve all architectural edges, junctions, and transitions exactly.
- While finishes and visual surfaces may be simplified, you MUST NOT flatten, erase, or ignore existing architectural boundaries or structural cues.
- Maintain the 3D depth and complexity of the original room structure.
`;


// --------------------------------------------
// GLOBAL STYLE CONSTRAINTS
// --------------------------------------------

export const GLOBAL_STYLE_CONSTRAINTS = `
**GLOBAL STYLE CONSTRAINTS:**
- Apply all materials as surface treatments, not as structural additions.
- You are strictly prohibited from altering the spatial layout or structural boundaries.
- Do not introduce new walls, partitions, or structural dividers.
`;

export const LIGHTING_GEOMETRY_SAFETY = `
**LIGHTING & GEOMETRY SAFETY:**
- Lighting must be used for aesthetic mood and exposure only.
- Lighting MUST NOT create apparent new corners, separations, or structural boundaries.
- Ensure shadows and highlights reinforce existing geometry rather than distorting it.
`;


// --------------------------------------------
// DEFAULT VALUE
// --------------------------------------------
// Used when the user does not write any specific request
export const DEFAULT_USER_REQUEST = `No specific requests.`;



