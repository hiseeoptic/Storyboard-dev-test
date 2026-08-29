import { authorityRank, type RuleAuthority } from "./authority.ts";
import type { PromptRuleInventoryEntry } from "./prompt-inventory.ts";

export interface RuleConflictCandidate { rule: PromptRuleInventoryEntry; authority: RuleAuthority; }
export interface RuleConflictResolution { winner_id: string; suppressed_id: string; reason: "explicit_selection" | "higher_authority" | "higher_priority"; }
export interface UnresolvedRuleConflict { rule_ids: [string, string]; reason: "equal_authority_and_priority"; }
export interface RuleConflictResult { active: RuleConflictCandidate[]; suppressed: RuleConflictCandidate[]; resolutions: RuleConflictResolution[]; unresolved: UnresolvedRuleConflict[]; }
const PRIORITY_RANK = { hard: 0, conditional: 1, preference: 2 } as const;
function conflicts(a: RuleConflictCandidate, b: RuleConflictCandidate): boolean { return a.rule.conflicts_with.includes(b.rule.id) || b.rule.conflicts_with.includes(a.rule.id); }

export function resolveRuleConflicts(candidates: readonly RuleConflictCandidate[], explicitlySelectedRuleIds: readonly string[] = []): RuleConflictResult {
  const preferred = new Set(explicitlySelectedRuleIds);
  const unique = new Map<string, RuleConflictCandidate>();
  for (const item of candidates) unique.set(item.rule.id, item);
  const ordered = [...unique.values()].sort((a, b) => a.rule.id.localeCompare(b.rule.id));
  const active = new Map(ordered.map((item) => [item.rule.id, item]));
  const suppressed = new Map<string, RuleConflictCandidate>();
  const resolutions: RuleConflictResolution[] = [];
  const unresolved: UnresolvedRuleConflict[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const left = ordered[i];
    if (!left || !active.has(left.rule.id)) continue;
    for (let j = i + 1; j < ordered.length; j += 1) {
      const right = ordered[j];
      if (!right || !active.has(right.rule.id) || !conflicts(left, right)) continue;
      const lp = preferred.has(left.rule.id); const rp = preferred.has(right.rule.id);
      let winner: RuleConflictCandidate | undefined; let loser: RuleConflictCandidate | undefined; let reason: RuleConflictResolution["reason"] | undefined;
      if (lp !== rp) { [winner, loser] = lp ? [left, right] : [right, left]; reason = "explicit_selection"; }
      else if (authorityRank(left.authority) !== authorityRank(right.authority)) { [winner, loser] = authorityRank(left.authority) < authorityRank(right.authority) ? [left, right] : [right, left]; reason = "higher_authority"; }
      else if (PRIORITY_RANK[left.rule.priority] !== PRIORITY_RANK[right.rule.priority]) { [winner, loser] = PRIORITY_RANK[left.rule.priority] < PRIORITY_RANK[right.rule.priority] ? [left, right] : [right, left]; reason = "higher_priority"; }
      if (!winner || !loser || !reason) { unresolved.push({ rule_ids: [left.rule.id, right.rule.id], reason: "equal_authority_and_priority" }); continue; }
      active.delete(loser.rule.id); suppressed.set(loser.rule.id, loser); resolutions.push({ winner_id: winner.rule.id, suppressed_id: loser.rule.id, reason });
      if (loser.rule.id === left.rule.id) break;
    }
  }
  return { active: [...active.values()], suppressed: [...suppressed.values()], resolutions, unresolved };
}
