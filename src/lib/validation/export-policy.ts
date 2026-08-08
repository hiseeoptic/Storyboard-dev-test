import type { SemanticValidationReport } from "./semantic-validator.ts";

export interface SoftExportPolicy {
  can_export: boolean;
  status: "clean" | "exported_with_warnings" | "manifest_unavailable";
  warning_count: number;
}

/** Semantic findings are QA, not a transport lock. Only failure to compile a
 * manifest prevents JSON/Extension/ZIP export. */
export function assessSoftExportPolicy(
  report: SemanticValidationReport | null | undefined,
  manifestAvailable: boolean
): SoftExportPolicy {
  if (!manifestAvailable) {
    return {
      can_export: false,
      status: "manifest_unavailable",
      warning_count: report?.counts.total ?? 0,
    };
  }
  return {
    can_export: true,
    status: report?.ok === true ? "clean" : "exported_with_warnings",
    warning_count: report?.counts.total ?? 0,
  };
}

export function calculateRepairImprovement(before: number, after: number): {
  fixed: number;
  percent: number;
} {
  const safeBefore = Math.max(0, Math.round(before));
  const safeAfter = Math.max(0, Math.round(after));
  const fixed = Math.max(0, safeBefore - safeAfter);
  return {
    fixed,
    percent: safeBefore === 0 ? 100 : Math.round((fixed / safeBefore) * 100),
  };
}
