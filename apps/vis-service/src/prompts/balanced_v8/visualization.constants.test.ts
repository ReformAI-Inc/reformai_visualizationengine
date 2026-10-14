import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConstraintHierarchyBlock } from './visualization.constants.js';

test('V8 hierarchy: single item text unchanged, multi item names every product', () => {
    const single = buildConstraintHierarchyBlock(1, false, false);
    assert.ok(single.includes('TIER 2 — INJECTED ITEM CONSTRAINTS [ACTIVE — 1 injected item present]'));
    assert.ok(single.includes(
        '  Preserve the injected item exactly as shown. Silhouette, color, material, and finish are\n' +
        '  non-negotiable. Do not restyle, recolor, or substitute it. Resolve style conflicts\n' +
        '  through surrounding non-injected elements only.\n',
    ));

    const multi = buildConstraintHierarchyBlock(5, true, true);
    assert.ok(multi.includes('TIER 2 — INJECTED ITEM CONSTRAINTS [ACTIVE — 5 injected items present]'));
    assert.match(multi, /Every one of the 5 injected products must appear exactly once/);
    assert.match(multi, /TIER 2B — INSTALLED CATALOGUE PRODUCTS \[ACTIVE/);
    assert.match(multi, /Verified hard facts/);

    const none = buildConstraintHierarchyBlock(0, false, false);
    assert.match(none, /INJECTED ITEM CONSTRAINTS \[INACTIVE/);
});
