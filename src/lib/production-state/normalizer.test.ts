import assert from "node:assert/strict";
import test from "node:test";
import type { StoryboardGenerationOutput, VideoSegment } from "@/types";
import { ProductionIdRegistry } from "./id-registry.ts";
import { buildProductionState } from "./normalizer.ts";
import { productionStateSchema } from "./schema.ts";

function segment(
  segmentNumber: number,
  overrides: Partial<VideoSegment> = {}
): VideoSegment {
  return {
    segment_number: segmentNumber,
    duration_seconds: 10,
    title: `Shot ${segmentNumber}`,
    marketing_role: "body",
    beats: [],
    first_frame_prompt: "Legacy first-frame prompt",
    motion_prompt: "Legacy motion prompt",
    dialogue: null,
    continuity_note: "Legacy continuity note",
    ...overrides,
  };
}

function breakdown(
  segments: VideoSegment[],
  totalDuration = segments.reduce((sum, item) => sum + item.duration_seconds, 0)
): Pick<
  StoryboardGenerationOutput,
  "character_locks" | "segments" | "total_duration_seconds"
> {
  return {
    total_duration_seconds: totalDuration,
    character_locks: [],
    segments,
  };
}

const cupOnTable = {
  entity_id: "Cup",
  state: "full",
  position: "on the table",
  holder: null,
  orientation: "upright",
};

test("registry gives different stable IDs to display names with the same slug", () => {
  const registry = new ProductionIdRegistry();
  const first = registry.register({ kind: "character", displayName: "Đặng Minh" });
  const second = registry.register({ kind: "character", displayName: "Dặng Minh" });
  const persisted = registry.register({
    kind: "character",
    displayName: "Tên hiển thị mới",
    preferredId: "char_001",
  });

  assert.equal(first.entity_id, "char_dang_minh");
  assert.equal(second.entity_id, "char_dang_minh_2");
  assert.equal(persisted.entity_id, "char_001");
});

test("absolute timeline is contiguous and total mismatch produces evidence", () => {
  const state = buildProductionState(breakdown([segment(1), segment(2)], 25));

  assert.deepEqual(
    state.shots.map((shot) => [shot.start_time_s, shot.end_time_s]),
    [
      [0, 10],
      [10, 20],
    ]
  );
  const finding = state.findings.find((item) => item.code === "TIMELINE_TOTAL_MISMATCH");
  assert.deepEqual(finding?.evidence, {
    shot_duration_sum: 20,
    total_duration_seconds: 25,
  });
  assert.ok(finding?.suggested_patch);
});

test("continuous boundary reports an entity-specific snapshot mismatch", () => {
  const first = segment(1, {
    state_ledger: { start: [cupOnTable], changes: [], end: [cupOnTable] },
  });
  const second = segment(2, {
    continuity_mode: "continuous",
    transition_in: {
      mode: "continuous",
      to_location_id: "kitchen",
      time_relation: "same moment",
      preserve: ["Cup"],
      reset: [],
      reason: "same action continues",
    },
    state_ledger: {
      start: [{ ...cupOnTable, position: "in Lan's hand", holder: "Lan" }],
      changes: [],
      end: [{ ...cupOnTable, position: "in Lan's hand", holder: "Lan" }],
    },
  });

  const state = buildProductionState(breakdown([first, second]));
  const finding = state.findings.find((item) => item.code === "BOUNDARY_CONTINUITY_MISMATCH");
  assert.equal(finding?.shot_id, "shot_002");
  assert.equal(finding?.entity_ids.length, 1);
  assert.ok(finding?.evidence.differences);
  assert.ok(finding?.suggested_patch);
});

test("intentional time jump permits a different start snapshot", () => {
  const first = segment(1, {
    state_ledger: { start: [cupOnTable], changes: [], end: [cupOnTable] },
  });
  const second = segment(2, {
    transition_in: {
      mode: "time_jump",
      from_location_id: "kitchen",
      to_location_id: "living_room",
      time_relation: "three days later",
      preserve: ["character identity"],
      reset: ["object placement", "lighting"],
      reason: "the story intentionally advances three days",
    },
    state_ledger: {
      start: [{ ...cupOnTable, state: "empty", position: "inside a cabinet" }],
      changes: [],
      end: [{ ...cupOnTable, state: "empty", position: "inside a cabinet" }],
    },
  });

  const state = buildProductionState(breakdown([first, second]));
  assert.equal(state.boundaries[1]?.transition_mode, "time_jump");
  assert.equal(state.boundaries[1]?.intentional, true);
  assert.equal(state.shots[1]?.story_time, "three days later");
  assert.equal(
    state.findings.some((item) => item.code === "BOUNDARY_CONTINUITY_MISMATCH"),
    false
  );
});

test("legacy ledger and spatial layout convert without mutating legacy data", () => {
  const legacy = breakdown([
    segment(1, {
      location_id: "Kitchen",
      state_ledger: { start: [cupOnTable], changes: [], end: [cupOnTable] },
      spatial_layout: {
        zone_order: "door -> table",
        fixed_architecture: "door and table remain fixed",
        character_placement: "Lan stands left of the table",
        walkable_path: "door to table",
        camera_zone: "opposite the table",
      },
    }),
  ]);
  const before = structuredClone(legacy);
  const state = buildProductionState(legacy);

  assert.deepEqual(legacy, before);
  assert.equal(state.shots[0]?.start_snapshot.entities[0]?.entity_id, "obj_cup");
  assert.equal(state.shots[0]?.location_id, "loc_kitchen");
  assert.equal(state.shots[0]?.start_snapshot.spatial_layout?.zone_order, "door -> table");
  assert.equal(productionStateSchema.safeParse(state).success, true);
});
