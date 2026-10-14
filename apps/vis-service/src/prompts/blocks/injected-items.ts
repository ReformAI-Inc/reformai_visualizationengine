// Block: injected-items
// Introduced: V4.0; multi-item (1..MAX_INJECTED_ITEMS) variant added in injected-items@1.1
// Fires: only when at least one injected item (furniture/product image) is present
// Position: INJECTED_ITEM_OPTIONAL (after moodboard images)
// Input: item count (+ optional per-item description for the image labels)
// Returns empty string when inactive — the service gates on item presence.
//
// INVARIANT: with exactly ONE item the header, audit text, and image label are
// byte-identical to injected-items@1.0, so single-item renders do not change.
// The plural text is only ever produced for 2+ items.

import { MAX_INJECTED_ITEMS } from '../../shared/injected-items.constants.js';

export const INJECTED_ITEMS_BLOCK_VERSION = 'injected-items@1.1';

// Header injected immediately before the injected item image.
// Instructs the model to preserve item identity exactly as shown.
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

// Self-audit check injected into {{INJECTED_ITEM_AUDIT_BLOCK}} in the style template
// when an injected item is present. Empty string is injected when no item is present.
export const INJECTED_ITEM_AUDIT_TEXT = `
5. Injected Item Identity:
   - Is the injected item present in the output?
   - Does the item's color, material, and silhouette match its reference image?
   - Has the item been restyled, substituted, or omitted?
   - If any failure → correct before generating.
   Note: an injected item that conflicts with the active style is not a style fidelity failure.
   It is intentional. Tier 2 takes precedence over Tier 4.`;





// ── Multi-item (2..MAX_INJECTED_ITEMS) variants ───────────────────────────────

const buildMultiItemBlockHeader = (count: number): string => `**INJECTED PRODUCTS — IDENTITY PRESERVATION REQUIRED:**

${count} different products have been provided as reference images labeled [PRODUCT 1] through [PRODUCT ${count}].
EVERY one of the ${count} products MUST appear in the final output — exactly once each.

PRESERVE (these are non-negotiable, for each product independently):
  - Overall silhouette, proportions, and profile
  - Color and material identity — if a product is walnut with brass hardware, render it as
    walnut with brass hardware, not the nearest style-compatible alternative
  - Surface finish — matte stays matte, gloss stays gloss, textured stays textured
  - Recognizable design features: leg style, arm shape, back profile, hardware details,
    upholstery pattern or texture if visible
  - Each product keeps its OWN appearance — never blend colors, materials, or features
    between products

APPLY (required for scene integration):
  - Placement: give each product its own functionally correct location for the room type shown
    (infer from the room's layout, spatial logic, and the product's visible characteristics);
    products must not overlap, intersect, or block one another implausibly
  - Scale: realistic proportions for each product relative to the room, its vanishing points,
    and the other products
  - Lighting direction: match existing room light sources — direction and shadow geometry only
  - Shadows: cast natural, accurate shadows to ground every product in the scene

NEVER:
  - Omit any of the ${count} products, or replace one because it conflicts with the room's aesthetic
  - Duplicate a product — each referenced product appears exactly once
  - Substitute a product with a generic version of the same item type
  - Merge two products into one object, or swap features between them
  - Restyle, recolor, or refinish any product to match the active style preset
  - Generate a "similar" item — generate the EXACT product shown in each reference image
  - Shift any product's color temperature to match the room's ambient warmth
  - Apply the active style's materials or finishes to any product`;

const buildMultiItemAuditText = (count: number): string => `
5. Injected Product Identity:
   - Are ALL ${count} referenced products present in the output — each exactly once, none duplicated?
   - Does each product's color, material, and silhouette match its own reference image?
   - Has any product been restyled, substituted, merged with another, or omitted?
   - If any failure → correct before generating.
   Note: an injected product that conflicts with the active style is not a style fidelity failure.
   It is intentional. Tier 2 takes precedence over Tier 4.`;

const assertSupportedCount = (count: number): void => {
    if (!Number.isInteger(count) || count < 1 || count > MAX_INJECTED_ITEMS) {
        throw new RangeError(
            `Injected item count must be an integer between 1 and ${MAX_INJECTED_ITEMS}. Received ${count}.`,
        );
    }
};

/** Header placed before the injected item image(s). 1 item → the frozen V4 header. */
export const buildInjectedItemBlockHeader = (count: number): string => {
    assertSupportedCount(count);
    return count === 1 ? INJECTED_ITEM_BLOCK_HEADER : buildMultiItemBlockHeader(count);
};

/** Self-audit check for the style template. 0 items → '' (block omitted). */
export const buildInjectedItemAuditText = (count: number): string => {
    if (count === 0) return '';
    assertSupportedCount(count);
    return count === 1 ? INJECTED_ITEM_AUDIT_TEXT : buildMultiItemAuditText(count);
};

// ── Product descriptions (caller-supplied text entering the prompt) ───────────
// Descriptions are DATA, never instructions (ENGINE_BLUEPRINT §security): they are
// flattened to one line, stripped of the bracket characters that delimit image
// labels (so a description cannot forge or close a label), and length-capped.

export const MAX_PRODUCT_DESCRIPTION_LENGTH = 160;

export const sanitizeProductDescription = (raw: string | undefined | null): string => {
    if (typeof raw !== 'string') return '';
    const flattened = raw
        .replace(/[\u0000-\u001F\u007F]+/g, ' ')
        .replace(/[\[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return flattened.length > MAX_PRODUCT_DESCRIPTION_LENGTH
        ? flattened.slice(0, MAX_PRODUCT_DESCRIPTION_LENGTH).trimEnd() + '…'
        : flattened;
};

/**
 * Text label placed immediately before one injected item image.
 * - 1 item, no description → `[INJECTED ITEM 1] — …` (byte-identical to V4).
 * - 1 item with description → `[INJECTED ITEM 1: <description>] — …`.
 * - 2+ items → `[PRODUCT n: <description>] — …` (or `[PRODUCT n] — …` when unlabeled).
 */
export const buildInjectedItemLabel = (
    index: number,
    count: number,
    description?: string,
): string => {
    assertSupportedCount(count);
    const safeDescription = sanitizeProductDescription(description);
    const suffix = safeDescription ? `: ${safeDescription}` : '';
    if (count === 1) {
        return `[INJECTED ITEM ${index}${suffix}] — preserve identity exactly as shown in this image.`;
    }
    return (
        `[PRODUCT ${index}${suffix}] — product reference ${index} of ${count}. ` +
        'Place exactly one instance of this product in the room, preserving its identity exactly as shown in this image.'
    );
};
