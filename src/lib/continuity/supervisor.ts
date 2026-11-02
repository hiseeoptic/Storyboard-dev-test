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
//   CONT-009 medium — a location has no planner blueprint (derived from prose)
//   CONT-010 medium — a shot's written start state ignores or contradicts its
//                     place's blueprint (no fixed element named / wrong side)
//   CONT-011 medium — a hand change on a prop has no structured hand/touches
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
/** The script source the supervisor cross-checks against the blueprints (optional). */
export interface ContinuitySource {
  segments?: Array<{ segment_number?: number; location_id?: string | null; environment_ref?: string | null; first_frame_prompt?: string }>;
}

const SIDE_WORDS: Record<"left" | "right", RegExp> = {
  left: /\b(?:left|left-hand)\b|(?:^|\s)(?:bên trái|phía trái|trái)(?=\s|$|[,.;])/iu,
  right: /\b(?:right|right-hand)\b|(?:^|\s)(?:bên phải|phía phải|phải)(?=\s|$|[,.;])/iu,
};

function singularHead(name: string): string {
  const word = name.toLocaleLowerCase().trim().split(/\s+/).pop() ?? "";
  if (/(?:x|ch|sh|ss)es$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

function mentions(text: string, name: string): boolean {
  const t = text.toLocaleLowerCase();
  const full = name.toLocaleLowerCase().trim();
  const head = singularHead(name);
  return (full.length > 2 && t.includes(full)) || (head.length >= 3 && new RegExp(`(?<!\\p{L})${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?(?!\\p{L})`, "iu").test(t));
}

export function superviseContinuity(manifest: NanoFlowManifest, source: ContinuitySource = {}): ContinuityReport {
  const findings: SemanticFinding[] = [];
  const keys = manifest.continuity?.world_keys ?? {};
  const rows = new Map((manifest.continuity?.log ?? []).map((row) => [row.shot_id, { ...row, findings: [] as string[] }]));
  const add = (finding: SemanticFinding, shotId?: string) => {
    findings.push(finding);
    const row = shotId ? rows.get(shotId) : undefined;
    if (row) row.findings.push(`${finding.code}: ${finding.message}`);
  };

  const blueprints = manifest.continuity?.blueprints ?? {};
  for (const env of manifest.assets?.environments ?? []) {
    const key = keys[env.id] ?? "";
    const blueprint = blueprints[env.id];
    if (blueprint?.source === "derived" && !env.image && !/attached location photo/.test(key)) {
      add({
        code: "CONT-009",
        severity: "medium",
        scope: "project",
        message: `Bối cảnh "${blueprint.name}" chưa có bản thiết kế bối cảnh từ AI lập kịch bản; hệ thống tự dựng từ câu mô tả (${blueprint.fixed_elements.length} đồ cố định). Tạo lại kịch bản để có bản thiết kế đầy đủ vị trí trong khung.`,
        evidence: `${env.id} — FIX: write location_blueprints for this location_id (name, kind, master_view, anchor, 3–8 fixed_elements with frame_zone and relation, light).`,
      });
    }
    const tooThin = blueprint ? blueprint.fixed_elements.length < 2 : /FIXED SET — exactly as the establishing image shows it/.test(key);
    if (!env.image && !/attached location photo/.test(key) && tooThin) {
      add({
        code: "CONT-001",
        severity: "high",
        scope: "project",
        message: `Bối cảnh "${env.name}" chưa có bản đồ cố định: bản thiết kế bối cảnh có dưới 2 đồ cố định có vị trí, và không có ảnh bối cảnh tải lên.`,
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

  // CONT-010 — each shot's written start state agrees with its place's
  // planner blueprint: it names the place's fixed elements, and never puts one
  // on the other side of the frame than the blueprint does.
  const shotIdBySegment = new Map(manifest.shots.map((shot, i) => [shot.index ?? i + 1, shot.shot_id]));
  for (const [i, segment] of (source.segments ?? []).entries()) {
    const loc = String(segment.location_id || segment.environment_ref || "").trim();
    const blueprint = blueprints[loc];
    const text = String(segment.first_frame_prompt ?? "");
    if (!blueprint || blueprint.source !== "planner" || !text.trim()) continue;
    const number = segment.segment_number ?? i + 1;
    const shotId = shotIdBySegment.get(number);
    const named = blueprint.fixed_elements.filter((e) => mentions(text, e.name));
    if (named.length === 0) {
      add({
        code: "CONT-010",
        severity: "medium",
        scope: "segment",
        segment_number: number,
        message: `Mô tả mở đầu của cảnh không nhắc đồ cố định nào của "${blueprint.name}" (${blueprint.fixed_elements.slice(0, 3).map((e) => e.name).join(", ")}…) — dễ bị vẽ lại khác bối cảnh.`,
        evidence: `${loc} — FIX: name the anchor (${blueprint.anchor}) and the nearby fixed elements in first_frame_prompt with the blueprint's words and positions.`,
      }, shotId);
    }
    for (const element of named) {
      const side = /^left\b/.test(element.frame_zone) ? "left" : /^right\b/.test(element.frame_zone) ? "right" : "";
      if (!side) continue;
      const opposite = side === "left" ? "right" : "left";
      const clause = text.split(/[.;,]|\bwhile\b|\band\b/i).find((c) => mentions(c, element.name) && SIDE_WORDS[opposite].test(c) && !SIDE_WORDS[side].test(c));
      if (!clause) continue;
      add({
        code: "CONT-010",
        severity: "medium",
        scope: "segment",
        segment_number: number,
        message: `Mô tả mở đầu đặt "${element.name}" ở bên ${opposite === "left" ? "trái" : "phải"}, nhưng bản thiết kế "${blueprint.name}" ghi bên ${side === "left" ? "trái" : "phải"} (${element.frame_zone}).`,
        evidence: `"${clause.trim()}" — FIX: use the blueprint's side for ${element.name}.`,
      }, shotId);
    }
  }

  // CONT-011 — in a project written with the structured schema (planner
  // blueprints present), every hand change on a prop declares its hand and
  // what it touches instead of leaving the app to guess from the verb.
  const structured = Object.values(blueprints).some((b) => b.source === "planner");
  if (structured) {
    const registry = manifest.production_state?.registry ?? [];
    const kindOf = new Map(registry.map((r) => [r.entity_id, r.kind]));
    const shotIdByProduction = new Map(manifest.shots.map((shot) => [shot.state_authority?.production_shot_id ?? "", shot.shot_id]));
    for (const production of manifest.production_state?.shots ?? []) {
      for (const change of production.changes ?? []) {
        const kind = kindOf.get(change.entity_id);
        if (kind !== "object" && kind !== "product") continue;
        const handDriven = /\b(?:hand|hands|fingers?|palm)\b/i.test(`${change.action} ${change.caused_by}`) || Boolean(change.from_holder_entity_id || change.to_holder_entity_id);
        if (!handDriven || (change.declared_body_part !== undefined && change.declared_contact_entity_ids)) continue;
        const label = (registry.find((r) => r.entity_id === change.entity_id)?.display_name ?? change.entity_id).replace(/_/g, " ");
        add({
          code: "CONT-011",
          severity: "medium",
          scope: "segment",
          segment_number: production.segment_number,
          message: `Thay đổi của "${label}" chưa ghi "hand" và "touches" có cấu trúc trong sổ trạng thái — app đang phải đoán tay và vật chạm từ câu chữ.`,
          evidence: `${change.entity_id} — FIX: add "hand" (left_hand | right_hand | both_hands) and "touches" (entity ids) to this state_ledger change.`,
        }, shotIdByProduction.get(production.shot_id));
      }
    }
  }

  return { findings, log: [...rows.values()] };
}
