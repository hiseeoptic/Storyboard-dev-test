import assert from "node:assert/strict";
import test from "node:test";
import { OPENAI_VIDEO_CONTEXT_RESPONSE_SCHEMA } from "../video-context/schema.ts";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { completeContextRealityProfile } from "../video-context/reality-fallback.ts";
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
            reverb_profile: "short furnished-room decay",
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

test("location without a reverb authority fails before storyboard API", () => {
  const ctx = context();
  ctx.layers.environment.locations[0]!.reverb_profile = "";
  const report = validateResolvedVideoContext(ctx);
  assert.ok(report.findings.some((finding) => finding.code === "CTX-020"));
});

test("parallel intercut needs at least two locked locations", () => {
  const fixture = context();
  fixture.layers.motion_continuity.allowed_transition_modes.push("parallel_intercut");
  const report = validateResolvedVideoContext(fixture);
  assert.ok(report.findings.some((finding) => finding.code === "CTX-017"));
});

test("missing reality profile is completed as cinematic for uploaded people", () => {
  const completed = completeContextRealityProfile(
    { layers: { character: { cast_ids: ["Vợ", "Chồng"] } } },
    {
      story_idea: "Một đôi vợ chồng nói chuyện trong phòng khách.",
      genre: "drama",
      style: "anime",
      scene_count: 6,
      character_images: [
        { name: "Vợ", images: ["data:image/jpeg;base64,AA"] },
        { name: "Chồng", images: ["data:image/jpeg;base64,BB"] },
      ],
    }
  );
  const profile = (
    completed.payload as { reality_profile: ResolvedVideoContext["reality_profile"] }
  ).reality_profile;
  assert.equal(completed.used_fallback, true);
  assert.equal(profile.mode, "cinematic");
  assert.equal(profile.fidelity, "E_cinematic_simulation");
  assert.equal(profile.salience_policy.max_high_fidelity_entities_per_clip, 3);
});

test("missing reality profile preserves stylized and fantasy world modes", () => {
  const stylized = completeContextRealityProfile(
    { layers: {} },
    {
      story_idea: "A hand-drawn character walks through a paper city.",
      genre: "animation",
      style: "watercolor",
      scene_count: 3,
      character_representation: "illustrated_2d",
    }
  );
  const fantasy = completeContextRealityProfile(
    { layers: {} },
    {
      story_idea: "A dragon crosses an internally consistent magical world.",
      genre: "fantasy",
      style: "cinematic",
      scene_count: 3,
    }
  );
  assert.equal(
    (
      stylized.payload as {
        reality_profile: ResolvedVideoContext["reality_profile"];
      }
    ).reality_profile.mode,
    "stylized"
  );
  assert.equal(
    (
      fantasy.payload as {
        reality_profile: ResolvedVideoContext["reality_profile"];
      }
    ).reality_profile.mode,
    "fantasy_scifi_internal"
  );
});

test("OpenAI Context IR schema strictly requires every declared object property", () => {
  let totalProperties = 0;
  let maxDepth = 0;
  const inspect = (node: unknown, path: string, depth = 0): void => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const schema = node as Record<string, unknown>;
    const type = schema.type;
    if (typeof type === "string") {
      assert.equal(type, type.toLowerCase(), `${path}.type must use JSON Schema casing`);
    }

    if (type === "object") {
      assert.equal(
        schema.additionalProperties,
        false,
        `${path} must reject undeclared properties`
      );
      const properties = schema.properties as Record<string, unknown>;
      const required = schema.required as string[];
      totalProperties += Object.keys(properties).length;
      maxDepth = Math.max(maxDepth, depth);
      assert.deepEqual(
        [...required].sort(),
        Object.keys(properties).sort(),
        `${path} must require every declared property`
      );
      for (const [key, child] of Object.entries(properties)) {
        inspect(child, `${path}.${key}`, depth + 1);
      }
    }

    if (type === "array") {
      inspect(schema.items, `${path}[]`, depth + 1);
    }
  };

  inspect(OPENAI_VIDEO_CONTEXT_RESPONSE_SCHEMA, "context");
  const root = OPENAI_VIDEO_CONTEXT_RESPONSE_SCHEMA;
  assert.ok(
    (root.required as string[]).includes("layers"),
    "the strict root schema must require layers"
  );
  const layers = (
    (root.properties as Record<string, unknown>).layers as Record<string, unknown>
  );
  assert.ok(
    (layers.required as string[]).includes("project_intent"),
    "the strict layers schema must require project_intent"
  );
  assert.ok(totalProperties <= 5000, "schema exceeds OpenAI's property limit");
  assert.ok(maxDepth <= 10, "schema exceeds OpenAI's nesting limit");
});
