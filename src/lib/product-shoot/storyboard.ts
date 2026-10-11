// ============================================================
// Deterministic post-model guard for product shoots. The script LLM is told the
// presence rule and shot style, but a model can still slip a person, a speaking
// presenter or generic "[MEDIUM] eye-level push-in" beats back in. For the
// people-free modes (product_only / hands_only) this guard makes the result
// obey the user's choice no matter what the model returned:
//   · no character locks, empty cast, no wardrobe changes;
//   · every spoken line becomes off-screen voice-over;
//   · every beat camera comes from the chosen style's beat plan (the model's
//     beat wording is kept when it does not bring a person back).
// with_characters keeps the model's story (affiliate problem → solution).
// ============================================================
import type { VideoSegment } from "@/types";
import { planProductBeats, type ResolvedProductShoot } from "./contract.ts";

type SegLike = Pick<VideoSegment, "duration_seconds" | "beats" | "characters_in_scene" | "dialogue_lines" | "speaker" | "first_frame_prompt" | "motion_prompt"> & {
  wardrobe_change?: unknown;
};
interface BreakdownLike {
  character_locks?: unknown[];
  segments: SegLike[];
}

const PERSON_WORDS = /\b(?:man|men|woman|women|person|people|girl|boy|guy|lady|model|presenter|customer|he|she|his|her|him|they|hand|hands|finger|fingers|face|wrist|arm|arms|palm)\b|người|cô gái|chàng|anh ấy|chị ấy|bàn tay|ngón tay|khuôn mặt/iu;
const FACE_WORDS = /\b(?:face|head|eyes|smile|smiling|portrait|full body|torso|shoulders|man|woman|person|girl|boy|presenter)\b|khuôn mặt|gương mặt|cô gái|chàng trai/iu;

/** Subject line used wherever the prompt pipeline would otherwise say "the main character". */
export function productShootSubject(shoot: ResolvedProductShoot | null | undefined): string {
  if (!shoot || shoot.presence === "with_characters") return "";
  const what = `the ${shoot.category.label_en.toLowerCase()} product`;
  return shoot.presence === "product_only"
    ? `${what} is the ONLY subject — no person, face, hands or any body part; the ${shoot.style.label_en.toLowerCase()} lighting and camera reveal it`
    : `${what} with anonymous hands/wrist only (${shoot.category.hand_action}); never a face, head or body`;
}

export function enforceProductShootContract(
  shoot: ResolvedProductShoot | null | undefined,
  breakdown: BreakdownLike,
): string[] {
  if (!shoot || shoot.presence === "with_characters" || !Array.isArray(breakdown.segments)) return [];
  const notes: string[] = [];
  const productOnly = shoot.presence === "product_only";
  const words = productOnly ? PERSON_WORDS : FACE_WORDS;
  // Names of any cast the model invented also count as "a person is in this text".
  const names = new Set<string>();
  for (const lock of breakdown.character_locks ?? []) {
    const n = String((lock as { name?: unknown })?.name ?? "").trim();
    if (n) names.add(n);
  }
  for (const seg of breakdown.segments) for (const n of seg.characters_in_scene ?? []) if (String(n).trim()) names.add(String(n).trim());
  const nameRe = names.size
    ? new RegExp(`(^|[^\\p{L}])(?:${[...names].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?=$|[^\\p{L}])`, "iu")
    : null;
  const banned = { test: (t: string) => words.test(t) || Boolean(nameRe && nameRe.test(t)) };
  if ((breakdown.character_locks?.length ?? 0) > 0) {
    notes.push(`Đã bỏ ${breakdown.character_locks!.length} nhân vật vì bạn chọn ${productOnly ? "chỉ quay sản phẩm" : "chỉ quay tay"}.`);
  }
  breakdown.character_locks = [];
  const plan = planProductBeats(shoot, breakdown.segments.map((s) => Math.max(1, Number(s.duration_seconds) || 10)));
  let replacedBeats = 0;
  let rebuilt = 0;
  breakdown.segments.forEach((seg, i) => {
    seg.characters_in_scene = [];
    seg.wardrobe_change = null;
    if (seg.speaker) seg.speaker = "";
    if (Array.isArray(seg.dialogue_lines)) {
      seg.dialogue_lines = seg.dialogue_lines.map((turn) => ({ ...turn, speaker: "", delivery: "voiceover" as const, camera_beat: undefined }));
    }
    const modelBeats = Array.isArray(seg.beats) ? seg.beats : [];
    seg.beats = (plan[i] ?? []).map((b, j) => {
      const text = String(modelBeats[j]?.beat ?? "").trim();
      const keep = text && !banned.test(text);
      if (!keep) replacedBeats++;
      return { beat: keep ? text : b.action, camera: b.camera };
    });
    // A first frame / motion line that still stages a person is rebuilt from the
    // style's beat plan instead of being patched with a contradicting clause.
    const clipPlan = plan[i] ?? [];
    if (seg.first_frame_prompt && banned.test(seg.first_frame_prompt) && clipPlan[0]) {
      seg.first_frame_prompt = `${productShootSubject(shoot)}. ${clipPlan[0].camera.replace(/^\s*\[[A-Z_]+\]\s*/, "")} — ${clipPlan[0].action} Set: ${shoot.style.set}. ${shoot.style.keyframe_rule}.`;
      rebuilt++;
    }
    if (seg.motion_prompt && banned.test(seg.motion_prompt) && clipPlan.length) {
      seg.motion_prompt = clipPlan.map((b) => b.action.replace(/[.\s]*$/, ".")).join(" ");
      rebuilt++;
    }
  });
  if (replacedBeats) notes.push(`Đã viết lại ${replacedBeats} nhịp cho đúng phong cách "${shoot.style.label_vi}".`);
  if (rebuilt) notes.push(`Đã dựng lại ${rebuilt} mô tả khung đầu / chuyển động vì còn nhắc tới người.`);
  return notes;
}
