import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterLock, SceneBible, StoryboardGenerationOutput, VideoSegment } from "@/types";
import { validateCinematographyState } from "./cinematography-validator.ts";
import { buildProductionState } from "./normalizer.ts";

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
    first_frame_prompt: "morning interior",
    motion_prompt: "subtle natural movement",
    dialogue: null,
    continuity_note: "continuous visual state",
    ...overrides,
  };
}

function breakdown(
  segments: VideoSegment[],
  options: { names?: string[]; sceneBible?: SceneBible } = {}
): Pick<
  StoryboardGenerationOutput,
  "character_locks" | "segments" | "total_duration_seconds" | "scene_bible" | "context_ir"
> {
  return {
    character_locks: (options.names ?? ["Lan", "Minh"]).map(character),
    segments,
    total_duration_seconds: segments.reduce((sum, item) => sum + item.duration_seconds, 0),
    ...(options.sceneBible ? { scene_bible: options.sceneBible } : {}),
  };
}

const sceneBible: SceneBible = {
  lens: "50mm cinema lens",
  lighting: "morning key light from left at 4500K and 300 lux, shadows to right",
  backdrop: "warm interior",
  color_grade: "neutral",
};

test("legacy camera and lighting prose compile conservatively into structured state", () => {
  const input = breakdown(
    [
      segment(1, {
        characters_in_scene: ["Lan", "Minh"],
        beats: [
          {
            beat: "Lan speaks to Minh",
            camera: "medium shot, axis_id=dialogue_1, camera left of axis, static, focus on Lan",
          },
        ],
        spatial_layout: {
          zone_order: "room floor",
          fixed_architecture: "walls stay fixed",
          character_placement: "Lan screen-left facing Minh. Minh screen-right facing Lan.",
          walkable_path: "clear room floor",
          camera_zone: "camera on room floor",
        },
      }),
    ],
    { sceneBible }
  );
  const before = structuredClone(input);
  const state = buildProductionState(input);
  const shot = state.shots[0]!;

  assert.deepEqual(input, before);
  assert.equal(shot.camera_state.shot_size, "medium");
  assert.equal(shot.camera_state.lens_mm, 50);
  assert.equal(shot.camera_state.axis_id, "dialogue_1");
  assert.equal(shot.camera_state.axis_side, "left");
  assert.equal(shot.camera_state.look_target_entity_id, "char_lan");
  assert.equal(shot.lighting_state.color_temperature_k, 4500);
  assert.equal(shot.lighting_state.intensity_lux, 300);
  assert.equal(shot.lighting_state.key_direction, "left");
  assert.equal(shot.lighting_state.shadow_direction, "right");
});

test("CameraAxisValidator blocks a continuous 180-degree axis crossing", () => {
  const first = segment(1, {
    beats: [{ beat: "conversation", camera: "axis_id=dialogue_1, camera left of axis" }],
  });
  const second = segment(2, {
    continuity_mode: "continuous",
    transition_in: {
      mode: "continuous",
      to_location_id: "room",
      time_relation: "same moment",
      preserve: ["camera axis"],
      reset: [],
      reason: "same conversation",
    },
    beats: [{ beat: "reply", camera: "axis_id=dialogue_1, camera right of axis" }],
  });
  const state = buildProductionState(breakdown([first, second]));
  const findings = validateCinematographyState(state);
  assert.ok(findings.some((item) => item.code === "CAMERA_AXIS_180_CROSS"));
});

test("intentional scene cut permits a new camera axis side", () => {
  const first = segment(1, {
    beats: [{ beat: "conversation", camera: "axis_id=dialogue_1, camera left of axis" }],
  });
  const second = segment(2, {
    transition_in: {
      mode: "scene_cut",
      to_location_id: "new_room",
      time_relation: "later",
      preserve: ["identity"],
      reset: ["camera axis"],
      reason: "new setup",
    },
    beats: [{ beat: "new setup", camera: "axis_id=dialogue_1, camera right of axis" }],
  });
  const state = buildProductionState(breakdown([first, second]));
  const findings = validateCinematographyState(state);
  assert.equal(findings.some((item) => item.code === "CAMERA_AXIS_180_CROSS"), false);
});

test("CameraZoneValidator rejects a camera outside the spatial graph", () => {
  const state = buildProductionState(
    breakdown([
      segment(1, {
        spatial_layout: {
          zone_order: "room floor",
          fixed_architecture: "fixed walls",
          character_placement: "Lan in room floor",
          walkable_path: "clear floor",
          camera_zone: "room floor",
        },
      }),
    ])
  );
  state.shots[0]!.camera_state.zone_id = "zone_outside";
  const findings = validateCinematographyState(state);
  assert.ok(findings.some((item) => item.code === "CAMERA_ZONE_INVALID"));
});

test("LightingContinuityValidator catches Kelvin and key-direction drift", () => {
  const second = segment(2, {
    continuity_mode: "continuous",
    transition_in: {
      mode: "continuous",
      to_location_id: "room",
      time_relation: "same moment",
      preserve: ["lighting"],
      reset: [],
      reason: "same moment",
    },
  });
  const state = buildProductionState(breakdown([segment(1), second]));
  state.shots[0]!.lighting_state.color_temperature_k = 4500;
  state.shots[0]!.lighting_state.key_direction = "left";
  state.shots[1]!.lighting_state.color_temperature_k = 6500;
  state.shots[1]!.lighting_state.key_direction = "right";
  const findings = validateCinematographyState(state);
  assert.ok(findings.some((item) => item.code === "LIGHTING_CONTINUITY_DRIFT"));
});

test("time jump permits lighting and time-of-day reset", () => {
  const second = segment(2, {
    transition_in: {
      mode: "time_jump",
      to_location_id: "room",
      time_relation: "night",
      preserve: ["identity"],
      reset: ["lighting", "time of day"],
      reason: "hours later",
    },
  });
  const state = buildProductionState(breakdown([segment(1), second]));
  state.shots[0]!.lighting_state.color_temperature_k = 6500;
  state.shots[0]!.lighting_state.time_of_day = "morning";
  state.shots[1]!.lighting_state.color_temperature_k = 3200;
  state.shots[1]!.lighting_state.time_of_day = "night";
  const findings = validateCinematographyState(state);
  assert.equal(findings.some((item) => item.code === "LIGHTING_CONTINUITY_DRIFT"), false);
});

test("reflection with a declared mirror is not counted as a duplicate person", () => {
  const mirror = { entity_id: "Mirror", state: "intact", position: "on wall" };
  const state = buildProductionState(
    breakdown(
      [
        segment(1, {
          characters_in_scene: ["Lan"],
          first_frame_prompt: "Lan and Lan's reflection in the Mirror",
          state_ledger: { start: [mirror], changes: [], end: [mirror] },
        }),
      ],
      { names: ["Lan"] }
    )
  );
  const instances = state.shots[0]!.start_snapshot.visual_instances;
  const findings = validateCinematographyState(state);

  assert.equal(instances.filter((item) => item.classification === "primary").length, 1);
  assert.equal(instances.filter((item) => item.classification === "reflection").length, 1);
  assert.equal(findings.some((item) => item.code === "IDENTITY_MULTIPLE_PRIMARY_INSTANCES"), false);
  assert.equal(findings.some((item) => item.code === "REFLECTION_SOURCE_MISSING"), false);
});

test("explicit mirror prose registers its reflective surface without a ledger object", () => {
  const state = buildProductionState(
    breakdown(
      [segment(1, {
        characters_in_scene: ["Lan", "Minh"],
        first_frame_prompt: "Lan's reflection and Minh's reflection are both visible in the wall mirror",
      })],
      { names: ["Lan", "Minh"] }
    )
  );
  const reflections = state.shots[0]!.start_snapshot.visual_instances.filter(
    (instance) => instance.classification === "reflection"
  );
  assert.equal(reflections.length, 2);
  assert.ok(reflections.every((instance) => instance.source_surface_id === "obj_mirror_surface"));
  assert.equal(
    validateCinematographyState(state).some((item) => item.code === "REFLECTION_SOURCE_MISSING"),
    false
  );
});

test("negative reflection guards do not create phantom reflected characters", () => {
  const state = buildProductionState(
    breakdown(
      [segment(1, {
        characters_in_scene: ["Lan", "Minh"],
        first_frame_prompt: "Lan and Minh stand together. No reflections, never duplicate either character in a reflection.",
      })],
      { names: ["Lan", "Minh"] }
    )
  );
  assert.equal(
    state.shots[0]!.start_snapshot.visual_instances.some(
      (instance) => instance.classification === "reflection"
    ),
    false
  );
  assert.equal(
    validateCinematographyState(state).some((item) => item.code === "REFLECTION_SOURCE_MISSING"),
    false
  );
});

test("reflection without a mirror source is reported, and a background clone is critical", () => {
  const state = buildProductionState(
    breakdown(
      [
        segment(1, {
          characters_in_scene: ["Lan"],
          first_frame_prompt: "Lan's reflection plus a second identical person, a duplicate Lan in background",
        }),
      ],
      { names: ["Lan"] }
    )
  );
  const findings = validateCinematographyState(state);
  assert.ok(findings.some((item) => item.code === "REFLECTION_SOURCE_MISSING"));
  assert.ok(findings.some((item) => item.code === "IDENTITY_BACKGROUND_DUPLICATE"));
});

test("occluded character remains in the world; deleting it through occlusion is invalid", () => {
  const lan = { entity_id: "Lan", state: "occluded", position: "fully hidden behind door" };
  const state = buildProductionState(
    breakdown(
      [
        segment(1, {
          characters_in_scene: ["Lan"],
          state_ledger: { start: [lan], changes: [], end: [lan] },
        }),
      ],
      { names: ["Lan"] }
    )
  );
  const occlusion = state.shots[0]!.start_snapshot.occlusions[0]!;
  assert.equal(occlusion.entity_still_exists, true);
  let findings = validateCinematographyState(state);
  assert.equal(findings.some((item) => item.code === "OCCLUSION_ERASES_EXISTENCE"), false);

  occlusion.entity_still_exists = false;
  findings = validateCinematographyState(state);
  assert.ok(findings.some((item) => item.code === "OCCLUSION_ERASES_EXISTENCE"));
});
