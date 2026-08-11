import type { NanoFlowManifest } from "@/types/nano-flow";
import { stableStringify } from "../nano-flow/state-authority.ts";
import {
  buildReport,
  type SemanticFinding,
  type SemanticValidationReport,
} from "./semantic-validator.ts";

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoard(value: string): Record<string, unknown> {
  try {
    return obj(JSON.parse(value));
  } catch {
    return {};
  }
}

/**
 * Gate the one-way authority chain:
 * script -> Production State -> primary video prompt -> storyboard board.
 * It reports only; it never repairs or mutates exported prompts.
 */
export function validateProductionPromptAuthority(
  manifest: NanoFlowManifest
): SemanticValidationReport {
  const findings: SemanticFinding[] = [];
  const hasNewContract =
    !!manifest.production_state ||
    (manifest.shots ?? []).some((shot) => !!shot.state_authority);
  if (!hasNewContract) return buildReport(findings, "production prompt authority gate");

  const productionShotIds = new Set(
    (manifest.production_state?.shots ?? []).map((shot) => shot.shot_id)
  );
  for (const shot of manifest.shots ?? []) {
    const push = (finding: Omit<SemanticFinding, "scope" | "segment_number">) => {
      findings.push({
        ...finding,
        scope: "segment",
        segment_number: shot.index,
      });
    };
    const authority = shot.state_authority;
    if (!authority) {
      push({
        code: "AUTH-001",
        severity: "high",
        message: "Shot is missing the script-derived state authority shared by video and board prompts.",
      });
      continue;
    }
    const fingerprint = authority.authority_fingerprint;
    if (!productionShotIds.has(authority.production_shot_id)) {
      push({
        code: "AUTH-002",
        severity: "high",
        message: "Shot authority points to a production_shot_id absent from manifest.production_state.",
        evidence: authority.production_shot_id,
      });
    }
    const expectedOrder = "script>production_state>video_prompt>storyboard_board";
    if (authority.authority_order.join(">") !== expectedOrder) {
      push({
        code: "AUTH-003",
        severity: "critical",
        message: "Authority order is reversed or incomplete; storyboard must never control video semantics.",
        evidence: authority.authority_order.join(">"),
      });
    }

    const board = parseBoard(shot.storyboard_prompt);
    const boardFingerprint = str(board.authority_fingerprint);
    if (boardFingerprint !== fingerprint) {
      push({
        code: "AUTH-004",
        severity: "high",
        message: "Storyboard board was not compiled from the same script/state authority as its video prompt.",
        evidence: `state=${fingerprint}, board=${boardFingerprint || "missing"}`,
      });
    }
    const boardRule = str(board.semantic_authority).toLowerCase();
    if (!boardRule.includes("static visual projection") || !boardRule.includes("may not")) {
      push({
        code: "AUTH-005",
        severity: "high",
        message: "Board prompt does not explicitly forbid overriding or inventing video semantics.",
      });
    }

    const video = shot.video_prompt;
    const structuredVideo = obj(video);
    const videoFingerprint = Object.keys(structuredVideo).length
      ? str(obj(structuredVideo.production_state_authority).authority_fingerprint)
      : str(video).includes(fingerprint) ? fingerprint : "";
    if (videoFingerprint !== fingerprint) {
      push({
        code: "AUTH-006",
        severity: "critical",
        message: "Primary video prompt is detached from the shot's canonical script/state authority.",
        evidence: `state=${fingerprint}, video=${videoFingerprint || "missing"}`,
      });
    }
    if (Object.keys(structuredVideo).length) {
      const rules = obj(structuredVideo.output_rules);
      const semanticPriority = str(rules.semantic_priority).toLowerCase();
      const referenceRole = str(rules.storyboard_reference_role).toLowerCase();
      if (
        !semanticPriority.includes("board is not a video input") ||
        !referenceRole.includes("not attached to veo")
      ) {
        push({
          code: "AUTH-007",
          severity: "critical",
          message: "Structured video prompt does not preserve video-over-board semantic priority.",
        });
      }
      const expectedProjection = {
        scene_action: structuredVideo.scene_action,
        camera: structuredVideo.camera,
        background_lock: structuredVideo.background_lock,
        spatial_topology: structuredVideo.spatial_topology,
        continuity_mode: structuredVideo.continuity_mode,
      };
      if (stableStringify(board.video_prompt_projection) !== stableStringify(expectedProjection)) {
        push({
          code: "AUTH-009",
          severity: "critical",
          message: "Storyboard board projection no longer matches the primary structured video prompt.",
          evidence: "scene_action/camera/background/spatial/continuity projection differs",
        });
      }
    }
    const sceneAction = obj(structuredVideo.scene_action);
    const allowedPanelActions = new Set(
      [
        authority.script_contract.first_frame_prompt,
        authority.script_contract.motion_prompt,
        authority.script_contract.full_prompt,
        ...(authority.script_contract.beats ?? []).map((beat) => beat.beat ?? ""),
        ...authority.actions.flatMap((action) => [action.evidence, action.verb]),
        str(sceneAction.start_state),
        str(sceneAction.ordered_action),
        str(sceneAction.action),
        str(sceneAction.end_state),
        str(board.setting),
      ].map(str).filter(Boolean)
    );
    const panels = Array.isArray(board.panels) ? board.panels : [];
    const inventedPanel = panels
      .map(obj)
      .find((panel) => {
        const action = str(panel.action);
        return action && !allowedPanelActions.has(action);
      });
    if (inventedPanel) {
      push({
        code: "AUTH-010",
        severity: "high",
        message: "Storyboard board contains an action not declared by the script, Production State or video prompt.",
        evidence: str(inventedPanel.action),
      });
    }
    if (!str(shot.video_keyframe_prompt) || shot.video_refs?.use_clean_video_keyframe !== true) {
      push({
        code: "AUTH-008",
        severity: "high",
        message: "Video step is missing its dedicated clean full-frame keyframe; the multi-panel storyboard must never be used as Veo input.",
      });
    }
  }
  return buildReport(findings, "production prompt authority gate");
}
