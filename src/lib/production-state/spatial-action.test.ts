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

test("compound legacy action is preserved but marked non-atomic with missing duration", () => {
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
  const action = state.shots[0]?.actions[0];
  const findings = validateAtomicActions(state);

  assert.equal(action?.is_atomic, false);
  assert.equal(action?.duration_s, null);
  assert.ok(findings.some((item) => item.code === "ACTION_NOT_ATOMIC"));
  assert.ok(findings.some((item) => item.code === "ACTION_DURATION_MISSING"));
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
