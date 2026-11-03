// ============================================================
// Mẹ chồng – nàng dâu — the full shelf: the first 10 hand-written lessons
// (../in-laws.ts, unchanged) given a theme, plus the themed library (190
// lessons in 12 themes). Ordered by theme so the card lists each shelf
// together; within a theme the original lesson comes first.
// ============================================================

import type { FamilyLesson } from "../../lesson-types.ts";
import { MIL_THEMES, type MilTheme } from "../../techniques.ts";
import { MIL_GRANDCHILD_LESSONS, MIL_BIRTH_LESSONS } from "./grandchildren-birth.ts";
import { MIL_ELDER_LESSONS, MIL_MODERN_LESSONS } from "./health-modern.ts";
import { MIL_LIFESTYLE_LESSONS, MIL_KIN_LESSONS } from "./lifestyle-family.ts";
import { MIL_LIVING_LESSONS, MIL_WORDS_LESSONS } from "./living-words.ts";
import { MIL_MONEY_LESSONS, MIL_FESTIVAL_LESSONS } from "./money-festivals.ts";
import { MIL_WEDDING_LESSONS, MIL_KITCHEN_LESSONS } from "./wedding-kitchen.ts";

/** The shelf of each of the first 10 lessons (they predate themes). */
export const ORIGINAL_MIL_THEMES: Record<string, MilTheme> = {
  mil_childcare_01: "cham_chau",
  mil_kitchen_02: "bep",
  mil_son_bridge_03: "o_chung",
  mil_salary_04: "tien",
  mil_grandson_05: "o_cu",
  mil_comparison_06: "loi_noi",
  mil_visit_07: "o_chung",
  mil_new_bride_08: "ngay_dau",
  mil_gossip_09: "thoi_dai",
  mil_gratitude_10: "tuoi_gia",
};

export const MIL_THEMED_LESSONS: FamilyLesson[] = [
  ...MIL_WEDDING_LESSONS,
  ...MIL_KITCHEN_LESSONS,
  ...MIL_GRANDCHILD_LESSONS,
  ...MIL_BIRTH_LESSONS,
  ...MIL_MONEY_LESSONS,
  ...MIL_FESTIVAL_LESSONS,
  ...MIL_LIVING_LESSONS,
  ...MIL_WORDS_LESSONS,
  ...MIL_LIFESTYLE_LESSONS,
  ...MIL_KIN_LESSONS,
  ...MIL_ELDER_LESSONS,
  ...MIL_MODERN_LESSONS,
];

const THEME_ORDER = new Map<string, number>(MIL_THEMES.map((t, i) => [t.id, i]));

/** The original lessons (themed) + the themed library, grouped by theme. */
export function milLibrary(originals: FamilyLesson[]): FamilyLesson[] {
  const themed = originals.map((l) => (l.theme || !ORIGINAL_MIL_THEMES[l.id] ? l : { ...l, theme: ORIGINAL_MIL_THEMES[l.id] }));
  const all = [...themed, ...MIL_THEMED_LESSONS];
  const rank = (l: FamilyLesson) => THEME_ORDER.get(l.theme ?? "") ?? MIL_THEMES.length;
  return all.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map(({ l }) => l);
}
