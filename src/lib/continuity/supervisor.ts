// ============================================================
// SCRIPT SUPERVISOR — the continuity pass of the editorial room.
//
// On a real set the script supervisor keeps a log of every prop's place at the
// start and end of each take, which hand touches what, the framing, and
// whether the last frame matches the next shot. This pass does the same on the
// compiled manifest and reports CONT-* findings:
//   CONT-001 high   — a location has no fixed set (no map, no photo)
//   CONT-002 high   — the camera changes direction inside one take
//   CONT-003 high   — a prop changes place but nobody moves it
//   CONT-004 high   — a prompt of the place lacks the location's world key
//   CONT-005 medium — a moved prop has no hand
//   CONT-006 medium — more than two new elements enter a shot of the same place
//   CONT-007 medium — a prop that must stay put sits in the foreground / at the
//                     frame edge (the easiest place to slide out of frame)
//   CONT-008 medium — the shot's place name is a script sentence
// High findings block the export until they are fixed (see export gate).
// ============================================================
import type { NanoFlowManifest } from "@/types/nano-flow";
import type { SemanticFinding } from "../validation/semantic-validator.ts";
import { analyzeCameraPath } from "./camera.ts";
import { WORLD_KEY_FIELD, foregroundProps, junkPlaceName, shotPropPlan } from "./contract.ts";
import type { ContinuityLogRow } from "./types.ts";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const CONTINUITY_BLOCKING_CODES = new Set(["CONT-001", "CONT-002", "CONT-003", "CONT-004"]);

/** True for a finding the continuity gate refuses to export with. */
export function isBlockingContinuityFinding(f: { code: string; severity: string }): boolean {
  return f.code.startsWith("CONT-") && (f.severity === "critical" || f.severity === "high");
}

function keyframeWorldKey(prompt: string | undefined): string {
  if (!prompt) return "";
  try {
    const parsed = JSON.parse(prompt) as unknown;
    return isObj(parsed) ? str(parsed[WORLD_KEY_FIELD]) : "";
  } catch {
    return "";
  }
}

export interface ContinuityReport {
  findings: SemanticFinding[];
  log: ContinuityLogRow[];
}

/** Check a manifest that went through applyContinuityContract (or not — then CONT-004 says so). */
export function superviseContinuity(manifest: NanoFlowManifest): ContinuityReport {
  const findings: SemanticFinding[] = [];
  const keys = manifest.continuity?.world_keys ?? {};
  const rows = new Map((manifest.continuity?.log ?? []).map((row) => [row.shot_id, { ...row, findings: [] as string[] }]));
  const add = (finding: SemanticFinding, shotId?: string) => {
    findings.push(finding);
    const row = shotId ? rows.get(shotId) : undefined;
    if (row) row.findings.push(`${finding.code}: ${finding.message}`);
  };

  for (const env of manifest.assets?.environments ?? []) {
    const key = keys[env.id] ?? "";
    if (!env.image && /FIXED SET — exactly as the establishing image shows it/.test(key)) {
      add({
        code: "CONT-001",
        severity: "high",
        scope: "project",
        message: `Bối cảnh "${env.name}" chưa có bản đồ cố định: mô tả bối cảnh không nêu được ít nhất 2 đồ vật/vị trí, cũng không có ảnh bối cảnh tải lên.`,
        evidence: `${env.id} — FIX: rewrite the location's scenery as a list of at least two fixed pieces with positions (e.g. "low wooden table at the rug edge; beige sofa against the back wall").`,
      });
    }
  }

  manifest.shots.forEach((shot, index) => {
    const segment = shot.index ?? index + 1;
    const loc =
      str(shot.location_id) ||
      (isObj(shot.video_prompt) ? str(shot.video_prompt.location_id) : "") ||
      str(shot.video_refs?.environments?.[0]);
    const key = keys[loc];
    const camera = analyzeCameraPath(shot.beats);
    if (camera.turns > 0 && !camera.locked) {
      add({
        code: "CONT-002",
        severity: "high",
        scope: "segment",
        segment_number: segment,
        message: `Máy quay đổi hướng trong một clip (${camera.sizes.join(" → ")}): dí cận rồi kéo rộng lại làm đồ đạc bị vẽ lại và xê dịch.`,
        evidence: `sizes ${camera.sizes.join(",")} — FIX: rewrite this segment's beats so the camera pushes in OR pulls back, never both; keep the reaction in the opening framing.`,
      }, shot.shot_id);
    }
    const clip = isObj(shot.video_prompt) ? shot.video_prompt : undefined;
    if (key) {
      const videoKey = clip ? str(clip[WORLD_KEY_FIELD]) : key;
      const frameKey = keyframeWorldKey(shot.storyboard_prompt);
      const frameIsJson = (() => {
        try { return isObj(JSON.parse(shot.storyboard_prompt)); } catch { return false; }
      })();
      if (videoKey !== key || (frameIsJson && frameKey !== key)) {
        add({
          code: "CONT-004",
          severity: "high",
          scope: "segment",
          segment_number: segment,
          message: "Prompt của shot thiếu World Key của bối cảnh hoặc World Key bị sửa khác đi.",
          evidence: loc,
        }, shot.shot_id);
      }
    }
    const state = manifest.production_state;
    const productionId = shot.state_authority?.production_shot_id;
    const production = (productionId ? state?.shots.find((s) => s.shot_id === productionId) : undefined) ?? state?.shots[index];
    const plan = production ? shotPropPlan(production, state?.registry ?? []) : { moves: [], touched: [], stays: [] };
    for (const move of plan.moves) {
      if (!move.by) {
        add({
          code: "CONT-003",
          severity: "high",
          scope: "segment",
          segment_number: segment,
          message: `Đạo cụ "${move.label}" đổi chỗ (${move.from} → ${move.to}) nhưng không có nhân vật nào làm việc đó.`,
          evidence: `${move.entity_id} — FIX: add a state_ledger change naming who moves it, with which hand, and the hand-to-prop contact.`,
        }, shot.shot_id);
      } else if (!move.hand) {
        add({
          code: "CONT-005",
          severity: "medium",
          scope: "segment",
          segment_number: segment,
          message: `Đạo cụ "${move.label}" do ${move.by} di chuyển nhưng không ghi tay nào.`,
          evidence: `${move.entity_id} — FIX: name the hand (body_part) in the state_ledger change that moves it.`,
        }, shot.shot_id);
      }
    }
    const row = rows.get(shot.shot_id);
    if (row && row.new_elements.length > 2) {
      add({
        code: "CONT-006",
        severity: "medium",
        scope: "segment",
        segment_number: segment,
        message: `Shot thêm ${row.new_elements.length} yếu tố mới cùng lúc (${row.new_elements.join(", ")}); tối đa 2 để thế giới không bị vỡ.`,
        evidence: `${row.new_elements.join(", ")} — FIX: introduce at most two new people/props per clip; move the rest to the next clip.`,
      }, shot.shot_id);
    }
    if (row) {
      const edge = foregroundProps(shot.beats, row.stays);
      if (edge.length) {
        add({
          code: "CONT-007",
          severity: "medium",
          scope: "segment",
          segment_number: segment,
          message: `${edge.join(", ")} nằm ở tiền cảnh/mép khung trong beat máy quay — chỗ dễ bị đẩy ra khỏi khung nhất; đã thêm frame_margin giữ nó trọn trong khung; tốt nhất nên đặt vào giữa mặt bàn.`,
          evidence: edge.join(", "),
        }, shot.shot_id);
      }
    }
    const bgName = clip && isObj(clip.background_lock) ? str(clip.background_lock.name) : "";
    if (clip && isObj(clip.background_lock) && bgName && junkPlaceName(bgName)) {
      add({
        code: "CONT-008",
        severity: "medium",
        scope: "segment",
        segment_number: segment,
        message: `Tên bối cảnh của shot là một câu kịch bản ("${bgName}"), không phải tên nơi chốn.`,
        evidence: bgName,
      }, shot.shot_id);
    }
  });

  return { findings, log: [...rows.values()] };
}
