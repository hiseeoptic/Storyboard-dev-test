// ============================================================
// CHUYỆN CÔNG SỞ — the shape of a workplace-culture lesson: a 1–3 minute
// training drama for managers and employees, built like "Chuyện nhà":
// HOOK → leo thang → CAO TRÀO → bước ngoặt + BÀI HỌC → TỈNH THỨC.
//
// Each lesson is also a training case: it names who it is mainly for (the
// manager, the employee, or the whole team), the practice behind it (from
// leadership and organisational research — Gallup, Google re:Work, Amy
// Edmondson, Kim Scott, CCL, Lencioni, Porath & Pearson, WHO, ILO, Vietnam's
// Labour Code…) and two discussion questions for a training session.
// `basis` states only what that research broadly found — no invented numbers.
// ============================================================

export type OfficeRole =
  | "staff"
  | "manager"
  | "director"
  | "colleague"
  | "newbie"
  | "hr"
  | "client"
  | "senior";

/** Who the lesson mainly trains. */
export type OfficeAudience = "manager" | "staff" | "all";

export interface OfficeLesson {
  id: string;
  /** Library shelf (e.g. "gop_y"). */
  theme: string;
  audience: OfficeAudience;
  title: string;
  /** 0–3 s: the line or image that stops the scroll. */
  hook: string;
  /** The everyday workplace setup. */
  situation: string;
  /** How it escalates — the harmful pattern on BOTH sides, nobody is a villain. */
  conflict: string;
  /** The peak moment (never violence, never humiliation played for laughs). */
  climax: string;
  /** What makes someone stop and see. */
  turning: string;
  /** The concrete practice, step by step, as it is acted out. */
  lesson: string;
  /** The visible change and the mutual repair at the end. */
  awakening: string;
  /** One closing line for the narrator / caption (≤ 30 words). */
  takeaway: string;
  /** The harmful pattern the story shows first. */
  pattern: string;
  /** The named practice behind the lesson. */
  method: string;
  /** What the research behind the practice broadly found (for the trainer; hedged). */
  basis: string;
  /** Two questions for a training discussion after the video. */
  questions: string[];
  /** Who must be on screen. */
  roles: OfficeRole[];
  /** Default place (the card's workplace type decides the look). */
  place: string;
}

export const OFFICE_ROLE_LABEL: Record<OfficeRole, string> = {
  staff: "Nhân viên",
  manager: "Trưởng phòng",
  director: "Giám đốc",
  colleague: "Đồng nghiệp",
  newbie: "Nhân viên mới",
  hr: "Nhân sự (HR)",
  client: "Khách hàng",
  senior: "Nhân viên lâu năm",
};

export const AUDIENCE_LABEL: Record<OfficeAudience, { vi: string; en: string; emoji: string }> = {
  manager: { vi: "Cho sếp", en: "For managers", emoji: "👔" },
  staff: { vi: "Cho nhân viên", en: "For employees", emoji: "🧑‍💻" },
  all: { vi: "Cả đội", en: "Whole team", emoji: "🤝" },
};
