import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterLock, StoryboardGenerationOutput, VideoSegment } from "@/types";
import { validateAtomicActions } from "./action-validator.ts";
import { buildProductionState } from "./normalizer.ts";
import { validateSpatialState } from "./spatial-validator.ts";

function character(name: string): CharacterLock {
  return {
    name,
    gender_age: "adult",
    build: "average",
    skin_tone: "unspecified",
    hair: "unspecified",
    eyes: "unspecified",
    costume: "story outfit",
    signature_features: "none",
    default_expression: "neutral",
    render_style: "cinematic",
  };
}

function segment(number: number, overrides: Partial<VideoSegment> = {}): VideoSegment {
  return {
    segment_number: number,
    duration_seconds: 10,
    title: `Shot ${number}`,
    marketing_role: "body",
    beats: [],
    first_frame_prompt: "legacy frame",
    motion_prompt: "legacy motion",
    dialogue: null,
    continuity_note: "legacy continuity",
    ...overrides,
  };
}

function breakdown(
  segments: VideoSegment[],
  names: string[] = ["Lan", "Minh"]
): Pick<
  StoryboardGenerationOutput,
  "character_locks" | "segments" | "total_duration_seconds"
> {
  return {
    character_locks: names.map(character),
    segments,
    total_duration_seconds: segments.reduce((sum, item) => sum + item.duration_seconds, 0),
  };
}

function twoPersonLayout(placement: string) {
  return {
    zone_order: "lobby floor -> doorway threshold -> café floor",
    fixed_architecture: "The doorway and café counter remain fixed.",
    character_placement: placement,
    walkable_path: "A clear unobstructed route connects the lobby to the café.",
    camera_zone: "camera on the lobby floor",
  };
}

test("legacy spatial layout compiles into zones, connectors and per-character placement", () => {
  const legacy = breakdown([
    segment(1, {
      characters_in_scene: ["Lan", "Minh"],
      spatial_layout: twoPersonLayout(
        "Lan stands on the left in lobby floor, facing Minh, 2 m from the doorway. Minh stands on the right in café floor, facing Lan."
      ),
    }),
  ]);
  const before = structuredClone(legacy);
  const state = buildProductionState(legacy);
  const shot = state.shots[0]!;

  assert.deepEqual(legacy, before);
  assert.equal(shot.spatial_graph?.zones.length, 3);
  assert.equal(shot.spatial_graph?.connectors.length, 2);
  assert.equal(shot.start_snapshot.placements.length, 2);
  assert.equal(shot.start_snapshot.placements[0]?.zone_id, "zone_lobby_floor");
  assert.equal(shot.start_snapshot.placements[1]?.zone_id, "zone_cafe_floor");
});

test("SpatialGraphValidator rejects connectors and placements pointing outside the graph", () => {
  const state = buildProductionState(
    breakdown([
      segment(1, {
        characters_in_scene: ["Lan", "Minh"],
        spatial_layout: twoPersonLayout("Lan on the left in lobby floor. Minh on the right in café floor."),
      }),
    ])
  );
  state.shots[0]!.spatial_graph!.connectors[0]!.to_zone_id = "zone_missing";
  state.shots[0]!.start_snapshot.placements[0]!.anchor_id = "anchor_missing";
  const findings = validateSpatialState(state);

  assert.ok(findings.some((item) => item.code === "SPATIAL_CONNECTOR_INVALID"));
  assert.ok(findings.some((item) => item.code === "SPATIAL_PLACEMENT_ANCHOR_INVALID"));
});

test("continuous boundary catches a silent left-right seat swap", () => {
  const first = segment(1, {
    characters_in_scene: ["Lan", "Minh"],
    spatial_layout: twoPersonLayout("Lan is on the left in lobby floor. Minh is on the right in lobby floor."),
  });
  const second = segment(2, {
    characters_in_scene: ["Lan", "Minh"],
    continuity_mode: "continuous",
    transition_in: {
      mode: "continuous",
      to_location_id: "lobby",
      time_relation: "same moment",
      preserve: ["character placement"],
      reset: [],
      reason: "same conversation",
    },
    spatial_layout: twoPersonLayout("Lan is on the right in lobby floor. Minh is on the left in lobby floor."),
  });
  const state = buildProductionState(breakdown([first, second]));
  const findings = validateSpatialState(state);

  assert.ok(
    findings.some(
      (item) =>
        item.code === "SPATIAL_UNEXPLAINED_REPOSITION" ||
        item.code === "SPATIAL_TELEPORT_OR_SWAP"
    )
  );
});

test("continuous boundary treats null-to-known zone metadata as enrichment when prose placement is identical", () => {
  const first = segment(1, {
    characters_in_scene: ["Lan", "Minh"],
    spatial_layout: twoPersonLayout("Lan screen-left facing Minh. Minh screen-right facing Lan."),
  });
  const second = segment(2, {
    characters_in_scene: ["Lan", "Minh"],
    continuity_mode: "continuous",
    transition_in: {
      mode: "continuous", to_location_id: "lobby", time_relation: "same moment",
      preserve: ["placement"], reset: [], reason: "same conversation",
    },
    spatial_layout: twoPersonLayout("Lan screen-left facing Minh. Minh screen-right facing Lan."),
  });
  const state = buildProductionState(breakdown([first, second]));
  const before = state.shots[0]!.end_snapshot.placements[0]!;
  const after = state.shots[1]!.start_snapshot.placements[0]!;
  before.position_label = after.position_label;
  before.body_orientation = after.body_orientation;
  before.zone_id = null;
  before.anchor_id = null;
  assert.equal(
    validateSpatialState(state).some((item) =>
      item.entity_ids.includes(before.entity_id) &&
      ["SPATIAL_UNEXPLAINED_REPOSITION", "SPATIAL_TELEPORT_OR_SWAP"].includes(item.code)
    ),
    false
  );
});

test("continuous boundary treats null-to-known zone metadata as enrichment despite prose detail drift", () => {
  const first = segment(1, {
    characters_in_scene: ["Lan", "Minh"],
    spatial_layout: twoPersonLayout("Lan at sink front right; Minh at sink left near Lan"),
  });
  const second = segment(2, {
    characters_in_scene: ["Lan", "Minh"],
    continuity_mode: "continuous",
    spatial_layout: twoPersonLayout("Lan and Minh remain beside the sink in the same room"),
  });
  const state = buildProductionState(breakdown([first, second]));
  state.shots[0]!.end_snapshot.placements.forEach((placement) => { placement.zone_id = null; });
  assert.equal(
    validateSpatialState(state).some((item) => item.code === "SPATIAL_TELEPORT_OR_SWAP"),
    false
  );
});

test("an intentional scene cut does not treat changed placement as teleport", () => {
  const first = segment(1, {
    characters_in_scene: ["Lan", "Minh"],
    spatial_layout: twoPersonLayout("Lan is on the left in lobby floor. Minh is on the right in lobby floor."),
  });
  const second = segment(2, {
    characters_in_scene: ["Lan", "Minh"],
    transition_in: {
      mode: "scene_cut",
      to_location_id: "cafe",
      time_relation: "later",
      preserve: ["identity"],
      reset: ["placement"],
      reason: "intentional new setup",
    },
    spatial_layout: twoPersonLayout("Lan is on the right in café floor. Minh is on the left in café floor."),
  });
  const state = buildProductionState(breakdown([first, second]));
  const findings = validateSpatialState(state);

  assert.equal(
    findings.some(
      (item) =>
        item.code === "SPATIAL_UNEXPLAINED_REPOSITION" ||
        item.code === "SPATIAL_TELEPORT_OR_SWAP"
    ),
    false
  );
});

test("continuous single-zone shots reuse one stable location floor ID despite filler wording", () => {
  const first = segment(1, {
    location_id: "Kitchen",
    characters_in_scene: ["Lan", "Minh"],
    spatial_layout: {
      zone_order: "kitchen floor only",
      fixed_architecture: "sink and counter remain fixed",
      character_placement: "Lan and Minh stand on the kitchen floor facing each other",
      walkable_path: "the kitchen floor is unobstructed",
      camera_zone: "camera beside the counter",
    },
  });
  const second = segment(2, {
    location_id: "Kitchen",
    characters_in_scene: ["Lan", "Minh"],
    continuity_mode: "continuous",
    transition_in: {
      mode: "continuous",
      from_location_id: "Kitchen",
      to_location_id: "Kitchen",
      time_relation: "same moment",
      preserve: ["placement"],
      reset: [],
      reason: "same confrontation",
    },
    spatial_layout: {
      zone_order: "kitchen floor",
      fixed_architecture: "sink and counter remain fixed",
      character_placement: "Lan and Minh stand on the kitchen floor facing each other",
      walkable_path: "the kitchen floor is unobstructed",
      camera_zone: "camera beside the counter",
    },
  });

  const state = buildProductionState(breakdown([first, second]));
  const firstZone = state.shots[0]?.spatial_graph?.zones[0]?.zone_id;
  const secondZone = state.shots[1]?.spatial_graph?.zones[0]?.zone_id;
  const findings = validateSpatialState(state);

  assert.equal(firstZone, "zone_loc_kitchen_walkable");
  assert.equal(secondZone, firstZone);
  assert.equal(
    findings.some((finding) => finding.code === "SPATIAL_TELEPORT_OR_SWAP"),
    false
  );
});

test("compound legacy action is preserved as ordered atomic transitions with local timing", () => {
  const state = buildProductionState(
    breakdown(
      [
        segment(1, {
          characters_in_scene: ["Lan"],
          state_ledger: {
            start: [{ entity_id: "Phone", state: "on", position: "on table" }],
            changes: [
              {
                entity_id: "Phone",
                from: "on",
                action: "Lan picks up the phone then walks to the doorway",
                to: "held",
                caused_by: "Lan",
              },
            ],
            end: [
              {
                entity_id: "Phone",
                state: "held",
                position: "in Lan's right hand",
                holder: "Lan",
              },
            ],
          },
        }),
      ],
      ["Lan"]
    )
  );
  const actions = state.shots[0]?.actions ?? [];
  const findings = validateAtomicActions(state);

  assert.equal(actions.length, 2);
  assert.deepEqual(actions.map((action) => action.verb), [
    "Lan picks up the phone",
    "walks to the doorway",
  ]);
  assert.ok(actions.every((action) => action.is_atomic));
  assert.equal(actions.reduce((sum, action) => sum + (action.duration_s ?? 0), 0), 10);
  assert.equal(findings.some((item) => item.code === "ACTION_NOT_ATOMIC"), false);
  assert.equal(findings.some((item) => item.code === "ACTION_DURATION_MISSING"), false);
});

test("while choreography splits locally and manipulation receives hand-contact evidence", () => {
  const state = buildProductionState(
    breakdown(
      [
        segment(1, {
          characters_in_scene: ["Lan"],
          state_ledger: {
            start: [
              { entity_id: "Lan", state: "running", position: "path" },
              { entity_id: "Tower", state: "upright", position: "path edge" },
            ],
            changes: [
              {
                entity_id: "Tower",
                from: "upright",
                action: "Lan runs forward while reaching toward and pushing the tower",
                to: "tilted",
                caused_by: "Lan",
              },
            ],
            end: [
              { entity_id: "Lan", state: "running", position: "path" },
              { entity_id: "Tower", state: "tilted", position: "path edge" },
            ],
          },
        }),
      ],
      ["Lan"]
    )
  );
  const actions = state.shots[0]!.actions;
  const contact = actions.find((action) => /push/iu.test(action.verb));
  const findings = validateAtomicActions(state);

  assert.equal(actions.length, 2);
  assert.ok(actions.every((action) => action.is_atomic));
  assert.equal(contact?.body_part, "right_hand");
  assert.ok(contact?.contact_entity_ids.includes(contact.object_entity_id!));
  assert.equal(findings.some((item) => item.code === "ACTION_NOT_ATOMIC"), false);
  assert.equal(findings.some((item) => item.code === "ACTION_CONTACT_CONTRACT_INCOMPLETE"), false);
});

test("action duration validator rejects physically impossible shoe-removal timing", () => {
  const shoeState = buildProductionState(
    breakdown(
      [
        segment(1, {
          characters_in_scene: ["Lan"],
          state_ledger: {
            start: [
              { entity_id: "Lan", state: "sitting", position: "sitting on chair" },
              { entity_id: "Shoe", state: "worn", position: "on Lan's right foot" },
            ],
            changes: [
              {
                entity_id: "Shoe",
                from: "worn",
                action: "Lan uses her right hand to remove the shoe in 0.5s",
                to: "removed",
                caused_by: "Lan",
                to_holder: "Lan",
                to_position: "in Lan's right hand",
              },
            ],
            end: [
              { entity_id: "Lan", state: "sitting", position: "sitting on chair" },
              {
                entity_id: "Shoe",
                state: "removed",
                position: "in Lan's right hand",
                holder: "Lan",
              },
            ],
          },
        }),
      ],
      ["Lan"]
    )
  );
  const action = shoeState.shots[0]?.actions[0];
  const findings = validateAtomicActions(shoeState);

  assert.equal(action?.duration_s, 0.5);
  assert.equal(action?.minimum_duration_s, 2.5);
  assert.ok(findings.some((item) => item.code === "ACTION_DURATION_TOO_SHORT"));
});

test("atomic state chain detects a mismatched intermediate object state", () => {
  const compiled = buildProductionState(
    breakdown([segment(1, { characters_in_scene: ["Lan"] })], ["Lan"])
  );
  const shot = compiled.shots[0]!;
  shot.actions = [
    {
      action_id: "a1",
      source_change_index: 0,
      subject_entity_id: "char_lan",
      verb: "touch phone",
      object_entity_id: "obj_phone",
      body_part: "right_hand",
      start_state: "on table",
      transition_states: [],
      end_state: "gripped",
      contact_entity_ids: ["obj_phone"],
      duration_s: 1,
      minimum_duration_s: 0.6,
      physical_conditions: [],
      from_zone_id: "zone_table",
      to_zone_id: "zone_table",
      is_atomic: true,
      evidence: "Lan touches phone",
    },
    {
      action_id: "a2",
      source_change_index: 1,
      subject_entity_id: "char_lan",
      verb: "lift phone",
      object_entity_id: "obj_phone",
      body_part: "right_hand",
      start_state: "still on table",
      transition_states: [],
      end_state: "held",
      contact_entity_ids: ["obj_phone"],
      duration_s: 1,
      minimum_duration_s: 0.8,
      physical_conditions: [],
      from_zone_id: "zone_table",
      to_zone_id: "zone_table",
      is_atomic: true,
      evidence: "Lan lifts phone",
    },
  ];
  const findings = validateAtomicActions(compiled);
  assert.ok(findings.some((item) => item.code === "ACTION_STATE_CHAIN_BROKEN"));
});

// Regression: a 2-character shot whose segment legitimately omits spatial_layout
// (the breakdown prompt tells the model to omit it for simple single-zone scenes)
// must NOT emit an export-blocking high — that produced an unrepairable gate. It
// stays advisory (medium) and fires ONCE per shot, not once per start/end boundary.
test("multi-character shot without spatial_layout is advisory medium, once per shot", () => {
  const state = buildProductionState(
    breakdown([segment(1, { characters_in_scene: ["Lan", "Minh"] })])
  );
  const placement = validateSpatialState(state).filter(
    (item) => item.code === "SPATIAL_MULTI_CHARACTER_PLACEMENT_MISSING"
  );
  assert.equal(placement.length, 1);
  assert.equal(placement[0]?.severity, "medium");
});

// Regression: when a spatial graph DOES exist but a character is unplaced in it,
// that is a genuine structured gap and must still block (high).
test("multi-character shot with a graph but an unplaced character still blocks (high)", () => {
  const state = buildProductionState(
    breakdown([
      segment(1, {
        characters_in_scene: ["Lan", "Minh"],
        spatial_layout: twoPersonLayout("Lan on the left in lobby floor."),
      }),
    ])
  );
  // Drop one compiled placement to simulate an unplaced character in a real graph.
  state.shots[0]!.start_snapshot.placements = state.shots[0]!.start_snapshot.placements.slice(0, 1);
  const placement = validateSpatialState(state).filter(
    (item) => item.code === "SPATIAL_MULTI_CHARACTER_PLACEMENT_MISSING"
  );
  assert.equal(placement.length, 1);
  assert.equal(placement[0]?.severity, "high");
});
