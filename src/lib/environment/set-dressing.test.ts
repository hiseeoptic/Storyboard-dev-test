import assert from "node:assert/strict";
import test from "node:test";
import { setDressingFor, setDressingLock } from "./set-dressing.ts";

const registry = [
  { entity_id: "char_minh", display_name: "Minh", kind: "character" },
  { entity_id: "char_lan", display_name: "Lan", kind: "character" },
  { entity_id: "obj_chair_lan", display_name: "chair_Lan", kind: "object" },
  { entity_id: "obj_menu_minh", display_name: "menu_Minh", kind: "object" },
  { entity_id: "obj_napkin_lan", display_name: "napkin_Lan", kind: "object" },
  { entity_id: "obj_cake", display_name: "cake", kind: "object" },
];
const shot = (entities: Array<Record<string, unknown>>, changes: Array<Record<string, unknown>> = []) => ({
  location_id: "loc_1",
  start_snapshot: { entities: entities as never },
  end_snapshot: { entities: entities as never },
  changes: changes as never,
});
const shots = [
  shot([
    { entity_id: "obj_chair_lan", kind: "object", state: "Intact", position: "Beside the table", holder_entity_id: "char_lan" },
    { entity_id: "obj_menu_minh", kind: "object", state: "Open", position: "In front of Minh", holder_entity_id: "char_minh" },
  ]),
  shot([
    { entity_id: "obj_menu_minh", kind: "object", state: "Open", position: "Tabletop in front of Minh" },
  ]),
  // The napkin is named only now, "at Lan's place setting on the table"; the cake is carried in.
  shot(
    [
      { entity_id: "obj_napkin_lan", kind: "object", state: "Folded", position: "At Lan's place setting on the table" },
      { entity_id: "obj_cake", kind: "object", state: "Whole", position: "On the table centre" },
    ],
    [{ entity_id: "obj_cake", from: "absent", action: "the waiter brings the cake" }]
  ),
];

test("a table item named later was there from the first shot; a brought-in item was not", () => {
  const first = setDressingFor(shots, 0, registry);
  assert.deepEqual(first.map((i) => [i.label, i.zone]), [
    ["Lan's chair", "set"],
    ["Minh's menu", "held"],
    ["Lan's napkin", "table"],
  ]);
  assert.ok(!first.some((i) => i.label === "cake"));
});

test("what the previous shot left stays even if the script forgets it", () => {
  const second = setDressingFor(shots, 1, registry).map((i) => i.label);
  assert.ok(second.includes("Lan's chair"), "the chair from shot 1 is still there");
  assert.ok(second.includes("Lan's napkin"));
});

test("the lock lists the table, forbids extras and fixes the furniture", () => {
  const text = setDressingLock(setDressingFor(shots, 0, registry));
  assert.match(text, /^SET DRESSING LOCK .*on the table — Lan's napkin \(folded, at Lan's place setting on the table\)/);
  assert.match(text, /held — Minh's menu \(open, in front of Minh\)/);
  assert.match(text, /no added plates, glasses, cutlery, candles, vases, bottles or food/);
  assert.match(text, /chairs keep the establishing image's number, positions and facing/);
  assert.match(setDressingLock([], { interior: true }), /^FURNITURE LOCK/);
  assert.equal(setDressingLock([], { interior: false }), "");
});
