import assert from "node:assert/strict";
import test from "node:test";
import { assessSoftExportPolicy, calculateRepairImprovement } from "./export-policy.ts";
import type { SemanticValidationReport } from "./semantic-validator.ts";

const warningReport: SemanticValidationReport = {
  ok: false,
  findings: [{
    code: "STATE-004",
    severity: "high",
    scope: "segment",
    segment_number: 2,
    message: "End snapshot needs review.",
  }],
  counts: { critical: 0, high: 1, medium: 0, total: 1 },
  summary: "test",
};

test("a compiled manifest remains exportable with semantic warnings", () => {
  assert.deepEqual(assessSoftExportPolicy(warningReport, true), {
    can_export: true,
    status: "exported_with_warnings",
    warning_count: 1,
  });
});

test("only a missing/uncompilable manifest blocks transport export", () => {
  assert.equal(assessSoftExportPolicy(warningReport, false).can_export, false);
});

test("repair improvement reports the resolved percentage", () => {
  assert.deepEqual(calculateRepairImprovement(10, 4), { fixed: 6, percent: 60 });
  assert.deepEqual(calculateRepairImprovement(5, 7), { fixed: 0, percent: 0 });
});
