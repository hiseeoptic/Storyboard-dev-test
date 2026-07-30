import type { StoryboardGenerationOutput } from "../../types/index.ts";
import type { SemanticFinding } from "./semantic-validator.ts";
import {
  changeHasOnlyRelationalOrStableState,
  hasVisibleCausalAction,
} from "../storyboard/state-ledger.ts";

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function deniesVisibleCause(finding: SemanticFinding): boolean {
  const text = `${finding.message} ${finding.evidence ?? ""}`;
  return /(?:without|no|lacks?|missing|not\s+clear|unclear).{0,60}(?:cause|contact|action|visible\s+path)|(?:cause|contact|action|visible\s+path).{0,60}(?:without|missing|unclear|not\s+clear)|(?:không|thiếu|chưa).{0,60}(?:nguyên\s+nhân|tiếp\s+xúc|hành\s+động|đường\s+đi)/iu.test(
    text
  );
}

function quotedEntity(finding: SemanticFinding): string {
  const text = `${finding.message} ${finding.evidence ?? ""}`;
  return clean(
    text.match(/["“”']([^"“”']{2,80})["“”']/u)?.[1]
  ).toLowerCase();
}

/**
 * Reject a narrow class of self-contradictory LLM critic findings. The critic
 * may not claim "no cause/contact" when the structured ledger already has a
 * named cause plus a visible contact/movement verb and the intrinsic condition
 * is stable. Real transformations (warm→cold, intact→broken, full→empty…) are
 * never suppressed by this filter.
 */
export function filterContradictoryCriticFindings(
  findings: SemanticFinding[],
  breakdown: StoryboardGenerationOutput
): SemanticFinding[] {
  const characterNames = (breakdown.character_locks ?? [])
    .map((lock) => clean(lock.name))
    .filter(Boolean);

  return findings.filter((finding) => {
    if (
      finding.scope !== "segment" ||
      !finding.segment_number ||
      !deniesVisibleCause(finding)
    ) {
      return true;
    }
    const segment = breakdown.segments.find(
      (candidate) =>
        candidate.segment_number === finding.segment_number
    );
    if (!segment?.state_ledger) return true;

    const findingText =
      `${finding.message} ${finding.evidence ?? ""}`.toLowerCase();
    const entityHint =
      quotedEntity(finding) ||
      segment.state_ledger.changes
        .map((change) => clean(change.entity_id).toLowerCase())
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .find((id) => {
          if (findingText.includes(id)) return true;
          const words = id
            .replace(/[_-]+/g, " ")
            .split(/\s+/)
            .filter((word) => word.length >= 4);
          return words.some((word) => findingText.includes(word));
        }) ||
      "";
    const candidates = segment.state_ledger.changes.filter((change) => {
      if (!entityHint) return true;
      const id = clean(change.entity_id).toLowerCase();
      return entityHint.includes(id) || id.includes(entityHint);
    });
    const relevant = candidates.length
      ? candidates
      : segment.state_ledger.changes;
    const criticText = `${finding.message} ${finding.evidence ?? ""}`;

    const isProven = (change: (typeof relevant)[number]) =>
        clean(change.caused_by) &&
        clean(change.action) &&
        changeHasOnlyRelationalOrStableState(change, characterNames) &&
        hasVisibleCausalAction(
          `${change.caused_by} ${change.action} ${segment.motion_prompt} ${criticText}`
        );
    // A finding that names one entity is discharged by that entity's proof.
    // A vague whole-segment finding is suppressed only when every change in
    // the segment has the same explicit proof.
    const provenVisibleCause =
      relevant.length > 0 &&
      (entityHint ? relevant.some(isProven) : relevant.every(isProven));
    return !provenVisibleCause;
  });
}
