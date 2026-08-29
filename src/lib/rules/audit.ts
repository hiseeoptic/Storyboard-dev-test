import { isCanonicalRuleOwner } from "./authority.ts";
import type { PromptRuleInventoryEntry } from "./prompt-inventory.ts";
import type { RuleDefinition } from "./types.ts";

export type RuleAuditSeverity = "error" | "warning" | "info";
export interface RuleAuditFinding { code: string; severity: RuleAuditSeverity; rule_ids: string[]; message: string; }
export interface RuleAuditReport { ok: boolean; findings: RuleAuditFinding[]; counts: Record<RuleAuditSeverity, number>; }
function report(findings: RuleAuditFinding[]): RuleAuditReport { const counts = { error: 0, warning: 0, info: 0 }; for (const finding of findings) counts[finding.severity] += 1; return { ok: counts.error === 0, findings, counts }; }
function duplicates(values: string[]): string[] { return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]; }

export function auditRuleDefinitions(definitions: readonly RuleDefinition[]): RuleAuditReport {
  const findings: RuleAuditFinding[] = [];
  for (const id of duplicates(definitions.map((rule) => rule.id))) findings.push({ code: "RULE_ID_DUPLICATE", severity: "error", rule_ids: [id], message: `Rule id "${id}" is declared more than once.` });
  for (const code of duplicates(definitions.map((rule) => rule.violation_code))) findings.push({ code: "RULE_VIOLATION_CODE_DUPLICATE", severity: "error", rule_ids: definitions.filter((rule) => rule.violation_code === code).map((rule) => rule.id), message: `Violation code "${code}" is shared by multiple rules.` });
  for (const rule of definitions) {
    if (!isCanonicalRuleOwner(rule.owner)) findings.push({ code: "RULE_OWNER_UNKNOWN", severity: "warning", rule_ids: [rule.id], message: `Owner "${rule.owner}" is not in the canonical registry.` });
    if (rule.priority === "hard" && rule.enforced_by.includes("prompt") && !rule.enforced_by.includes("compiler") && !rule.enforced_by.includes("validator")) findings.push({ code: "RULE_HARD_PROMPT_ONLY", severity: "warning", rule_ids: [rule.id], message: "Hard rule relies on prose alone." });
    for (const conflict of rule.conflicts_with) if (!definitions.some((candidate) => candidate.id === conflict)) findings.push({ code: "RULE_CONFLICT_UNRESOLVED_REFERENCE", severity: "info", rule_ids: [rule.id], message: `Conflict target "${conflict}" is descriptive rather than registered.` });
  }
  return report(findings);
}

export function auditPromptRuleInventory(entries: readonly PromptRuleInventoryEntry[]): RuleAuditReport {
  const findings: RuleAuditFinding[] = []; const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const id of duplicates(entries.map((entry) => entry.id))) findings.push({ code: "PROMPT_RULE_ID_DUPLICATE", severity: "error", rule_ids: [id], message: `Prompt inventory id "${id}" is declared more than once.` });
  for (const entry of entries) {
    if (!isCanonicalRuleOwner(entry.canonical_owner)) findings.push({ code: "PROMPT_RULE_OWNER_UNKNOWN", severity: "error", rule_ids: [entry.id], message: `Prompt owner "${entry.canonical_owner}" is not registered.` });
    if (entry.activation === "currently_global" && entry.priority !== "hard") findings.push({ code: "PROMPT_CONDITIONAL_RULE_GLOBAL", severity: "warning", rule_ids: [entry.id], message: "Conditional/preference policy is currently global." });
    for (const conflictId of entry.conflicts_with) {
      const conflict = byId.get(conflictId);
      if (!conflict) findings.push({ code: "PROMPT_CONFLICT_TARGET_MISSING", severity: "error", rule_ids: [entry.id], message: `Conflict target "${conflictId}" is absent.` });
      else if (!conflict.conflicts_with.includes(entry.id)) findings.push({ code: "PROMPT_CONFLICT_NOT_SYMMETRIC", severity: "warning", rule_ids: [entry.id, conflictId], message: "Known prompt conflict is not symmetric." });
    }
  }
  return report(findings);
}
