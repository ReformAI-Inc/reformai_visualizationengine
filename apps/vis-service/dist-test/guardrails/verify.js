// ============================================================
// AGT POST-GENERATION VERIFICATION — pure diff logic
//
// Compares the AGT extracted from the INPUT room image against
// the AGT re-extracted from the GENERATED image, and reports
// violations of hard-tier facts only.
//
// Rules:
// - Only fields classified 'hard' on the INPUT side can violate.
//   Advisory/suppressed facts never block output.
// - Camera perspective never violates (classify.ts never marks it
//   hard — it is compositional guidance, not an enforceable fact).
// - Count fields (windows, doors): a violation requires the output
//   extraction to disagree with the input value AND the output
//   extraction itself to be at least medium confidence. If the
//   output extraction is low confidence, the field is recorded as
//   inconclusive instead — never block users on extractor doubt.
// - Boolean fields (ceiling fixture, niches): violation only when
//   a feature PRESENT in the input is absent in the output.
//   Additions are often style-legitimate and are allowed.
//
// This module is intentionally pure: no SDK imports, no env access.
// The orchestration (re-extract → diff → retry) lives in the
// pipeline layer so this logic stays contract-testable.
// ============================================================
export const diffAGT = (input, inputClassified, output) => {
    const violations = [];
    const inconclusiveFields = [];
    const hard = new Set(inputClassified.hard_fact_fields);
    for (const field of ['window_count', 'door_count']) {
        if (!hard.has(field))
            continue;
        const expected = input[field].value;
        const observed = output[field];
        if (observed.confidence === 'low') {
            inconclusiveFields.push(field);
            continue;
        }
        if (observed.value !== expected) {
            const anchors = input[field].instances.map(i => `${i.location} (${i.type})`).join(', ');
            violations.push({
                field,
                expected: String(expected),
                observed: String(observed.value),
                detail: `source room has exactly ${expected} (${anchors || 'positions unrecorded'}), generated image shows ${observed.value}`,
            });
        }
    }
    for (const field of ['has_ceiling_fixture', 'has_built_in_niches']) {
        if (!hard.has(field))
            continue;
        if (!input[field].value)
            continue; // absent-in-input never violates: additions are style-legitimate
        const observed = output[field];
        if (observed.confidence === 'low') {
            inconclusiveFields.push(field);
            continue;
        }
        if (!observed.value) {
            violations.push({
                field,
                expected: 'PRESENT',
                observed: 'ABSENT',
                detail: `source room contains this feature; it must not be removed by the redesign`,
            });
        }
    }
    return { violations, inconclusiveFields };
};
const FIELD_LABELS = {
    window_count: 'window openings',
    door_count: 'door openings',
    has_ceiling_fixture: 'ceiling-mounted light fixture',
    has_built_in_niches: 'built-in niche/alcove',
};
// Correction block appended to the original prompt parts on retry.
// Speaks in the same imperative register as the constraint blocks.
export const buildViolationFeedback = (violations) => {
    if (violations.length === 0)
        return '';
    const lines = violations.map(v => `- ${FIELD_LABELS[v.field]}: your previous output showed ${v.observed}, but the source room has ${v.expected}. ${v.detail}.`);
    return [
        'VIOLATION FEEDBACK — STRUCTURAL CORRECTION REQUIRED:',
        'Your previous attempt violated verified architectural facts of the source room.',
        ...lines,
        'Regenerate the redesign with these architectural facts restored exactly. Do not add, remove, move, or resize any of the elements listed above.',
    ].join('\n');
};
//# sourceMappingURL=verify.js.map