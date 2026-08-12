import type { CharacterLock, VideoSegment } from "@/types";
import type { ResolvedVideoContext } from "@/lib/video-context/types";
import { ensureDialogueClock } from "../timeline-contract.ts";
import type {
  AudioState,
  DialogueDeliveryState,
  DialogueTurnState,
  FoleyCueState,
  ProductionRegistryEntry,
  ShotState,
} from "./types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function lower(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

function resolveEntity(raw: string, registry: ProductionRegistryEntry[]): ProductionRegistryEntry | undefined {
  const wanted = lower(raw);
  if (!wanted) return undefined;
  return registry.find((entry) =>
    [entry.entity_id, entry.display_name, entry.source_ref, ...entry.aliases]
      .filter((value): value is string => Boolean(value))
      .some((value) => lower(value) === wanted)
  );
}

function voiceFor(entity: ProductionRegistryEntry | undefined, locks: CharacterLock[]): string | null {
  if (!entity) return null;
  const lock = locks.find((candidate) =>
    [candidate.character_id, candidate.display_name, candidate.name]
      .filter((value): value is string => Boolean(value))
      .some((value) => lower(value) === lower(entity.entity_id) || lower(value) === lower(entity.display_name) || entity.aliases.some((alias) => lower(alias) === lower(value)))
  );
  return clean(lock?.voice) || null;
}

function reactionEvidence(segment: VideoSegment, listeners: ProductionRegistryEntry[]): string | null {
  if (listeners.length === 0) return null;
  const evidence = [...(segment.beats ?? []).map((beat) => beat.beat), segment.motion_prompt].map(clean);
  const reaction = /\b(?:reacts?|listens?|nods?|smiles?|frowns?|looks?|glances?|pauses?|answers?|replies|laughs?|gasps?|flinches?|recoils?|braces?|winces?|ducks?|staggers?|freezes?|steps? back|catches? (?:his|her|their) breath)\b|\b(?:phản ứng|lắng nghe|gật đầu|mỉm cười|cau mày|nhìn|liếc|dừng lại|trả lời|cười|sững lại|giật mình|co người|né|đỡ|nhăn mặt|loạng choạng|lùi lại|nín thở|hụt hơi)\b/iu;
  return evidence.find((text) => reaction.test(text) && listeners.some((listener) =>
    [listener.display_name, listener.source_ref, ...listener.aliases]
      .filter((value): value is string => Boolean(value))
      .some((value) => lower(text).includes(lower(value)))
  )) ?? null;
}

function foleyFor(shot: ShotState): FoleyCueState[] {
  return shot.actions.flatMap((action, index) => {
    const text = lower(`${action.verb} ${action.evidence}`);
    let kind: FoleyCueState["kind"] | null = null;
    if (/\b(?:walk|step|cross|enter|exit|run)\b|\b(?:đi|bước|băng qua|đi vào|đi ra|chạy)\b/iu.test(text)) kind = "footstep";
    else if (/\b(?:grip(?:s)?|hold(?:s)?|pick(?:s)? up|place(?:s)?|set(?:s)? down|put(?:s)? down|touch(?:es)?|push(?:es)?|pull(?:s)?|open(?:s)?|close(?:s)?)\b|\b(?:cầm|nắm|nhặt|đặt|chạm|đẩy|kéo|mở|đóng)\b/iu.test(text)) kind = "prop_contact";
    else if (/\b(?:cloth|clothing|coat|shirt|dress|shoe|wardrobe)\b|\b(?:vải|quần áo|áo|váy|giày|trang phục)\b/iu.test(text)) kind = "clothing";
    if (!kind) return [];
    return [{
      cue_id: `${shot.shot_id}_foley_${String(index + 1).padStart(3, "0")}`,
      kind,
      action_id: action.action_id,
      entity_ids: [action.subject_entity_id, action.object_entity_id, ...action.contact_entity_ids]
        .filter((value): value is string => Boolean(value)),
      start_time_s: null,
      end_time_s: null,
      description: clean(action.evidence || action.verb),
      source: "compiled_action" as const,
    }];
  });
}

export function compileDialogueAudioState(params: {
  shot: ShotState;
  segment: VideoSegment;
  previousSegment?: VideoSegment;
  registry: ProductionRegistryEntry[];
  characterLocks: CharacterLock[];
  context?: ResolvedVideoContext;
}): void {
  const { shot, segment, previousSegment, registry, characterLocks, context } = params;
  const rawTurns = segment.dialogue_lines?.length
    ? segment.dialogue_lines
    : segment.dialogue
      ? [{ speaker: clean(segment.speaker), text: segment.dialogue }]
      : [];
  const source = segment.dialogue_lines?.length ? "dialogue_lines" : segment.dialogue ? "legacy_single_line" : "none";
  const turns = ensureDialogueClock(rawTurns.filter((turn) => clean(turn.text)), shot.end_time_s - shot.start_time_s);
  const visible = (segment.characters_in_scene ?? [])
    .map((name) => resolveEntity(name, registry))
    .filter((entry): entry is ProductionRegistryEntry => Boolean(entry));

  shot.dialogue_state = {
    language: clean(context?.layers?.audio_validation?.language) || null,
    source,
    camera_beat_count: segment.beats?.length ?? 0,
    turns: turns.map((turn, index): DialogueTurnState => {
      const speaker = resolveEntity(turn.speaker, registry);
      const delivery: DialogueDeliveryState = turn.delivery === "off_screen"
        ? "off_screen"
        : speaker ? "on_screen" : "voiceover";
      const listeners = delivery === "on_screen"
        ? visible.filter((entry) => entry.entity_id !== speaker?.entity_id)
        : visible;
      const start = typeof turn.start_s === "number" ? turn.start_s : null;
      const end = typeof turn.end_s === "number" ? turn.end_s : null;
      return {
        turn_id: `${shot.shot_id}_turn_${String(index + 1).padStart(3, "0")}`,
        speaker_entity_id: speaker?.entity_id ?? null,
        speaker_display_name: clean(turn.speaker) || "VOICEOVER",
        delivery,
        text: clean(turn.text),
        start_time_s: start,
        end_time_s: end,
        absolute_start_time_s: start === null ? null : shot.start_time_s + start,
        absolute_end_time_s: end === null ? null : shot.start_time_s + end,
        camera_beat: delivery === "on_screen" ? turn.camera_beat ?? null : null,
        lip_sync_target_entity_id: delivery === "on_screen" ? speaker?.entity_id ?? null : null,
        voice_profile: delivery === "voiceover" ? "off-screen narrator" : voiceFor(speaker, characterLocks),
        listener_entity_ids: listeners.map((entry) => entry.entity_id),
        listener_reaction_evidence: reactionEvidence(segment, listeners),
      };
    }),
  };

  const location = context?.layers?.environment?.locations?.find((candidate) =>
    lower(candidate.id) === lower(segment.location_id)
  );
  const mode = segment.transition_in?.mode ?? segment.continuity_mode ?? (previousSegment ? "scene_cut" : "opening");
  const locationChanged = Boolean(previousSegment?.location_id && segment.location_id && previousSegment.location_id !== segment.location_id);
  const transitionPolicy: AudioState["transition_policy"] = mode === "opening"
    ? "open"
    : mode === "continuous"
      ? "preserve"
      : locationChanged
        ? "reset_to_location"
        : mode === "time_jump"
          ? "reset_for_time"
          : "reset_for_cut";
  shot.audio_state = {
    environment_sound_bed: clean(location?.sound_bed) || null,
    environment_reverb: clean(location?.reverb_profile) || null,
    ambience_strategy: clean(context?.layers?.audio_validation?.ambience_strategy) || null,
    music_strategy: clean(context?.layers?.audio_validation?.music_strategy) || null,
    transition_policy: transitionPolicy,
    from_location_id: clean(previousSegment?.location_id) || null,
    to_location_id: clean(segment.location_id) || null,
    foley_cues: foleyFor(shot),
  };
}
