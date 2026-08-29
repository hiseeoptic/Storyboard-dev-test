import assert from "node:assert/strict";
import test from "node:test";
import { auditPromptRuleInventory } from "./audit.ts";
import { RULE_AUTHORITY_ORDER, authorityRank } from "./authority.ts";
import { STORYBOARD_PROMPT_RULE_INVENTORY } from "./prompt-inventory.ts";

test("authority keeps user facts above generated preferences", () => {
  assert.equal(RULE_AUTHORITY_ORDER[0], "user_reference");
  assert.ok(authorityRank("approved_script") < authorityRank("style_preference"));
});
test("prompt inventory has no structural error", () => {
  const report = auditPromptRuleInventory(STORYBOARD_PROMPT_RULE_INVENTORY);
  assert.equal(report.counts.error, 0, JSON.stringify(report.findings, null, 2));
});
