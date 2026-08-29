import assert from "node:assert/strict";
import test from "node:test";
import { validateSceneIntent } from "../scene-intent/validator.ts";
import type { SceneIntentIR } from "../scene-intent/types.ts";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { buildActiveStoryboardRulePacket } from "./active-packet.ts";
import { compileStoryboardSystemPrompt } from "./prompt-compiler.ts";
import { buildStoryboardValidationPolicy } from "./validation-policy.ts";

const LEGACY_SAMPLE = `CRITICAL PRODUCTION MODEL — retained
- Clip 1 ALWAYS owns a 3-5 second Hook Window, but its form comes from Project Intent.
- For videos lasting 30s or longer, clips 1-3 form a RETENTION LADDER: legacy global ladder.
- VIDEO OUTPUT TEXT CONTRACT (NON-NEGOTIABLE): every generated VIDEO frame contains ZERO readable text or graphics. Legacy ban.
- Camera moves are smooth and minimal (a slow push-in or gentle pan). Legacy camera preference.
- ⏱️ FIRST 2-3 SECONDS DECIDE EVERYTHING (every genre, not just hooks): legacy opening.
- ✋ CHARACTER BUSINESS: every visible character has ONE concrete piece of physical business per clip.
- 🎬 CAMERA VARIETY ACROSS CLIPS: still ONE smooth move per clip, but vary it.
- DIALOGUE QUALITY DOCTRINE (MANDATORY — the user's #1 priority): re-author every line.
- NEVER FAKE A LINE: write a strong one when absent.
OUTPUT CONTRACT — retained`;

function nonHookIntent(): SceneIntentIR {
  return {
    intent_id: "intent_001",
    state: "locked",
    evidence: ["approved observational opening"],
    confidence: 1,
    primary_function: "introduce_world",
    secondary_functions: [],
    hook_window: {
      enabled: false,
      duration_seconds: 0,
      hook_type: "sensory_moment",
      core_promise: "none",
      immediate_visual_event: "none",
      immediate_audio_event: "none",
      dialogue_hook: "none",
      payoff_link: "none",
      forbidden_delays: [],
    },
    narrative_objective: "Observe the morning routine without a formal hook.",
    audience_effect: { attention: "observe", emotion: "calm", belief: "daily life", desired_action: "none" },
    story_change: {
      state_before: "room is quiet",
      trigger: "morning begins",
      state_after: "routine starts",
      information_revealed: "the household rhythm",
      if_removed_what_breaks: "the world has no introduction",
    },
    performance: {
      point_of_view_character: "observer",
      character_objective: "begin routine",
      obstacle: "none",
      tactic: "economical movement",
      stakes: "clarity",
      subtext: "familiar calm",
      emotion_start: "quiet",
      emotion_end: "settled",
      performance_intensity: "low",
      physical_behavior: "one grounded action",
    },
    proof: { must_show: ["routine starts"], must_hear: [], must_not_distract_with: [] },
    entry_exit: { entry_state: "quiet", exit_state: "routine", continuity_anchors: [], exit_hook: "none" },
    validation: { success_criteria: ["routine is readable"], failure_conditions: ["forced clickbait"] },
  };
}

test("compiler leaves the legacy prompt byte-identical when no rule is suppressed", () => {
  assert.equal(compileStoryboardSystemPrompt(LEGACY_SAMPLE).prompt, LEGACY_SAMPLE);
});

test("V5 removes only router-suppressed legacy global clauses", () => {
  const context = {
    layers: {
      ontology: { visible_text_policy: "Vietnamese diegetic signs allowed" },
      visual_language: { text_overlay_policy: "none" },
    },
  } as ResolvedVideoContext;
  const packet = buildActiveStoryboardRulePacket({
    source_script: "LAN: câu đã duyệt",
    script_treatment: "preserve",
    source_script_revision: "user_verbatim",
    resolved_context: context,
  });
  const prompt = `${compileStoryboardSystemPrompt(LEGACY_SAMPLE, packet.suppressed_rule_ids).prompt}\n${packet.prompt_digest}`;

  assert.doesNotMatch(prompt, /Clip 1 ALWAYS owns a 3-5 second Hook Window/);
  assert.doesNotMatch(prompt, /FIRST 2-3 SECONDS DECIDE EVERYTHING/);
  assert.doesNotMatch(prompt, /every generated VIDEO frame contains ZERO readable text/);
  assert.doesNotMatch(prompt, /Camera moves are smooth and minimal/);
  assert.doesNotMatch(prompt, /CHARACTER BUSINESS: every visible character/);
  assert.doesNotMatch(prompt, /CAMERA VARIETY ACROSS CLIPS/);
  assert.doesNotMatch(prompt, /DIALOGUE QUALITY DOCTRINE/);
  assert.match(prompt, /CRITICAL PRODUCTION MODEL/);
  assert.match(prompt, /ACTIVE RULE PACKET V5/);
  assert.match(prompt, /MENU MODE — PRESERVE EVERY LINE/);
});

test("creative polish keeps the dialogue-authoring doctrine active", () => {
  const packet = buildActiveStoryboardRulePacket({
    source_script: "LAN: câu gốc",
    script_treatment: "polish",
  });
  const prompt = `${compileStoryboardSystemPrompt(LEGACY_SAMPLE, packet.suppressed_rule_ids).prompt}\n${packet.prompt_digest}`;
  assert.match(prompt, /DIALOGUE QUALITY DOCTRINE/);
  assert.match(prompt, /MENU MODE — CREATIVE POLISH/);
});

test("Scene Intent validation consumes the routed hook policy", () => {
  const intent = nonHookIntent();
  const intentGatedPacket = buildActiveStoryboardRulePacket({
    audience_goal: "empathy",
    story_format: "observational",
    video_goal: "storytelling",
  });
  const optionalPolicy = buildStoryboardValidationPolicy(intentGatedPacket);
  const optionalIssues = validateSceneIntent(intent, {
    segmentIndex: 0,
    segmentCount: 1,
    hookSelectionMode: optionalPolicy.hook_selection_mode,
  });
  assert.equal(optionalIssues.some((issue) => issue.code === "HOOK_WINDOW_DISABLED"), false);

  const requiredPacket = buildActiveStoryboardRulePacket({ audience_goal: "attention" });
  const requiredPolicy = buildStoryboardValidationPolicy(requiredPacket);
  const requiredIssues = validateSceneIntent(intent, {
    segmentIndex: 0,
    segmentCount: 1,
    hookSelectionMode: requiredPolicy.hook_selection_mode,
  });
  assert.ok(requiredIssues.some((issue) => issue.code === "HOOK_WINDOW_DISABLED"));
});

test("repair-stage validation policy never authorizes dialogue mutation", () => {
  const packet = buildActiveStoryboardRulePacket(
    { source_script: "LAN: câu đang có", script_treatment: "polish" },
    { stage: "repair" }
  );
  const policy = buildStoryboardValidationPolicy(packet);
  assert.equal(policy.dialogue_mode, "preserve_current_edit");
  assert.equal(policy.dialogue_mutation_allowed, false);
});
