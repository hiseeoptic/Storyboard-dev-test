// ============================================================
// Writers' room → storyboard form. The approved shot table becomes a
// screenplay the existing pipeline recognises as a finished script (kept
// verbatim), one "CẢNH" per 10-second segment, plus the cast and settings.
// ============================================================
import { fillLineClock } from "./shot-rules.ts";
import type { PlanOption, RoomCharacter, RoomScript, RoomState } from "./types.ts";

const narratorLabel = (speaker: string) =>
  !speaker || /^(lời dẫn|người dẫn|narrator|voice[- ]?over|vo|thuyết minh)$/iu.test(speaker.trim()) ? "Lời dẫn" : speaker.trim();

/** Screenplay text: detected by approvedScriptFromStoryIdea (heading + labelled lines). */
export function scriptToScreenplay(script: RoomScript): string {
  const out: string[] = [];
  out.push(`KỊCH BẢN: ${script.title}`);
  if (script.logline) out.push(`Tóm tắt: ${script.logline}`);
  if (script.characters.length) {
    out.push("", "NHÂN VẬT:");
    for (const c of script.characters) {
      out.push(`- ${c.name}${[c.age, c.gender].filter(Boolean).length ? ` (${[c.age, c.gender].filter(Boolean).join(", ")})` : ""}${c.role ? ` — ${c.role}` : ""}${c.appearance ? `. Ngoại hình: ${c.appearance}` : ""}${c.wardrobe ? `. Trang phục: ${c.wardrobe}` : ""}${c.personality ? `. Tính cách: ${c.personality}` : ""}`);
    }
  }
  out.push("", `MỖI CẢNH DƯỚI ĐÂY LÀ ĐÚNG MỘT CLIP 10 GIÂY (${script.shots.length} cảnh). Giữ nguyên thứ tự, lời thoại và hành động. Các cảnh nối tiếp liền mạch trong cùng không gian: cảnh sau mở đúng vị trí, tư thế và đồ vật mà cảnh trước kết thúc, trừ khi ghi "cắt cảnh".`);
  for (const raw of script.shots) {
    const shot = fillLineClock(raw);
    out.push("", `CẢNH ${shot.n} (10 giây) — ${shot.location || "bối cảnh như cảnh trước"}${shot.transition ? ` · chuyển cảnh: ${shot.transition}` : ""}`);
    if (shot.characters.length) out.push(`Nhân vật trong cảnh: ${shot.characters.join(", ")}`);
    if (shot.start) out.push(`Mở cảnh: ${shot.start}`);
    out.push(`Hành động: ${shot.action}`);
    if (shot.camera) out.push(`Camera: ${shot.camera}`);
    const lines = [...(shot.dialogue ?? [])];
    if (shot.voice_over?.text) lines.push(shot.voice_over);
    lines
      .sort((a, b) => (a.start_s ?? 0) - (b.start_s ?? 0))
      .forEach((l) => out.push(`${narratorLabel(l.speaker)}: "${l.text}"${typeof l.start_s === "number" && typeof l.end_s === "number" ? ` (${l.start_s}–${l.end_s}s)` : ""}`));
  }
  return out.join("\n");
}

export interface FormCharacter {
  name: string;
  role: string;
  appearance: string;
  isChild: boolean;
}

export interface RoomFormPatch {
  storyIdea: string;
  segmentCount: number;
  genre?: string;
  style?: string;
  characterRepresentation?: string;
  voiceOver: boolean;
  dialogue: boolean;
  characters: FormCharacter[];
}

const isChild = (c: RoomCharacter) => {
  const age = parseInt(String(c.age ?? "").replace(/[^\d]/g, ""), 10);
  return (Number.isFinite(age) && age > 0 && age < 13) || /trẻ em|bé |em bé|child|kid/iu.test(`${c.age ?? ""} ${c.role ?? ""}`);
};

/** Everything the generate form needs to continue with the approved script. */
export function roomToFormPatch(state: RoomState): RoomFormPatch | null {
  const script = state.script;
  if (!script?.shots.length) return null;
  const option: PlanOption | undefined = state.options?.find((o) => o.id === state.chosenOptionId);
  const hasDialogue = script.shots.some((s) => (s.dialogue ?? []).some((l) => narratorLabel(l.speaker) !== "Lời dẫn"));
  const hasVo = script.shots.some((s) => s.voice_over?.text || (s.dialogue ?? []).some((l) => narratorLabel(l.speaker) === "Lời dẫn"));
  return {
    storyIdea: scriptToScreenplay(script),
    segmentCount: script.shots.length,
    ...(option?.genre ? { genre: option.genre } : {}),
    ...(option?.visual_style ? { style: option.visual_style } : {}),
    ...(option?.character_representation ? { characterRepresentation: option.character_representation } : {}),
    voiceOver: hasVo,
    dialogue: hasDialogue,
    characters: script.characters.map((c) => ({
      name: c.name,
      role: [c.role, c.personality ? `Tính cách: ${c.personality}` : ""].filter(Boolean).join(". "),
      appearance: [c.gender, c.age ? `${c.age} tuổi`.replace(/tuổi tuổi/, "tuổi") : "", c.appearance, c.wardrobe ? `trang phục: ${c.wardrobe}` : ""].filter(Boolean).join(", "),
      isChild: isChild(c),
    })),
  };
}
