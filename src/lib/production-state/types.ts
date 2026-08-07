import type { SegmentTransitionMode, SpatialLayout } from "@/types";

export const PRODUCTION_STATE_VERSION = "1.0" as const;

export type ProductionEntityKind =
  | "character"
  | "object"
  | "product"
  | "location"
  | "unknown";

export interface ProductionRegistryEntry {
  entity_id: string;
  display_name: string;
  kind: ProductionEntityKind;
  aliases: string[];
  /** Legacy/model identifier retained only as migration evidence. */
  source_ref?: string;
}

export type LimbId = "left_hand" | "right_hand" | "left_foot" | "right_foot";

export interface LimbState {
  limb_id: LimbId;
  /** null means the legacy source did not provide enough topology evidence. */
  exists: boolean | null;
  position: string | null;
  status: "free" | "holding" | "contacting" | "supporting" | "unknown";
  held_object_ids: string[];
  contact_entity_ids: string[];
  /** Simultaneous physical jobs, used by HandOccupancyValidator. */
  activities: string[];
}

export interface BodyTopologyState {
  model: "human" | "non_human" | "unknown";
  torso_count: number | null;
  arm_count: number | null;
  hand_count: number | null;
  leg_count: number | null;
  foot_count: number | null;
}

export interface PoseState {
  pose: "standing" | "sitting" | "kneeling" | "lying" | "bending" | "unknown";
  weight_bearing_limb_ids: LimbId[];
  body_orientation: string | null;
  gaze_target_entity_id: string | null;
  zone_id: string | null;
  anchor: string | null;
}

export interface CharacterPhysicalState {
  instance_count: number;
  topology: BodyTopologyState;
  pose: PoseState;
  limbs: Record<LimbId, LimbState>;
  /** Held by the character, but the legacy source did not identify a hand. */
  unassigned_held_object_ids: string[];
  occupied_volume_id: string | null;
}

export interface ObjectPhysicalState {
  existence: "exists" | "does_not_exist" | "unknown";
  visibility: "visible" | "occluded" | "out_of_frame" | "unknown";
  occupied_volume_id: string | null;
}

export interface ContactRelation {
  source_entity_id: string;
  source_limb_id: LimbId | null;
  target_entity_id: string;
  kind: "touch" | "grip" | "hold" | "push" | "pull" | "support" | "unknown";
  active: boolean;
}

export interface SupportRelation {
  supported_entity_id: string;
  support_entity_id: string | null;
  kind: "ground" | "seat" | "surface" | "hand" | "body" | "unknown";
  contact_part: LimbId | "torso" | "object_base" | null;
  active: boolean;
}

export type SpatialZoneKind =
  | "walkable"
  | "seat"
  | "support_surface"
  | "threshold"
  | "stairs"
  | "barrier"
  | "unknown";

export interface SpatialZoneState {
  zone_id: string;
  label: string;
  kind: SpatialZoneKind;
  walkable: boolean | null;
  description: string;
}

export interface SpatialConnectorState {
  connector_id: string;
  from_zone_id: string;
  to_zone_id: string;
  kind: "open_path" | "doorway" | "threshold" | "stairs" | "unknown";
  bidirectional: boolean | null;
  path_clear: boolean | null;
  description: string;
}

export interface SpatialAnchorState {
  anchor_id: string;
  zone_id: string;
  label: string;
  kind: "architecture" | "furniture" | "object" | "mark" | "unknown";
  entity_id: string | null;
  description: string;
}

export interface SpatialGraphState {
  graph_id: string;
  source: "structured" | "legacy_compiled";
  zones: SpatialZoneState[];
  connectors: SpatialConnectorState[];
  anchors: SpatialAnchorState[];
  camera_zone_id: string | null;
}

export interface EntityPlacementState {
  entity_id: string;
  zone_id: string | null;
  anchor_id: string | null;
  position_label: string;
  body_orientation: string | null;
  facing_entity_id: string | null;
  distance_to_anchor: string | null;
  world_side: "left" | "right" | "center" | "unknown";
  screen_side: "left" | "right" | "center" | "unknown";
}

export interface CameraState {
  camera_id: string;
  source: "structured" | "legacy_compiled";
  zone_id: string | null;
  position_label: string;
  shot_size: "extreme_close_up" | "close_up" | "medium" | "wide" | "unknown";
  lens_mm: number | null;
  yaw_deg: number | null;
  pitch_deg: number | null;
  roll_deg: number | null;
  look_target_entity_id: string | null;
  axis_id: string | null;
  axis_side: "left" | "right" | "on_axis" | "unknown";
  movement: string | null;
}

export interface LightingState {
  source: "structured" | "legacy_compiled";
  time_of_day: string | null;
  key_source: string | null;
  key_direction: "front" | "back" | "left" | "right" | "top" | "bottom" | "diffuse" | "unknown";
  color_temperature_k: number | null;
  intensity_lux: number | null;
  shadow_direction: "front" | "back" | "left" | "right" | "top" | "bottom" | "diffuse" | "unknown";
  continuity_group: string | null;
}

export interface VisualInstanceState {
  instance_id: string;
  entity_id: string;
  classification: "primary" | "reflection" | "screen_image" | "background_duplicate";
  visible: boolean;
  source_surface_id: string | null;
}

export interface OcclusionRelationState {
  occluded_entity_id: string;
  occluder_entity_id: string | null;
  state: "partial" | "full" | "out_of_frame";
  entity_still_exists: boolean;
  expected_reappearance: boolean | null;
}

export interface ProductionEntitySnapshot {
  entity_id: string;
  kind: ProductionEntityKind;
  state: string;
  position: string;
  holder_entity_id?: string | null;
  orientation?: string | null;
  traces?: string[];
  /** Reserved structured dimensions. Legacy data may leave them unknown. */
  pose?: string | null;
  visible?: boolean | null;
  wardrobe?: string | null;
  character_physics?: CharacterPhysicalState;
  object_physics?: ObjectPhysicalState;
}

export interface ProductionSnapshot {
  entities: ProductionEntitySnapshot[];
  contacts: ContactRelation[];
  supports: SupportRelation[];
  placements: EntityPlacementState[];
  visual_instances: VisualInstanceState[];
  occlusions: OcclusionRelationState[];
  spatial_layout?: SpatialLayout;
}

export interface ProductionStateChange {
  entity_id: string;
  from: string;
  action: string;
  to: string;
  caused_by: string;
  from_position?: string;
  to_position?: string;
  from_holder_entity_id?: string | null;
  to_holder_entity_id?: string | null;
  from_orientation?: string | null;
  to_orientation?: string | null;
  trace?: string;
  body_part?: LimbId | "torso" | null;
  contact_entity_ids?: string[];
  duration_s?: number | null;
  physical_conditions?: string[];
}

export interface AtomicAction {
  action_id: string;
  source_change_index: number;
  subject_entity_id: string | null;
  verb: string;
  object_entity_id: string | null;
  body_part: LimbId | "torso" | null;
  start_state: string;
  transition_states: string[];
  end_state: string;
  contact_entity_ids: string[];
  duration_s: number | null;
  minimum_duration_s: number;
  physical_conditions: string[];
  from_zone_id: string | null;
  to_zone_id: string | null;
  is_atomic: boolean;
  evidence: string;
}

export type DialogueDeliveryState = "on_screen" | "off_screen" | "voiceover";

/** Canonical dialogue clock. Turn times are local to the shot; absolute times
 * are derived once from the shot's production timeline. */
export interface DialogueTurnState {
  turn_id: string;
  speaker_entity_id: string | null;
  speaker_display_name: string;
  delivery: DialogueDeliveryState;
  text: string;
  start_time_s: number | null;
  end_time_s: number | null;
  absolute_start_time_s: number | null;
  absolute_end_time_s: number | null;
  camera_beat: number | null;
  lip_sync_target_entity_id: string | null;
  voice_profile: string | null;
  listener_entity_ids: string[];
  listener_reaction_evidence: string | null;
}

export interface DialogueState {
  language: string | null;
  source: "dialogue_lines" | "legacy_single_line" | "none";
  camera_beat_count: number;
  turns: DialogueTurnState[];
}

export interface FoleyCueState {
  cue_id: string;
  kind: "footstep" | "prop_contact" | "clothing" | "action";
  action_id: string;
  entity_ids: string[];
  start_time_s: number | null;
  end_time_s: number | null;
  description: string;
  source: "compiled_action" | "legacy_text";
}

export interface AudioState {
  environment_sound_bed: string | null;
  environment_reverb: string | null;
  ambience_strategy: string | null;
  music_strategy: string | null;
  transition_policy:
    | "open"
    | "preserve"
    | "reset_to_location"
    | "reset_for_time"
    | "reset_for_cut";
  from_location_id: string | null;
  to_location_id: string | null;
  foley_cues: FoleyCueState[];
}

export interface ShotState {
  shot_id: string;
  scene_id: string;
  segment_number: number;
  location_id: string | null;
  start_time_s: number;
  end_time_s: number;
  /** Time inside the story, separate from the video's production clock. */
  story_time: string | null;
  spatial_graph: SpatialGraphState | null;
  camera_state: CameraState;
  lighting_state: LightingState;
  dialogue_state: DialogueState;
  audio_state: AudioState;
  start_snapshot: ProductionSnapshot;
  changes: ProductionStateChange[];
  actions: AtomicAction[];
  end_snapshot: ProductionSnapshot;
}

export interface BoundaryState {
  boundary_id: string;
  from_shot_id: string | null;
  to_shot_id: string;
  transition_mode: SegmentTransitionMode;
  time_relation: string | null;
  preserve: string[];
  reset: string[];
  intentional: boolean;
  reason: string | null;
}

export type ProductionFindingSeverity = "critical" | "high" | "medium";

export interface ProductionFinding {
  code: string;
  severity: ProductionFindingSeverity;
  message: string;
  shot_id: string | null;
  entity_ids: string[];
  evidence: Record<string, unknown>;
  /** Machine-readable proposal only. It is never applied automatically. */
  suggested_patch: Record<string, unknown> | null;
}

export interface ProductionState {
  version: typeof PRODUCTION_STATE_VERSION;
  registry: ProductionRegistryEntry[];
  shots: ShotState[];
  boundaries: BoundaryState[];
  findings: ProductionFinding[];
}
