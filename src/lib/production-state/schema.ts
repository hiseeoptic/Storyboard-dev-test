import { z } from "zod";

const entityKindSchema = z.enum([
  "character",
  "object",
  "product",
  "location",
  "unknown",
]);

const registryEntrySchema = z.object({
  entity_id: z.string().min(1),
  display_name: z.string().min(1),
  kind: entityKindSchema,
  aliases: z.array(z.string()),
  source_ref: z.string().optional(),
});

const limbIdSchema = z.enum(["left_hand", "right_hand", "left_foot", "right_foot"]);

const limbStateSchema = z.object({
  limb_id: limbIdSchema,
  exists: z.boolean().nullable(),
  position: z.string().nullable(),
  status: z.enum(["free", "holding", "contacting", "supporting", "unknown"]),
  held_object_ids: z.array(z.string()),
  contact_entity_ids: z.array(z.string()),
  activities: z.array(z.string()),
});

const characterPhysicalStateSchema = z.object({
  instance_count: z.number().int().nonnegative(),
  topology: z.object({
    model: z.enum(["human", "non_human", "unknown"]),
    torso_count: z.number().int().nonnegative().nullable(),
    arm_count: z.number().int().nonnegative().nullable(),
    hand_count: z.number().int().nonnegative().nullable(),
    leg_count: z.number().int().nonnegative().nullable(),
    foot_count: z.number().int().nonnegative().nullable(),
  }),
  pose: z.object({
    pose: z.enum(["standing", "sitting", "kneeling", "lying", "bending", "unknown"]),
    weight_bearing_limb_ids: z.array(limbIdSchema),
    body_orientation: z.string().nullable(),
    gaze_target_entity_id: z.string().nullable(),
    zone_id: z.string().nullable(),
    anchor: z.string().nullable(),
  }),
  limbs: z.object({
    left_hand: limbStateSchema,
    right_hand: limbStateSchema,
    left_foot: limbStateSchema,
    right_foot: limbStateSchema,
  }),
  unassigned_held_object_ids: z.array(z.string()),
  occupied_volume_id: z.string().nullable(),
});

const objectPhysicalStateSchema = z.object({
  existence: z.enum(["exists", "does_not_exist", "unknown"]),
  visibility: z.enum(["visible", "occluded", "out_of_frame", "unknown"]),
  occupied_volume_id: z.string().nullable(),
});

const entitySnapshotSchema = z.object({
  entity_id: z.string().min(1),
  kind: entityKindSchema,
  state: z.string(),
  position: z.string(),
  holder_entity_id: z.string().nullable().optional(),
  orientation: z.string().nullable().optional(),
  traces: z.array(z.string()).optional(),
  pose: z.string().nullable().optional(),
  visible: z.boolean().nullable().optional(),
  wardrobe: z.string().nullable().optional(),
  character_physics: characterPhysicalStateSchema.optional(),
  object_physics: objectPhysicalStateSchema.optional(),
});

const spatialLayoutSchema = z.object({
  zone_order: z.string(),
  fixed_architecture: z.string(),
  character_placement: z.string(),
  walkable_path: z.string(),
  camera_zone: z.string(),
  mechanism_motion: z.string().optional(),
});

const snapshotSchema = z.object({
  entities: z.array(entitySnapshotSchema),
  contacts: z.array(
    z.object({
      source_entity_id: z.string(),
      source_limb_id: limbIdSchema.nullable(),
      target_entity_id: z.string(),
      kind: z.enum(["touch", "grip", "hold", "push", "pull", "support", "unknown"]),
      active: z.boolean(),
    })
  ),
  supports: z.array(
    z.object({
      supported_entity_id: z.string(),
      support_entity_id: z.string().nullable(),
      kind: z.enum(["ground", "seat", "surface", "hand", "body", "unknown"]),
      contact_part: z.union([limbIdSchema, z.literal("torso"), z.literal("object_base")]).nullable(),
      active: z.boolean(),
    })
  ),
  placements: z.array(
    z.object({
      entity_id: z.string(),
      zone_id: z.string().nullable(),
      anchor_id: z.string().nullable(),
      position_label: z.string(),
      body_orientation: z.string().nullable(),
      facing_entity_id: z.string().nullable(),
      distance_to_anchor: z.string().nullable(),
      world_side: z.enum(["left", "right", "center", "unknown"]),
      screen_side: z.enum(["left", "right", "center", "unknown"]),
    })
  ),
  visual_instances: z.array(
    z.object({
      instance_id: z.string(),
      entity_id: z.string(),
      classification: z.enum(["primary", "reflection", "screen_image", "background_duplicate"]),
      visible: z.boolean(),
      source_surface_id: z.string().nullable(),
    })
  ),
  occlusions: z.array(
    z.object({
      occluded_entity_id: z.string(),
      occluder_entity_id: z.string().nullable(),
      state: z.enum(["partial", "full", "out_of_frame"]),
      entity_still_exists: z.boolean(),
      expected_reappearance: z.boolean().nullable(),
    })
  ),
  spatial_layout: spatialLayoutSchema.optional(),
});

const cameraStateSchema = z.object({
  camera_id: z.string(),
  source: z.enum(["structured", "legacy_compiled"]),
  zone_id: z.string().nullable(),
  position_label: z.string(),
  shot_size: z.enum(["extreme_close_up", "close_up", "medium", "wide", "unknown"]),
  lens_mm: z.number().positive().nullable(),
  yaw_deg: z.number().nullable(),
  pitch_deg: z.number().nullable(),
  roll_deg: z.number().nullable(),
  look_target_entity_id: z.string().nullable(),
  axis_id: z.string().nullable(),
  axis_side: z.enum(["left", "right", "on_axis", "unknown"]),
  movement: z.string().nullable(),
});

const lightingStateSchema = z.object({
  source: z.enum(["structured", "legacy_compiled"]),
  time_of_day: z.string().nullable(),
  key_source: z.string().nullable(),
  key_direction: z.enum(["front", "back", "left", "right", "top", "bottom", "diffuse", "unknown"]),
  color_temperature_k: z.number().positive().nullable(),
  intensity_lux: z.number().nonnegative().nullable(),
  shadow_direction: z.enum(["front", "back", "left", "right", "top", "bottom", "diffuse", "unknown"]),
  continuity_group: z.string().nullable(),
});

const spatialGraphSchema = z.object({
  graph_id: z.string(),
  source: z.enum(["structured", "legacy_compiled"]),
  zones: z.array(
    z.object({
      zone_id: z.string(),
      label: z.string(),
      kind: z.enum([
        "walkable",
        "seat",
        "support_surface",
        "threshold",
        "stairs",
        "barrier",
        "unknown",
      ]),
      walkable: z.boolean().nullable(),
      description: z.string(),
    })
  ),
  connectors: z.array(
    z.object({
      connector_id: z.string(),
      from_zone_id: z.string(),
      to_zone_id: z.string(),
      kind: z.enum(["open_path", "doorway", "threshold", "stairs", "unknown"]),
      bidirectional: z.boolean().nullable(),
      path_clear: z.boolean().nullable(),
      description: z.string(),
    })
  ),
  anchors: z.array(
    z.object({
      anchor_id: z.string(),
      zone_id: z.string(),
      label: z.string(),
      kind: z.enum(["architecture", "furniture", "object", "mark", "unknown"]),
      entity_id: z.string().nullable(),
      description: z.string(),
    })
  ),
  camera_zone_id: z.string().nullable(),
});

const stateChangeSchema = z.object({
  entity_id: z.string().min(1),
  from: z.string(),
  action: z.string(),
  to: z.string(),
  caused_by: z.string(),
  from_position: z.string().optional(),
  to_position: z.string().optional(),
  from_holder_entity_id: z.string().nullable().optional(),
  to_holder_entity_id: z.string().nullable().optional(),
  from_orientation: z.string().nullable().optional(),
  to_orientation: z.string().nullable().optional(),
  trace: z.string().optional(),
  body_part: z.union([limbIdSchema, z.literal("torso")]).nullable().optional(),
  contact_entity_ids: z.array(z.string()).optional(),
  duration_s: z.number().nonnegative().nullable().optional(),
  physical_conditions: z.array(z.string()).optional(),
});

const atomicActionSchema = z.object({
  action_id: z.string(),
  source_change_index: z.number().int().nonnegative(),
  subject_entity_id: z.string().nullable(),
  verb: z.string(),
  object_entity_id: z.string().nullable(),
  body_part: z.union([limbIdSchema, z.literal("torso")]).nullable(),
  start_state: z.string(),
  transition_states: z.array(z.string()),
  end_state: z.string(),
  contact_entity_ids: z.array(z.string()),
  duration_s: z.number().nonnegative().nullable(),
  minimum_duration_s: z.number().nonnegative(),
  physical_conditions: z.array(z.string()),
  from_zone_id: z.string().nullable(),
  to_zone_id: z.string().nullable(),
  is_atomic: z.boolean(),
  evidence: z.string(),
});

const dialogueStateSchema = z.object({
  language: z.string().nullable(),
  source: z.enum(["dialogue_lines", "legacy_single_line", "none"]),
  camera_beat_count: z.number().int().nonnegative(),
  turns: z.array(z.object({
    turn_id: z.string(),
    speaker_entity_id: z.string().nullable(),
    speaker_display_name: z.string(),
    delivery: z.enum(["on_screen", "off_screen", "voiceover"]),
    text: z.string(),
    start_time_s: z.number().nonnegative().nullable(),
    end_time_s: z.number().nonnegative().nullable(),
    absolute_start_time_s: z.number().nonnegative().nullable(),
    absolute_end_time_s: z.number().nonnegative().nullable(),
    camera_beat: z.number().int().positive().nullable(),
    lip_sync_target_entity_id: z.string().nullable(),
    voice_profile: z.string().nullable(),
    listener_entity_ids: z.array(z.string()),
    listener_reaction_evidence: z.string().nullable(),
  })),
});

const audioStateSchema = z.object({
  environment_sound_bed: z.string().nullable(),
  environment_reverb: z.string().nullable(),
  ambience_strategy: z.string().nullable(),
  music_strategy: z.string().nullable(),
  transition_policy: z.enum(["open", "preserve", "reset_to_location", "reset_for_time", "reset_for_cut"]),
  from_location_id: z.string().nullable(),
  to_location_id: z.string().nullable(),
  foley_cues: z.array(z.object({
    cue_id: z.string(),
    kind: z.enum(["footstep", "prop_contact", "clothing", "action"]),
    action_id: z.string(),
    entity_ids: z.array(z.string()),
    start_time_s: z.number().nonnegative().nullable(),
    end_time_s: z.number().nonnegative().nullable(),
    description: z.string(),
    source: z.enum(["compiled_action", "legacy_text"]),
  })),
});

const transitionModeSchema = z.enum([
  "opening",
  "continuous",
  "scene_cut",
  "location_cut",
  "time_jump",
  "parallel_intercut",
  "match_cut",
  "montage",
  "flashback",
  "dream",
  "symbolic",
]);

export const productionStateSchema = z.object({
  version: z.literal("1.0"),
  registry: z.array(registryEntrySchema),
  shots: z.array(
    z.object({
      shot_id: z.string().min(1),
      scene_id: z.string().min(1),
      segment_number: z.number().int().positive(),
      location_id: z.string().nullable(),
      start_time_s: z.number().nonnegative(),
      end_time_s: z.number().nonnegative(),
      story_time: z.string().nullable(),
      spatial_graph: spatialGraphSchema.nullable(),
      camera_state: cameraStateSchema,
      lighting_state: lightingStateSchema,
      dialogue_state: dialogueStateSchema,
      audio_state: audioStateSchema,
      start_snapshot: snapshotSchema,
      changes: z.array(stateChangeSchema),
      actions: z.array(atomicActionSchema),
      end_snapshot: snapshotSchema,
    })
  ),
  boundaries: z.array(
    z.object({
      boundary_id: z.string().min(1),
      from_shot_id: z.string().nullable(),
      to_shot_id: z.string().min(1),
      transition_mode: transitionModeSchema,
      time_relation: z.string().nullable(),
      preserve: z.array(z.string()),
      reset: z.array(z.string()),
      intentional: z.boolean(),
      reason: z.string().nullable(),
    })
  ),
  findings: z.array(
    z.object({
      code: z.string().min(1),
      severity: z.enum(["critical", "high", "medium"]),
      message: z.string().min(1),
      shot_id: z.string().nullable(),
      entity_ids: z.array(z.string()),
      evidence: z.record(z.unknown()),
      suggested_patch: z.record(z.unknown()).nullable(),
    })
  ),
});
