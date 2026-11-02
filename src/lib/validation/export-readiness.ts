import type { StoryboardGenerationOutput } from "@/types";
import type { NanoFlowManifest } from "@/types/nano-flow";
import { validatePromptExports } from "./prompt-validator.ts";
import { superviseContinuity } from "../continuity/supervisor.ts";
import {
  buildReport,
  type SemanticFinding,
  validateStoryboardSemantics,
  type SemanticValidationReport,
} from "./semantic-validator.ts";

export function productionStateExportFindings(
  manifest: NanoFlowManifest
): SemanticFinding[] {
  const segmentByProductionShot = new Map(
    (manifest.shots ?? [])
      .filter((shot) => shot.state_authority)
      .map((shot) => [shot.state_authority!.production_shot_id, shot.index])
  );
  return (manifest.production_state?.findings ?? []).map((finding) => {
    const segmentNumber = finding.shot_id
      ? segmentByProductionShot.get(finding.shot_id)
      : undefined;
    return {
      code: finding.code,
      severity: finding.severity,
      scope: segmentNumber === undefined ? "project" : "segment",
      ...(segmentNumber !== undefined ? { segment_number: segmentNumber } : {}),
      message: finding.message,
      evidence: JSON.stringify({
        entity_ids: finding.entity_ids,
        evidence: finding.evidence,
        suggested_patch: finding.suggested_patch,
      }),
    };
  });
}

/**
 * Free, deterministic export gate. Preview/rendering never calls this as a
 * blocker; JSON, extension push and ZIP do. Thumbnail image availability is
 * intentionally outside this gate because it is an optional review artifact.
 */
export function validateExportReadiness(
  breakdown: StoryboardGenerationOutput,
  manifest: NanoFlowManifest
): SemanticValidationReport {
  const source = validateStoryboardSemantics(breakdown);
  const prompts = validatePromptExports(manifest);
  // Script supervisor (02/11/2026): world key, fixed set, prop plan, camera
  // rule. Its high findings are the ones the export gate blocks on.
  const continuity = superviseContinuity(manifest, breakdown);
  return buildReport(
    [
      ...source.findings,
      ...productionStateExportFindings(manifest),
      ...prompts.findings,
      ...continuity.findings,
    ],
    "export readiness gate"
  );
}
