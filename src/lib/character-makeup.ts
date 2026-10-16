// ============================================================
// MAKEUP — per-character choice the user makes in the cast: let the story
// decide, a bare face, or natural polished makeup. Locked like the outfit:
// written into the character sheet, every keyframe and the video lock, so the
// same face is not made up in one shot and bare in the next. Children never
// wear makeup.
// ============================================================

export type MakeupMode = "auto" | "none" | "natural";

export const MAKEUP_LABEL: Record<MakeupMode, { vi: string; en: string }> = {
  auto: { vi: "Tự động", en: "Auto" },
  none: { vi: "Không trang điểm", en: "No makeup" },
  natural: { vi: "Có trang điểm", en: "Makeup" },
};

const NO_MAKEUP =
  "NO MAKEUP — bare natural face: no foundation, concealer, contour, blush, eyeshadow, eyeliner, mascara, false lashes, lipstick or lip tint; natural brows, natural lip colour and real skin texture with its small imperfections.";
const NATURAL_MAKEUP =
  "MAKEUP — polished, natural makeup that suits the occasion: even skin that still shows real texture, soft blush, groomed brows, subtle eye definition and a natural rosy or nude lip; never heavy, glossy, doll-like or plastic.";

/** The locked makeup text for a character, or "" when the story decides. */
export function makeupText(mode: MakeupMode | undefined, isChild = false): string {
  if (isChild) return mode && mode !== "auto" ? NO_MAKEUP : "";
  if (mode === "none") return NO_MAKEUP;
  if (mode === "natural") return NATURAL_MAKEUP;
  return "";
}

/** Keyframe / video contract for the characters in one shot. */
export function makeupContract(entries: Array<{ name: string; makeup: string }>): string {
  const set = entries.filter((e) => e.makeup);
  if (!set.length) return "";
  return `MAKEUP LOCK (chosen by the user, identical in every shot and over the face from the reference): ${set
    .map((e) => `${e.name} — ${e.makeup}`)
    .join(" | ")}`;
}
