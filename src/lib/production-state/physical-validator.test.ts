import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterLock, VideoSegment } from "@/types";
import { buildProductionState } from "./normalizer.ts";
import { validatePhysicalState } from "./physical-validator.ts";
import type {
  CharacterPhysicalState,
  LimbId,
  LimbState,
  ProductionEntitySnapshot,
  ProductionSnapshot,
  ProductionState,
  ProductionStateChange,
  ShotState,
} from "./types.ts";

function limb(limbId: LimbId, overrides: Partial<LimbState> = {}): LimbState {
  return {
    limb_id: limbId,
    exists: true,
    position: null,
    status: "free",
    held_object_ids: [],
    contact_entity_ids: [],
    activities: [],
    ...overrides,
  };
}

function characterPhysics(
  overrides: Partial<CharacterPhysicalState> = {}
): CharacterPhysicalState {
  return {
    instance_count: 1,
    topology: {
      model: "human",
      torso_count: 1,
      arm_count: 2,
      hand_count: 2,
      leg_count: 2,
      foot_count: 2,
    },
    pose: {
      pose: "unknown",
      weight_bearing_limb_ids: [],
      body_orientation: null,
      gaze_target_entity_id: null,
      zone_id: null,
      anchor: null,
    },
    limbs: {
      left_hand: limb("left_hand"),
      right_hand: limb("right_hand"),
      left_foot: limb("left_foot"),
      right_foot: limb("right_foot"),
    },
    unassigned_held_object_ids: [],
    occupied_volume_id: null,
    ...overrides,
  };
}

function characterEntity(
  id: string,
  physics: CharacterPhysicalState = characterPhysics()
): ProductionEntitySnapshot {
  return {
    entity_id: id,
    kind: "character",
    state: "",
    position: "",
    character_physics: physics,
  };
}

function snapshot(entities: ProductionEntitySnapshot[]): ProductionSnapshot {
  return {
    entities,
    contacts: [],
    supports: [],
    placements: [],
    visual_instances: [],
    occlusions: [],
  };
}

function shot(
  start: ProductionSnapshot,
  end: ProductionSnapshot = structuredClone(start),
  changes: ProductionStateChange[] = []
): ShotState {
  return {
    shot_id: "shot_001",
    scene_id: "scene_001",
    segment_number: 1,
    location_id: null,
    start_time_s: 0,
    end_time_s: 10,
    story_time: null,
    spatial_graph: null,
    camera_state: {
      camera_id: "camera_shot_001",
      source: "structured",
      zone_id: null,
      position_label: "",
      shot_size: "unknown",
      lens_mm: null,
      yaw_deg: null,
      pitch_deg: null,
      roll_deg: null,
      look_target_entity_id: null,
      axis_id: null,
      axis_side: "unknown",
      movement: null,
    },
    lighting_state: {
      source: "structured",
      time_of_day: null,
      key_source: null,
      key_direction: "unknown",
      color_temperature_k: null,
      intensity_lux: null,
      shadow_direction: "unknown",
      continuity_group: null,
    },
    dialogue_state: { language: null, source: "none", camera_beat_count: 0, turns: [] },
    audio_state: {
      environment_sound_bed: null,
      environment_reverb: null,
      ambience_strategy: null,
      music_strategy: null,
      transition_policy: "open",
      from_location_id: null,
      to_location_id: null,
      foley_cues: [],
    },
    start_snapshot: start,
    changes,
    actions: [],
    end_snapshot: end,
  };
}

function state(shots: ShotState[]): ProductionState {
  return {
    version: "1.0",
    registry: [],
    shots,
    boundaries: shots.map((item, index) => ({
      boundary_id: `boundary_${index + 1}`,
      from_shot_id: index === 0 ? null : shots[index - 1]!.shot_id,
      to_shot_id: item.shot_id,
      transition_mode: index === 0 ? "opening" : "continuous",
      time_relation: null,
      preserve: [],
      reset: [],
      intentional: false,
      reason: null,
    })),
    findings: [],
  };
}

test("BodyTopologyValidator catches wrong counts and an explicitly missing foot", () => {
  const physics = characterPhysics();
  physics.topology.hand_count = 3;
  physics.limbs.right_foot.exists = false;
  const findings = validatePhysicalState(state([shot(snapshot([characterEntity("char_lan", physics)]))]));

  assert.ok(findings.some((item) => item.code === "BODY_TOPOLOGY_INVALID"));
  assert.ok(findings.some((item) => item.code === "BODY_LIMB_MISSING"));
});

test("HandOccupancyValidator blocks one hand holding objects while doing another task", () => {
  const physics = characterPhysics();
  physics.limbs.right_hand = limb("right_hand", {
    status: "holding",
    held_object_ids: ["obj_phone", "obj_shoe"],
    activities: ["hold phone", "remove shoe", "brace chair"],
  });
  const findings = validatePhysicalState(state([shot(snapshot([characterEntity("char_lan", physics)]))]));

  assert.ok(findings.some((item) => item.code === "HAND_OCCUPANCY_CONFLICT"));
  assert.ok(findings.some((item) => item.code === "HAND_SIMULTANEOUS_TASK_CONFLICT"));
});

test("SupportValidator rejects sitting without a seat and accepts a declared seat", () => {
  const physics = characterPhysics();
  physics.pose.pose = "sitting";
  const unsupported = snapshot([characterEntity("char_lan", physics)]);
  const unsupportedFindings = validatePhysicalState(state([shot(unsupported)]));
  assert.ok(unsupportedFindings.some((item) => item.code === "SUPPORT_MISSING_FOR_SITTING"));

  const supported = snapshot([characterEntity("char_lan", physics)]);
  supported.supports.push({
    supported_entity_id: "char_lan",
    support_entity_id: "obj_chair",
    kind: "seat",
    contact_part: "torso",
    active: true,
  });
  const supportedFindings = validatePhysicalState(state([shot(supported)]));
  assert.equal(supportedFindings.some((item) => item.code === "SUPPORT_MISSING_FOR_SITTING"), false);
});

test("shoe removal requires an identified limb and contact with the shoe", () => {
  const baseChange: ProductionStateChange = {
    entity_id: "obj_shoe",
    from: "worn",
    action: "Lan removes the shoe",
    to: "removed",
    caused_by: "Lan",
    from_holder_entity_id: null,
    to_holder_entity_id: "char_lan",
  };
  const physicalShot = shot(snapshot([characterEntity("char_lan")]), undefined, [baseChange]);
  const missing = validatePhysicalState(state([physicalShot]));
  assert.ok(missing.some((item) => item.code === "CONTACT_CAUSALITY_MISSING"));

  baseChange.body_part = "right_hand";
  baseChange.contact_entity_ids = ["obj_shoe"];
  const complete = validatePhysicalState(state([physicalShot]));
  assert.equal(complete.some((item) => item.code === "CONTACT_CAUSALITY_MISSING"), false);
});

test("sitting-to-standing needs visible brace, weight shift or leg extension", () => {
  const startPhysics = characterPhysics();
  startPhysics.pose.pose = "sitting";
  const endPhysics = characterPhysics();
  endPhysics.pose.pose = "standing";
  const transition = shot(
    snapshot([characterEntity("char_lan", startPhysics)]),
    snapshot([characterEntity("char_lan", endPhysics)]),
    [
      {
        entity_id: "char_lan",
        from: "sitting",
        action: "Lan instantly appears standing",
        to: "standing",
        caused_by: "unspecified",
      },
    ]
  );
  transition.start_snapshot.supports.push({
    supported_entity_id: "char_lan",
    support_entity_id: "obj_chair",
    kind: "seat",
    contact_part: "torso",
    active: true,
  });
  transition.end_snapshot.supports.push({
    supported_entity_id: "char_lan",
    support_entity_id: null,
    kind: "ground",
    contact_part: null,
    active: true,
  });

  const findings = validatePhysicalState(state([transition]));
  assert.ok(findings.some((item) => item.code === "POSE_TRANSITION_UNSUPPORTED"));
});

test("CollisionValidator catches a person and object in the same occupied volume", () => {
  const physics = characterPhysics({ occupied_volume_id: "volume_chair_1" });
  const object: ProductionEntitySnapshot = {
    entity_id: "obj_chair",
    kind: "object",
    state: "intact",
    position: "at the desk",
    object_physics: {
      existence: "exists",
      visibility: "visible",
      occupied_volume_id: "volume_chair_1",
    },
  };
  const physicalSnapshot = snapshot([characterEntity("char_lan", physics), object]);
  physicalSnapshot.supports.push({
    supported_entity_id: "obj_chair",
    support_entity_id: null,
    kind: "ground",
    contact_part: "object_base",
    active: true,
  });
  const findings = validatePhysicalState(state([shot(physicalSnapshot)]));
  assert.ok(findings.some((item) => item.code === "COLLISION_OCCUPIED_VOLUME_CONFLICT"));
});

test("ObjectPersistenceValidator distinguishes explicit disappearance from omission", () => {
  const exists: ProductionEntitySnapshot = {
    entity_id: "obj_phone",
    kind: "object",
    state: "intact",
    position: "on table",
    object_physics: { existence: "exists", visibility: "visible", occupied_volume_id: null },
  };
  const gone: ProductionEntitySnapshot = {
    ...exists,
    position: "",
    object_physics: {
      existence: "does_not_exist",
      visibility: "unknown",
      occupied_volume_id: null,
    },
  };
  const first = shot(snapshot([exists]));
  first.shot_id = "shot_001";
  first.end_snapshot.supports.push({
    supported_entity_id: "obj_phone",
    support_entity_id: "obj_table",
    kind: "surface",
    contact_part: "object_base",
    active: true,
  });
  const second = shot(snapshot([gone]));
  second.shot_id = "shot_002";
  second.segment_number = 2;
  second.start_time_s = 10;
  second.end_time_s = 20;
  const findings = validatePhysicalState(state([first, second]));
  assert.ok(findings.some((item) => item.code === "OBJECT_PERSISTENCE_BROKEN"));
});

test("legacy compiler infers an explicit right-hand hold without mutating input", () => {
  const character = {
    name: "Lan",
    gender_age: "adult woman",
    build: "average",
    skin_tone: "warm",
    hair: "black",
    eyes: "brown",
    costume: "blue shirt",
    signature_features: "none",
    default_expression: "calm",
    render_style: "cinematic",
  } satisfies CharacterLock;
  const legacySegment = {
    segment_number: 1,
    duration_seconds: 10,
    title: "Phone",
    marketing_role: "body",
    beats: [],
    first_frame_prompt: "Lan holds a phone",
    motion_prompt: "Lan keeps holding the phone",
    dialogue: null,
    continuity_note: "same hold",
    characters_in_scene: ["Lan"],
    state_ledger: {
      start: [
        {
          entity_id: "Phone",
          state: "intact",
          position: "in Lan's right hand",
          holder: "Lan",
        },
      ],
      changes: [],
      end: [
        {
          entity_id: "Phone",
          state: "intact",
          position: "in Lan's right hand",
          holder: "Lan",
        },
      ],
    },
  } satisfies VideoSegment;
  const input = { character_locks: [character], segments: [legacySegment], total_duration_seconds: 10 };
  const before = structuredClone(input);
  const compiled = buildProductionState(input);

  assert.deepEqual(input, before);
  const lan = compiled.shots[0]?.start_snapshot.entities.find((entry) => entry.entity_id === "char_lan");
  assert.deepEqual(lan?.character_physics?.limbs.right_hand.held_object_ids, ["obj_phone"]);
  assert.ok(
    compiled.shots[0]?.start_snapshot.contacts.some(
      (contact) => contact.source_limb_id === "right_hand" && contact.target_entity_id === "obj_phone"
    )
  );
});

// Regression: a standing/sitting pose inferred from bare prose ("stands at the
// door", "sits on the steps") has no floor/chair keyword, but a standing or
// sitting human is ALWAYS physically supported. The compiler must assert that
// support so SUPPORT_MISSING_FOR_STANDING/SITTING never fires as a false
// export-blocking high on ordinary legacy text.
test("standing/sitting compiled from bare prose gets physical support, no false SUPPORT_MISSING", () => {
  const lan = {
    name: "Lan", gender_age: "adult woman", build: "average", skin_tone: "warm",
    hair: "black", eyes: "brown", costume: "blue shirt", signature_features: "none",
    default_expression: "calm", render_style: "cinematic",
  } satisfies CharacterLock;
  const minh = { ...lan, name: "Minh", gender_age: "adult man" } satisfies CharacterLock;
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Door", marketing_role: "body",
    beats: [], first_frame_prompt: "Lan at the door, Minh on the steps",
    motion_prompt: "", dialogue: null, continuity_note: "",
    characters_in_scene: ["Lan", "Minh"],
    state_ledger: {
      start: [
        { entity_id: "Lan", state: "standing at the doorway", position: "by the door" },
        { entity_id: "Minh", state: "sitting on the steps", position: "on the steps" },
      ],
      changes: [],
      end: [
        { entity_id: "Lan", state: "standing at the doorway", position: "by the door" },
        { entity_id: "Minh", state: "sitting on the steps", position: "on the steps" },
      ],
    },
  } satisfies VideoSegment;
  const compiled = buildProductionState({
    character_locks: [lan, minh], segments: [legacySegment], total_duration_seconds: 10,
  });
  const findings = validatePhysicalState(compiled);
  assert.equal(findings.some((item) => item.code === "SUPPORT_MISSING_FOR_STANDING"), false);
  assert.equal(findings.some((item) => item.code === "SUPPORT_MISSING_FOR_SITTING"), false);
  const start = compiled.shots[0]!.start_snapshot;
  assert.ok(start.supports.some((s) => s.supported_entity_id === "char_lan" && s.kind === "ground" && s.active));
  assert.ok(start.supports.some((s) => s.supported_entity_id === "char_minh" && s.kind === "seat" && s.active));
});

test("objects in a sink basin or on a floor compile with support instead of false blockers", () => {
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Broken bowl", marketing_role: "body",
    beats: [], first_frame_prompt: "Bowl and shards by the sink", motion_prompt: "",
    dialogue: null, continuity_note: "",
    state_ledger: {
      start: [
        { entity_id: "ceramic_bowl", state: "intact", position: "sink basin" },
        { entity_id: "ceramic_bowl_shards", state: "broken", position: "floor near dining_table" },
      ],
      changes: [],
      end: [
        { entity_id: "ceramic_bowl", state: "intact", position: "sink basin" },
        { entity_id: "ceramic_bowl_shards", state: "broken", position: "floor near dining_table" },
      ],
    },
  } satisfies VideoSegment;
  const compiled = buildProductionState({ character_locks: [], segments: [legacySegment], total_duration_seconds: 10 });
  const findings = validatePhysicalState(compiled);
  assert.equal(findings.some((item) => item.code === "OBJECT_SUPPORT_MISSING"), false);
});

test("wallet resting on a bed compiles as supported instead of a false blocker", () => {
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Wallet", marketing_role: "body",
    beats: [], first_frame_prompt: "A wallet remains on the bed behind Lan", motion_prompt: "",
    dialogue: null, continuity_note: "",
    state_ledger: {
      start: [{ entity_id: "wallet", state: "closed", position: "bed north side behind Lan" }],
      changes: [],
      end: [{ entity_id: "wallet", state: "closed", position: "bed north side behind Lan" }],
    },
  } satisfies VideoSegment;
  const compiled = buildProductionState({ character_locks: [], segments: [legacySegment], total_duration_seconds: 10 });
  assert.equal(validatePhysicalState(compiled).some((item) => item.code === "OBJECT_SUPPORT_MISSING"), false);
});

test("legacy sitting-to-standing boundary receives deterministic body mechanics", () => {
  const minh = {
    name: "Minh", gender_age: "adult", build: "average", skin_tone: "natural", hair: "black",
    eyes: "brown", costume: "shirt", signature_features: "none", default_expression: "neutral", render_style: "cinematic",
  } satisfies CharacterLock;
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Stand", marketing_role: "body",
    beats: [], first_frame_prompt: "Minh is sitting on a chair",
    motion_prompt: "Minh stands behind Lan", dialogue: null, continuity_note: "",
    characters_in_scene: ["Minh"],
    state_ledger: {
      start: [{ entity_id: "Minh", state: "sitting", position: "on chair" }],
      changes: [],
      end: [{ entity_id: "Minh", state: "standing", position: "behind Lan" }],
    },
  } satisfies VideoSegment;
  const compiled = buildProductionState({ character_locks: [minh], segments: [legacySegment], total_duration_seconds: 10 });
  assert.ok(compiled.shots[0]!.changes.some((change) =>
    change.physical_conditions?.some((condition) => /weight|brace|legs/iu.test(condition))
  ));
  assert.equal(validatePhysicalState(compiled).some((item) => item.code === "POSE_TRANSITION_UNSUPPORTED"), false);
});

test("contact/cut wording compiles causal contact evidence", () => {
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Finger cut", marketing_role: "body",
    beats: [], first_frame_prompt: "Minh near a sharp shard", motion_prompt: "Minh contacts the shard",
    dialogue: null, continuity_note: "", characters_in_scene: ["Minh"],
    state_ledger: {
      start: [{ entity_id: "Minh's right index finger", state: "intact", position: "near shard" }],
      changes: [{ entity_id: "Minh's right index finger", from: "intact", action: "contact with sharp shard causing cut", to: "bleeding", caused_by: "Minh's right hand contacts the sharp shard" }],
      end: [{ entity_id: "Minh's right index finger", state: "bleeding", position: "near shard" }],
    },
  } satisfies VideoSegment;
  const compiled = buildProductionState({ character_locks: [{
    name: "Minh", gender_age: "adult", build: "average", skin_tone: "natural", hair: "black",
    eyes: "brown", costume: "shirt", signature_features: "none", default_expression: "neutral", render_style: "cinematic",
  }], segments: [legacySegment], total_duration_seconds: 10 });
  assert.ok(compiled.shots[0]!.changes[0]!.contact_entity_ids?.length);
  assert.equal(validatePhysicalState(compiled).some((item) => item.code === "CONTACT_CAUSALITY_MISSING"), false);
});

test("gift box on sofa and bag inside the box compile with support", () => {
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Gift", marketing_role: "hook",
    beats: [], first_frame_prompt: "A gift box rests on the sofa with a bag inside",
    motion_prompt: "Lan reaches toward the gift", dialogue: null, continuity_note: "",
    state_ledger: {
      start: [
        { entity_id: "gift", state: "closed", position: "on sofa" },
        { entity_id: "bag", state: "intact", position: "inside gift box" },
      ],
      changes: [],
      end: [
        { entity_id: "gift", state: "closed", position: "on sofa" },
        { entity_id: "bag", state: "intact", position: "inside gift box" },
      ],
    },
  } satisfies VideoSegment;
  const compiled = buildProductionState({ character_locks: [], segments: [legacySegment], total_duration_seconds: 10 });
  assert.equal(validatePhysicalState(compiled).some((item) => item.code === "OBJECT_SUPPORT_MISSING"), false);
});

test("holder transfer with reach/lift gets a deterministic hand and contact target", () => {
  const legacySegment = {
    segment_number: 1, duration_seconds: 10, title: "Lift gift", marketing_role: "body",
    beats: [], first_frame_prompt: "Lan sits beside the gift",
    motion_prompt: "Lan reaches, lifts the gift and holds it", dialogue: null, continuity_note: "",
    characters_in_scene: ["Lan"],
    state_ledger: {
      start: [{ entity_id: "gift", state: "closed", position: "on table", holder: "" }],
      changes: [{
        entity_id: "gift", from: "closed", action: "Lan reaches and lifts the gift",
        to: "closed", caused_by: "Lan", from_holder: "", to_holder: "Lan",
        from_position: "on table", to_position: "in Lan's hand",
      }],
      end: [{ entity_id: "gift", state: "closed", position: "in Lan's hand", holder: "Lan" }],
    },
  } satisfies VideoSegment;
  const lan = {
    name: "Lan", gender_age: "adult", build: "average", skin_tone: "natural", hair: "black",
    eyes: "brown", costume: "shirt", signature_features: "none", default_expression: "neutral", render_style: "cinematic",
  } satisfies CharacterLock;
  const compiled = buildProductionState({ character_locks: [lan], segments: [legacySegment], total_duration_seconds: 10 });
  const change = compiled.shots[0]!.changes[0]!;
  assert.equal(change.body_part, "right_hand");
  assert.deepEqual(change.contact_entity_ids, ["obj_gift"]);
  assert.equal(validatePhysicalState(compiled).some((item) => item.code === "CONTACT_CAUSALITY_MISSING"), false);
});
