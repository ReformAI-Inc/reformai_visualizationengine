import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CONSTRAINT_HIERARCHY_BLOCK_VERSION,
    buildConstraintHierarchyBlock,
} from '../constraint-hierarchy.js';

test('constraint hierarchy toggles active/inactive tiers and keeps core tiers', () => {
    const none = buildConstraintHierarchyBlock(0, false);
    assert.match(none, /TIER 2 .*INJECTED ITEM CONSTRAINTS \[INACTIVE/);
    assert.match(none, /TIER 2B .*RENOVATION MATERIAL ANCHORS \[INACTIVE/);

    const withInjected = buildConstraintHierarchyBlock(1, false);
    assert.match(withInjected, /TIER 2 .*INJECTED ITEM CONSTRAINTS \[ACTIVE/);

    const withRenovation = buildConstraintHierarchyBlock(0, true);
    assert.match(withRenovation, /TIER 2B .*RENOVATION MATERIAL ANCHORS \[ACTIVE/);

    assert.match(none, /TIER 1 .*ARCHITECTURAL CONSTRAINTS/);
    assert.match(none, /TIER 4 .*STYLE TRANSFORMATION/);
    assert.match(CONSTRAINT_HIERARCHY_BLOCK_VERSION, /^constraint-hierarchy@.+/);
});





test('tier 2 single-item text is frozen; multi-item text names the count', () => {
    const single = buildConstraintHierarchyBlock(1, false);
    assert.ok(single.includes('TIER 2 — INJECTED ITEM CONSTRAINTS [ACTIVE — 1 injected item present]'));
    assert.ok(single.includes('  Preserve the injected item exactly as shown. Silhouette, color, material, and finish are\n'));

    const multi = buildConstraintHierarchyBlock(3, false);
    assert.ok(multi.includes('TIER 2 — INJECTED ITEM CONSTRAINTS [ACTIVE — 3 injected items present]'));
    assert.match(multi, /Every one of the 3 injected products must appear exactly once/);
    assert.match(multi, /merge, duplicate, or omit any of them/);
    assert.ok(!multi.includes('Preserve the injected item exactly as shown.'));
});
