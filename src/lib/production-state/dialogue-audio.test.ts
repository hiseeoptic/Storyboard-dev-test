import assert from "node:assert/strict";
import test from "node:test";
import type { CharacterLock, StoryboardGenerationOutput, VideoSegment } from "@/types";
import type { ResolvedVideoContext } from "@/lib/video-context/types";
import { buildProductionState } from "./normalizer.ts";
import { productionStateSchema } from "./schema.ts";
import { validateDialogueAudioState } from "./dialogue-audio-validator.ts";

function character(name: string, voice = `${name} stable warm voice`): CharacterLock {
  return {
    character_id: `char_${name.toLowerCase()}`,
    display_name: name,
    name,
    gender_age: "adult",
    build: "average",
    skin_tone: "natural",
    hair: "dark hair",
    eyes: "brown",
    costume: "story outfit",
    signature_features: "none",
    default_expression: "neutral",
    render_style: "cinematic",
    voice,
  };
}

function segment(number: number, overrides: Partial<VideoSegment> = {}): VideoSegment {
  return {
    segment_number: number,
    duration_seconds: 10,
    title: `Shot ${number}`,
    marketing_role: "body",
    beats: [{ beat: "Minh listens and nods to Lan", camera: "medium two-shot" }],
    first_frame_prompt: "Lan and Minh in the kitchen",
    motion_prompt: "Minh listens and nods naturally to Lan",
    dialogue: null,
    location_id: "kitchen",
    characters_in_scene: ["Lan", "Minh"],
    continuity_note: "continuous",
    ...overrides,
  };
}

function context(): ResolvedVideoContext {
  return {
    version: "2.0",
    state: "locked",
    analysis_summary: "test",
    confidence: 1,
    assumptions: [],
    evidence: [],
    reality_profile: {
      mode: "cinematic",
      fidelity: "B_physical",
      dimensions: { macro: true, meso: true, micro: false, material_reaction: true, temporal_continuity: true, causal_integrity: true },
      target_authenticity: "believable",
      physics_model: "real-world",
      allowed_deviations: [],
      salience_policy: { hero_entities: [], interaction_entities: [], foreground_fidelity: "meso", background_fidelity: "macro_only", max_high_fidelity_entities_per_clip: 3 },
    },
    layers: {
      project_intent: { purpose: "test", audience: "test", platform: "test", duration_seconds: 20, aspect_ratio: "9:16", success_criteria: [] },
      world_context: { world_type: "real", reality_level: "real", genre: "dialogue", geography: "Vietnam", culture: "Vietnamese", time_period: "present", technology_level: "present", social_class: "middle", physics_mode: "real", intentional_exceptions: [] },
      ontology: { allowed_entities: [], forbidden_entities: [], visible_text_policy: "none", symbolism_policy: "none", exception_rules: [] },
      temporal: { timeline_mode: "linear", story_time_span: "minutes", time_of_day: "day", season_weather: "clear", transition_rules: [] },
      environment: { strategy: "single_location", primary_category: "home", selection_rule: "script", locations: [{ id: "kitchen", narrative_function: "conversation", description: "kitchen", culture_geography_fit: "fit", spatial_anchors: [], fixed_elements: [], lighting_motivation: "window", sound_bed: "quiet kitchen room tone", reverb_profile: "short furnished-room decay" }] },
      character: { cast_ids: ["char_lan", "char_minh"], identity_rules: [], behavior_rules: [], relationship_rules: [] },
      object_prop: { hero_prop_ids: [], state_tracking_rules: [], material_rules: [] },
      motion_continuity: { physics_mode: "real", continuity_mode: "strict", action_budget: "calm", allowed_transition_modes: ["continuous"], rules: [] },
      visual_language: { style_mode: "cinematic", camera_grammar: [], lighting_grammar: [], color_grammar: [], vfx_rules: [], text_overlay_policy: "none" },
      audio_validation: { dialogue_mode: "turn-taking", language: "Vietnamese", voice_strategy: "locked per character", ambience_strategy: "location locked", music_strategy: "none", validation_priorities: [], post_render_policy: "report_only_no_auto_regeneration" },
    },
  };
}

function breakdown(segments: VideoSegment[]): Pick<StoryboardGenerationOutput, "character_locks" | "segments" | "total_duration_seconds" | "context_ir"> {
  return {
    character_locks: [character("Lan"), character("Minh")],
    segments,
    total_duration_seconds: segments.reduce((sum, item) => sum + item.duration_seconds, 0),
    context_ir: context(),
  };
}

test("dialogue compiler binds stable speaker, voice, lip-sync and absolute clock", () => {
  const state = buildProductionState(breakdown([
    segment(1, { dialogue_lines: [
      { speaker: "Lan", text: "Mình bắt đầu nhé.", start_s: 0, end_s: 2, camera_beat: 1 },
      { speaker: "Minh", text: "Được, tôi đang nghe.", start_s: 2.4, end_s: 4.5, camera_beat: 1 },
    ] }),
  ]));
  const [first, second] = state.shots[0]!.dialogue_state.turns;
  assert.equal(first?.speaker_entity_id, "char_lan");
  assert.equal(first?.lip_sync_target_entity_id, "char_lan");
  assert.equal(first?.voice_profile, "Lan stable warm voice");
  assert.equal(second?.absolute_start_time_s, 2.4);
  assert.equal(state.shots[0]!.audio_state.environment_sound_bed, "quiet kitchen room tone");
  assert.equal(productionStateSchema.safeParse(state).success, true);
});

test("off-screen delivery never owns an on-screen lip-sync target", () => {
  const state = buildProductionState(breakdown([
    segment(1, { dialogue_lines: [{ speaker: "Lan", delivery: "off_screen", text: "Tôi ở ngoài này.", start_s: 0, end_s: 2 }] }),
  ]));
  const turn = state.shots[0]!.dialogue_state.turns[0]!;
  assert.equal(turn.delivery, "off_screen");
  assert.equal(turn.lip_sync_target_entity_id, null);
  assert.equal(state.findings.some((item) => item.code === "OFF_SCREEN_LIP_SYNC_FORBIDDEN"), false);
});

test("validator reports overlap, wrong lip authority and voice drift with patch evidence", () => {
  const state = buildProductionState(breakdown([
    segment(1, { dialogue_lines: [{ speaker: "Lan", text: "Một câu vừa đủ.", start_s: 0, end_s: 3, camera_beat: 1 }] }),
    segment(2, { dialogue_lines: [
      { speaker: "Lan", text: "Câu đầu tiên.", start_s: 0, end_s: 3, camera_beat: 1 },
      { speaker: "Minh", text: "Câu thứ hai.", start_s: 3.5, end_s: 6, camera_beat: 1 },
    ] }),
  ]));
  const shot = state.shots[1]!;
  shot.dialogue_state.turns[1]!.start_time_s = 2;
  shot.dialogue_state.turns[0]!.lip_sync_target_entity_id = "char_minh";
  shot.dialogue_state.turns[0]!.voice_profile = "changed voice";
  const findings = validateDialogueAudioState(state);
  for (const code of ["DIALOGUE_CLOCK_OVERLAP", "LIP_SYNC_AUTHORITY_INVALID", "VOICE_PROFILE_DRIFT"]) {
    const item = findings.find((candidate) => candidate.code === code);
    assert.equal(item?.shot_id, "shot_002");
    assert.ok(item?.suggested_patch);
    assert.ok(item?.evidence);
  }
});

test("continuous boundaries preserve the exact acoustic environment", () => {
  const state = buildProductionState(breakdown([
    segment(1),
    segment(2, { continuity_mode: "continuous" }),
  ]));
  assert.equal(state.shots[1]!.audio_state.transition_policy, "preserve");
  assert.equal(state.findings.some((item) => item.code === "AUDIO_BOUNDARY_CONTINUITY_MISMATCH"), false);
  state.shots[1]!.audio_state.environment_reverb = "large hall echo";
  assert.ok(validateDialogueAudioState(state).some((item) => item.code === "AUDIO_BOUNDARY_CONTINUITY_MISMATCH"));
});

test("Foley cues are generated only from visible canonical actions", () => {
  const state = buildProductionState(breakdown([
    segment(1, { state_ledger: {
      start: [{ entity_id: "Cup", state: "on table", position: "table", holder: null }],
      changes: [{ entity_id: "Cup", from: "on table", action: "Lan picks up the cup", to: "held", caused_by: "Lan picks up the cup" }],
      end: [{ entity_id: "Cup", state: "held", position: "Lan hand", holder: "Lan" }],
    } }),
  ]));
  const cue = state.shots[0]!.audio_state.foley_cues[0];
  assert.equal(cue?.kind, "prop_contact");
  assert.ok(state.shots[0]!.actions.some((action) => action.action_id === cue?.action_id));
});
