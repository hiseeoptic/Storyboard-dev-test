import assert from "node:assert/strict";
import test from "node:test";
import type { ResolvedVideoContext } from "../video-context/types.ts";
import { buildActiveStoryboardRulePacket, isPromptRuleRouterV2Enabled } from "./active-packet.ts";

function context(text: string, overlay = "none — no overlays"): ResolvedVideoContext {
  return { layers: { ontology: { visible_text_policy: text }, visual_language: { text_overlay_policy: overlay } } } as ResolvedVideoContext;
}
test("router is opt-in", () => { assert.equal(isPromptRuleRouterV2Enabled(undefined), false); assert.equal(isPromptRuleRouterV2Enabled("true"), true); });
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
