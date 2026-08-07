import type { VideoSegment } from "@/types";
import type {
  NanoFlowShotStateAuthority,
  NanoFlowScriptAuthority,
} from "@/types/nano-flow";
import type { ProductionState, ShotState } from "../production-state/types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    if (input[key] !== undefined) output[key] = stableValue(input[key]);
  }
  return output;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

/** Browser-safe deterministic FNV-1a fingerprint; this is an equality token, not a secret hash. */
export function authorityFingerprint(value: unknown): string {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `psa_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildScriptAuthority(segment: VideoSegment): NanoFlowScriptAuthority {
  return {
    first_frame_prompt: clean(segment.first_frame_prompt),
    motion_prompt: clean(segment.motion_prompt),
    full_prompt: clean(segment.full_prompt),
    dialogue: clean(segment.dialogue) || null,
    beats: (segment.beats ?? []).map((beat) => ({
      beat: clean(beat.beat),
      camera: clean(beat.camera),
    })),
  };
}

export function buildNanoFlowShotStateAuthority(params: {
  productionState: ProductionState;
  shot: ShotState;
  segment: VideoSegment;
}): NanoFlowShotStateAuthority {
  const scriptContract = buildScriptAuthority(params.segment);
  const sourceContract = {
    production_shot_id: params.shot.shot_id,
    script_contract: scriptContract,
    start_snapshot: params.shot.start_snapshot,
    end_snapshot: params.shot.end_snapshot,
    spatial_graph: params.shot.spatial_graph,
    camera_state: params.shot.camera_state,
    lighting_state: params.shot.lighting_state,
    dialogue_state: params.shot.dialogue_state,
    audio_state: params.shot.audio_state,
    actions: params.shot.actions,
  };
  return {
    production_shot_id: params.shot.shot_id,
    authority_fingerprint: authorityFingerprint(sourceContract),
    authority_order: ["script", "production_state", "video_prompt", "storyboard_board"],
    script_contract: scriptContract,
    start_snapshot: params.shot.start_snapshot,
    end_snapshot: params.shot.end_snapshot,
    spatial_graph: params.shot.spatial_graph,
    camera_state: params.shot.camera_state,
    lighting_state: params.shot.lighting_state,
    dialogue_state: params.shot.dialogue_state,
    audio_state: params.shot.audio_state,
    actions: params.shot.actions,
    findings: params.productionState.findings.filter(
      (finding) => finding.shot_id === params.shot.shot_id
    ),
  };
}

/** Compact prompt payload. The full canonical state remains available on shot.state_authority. */
export function compactPromptAuthority(authority: NanoFlowShotStateAuthority) {
  const compactSnapshot = (snapshot: NanoFlowShotStateAuthority["start_snapshot"]) => ({
    entities: snapshot.entities.map((entity) => ({
      entity_id: entity.entity_id,
      kind: entity.kind,
      state: entity.state,
      position: entity.position,
      holder_entity_id: entity.holder_entity_id ?? null,
      orientation: entity.orientation ?? null,
      pose: entity.pose ?? entity.character_physics?.pose.pose ?? null,
      wardrobe: entity.wardrobe ?? null,
      held_objects: entity.character_physics
        ? Object.values(entity.character_physics.limbs).flatMap((limb) => limb.held_object_ids)
        : [],
    })),
    contacts: snapshot.contacts.filter((contact) => contact.active),
    supports: snapshot.supports.filter((support) => support.active),
    placements: snapshot.placements,
  });
  return {
    production_shot_id: authority.production_shot_id,
    authority_fingerprint: authority.authority_fingerprint,
    authority_order: authority.authority_order,
    script_contract: {
      first_frame_prompt: authority.script_contract.first_frame_prompt,
      motion_prompt: authority.script_contract.motion_prompt,
      dialogue: authority.script_contract.dialogue,
      beats: authority.script_contract.beats,
    },
    start_snapshot: compactSnapshot(authority.start_snapshot),
    ordered_atomic_actions: authority.actions.map((action) => ({
      action_id: action.action_id,
      subject_entity_id: action.subject_entity_id,
      verb: action.verb,
      object_entity_id: action.object_entity_id,
      body_part: action.body_part,
      start_state: action.start_state,
      transition_states: action.transition_states,
      end_state: action.end_state,
      contact_entity_ids: action.contact_entity_ids,
      from_zone_id: action.from_zone_id,
      to_zone_id: action.to_zone_id,
      evidence: action.evidence,
    })),
    end_snapshot: compactSnapshot(authority.end_snapshot),
    spatial_graph: authority.spatial_graph,
    camera_state: authority.camera_state,
    lighting_state: authority.lighting_state,
    dialogue_state: authority.dialogue_state,
    audio_state: authority.audio_state,
  };
}
