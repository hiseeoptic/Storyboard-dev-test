import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { buildActiveStoryboardRulePacket, isPromptRuleRouterEnabled, isPromptRuleRouterV7Enabled } from "./active-packet.ts";

function context(text: string, overlay = "none — no overlays"): ResolvedVideoContext {
  return { layers: { ontology: { visible_text_policy: text }, visual_language: { text_overlay_policy: overlay } } } as ResolvedVideoContext;
}

function productionContext(values: {
  continuity: string;
  transitions: string[];
  actionBudget: string;
  cameraProfile: string;
  cameraGrammar: string[];
  editRhythm: string;
}): ResolvedVideoContext {
  return {
    production_profile: {
      camera_profile_id: values.cameraProfile,
      edit_rhythm: values.editRhythm,
    },
    layers: {
      ontology: { visible_text_policy: "none" },
      motion_continuity: {
        continuity_mode: values.continuity,
        allowed_transition_modes: values.transitions,
        action_budget: values.actionBudget,
      },
      visual_language: {
        camera_grammar: values.cameraGrammar,
        text_overlay_policy: "none",
      },
    },
  } as ResolvedVideoContext;
}
test("router is opt-in", () => { assert.equal(isPromptRuleRouterEnabled(undefined), false); assert.equal(isPromptRuleRouterEnabled("true"), true); });
test("V7 generation compiler has its own rollout gate", () => { assert.equal(isPromptRuleRouterV7Enabled(undefined), false); assert.equal(isPromptRuleRouterV7Enabled("on"), true); });
test("production defaults V7 on while an explicit false remains a kill switch", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousV7 = process.env.PROMPT_RULE_ROUTER_V7;
  try {
    mutableEnv.NODE_ENV = "production";
    delete mutableEnv.PROMPT_RULE_ROUTER_V7;
    assert.equal(isPromptRuleRouterV7Enabled(), true);
    mutableEnv.PROMPT_RULE_ROUTER_V7 = "false";
    assert.equal(isPromptRuleRouterV7Enabled(), false);
    assert.equal(isPromptRuleRouterEnabled(), false);
  } finally {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousV7 === undefined) delete mutableEnv.PROMPT_RULE_ROUTER_V7;
    else mutableEnv.PROMPT_RULE_ROUTER_V7 = previousV7;
  }
});
test("polish menu remains creative without completed revision", () => {
  const packet = buildActiveStoryboardRulePacket({ source_script: "LAN: câu gốc", script_treatment: "polish" });
  assert.equal(packet.dialogue.mode, "editorial_polish"); assert.ok(packet.active_rule_ids.includes("storyboard.dialogue.reauthor"));
});
test("completed editorial revision feeds technical planning", () => {
  const packet = buildActiveStoryboardRulePacket({ source_script: "LAN: câu mới", script_treatment: "polish", source_script_revision: "editorial_revision" });
  assert.equal(packet.dialogue.mode, "use_editorial_revision"); assert.ok(packet.suppressed_rule_ids.includes("storyboard.dialogue.reauthor"));
});
test("preserve menu locks original lines", () => {
  assert.equal(buildActiveStoryboardRulePacket({ source_script: "x", script_treatment: "preserve", source_script_revision: "user_verbatim" }).dialogue.mode, "preserve_user_verbatim");
});
test("locked diegetic text overrides generic ban", () => {
  const packet = buildActiveStoryboardRulePacket({ resolved_context: context("Vietnamese minimal diegetic signage") });
  assert.equal(packet.visible_text.mode, "contextual_diegetic"); assert.ok(packet.suppressed_rule_ids.includes("storyboard.visible_text.forbid_all"));
});
test("verified brand gets narrow exception", () => {
  const packet = buildActiveStoryboardRulePacket({ product_images: [{ images: ["verified"] }], resolved_context: context("none — zero readable text") });
  assert.equal(packet.visible_text.mode, "verified_brand_only");
});

test("attention menu requires a format-led hook without activating the legacy universal hook", () => {
  const packet = buildActiveStoryboardRulePacket({
    audience_goal: "attention",
    story_format: "visual_poem",
    video_goal: "storytelling",
  });
  assert.equal(packet.hook.mode, "required_by_menu");
  assert.deepEqual(packet.hook.evidence, ["audience_goal=attention"]);
  assert.ok(packet.active_rule_ids.includes("storyboard.hook.required_by_selection"));
  assert.ok(packet.suppressed_rule_ids.includes("storyboard.hook.always_first_clip"));
  assert.match(packet.prompt_digest, /sensory, emotional, factual, narrative or product-proof/i);
});

test("non-hook menu combinations remain intent-gated", () => {
  const packet = buildActiveStoryboardRulePacket({
    audience_goal: "empathy",
    story_format: "observational",
    video_goal: "storytelling",
  });
  assert.equal(packet.hook.mode, "intent_gated");
  assert.ok(packet.active_rule_ids.includes("storyboard.hook.intent_gated"));
  assert.ok(packet.suppressed_rule_ids.includes("storyboard.hook.required_by_selection"));
  assert.match(packet.prompt_digest, /no universal 3-5 second hook requirement/i);
});

test("montage context keeps continuous generation inside clips and montage at boundaries", () => {
  const packet = buildActiveStoryboardRulePacket({
    resolved_context: productionContext({
      continuity: "montage",
      transitions: ["opening", "montage", "match_cut"],
      actionBudget: "one primary causal change per clip",
      cameraProfile: "rhythmic_music_video",
      cameraGrammar: ["cut on musical structure", "repeat one visual motif"],
      editRhythm: "rhythmic montage at declared boundaries",
    }),
  });
  assert.equal(packet.clip_execution.continuity_mode, "montage");
  assert.ok(packet.active_rule_ids.includes("storyboard.clip.continuous_take"));
  assert.ok(packet.active_rule_ids.includes("storyboard.editing.context_mode"));
  assert.ok(!packet.suppressed_rule_ids.includes("storyboard.clip.continuous_take"));
  assert.match(packet.prompt_digest, /montage.*declared clip boundary/i);
});

test("selected camera grammar suppresses generic smoothness and forced variety", () => {
  const packet = buildActiveStoryboardRulePacket({
    directing_profile: "static_locked",
    resolved_context: productionContext({
      continuity: "strict",
      transitions: ["opening", "continuous"],
      actionBudget: "one actor action; listeners may remain still",
      cameraProfile: "static_locked",
      cameraGrammar: ["locked tripod", "no camera movement"],
      editRhythm: "hold composition",
    }),
  });
  assert.equal(packet.camera.selected_profile_id, "static_locked");
  assert.ok(packet.suppressed_rule_ids.includes("storyboard.camera.smooth_minimal"));
  assert.ok(packet.suppressed_rule_ids.includes("storyboard.camera.forced_variety"));
  assert.match(packet.prompt_digest, /locked tripod/);
});

test("explicit camera menu outranks a stale mismatched context profile", () => {
  const packet = buildActiveStoryboardRulePacket({
    directing_profile: "static_locked",
    resolved_context: productionContext({
      continuity: "strict",
      transitions: ["continuous"],
      actionBudget: "one",
      cameraProfile: "handheld_vlog",
      cameraGrammar: ["handheld sway"],
      editRhythm: "quick reframes",
    }),
  });
  assert.equal(packet.camera.mode, "selected_menu_profile");
  assert.equal(packet.camera.selected_profile_id, "static_locked");
  assert.deepEqual(packet.camera.locked_grammar, []);
  assert.doesNotMatch(packet.prompt_digest, /handheld sway/);
});

test("locked action budget permits intentional stillness and suppresses forced business", () => {
  const packet = buildActiveStoryboardRulePacket({
    resolved_context: productionContext({
      continuity: "strict",
      transitions: ["continuous"],
      actionBudget: "one speaker gesture; silent listener remains motionless",
      cameraProfile: "cinematic_drama",
      cameraGrammar: ["stable eyeline"],
      editRhythm: "cut on emotional turn",
    }),
  });
  assert.equal(packet.action.mode, "locked_context_budget");
  assert.ok(packet.suppressed_rule_ids.includes("storyboard.performance.forced_business"));
  assert.match(packet.prompt_digest, /Intentional stillness is valid/i);
});

test("digest makes input fidelity the operating principle", () => {
  const packet = buildActiveStoryboardRulePacket({ directing_profile: "pov_first_person" });
  assert.match(packet.prompt_digest, /obey every explicit menu selection/i);
  assert.match(packet.prompt_digest, /may never replace input facts with a preferred template/i);
});

test("V7 retains obstacle, hand-contact and support-continuity contracts", () => {
  const packet = buildActiveStoryboardRulePacket({});
  assert.equal(packet.version, "7.0");
  assert.equal(packet.physical_interaction.mode, "real_world_default");
  assert.ok(packet.active_rule_ids.includes("storyboard.spatial.obstacle_clearance"));
  assert.ok(packet.active_rule_ids.includes("storyboard.manipulation.contact_chain"));
  assert.ok(packet.active_rule_ids.includes("storyboard.object.support_continuity"));
  assert.match(packet.prompt_digest, /pan, pot, bowl, tool or receiving surface never floats/i);
});

test("V7 obeys locked universe physics and only its declared exceptions", () => {
  const resolved = productionContext({
    continuity: "strict",
    transitions: ["continuous"],
    actionBudget: "one causal action",
    cameraProfile: "static",
    cameraGrammar: ["locked camera"],
    editRhythm: "hold",
  });
  resolved.layers.world_context = {
    world_type: "magical realism",
    reality_level: "stylized",
    genre: "fantasy",
    geography: "script-defined",
    culture: "script-defined",
    time_period: "present",
    technology_level: "present",
    social_class: "script-defined",
    physics_mode: "ordinary gravity except declared telekinesis",
    intentional_exceptions: ["the sorcerer may levitate the named blue cup"],
  };
  const packet = buildActiveStoryboardRulePacket({ resolved_context: resolved });
  assert.equal(packet.physical_interaction.mode, "locked_world_physics");
  assert.deepEqual(packet.physical_interaction.intentional_exceptions, [
    "the sorcerer may levitate the named blue cup",
  ]);
  assert.match(packet.prompt_digest, /ordinary gravity except declared telekinesis/i);
});
