export type RuleResolutionState = "abstract" | "resolved" | "locked";
export type RulePriority = "hard" | "conditional" | "preference";
export type RuleScope = "project" | "scene" | "clip" | "transition" | "event" | "frame";
export type RuleEnforcement = "analyzer" | "prompt" | "compiler" | "validator" | "ui_review";

/** Machine-readable wrapper. The original statement is always preserved. */
export interface RuleDefinition {
  id: string;
  version: string;
  layer: string;
  statement: string;
  state: RuleResolutionState;
  priority: RulePriority;
  scope: RuleScope;
  profile: string;
  owner: string;
  applies_when: string[];
  does_not_apply_when: string[];
  conflicts_with: string[];
  exception_policy: string;
  enforced_by: readonly RuleEnforcement[];
  violation_code: string;
  violation_severity: "error" | "warning";
  autofix: string;
  source: string;
}

export function defineRules<const T extends readonly RuleDefinition[]>(rules: T): T {
  return rules;
}

