import assert from "node:assert/strict";
import test from "node:test";
import { resolveSpatialLayout } from "./index.ts";

// A simple single-zone scene (no doorway/edge/stair/railing keywords) used to
// return null, leaving multi-character scenes with no placement lock — which
// then tripped the now-enforced SPAT-001 gate (and the repair loop) on the most
// common scene of all: two people talking at a table. These tests pin the
// backfill behaviour.

test("a 2-character simple scene gets a placement lock (no null → no false SPAT-001)", () => {
  const layout = resolveSpatialLayout({
    setting: "A sunlit kitchen with a wooden table",
    motion: "Minh looks at Lan",
    characterNames: ["Minh", "Lan"],
  });
  assert.ok(layout, "expected a synthesised layout for a 2-character scene");
  assert.match(layout!.character_placement, /Minh/);
  assert.match(layout!.character_placement, /Lan/);
});

test("a single-character simple scene stays null (nothing to lock)", () => {
  const layout = resolveSpatialLayout({
    setting: "A sunlit kitchen",
    motion: "Minh pours tea",
    characterNames: ["Minh"],
  });
  assert.equal(layout, null);
});

test("a model-supplied layout is preserved for a simple scene", () => {
  const layout = resolveSpatialLayout({
    layout: {
      zone_order: "single room",
      fixed_architecture: "table centre",
      character_placement: "Minh left seat, Lan right seat",
      walkable_path: "around the table",
      camera_zone: "eye level across the table",
    },
    characterNames: ["Minh", "Lan"],
  });
  assert.ok(layout);
  assert.match(layout!.character_placement, /Minh left seat, Lan right seat/);
});

test("a high-risk scene (doorway) still gets its safety topology", () => {
  const layout = resolveSpatialLayout({
    setting: "A hallway with a doorway into the office",
    motion: "Minh steps through the doorway",
    characterNames: ["Minh"],
  });
  assert.ok(layout, "a doorway scene must always lock topology");
});
