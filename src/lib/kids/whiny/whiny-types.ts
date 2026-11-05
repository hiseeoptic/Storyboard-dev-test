// ============================================================
// NA NHÕNG NHẼO — the shape of a "whiny moment" scene for the cute-kids reel:
// a 4–5-year-old catches Bố eating on the sly and threatens to tell Mẹ, sees
// Bố hug Mẹ and wants a hug too, is told "no" and stages a theatrical whiny
// cry… then a warm, funny button (a bite of food and instant silence, a group
// hug, a cheeky deal). Kept apart from the scene data so the client loads the
// big library only when the panel opens; a picked scene travels inside the
// cute-kids config as a snapshot.
// ============================================================

import type { FamilyMember } from "../cute-kids.ts";

/** The "trigger" a scene is built on. */
export type WhinyGroup =
  | "caught"
  | "jealous"
  | "metoo"
  | "no"
  | "fair"
  | "attention"
  | "bedtime"
  | "meal"
  | "tease"
  | "outing"
  | "myself"
  | "morning"
  | "grand"
  | "sibling"
  | "pet"
  | "occasion"
  | "home";

/** How big the whiny cry gets: a whiny sing-song, a full pretend cry, or a flop-on-the-floor tantrum. */
export type WhineLevel = "light" | "medium" | "big";

export const WHINE_LEVELS: readonly WhineLevel[] = ["light", "medium", "big"];

export const WHINE_LEVEL_LABEL: Record<WhineLevel, { vi: string; en: string; hint_vi: string }> = {
  light: { vi: "🥺 Mè nheo", en: "Whiny", hint_vi: "giọng mè nheo kéo dài, phụng phịu, dậm chân — chưa khóc" },
  medium: { vi: "😭 Khóc nhè", en: "Pretend cry", hint_vi: "mếu máo, khóc nhè to, hé mắt xem người lớn, được dỗ là nín" },
  big: { vi: "🌪️ Ăn vạ lăn ra", en: "Big tantrum", hint_vi: "ngồi bệt xuống thảm/sofa, đạp chân, gào \"Mẹ ơiii\" — vẫn là ăn vạ cho vui" },
};

export interface WhinyGroupInfo {
  id: WhinyGroup;
  label: string;
  /** The cute-kids viral format the scene follows. */
  format: string;
}

export const WHINY_GROUPS: WhinyGroupInfo[] = [
  { id: "caught", label: "🕵️ Bắt quả tang người lớn", format: "caught" },
  { id: "jealous", label: "💞 Ghen tị tình cảm", format: "jealous" },
  { id: "metoo", label: "🙋 \"Na cũng muốn!\"", format: "me_too" },
  { id: "no", label: "🙅 Bị từ chối", format: "whiny_ask" },
  { id: "fair", label: "⚖️ \"Không công bằng!\"", format: "fairness" },
  { id: "attention", label: "📱 Đòi được chú ý", format: "attention" },
  { id: "bedtime", label: "🌙 Câu giờ đi ngủ", format: "bedtime" },
  { id: "meal", label: "🍚 Bữa ăn", format: "whiny_ask" },
  { id: "tease", label: "😜 Bố trêu yêu", format: "whiny_ask" },
  { id: "outing", label: "🛒 Đi chơi, đi chợ", format: "bargain" },
  { id: "myself", label: "💪 \"Na tự làm!\"", format: "whiny_ask" },
  { id: "morning", label: "⏰ Buổi sáng đi học", format: "whiny_ask" },
  { id: "grand", label: "👵 Ông bà chiều cháu", format: "whiny_ask" },
  { id: "sibling", label: "👦 Anh trai & em bé", format: "fairness" },
  { id: "pet", label: "🐶 Thú cưng", format: "jealous" },
  { id: "occasion", label: "🎉 Dịp lễ, ngày đặc biệt", format: "bargain" },
  { id: "home", label: "🧸 Đồ chơi & chuyện vặt", format: "whiny_ask" },
];

export interface WhinyScene {
  id: string;
  group: WhinyGroup;
  title: string;
  /** Who is on screen besides the kid (the card adds them to the family). */
  cast: FamilyMember[];
  /** Where it happens (one place, kept identical across the clips). */
  place: string;
  /** The opening 0–2 s and the trigger. */
  hook: string;
  /** How the kid whines in this situation (the 4-beat pretend cry is directed on top). */
  whine: string;
  /** The warm, funny button that ends the reel. */
  punch: string;
  /** The kid's key lines (≤ 6 words each, Northern speech; localised when sent). */
  naLines: string[];
  /** One or two adult lines that set up or answer the kid. */
  adultLines: string[];
  /** Suggested clip count. */
  shots: 2 | 3;
  level: WhineLevel;
  /** The cute-kids viral format id. */
  format: string;
}

/** The compact way the library is written; the group is set per list. */
export interface CompactScene {
  id: string;
  t: string;
  cast: FamilyMember[];
  place: string;
  hook: string;
  whine: string;
  punch: string;
  na: string[];
  adult?: string[];
  shots?: 2 | 3;
  level?: WhineLevel;
  fmt?: string;
}

export function scenesOf(group: WhinyGroup, list: CompactScene[]): WhinyScene[] {
  const format = WHINY_GROUPS.find((g) => g.id === group)!.format;
  return list.map((s) => ({
    id: s.id,
    group,
    title: s.t,
    cast: [...new Set(s.cast)],
    place: s.place,
    hook: s.hook,
    whine: s.whine,
    punch: s.punch,
    naLines: [...s.na],
    adultLines: [...(s.adult ?? [])],
    shots: s.shots ?? 3,
    level: s.level ?? "medium",
    format: s.fmt ?? format,
  }));
}
