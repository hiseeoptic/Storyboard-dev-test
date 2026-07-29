import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { validateResolvedVideoContext } from "./context-validator.ts";

function context(): ResolvedVideoContext {
  return {
    version: "2.0",
    segment_contract_version: "1.0",
    state: "locked",
    analysis_summary: "locked",
    confidence: 0.9,
    assumptions: [],
    evidence: [],
    reality_profile: {} as ResolvedVideoContext["reality_profile"],
    layers: {
      project_intent: {
        purpose: "story",
        audience: "adults",
        platform: "short video",
        duration_seconds: 20,
        aspect_ratio: "9:16",
        success_criteria: [],
      },
      world_context: {
        world_type: "cinematic realistic",
        reality_level: "cinematic",
        genre: "drama",
        geography: "Vietnam",
        culture: "Vietnamese",
        time_period: "contemporary",
        technology_level: "modern",
        social_class: "middle",
        physics_mode: "real world",
        intentional_exceptions: [],
      },
      ontology: {
        allowed_entities: [],
        forbidden_entities: [],
        visible_text_policy: "none",
        symbolism_policy: "literal",
        exception_rules: [],
      },
      temporal: {
        timeline_mode: "linear",
        story_time_span: "one afternoon",
        time_of_day: "noon",
        season_weather: "dry",
        transition_rules: [],
      },
      environment: {
        strategy: "single_location",
        primary_category: "home",
        locations: [
          {
            id: "home",
            narrative_function: "call",
            description: "living room",
            culture_geography_fit: "Vietnam",
            spatial_anchors: ["sofa"],
            fixed_elements: ["window"],
            lighting_motivation: "noon window light",
            sound_bed: "quiet home room tone",
          },
        ],
        selection_rule: "script",
      },
      character: {
        cast_ids: ["Minh"],
        identity_rules: [],
        behavior_rules: [],
        relationship_rules: [],
      },
      object_prop: { hero_prop_ids: [], state_tracking_rules: [], material_rules: [] },
      motion_continuity: {
        physics_mode: "real",
        continuity_mode: "continuous",
        action_budget: "one",
        allowed_transition_modes: ["opening", "continuous"],
        rules: [],
      },
      visual_language: {
        style_mode: "cinematic",
        camera_grammar: ["calm"],
        lighting_grammar: ["motivated"],
        color_grammar: ["neutral"],
        vfx_rules: [],
        text_overlay_policy: "none",
      },
      audio_validation: {
        dialogue_mode: "natural",
        language: "Vietnamese",
        voice_strategy: "per-character lock",
        ambience_strategy: "per-location bed",
        music_strategy: "none",
        validation_priorities: [],
        post_render_policy: "report_only_no_auto_regeneration",
      },
    },
  };
}

test("locked complete context passes", () => {
  assert.equal(validateResolvedVideoContext(context()).ok, true);
});

test("location without a sound bed fails before storyboard API", () => {
  const fixture = context();
  fixture.layers.environment.locations[0]!.sound_bed = "";
  const report = validateResolvedVideoContext(fixture);
  assert.ok(report.findings.some((finding) => finding.code === "CTX-014"));
});

test("parallel intercut needs at least two locked locations", () => {
  const fixture = context();
  fixture.layers.motion_continuity.allowed_transition_modes.push("parallel_intercut");
  const report = validateResolvedVideoContext(fixture);
  assert.ok(report.findings.some((finding) => finding.code === "CTX-017"));
});
