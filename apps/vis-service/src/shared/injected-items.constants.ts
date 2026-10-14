// Limits for injected product/furniture reference images.
// Shared by transport validation (400 on violation) and the prompt blocks
// (which only ever render 1..MAX_INJECTED_ITEMS items).

/** Maximum number of injected item reference images in one generation request. */
export const MAX_INJECTED_ITEMS = 5;
