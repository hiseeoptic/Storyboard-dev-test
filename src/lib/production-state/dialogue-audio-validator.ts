import type { DialogueTurnState, ProductionFinding, ProductionState, ShotState } from "./types.ts";

function finding(params: Omit<ProductionFinding, "suggested_patch"> & {
  suggested_patch?: Record<string, unknown> | null;
}): ProductionFinding {
  return { ...params, suggested_patch: params.suggested_patch ?? null };
}

function validateTurn(shot: ShotState, turn: DialogueTurnState, previousEnd: number): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  const duration = shot.end_time_s - shot.start_time_s;
  const ids = turn.speaker_entity_id ? [turn.speaker_entity_id] : [];
  if (turn.start_time_s === null || turn.end_time_s === null) {
    findings.push(finding({
      code: "DIALOGUE_CLOCK_MISSING",
      severity: "high",
      message: "Dialogue turn must own an explicit start and end on the shot-local clock.",
      shot_id: shot.shot_id,
      entity_ids: ids,
      evidence: { turn_id: turn.turn_id, start_time_s: turn.start_time_s, end_time_s: turn.end_time_s },
      suggested_patch: { op: "rebuild_dialogue_clock", shot_id: shot.shot_id },
    }));
  } else {
    if (turn.start_time_s < 0 || turn.end_time_s <= turn.start_time_s || turn.end_time_s > duration) {
      findings.push(finding({
        code: "DIALOGUE_CLOCK_OUT_OF_BOUNDS",
        severity: "high",
        message: "Dialogue turn lies outside the shot duration or has a non-positive interval.",
        shot_id: shot.shot_id,
        entity_ids: ids,
        evidence: { turn_id: turn.turn_id, shot_duration_s: duration, start_time_s: turn.start_time_s, end_time_s: turn.end_time_s },
        suggested_patch: { op: "fit_dialogue_turn_to_shot", turn_id: turn.turn_id },
      }));
    }
    if (turn.start_time_s < previousEnd) {
      findings.push(finding({
        code: "DIALOGUE_CLOCK_OVERLAP",
        severity: "high",
        message: "Sequential dialogue turns overlap on the sole audio clock.",
        shot_id: shot.shot_id,
        entity_ids: ids,
        evidence: { turn_id: turn.turn_id, previous_end_time_s: previousEnd, start_time_s: turn.start_time_s },
        suggested_patch: { op: "sequence_dialogue_turns", turn_id: turn.turn_id },
      }));
    }
    const words = turn.text.split(/\s+/u).filter(Boolean).length;
    const seconds = turn.end_time_s - turn.start_time_s;
    if (seconds > 0 && (words / seconds) * 60 > 190) {
      findings.push(finding({
        code: "DIALOGUE_SPEECH_RATE_EXCEEDED",
        severity: "high",
        message: "Dialogue turn exceeds the safe 190 words-per-minute delivery rate.",
        shot_id: shot.shot_id,
        entity_ids: ids,
        evidence: { turn_id: turn.turn_id, words, seconds, words_per_minute: Math.round((words / seconds) * 60) },
        suggested_patch: { op: "expand_or_shorten_dialogue_turn", turn_id: turn.turn_id },
      }));
    }
  }

  if (turn.delivery === "on_screen") {
    if (!turn.speaker_entity_id || turn.lip_sync_target_entity_id !== turn.speaker_entity_id) {
      findings.push(finding({
        code: "LIP_SYNC_AUTHORITY_INVALID",
        severity: "critical",
        message: "An on-screen line must lip-sync only to its registered speaker entity.",
        shot_id: shot.shot_id,
        entity_ids: ids,
        evidence: { turn_id: turn.turn_id, speaker_entity_id: turn.speaker_entity_id, lip_sync_target_entity_id: turn.lip_sync_target_entity_id },
        suggested_patch: { op: "bind_lip_sync_to_speaker", turn_id: turn.turn_id },
      }));
    }
    const visible = [...shot.start_snapshot.visual_instances, ...shot.end_snapshot.visual_instances]
      .some((instance) => instance.entity_id === turn.speaker_entity_id && instance.visible && instance.classification === "primary");
    if (turn.speaker_entity_id && !visible) {
      findings.push(finding({
        code: "ON_SCREEN_SPEAKER_NOT_VISIBLE",
        severity: "high",
        message: "A speaker declared on-screen has no visible primary instance in this shot.",
        shot_id: shot.shot_id,
        entity_ids: [turn.speaker_entity_id],
        evidence: { turn_id: turn.turn_id },
        suggested_patch: { op: "show_speaker_or_mark_off_screen", turn_id: turn.turn_id },
      }));
    }
    if (turn.camera_beat !== null && (turn.camera_beat < 1 || turn.camera_beat > shot.dialogue_state.camera_beat_count)) {
      findings.push(finding({
        code: "DIALOGUE_CAMERA_BEAT_INVALID",
        severity: "high",
        message: "Dialogue camera_beat does not reference an existing storyboard beat.",
        shot_id: shot.shot_id,
        entity_ids: ids,
        evidence: { turn_id: turn.turn_id, camera_beat: turn.camera_beat, beat_count: shot.dialogue_state.camera_beat_count },
        suggested_patch: { op: "assign_existing_camera_beat", turn_id: turn.turn_id },
      }));
    }
  } else if (turn.lip_sync_target_entity_id !== null) {
    findings.push(finding({
      code: "OFF_SCREEN_LIP_SYNC_FORBIDDEN",
      severity: "critical",
      message: "Off-screen and voiceover lines must not animate an on-screen mouth.",
      shot_id: shot.shot_id,
      entity_ids: [turn.lip_sync_target_entity_id],
      evidence: { turn_id: turn.turn_id, delivery: turn.delivery },
      suggested_patch: { op: "clear_lip_sync_target", turn_id: turn.turn_id },
    }));
  }

  if (turn.delivery !== "voiceover" && turn.speaker_entity_id && !turn.voice_profile) {
    findings.push(finding({
      code: "SPEAKER_VOICE_PROFILE_MISSING",
      severity: "high",
      message: "A named speaker must be bound to one stable voice profile.",
      shot_id: shot.shot_id,
      entity_ids: [turn.speaker_entity_id],
      evidence: { turn_id: turn.turn_id, speaker_display_name: turn.speaker_display_name },
      suggested_patch: { op: "assign_locked_voice_profile", entity_id: turn.speaker_entity_id },
    }));
  }
  if (turn.delivery === "on_screen" && turn.listener_entity_ids.length > 0 && !turn.listener_reaction_evidence) {
    findings.push(finding({
      code: "LISTENER_REACTION_UNSPECIFIED",
      severity: "medium",
      message: "A conversational shot should state a natural listener reaction instead of leaving listeners inert.",
      shot_id: shot.shot_id,
      entity_ids: turn.listener_entity_ids,
      evidence: { turn_id: turn.turn_id },
      suggested_patch: { op: "add_listener_reaction", turn_id: turn.turn_id },
    }));
  }
  return findings;
}

export function validateDialogueAudioState(state: ProductionState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  const voices = new Map<string, { profile: string; shot_id: string }>();
  for (const shot of state.shots) {
    let previousEnd = 0;
    for (const turn of shot.dialogue_state.turns) {
      findings.push(...validateTurn(shot, turn, previousEnd));
      if (turn.end_time_s !== null) previousEnd = Math.max(previousEnd, turn.end_time_s);
      if (turn.speaker_entity_id && turn.voice_profile) {
        const previous = voices.get(turn.speaker_entity_id);
        if (previous && previous.profile !== turn.voice_profile) {
          findings.push(finding({
            code: "VOICE_PROFILE_DRIFT",
            severity: "critical",
            message: "The same speaker is bound to different voice profiles across shots.",
            shot_id: shot.shot_id,
            entity_ids: [turn.speaker_entity_id],
            evidence: { previous_shot_id: previous.shot_id, previous_profile: previous.profile, current_profile: turn.voice_profile },
            suggested_patch: { op: "restore_locked_voice_profile", entity_id: turn.speaker_entity_id, value: previous.profile },
          }));
        } else if (!previous) voices.set(turn.speaker_entity_id, { profile: turn.voice_profile, shot_id: shot.shot_id });
      }
    }
    const actionIds = new Set(shot.actions.map((action) => action.action_id));
    for (const cue of shot.audio_state.foley_cues) {
      if (!actionIds.has(cue.action_id)) {
        findings.push(finding({
          code: "FOLEY_ACTION_AUTHORITY_MISSING",
          severity: "high",
          message: "A Foley cue must be tied to a visible canonical action.",
          shot_id: shot.shot_id,
          entity_ids: cue.entity_ids,
          evidence: { cue_id: cue.cue_id, action_id: cue.action_id },
          suggested_patch: { op: "remove_or_bind_foley_cue", cue_id: cue.cue_id },
        }));
      }
    }
  }

  for (let index = 1; index < state.shots.length; index++) {
    const shot = state.shots[index]!;
    const previous = state.shots[index - 1]!;
    const boundary = state.boundaries[index];
    if (boundary?.transition_mode !== "continuous") continue;
    const audio = shot.audio_state;
    const before = previous.audio_state;
    if (audio.transition_policy !== "preserve" || audio.environment_sound_bed !== before.environment_sound_bed || audio.environment_reverb !== before.environment_reverb) {
      findings.push(finding({
        code: "AUDIO_BOUNDARY_CONTINUITY_MISMATCH",
        severity: "high",
        message: "A continuous boundary must preserve the exact sound bed and acoustic reverb.",
        shot_id: shot.shot_id,
        entity_ids: [],
        evidence: { from_shot_id: previous.shot_id, previous_sound_bed: before.environment_sound_bed, current_sound_bed: audio.environment_sound_bed, previous_reverb: before.environment_reverb, current_reverb: audio.environment_reverb, transition_policy: audio.transition_policy },
        suggested_patch: { op: "inherit_previous_audio_environment", from_shot_id: previous.shot_id },
      }));
    }
  }
  return findings;
}
