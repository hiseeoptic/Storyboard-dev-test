import assert from "node:assert/strict";
import test from "node:test";
import { buildActiveStoryboardRulePacket } from "./active-packet.ts";
import {
  GENERATION_PROMPT_MAX_CHARS,
  REQUIRED_GENERATION_RESPONSIBILITIES,
  auditGenerationPromptModules,
  buildRoutedStoryboardStructureDirective,
  buildGenerationPromptModules,
  compileGenerationSystemPrompt,
} from "./generation-prompt.ts";

const TEST_ENVIRONMENT_CATALOG = Array.from(
  { length: 18 },
  (_, index) => `· environment_${index + 1} — compatible archetype ${index + 1}: daylight, key 5200K / ~800 lux`
).join("\n");

test("V7 generation prompt has one module per required responsibility and a hard size guard", () => {
  const packet = buildActiveStoryboardRulePacket(
    { source_script: "LAN: Câu đã duyệt", script_treatment: "preserve" },
    { stage: "generation" }
  );
  const modules = buildGenerationPromptModules(packet);
  const compiled = compileGenerationSystemPrompt(packet, {
    environment_catalog: TEST_ENVIRONMENT_CATALOG,
  });

  assert.deepEqual(auditGenerationPromptModules(modules), []);
  assert.equal(new Set(modules.map((entry) => entry.id)).size, modules.length);
  assert.equal(new Set(modules.map((entry) => entry.responsibility)).size, modules.length);
  assert.deepEqual(
    new Set(modules.map((entry) => entry.responsibility)),
    new Set(REQUIRED_GENERATION_RESPONSIBILITIES)
  );
  assert.equal(compiled.module_ids.length, REQUIRED_GENERATION_RESPONSIBILITIES.length);
  assert.equal(compiled.character_count, compiled.prompt.length);
  assert.ok(compiled.character_count < 16_000, `typical generation prompt grew to ${compiled.character_count} characters`);
  assert.ok(compiled.character_count < GENERATION_PROMPT_MAX_CHARS);
  assert.match(compiled.prompt, /ACTIVE GENERATION PROMPT V7/);
  assert.doesNotMatch(compiled.prompt, /world-class short-form video director and marketing strategist/i);
  assert.doesNotMatch(compiled.prompt, /ENVIRONMENT ENGINE \(locked world archetypes/i);
  assert.match(compiled.prompt, /AVAILABLE ARCHETYPE IDS/);
});

test("routed user-prompt structure consumes the same hook decision and preserves legacy fallback", () => {
  const required = buildRoutedStoryboardStructureDirective("required_by_menu", false);
  const gated = buildRoutedStoryboardStructureDirective("intent_gated", true);
  const legacy = buildRoutedStoryboardStructureDirective(undefined, false);
  assert.match(required, /resolved menu authority requires an attention-opening/i);
  assert.match(gated, /No universal Hook Window applies/i);
  assert.doesNotMatch(gated, /requires an intent-appropriate 3-5 second Hook Window/i);
  assert.match(legacy, /requires an intent-appropriate 3-5 second Hook Window/i);
});

test("preserve mode selects dialogue preservation and never activates authoring permission", () => {
  const packet = buildActiveStoryboardRulePacket(
    {
      source_script: "LAN: Giữ nguyên câu này",
      script_treatment: "preserve",
      source_script_revision: "user_verbatim",
    },
    { stage: "generation" }
  );
  const compiled = compileGenerationSystemPrompt(packet);
  assert.ok(compiled.module_ids.includes("dialogue_preservation"));
  assert.ok(!compiled.module_ids.includes("dialogue_authoring"));
  assert.match(compiled.prompt, /Preserve every enabled spoken line/);
  assert.doesNotMatch(compiled.prompt, /menu explicitly authorizes one creative polish pass/i);
});

test("polish menu selects bounded dialogue authorship without replacing story facts", () => {
  const packet = buildActiveStoryboardRulePacket(
    { source_script: "LAN: câu gốc", script_treatment: "polish" },
    { stage: "generation" }
  );
  const compiled = compileGenerationSystemPrompt(packet);
  assert.ok(compiled.module_ids.includes("dialogue_authoring"));
  assert.ok(!compiled.module_ids.includes("dialogue_preservation"));
  assert.match(compiled.prompt, /menu explicitly authorizes one creative polish pass/i);
  assert.match(compiled.prompt, /do not replace the premise/i);
});

test("menu and intent choose hook wording instead of a universal opening recipe", () => {
  const required = compileGenerationSystemPrompt(buildActiveStoryboardRulePacket(
    { audience_goal: "attention", story_format: "short_insight" },
    { stage: "generation" }
  )).prompt;
  const gated = compileGenerationSystemPrompt(buildActiveStoryboardRulePacket(
    { audience_goal: "empathy", story_format: "observational" },
    { stage: "generation" }
  )).prompt;
  assert.match(required, /explicit menu requires an immediate, honest opening promise/i);
  assert.match(gated, /No universal hook recipe applies/i);
  assert.doesNotMatch(gated, /Clip 1 ALWAYS owns/i);
});

test("uploaded references select binding module while generated projects select DNA module", () => {
  const packet = buildActiveStoryboardRulePacket({}, { stage: "generation" });
  const referenced = compileGenerationSystemPrompt(packet, { has_any_uploaded_references: true });
  const generated = compileGenerationSystemPrompt(packet, { has_any_uploaded_references: false });
  assert.ok(referenced.module_ids.includes("reference_binding"));
  assert.ok(!referenced.module_ids.includes("generated_identity"));
  assert.match(referenced.prompt, /Uploaded character, product, ingredient\/object, and location images outrank prose/);
  assert.ok(generated.module_ids.includes("generated_identity"));
  assert.ok(!generated.module_ids.includes("reference_binding"));
});

test("compact generation prompt retains obstacle, hand, receiver-support and exception laws", () => {
  const prompt = compileGenerationSystemPrompt(
    buildActiveStoryboardRulePacket({}, { stage: "generation" })
  ).prompt;
  assert.match(prompt, /never crosses a table, chair, wall, railing, glass/);
  assert.match(prompt, /reach\/contact\/grip\/use\/release chain/);
  assert.match(prompt, /A pan stays on a burner\/counter or in a named gripping hand while an egg is cracked into it/);
  assert.match(prompt, /Intentional exceptions apply only to their named entity\/event/);
});

test("generation prompt routes a selected camera palette by Scene Intent", () => {
  const prompt = compileGenerationSystemPrompt(buildActiveStoryboardRulePacket({
    directing_profiles: ["aerial_drone", "pov_first_person", "immersive_action", "macro_detail"],
  }, { stage: "generation" })).prompt;
  assert.match(prompt, /selected camera palette/i);
  assert.match(prompt, /establish scale\/geography\/crowds.*aerial/i);
  assert.match(prompt, /POV for embodied participation/i);
  assert.match(prompt, /conditional mappings, never a mandatory sequence/i);
  assert.match(prompt, /one physically coherent rig/i);
});

test("generation compiler rejects bounded edit packets", () => {
  const repair = buildActiveStoryboardRulePacket({}, { stage: "repair" });
  assert.throws(() => compileGenerationSystemPrompt(repair), /cannot compile stage=repair/);
});
