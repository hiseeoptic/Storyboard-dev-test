// ============================================================
// CHUYỆN NHÀ — the shape of a family-relationship lesson (adults): couples,
// mother-in-law & daughter-in-law, sister-in-law & the husband's younger
// sibling. Each lesson is a 2–3 minute educational drama in four movements:
// HOOK → leo thang → CAO TRÀO → bước ngoặt + BÀI HỌC → TỈNH THỨC.
//
// The techniques come from well-studied relationship research and practice
// (Gottman Method, Emotionally Focused Therapy, Nonviolent Communication,
// Imago dialogue, Gable's active-constructive responding, Rodsky's Fair Play,
// Terri Apter's in-law research, the Harvard Study of Adult Development) and
// from Vietnamese family research. `basis` states only what that research
// broadly found — no invented statistics — and is shown to the creator, not
// spoken as a claim in the video.
// ============================================================

export type FamilyRelation = "couple" | "mil_dil" | "sil";

export type FamilyRole =
  | "wife"
  | "husband"
  | "mother_in_law"
  | "father_in_law"
  | "sister_in_law"
  | "brother_in_law"
  | "child"
  | "baby";

export interface FamilyLesson {
  id: string;
  relation: FamilyRelation;
  title: string;
  /** 0–3 s: the line or image that stops the scroll. */
  hook: string;
  /** The relatable everyday setup. */
  situation: string;
  /** How it escalates — the harmful pattern on BOTH sides, nobody is a villain. */
  conflict: string;
  /** The peak moment (never violence, never humiliation played for laughs). */
  climax: string;
  /** What makes someone stop and see (a pause, an object, a memory, a child's question). */
  turning: string;
  /** The concrete technique, step by step, as it is acted out. */
  lesson: string;
  /** The awakening: the visible change and the mutual repair at the end. */
  awakening: string;
  /** One closing line for the narrator / caption (≤ 25 words). */
  takeaway: string;
  /** The harmful pattern the story shows first (named for the creator). */
  pattern: string;
  /** The named approach behind the technique. */
  method: string;
  /** What the research behind the approach broadly found (for the creator; hedged, no invented numbers). */
  basis: string;
  /** Who must be on screen. */
  roles: FamilyRole[];
  /** Default place (any place works; the blueprint is built from the story). */
  place: string;
}

export const RELATION_LABEL: Record<FamilyRelation, { vi: string; en: string; emoji: string }> = {
  couple: { vi: "Vợ chồng", en: "Couples", emoji: "💑" },
  mil_dil: { vi: "Mẹ chồng – nàng dâu", en: "Mother-in-law & daughter-in-law", emoji: "👩‍👩‍👧" },
  sil: { vi: "Chị dâu – em chồng", en: "Sister-in-law & husband's sibling", emoji: "👭" },
};

export const ROLE_LABEL: Record<FamilyRole, string> = {
  wife: "Vợ",
  husband: "Chồng",
  mother_in_law: "Mẹ chồng",
  father_in_law: "Bố chồng",
  sister_in_law: "Em chồng (gái)",
  brother_in_law: "Em chồng (trai)",
  child: "Con",
  baby: "Em bé",
};
