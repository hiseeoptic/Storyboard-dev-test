// ============================================================
// KHO DẠY CON — the shape of a parenting lesson and the areas (pillars) of
// the library. Kept apart from the lesson data so the client only loads the
// big library when the "Dạy con" panel opens; a picked lesson travels inside
// the cute-kids config as a snapshot.
// ============================================================

import type { FamilyMember, KidAge } from "./cute-kids.ts";

export type LessonPillar =
  | "money"
  | "emotions"
  | "routines"
  | "screens"
  | "manners"
  | "independence"
  | "social"
  | "honesty"
  | "confidence"
  | "empathy"
  | "safety"
  | "learning"
  | "calm"
  | "connection"
  | "eating"
  | "toddler"
  | "behavior"
  | "words"
  | "school"
  | "family"
  | "respect"
  | "thinking"
  | "nature"
  | "seasons"
  | "public"
  | "play"
  | "travel"
  | "pets"
  | "preteen"
  | "teen";

export interface ParentingLesson {
  id: string;
  pillar: LessonPillar;
  ages: KidAge[];
  title: string;
  /** The story request (Vietnamese) — the relatable moment. */
  situation: string;
  /** What the kid does (cute traits come from the card). */
  behavior: string;
  /** The parent's respectful, concrete technique. */
  technique: string;
  /** One-line tip for the narrator or the parent, and the caption. */
  takeaway: string;
  /** Mild ineffective reaction for "Cách 1" in the A/B format. */
  wrongWay: string;
  /** The named approach behind the technique (shown to parents, gives the reel credibility). */
  method: string;
  /** Family members the story needs on screen (added to the cast when the lesson is picked). */
  needs?: FamilyMember[];
}

/** Pillar groups, for the library's chip rows. */
export const PILLAR_GROUPS: Array<{ id: string; label: string }> = [
  { id: "heart", label: "Cảm xúc & tự tin" },
  { id: "daily", label: "Sinh hoạt hằng ngày" },
  { id: "conduct", label: "Hành vi & ứng xử" },
  { id: "people", label: "Gia đình, bạn bè, trường lớp" },
  { id: "explore", label: "Vui chơi & khám phá" },
  { id: "world", label: "Tiền bạc & thế giới quanh con" },
];

export const LESSON_PILLARS: Array<{ id: LessonPillar; label: string; group: string }> = [
  { id: "emotions", label: "😤 Cảm xúc", group: "heart" },
  { id: "calm", label: "🧘 Bình tĩnh & tự chủ", group: "heart" },
  { id: "confidence", label: "🌱 Tự tin", group: "heart" },
  { id: "connection", label: "💗 Gắn kết bố mẹ – con", group: "heart" },
  { id: "routines", label: "⏰ Thói quen", group: "daily" },
  { id: "eating", label: "🍚 Ăn uống & bữa cơm", group: "daily" },
  { id: "toddler", label: "🧸 Tuổi lên 2–3", group: "daily" },
  { id: "preteen", label: "🧑 Tuổi tiền dậy thì", group: "daily" },
  { id: "teen", label: "🎧 Tuổi teen", group: "daily" },
  { id: "independence", label: "🧒 Tự lập", group: "daily" },
  { id: "screens", label: "📱 Màn hình", group: "daily" },
  { id: "behavior", label: "🌋 Hành vi khó", group: "conduct" },
  { id: "words", label: "🗣️ Lời nói & giao tiếp", group: "conduct" },
  { id: "manners", label: "🙏 Lễ phép", group: "conduct" },
  { id: "honesty", label: "💡 Trung thực & trách nhiệm", group: "conduct" },
  { id: "respect", label: "🤲 Tôn trọng & khác biệt", group: "conduct" },
  { id: "family", label: "👵 Ông bà & gia đình", group: "people" },
  { id: "social", label: "🤝 Bạn bè & anh em", group: "people" },
  { id: "empathy", label: "💞 Yêu thương & biết ơn", group: "people" },
  { id: "school", label: "🏫 Trường lớp", group: "people" },
  { id: "play", label: "🎨 Vui chơi, nghệ thuật & thể thao", group: "explore" },
  { id: "learning", label: "📚 Học tập & tò mò", group: "explore" },
  { id: "thinking", label: "🧠 Tư duy & sáng tạo", group: "explore" },
  { id: "nature", label: "🌿 Thiên nhiên & môi trường", group: "explore" },
  { id: "pets", label: "🐾 Thú cưng", group: "explore" },
  { id: "travel", label: "✈️ Đi chơi xa & du lịch", group: "explore" },
  { id: "money", label: "💰 Tiền bạc", group: "world" },
  { id: "seasons", label: "🧧 Lễ Tết & truyền thống", group: "world" },
  { id: "public", label: "🚌 Nơi công cộng", group: "world" },
  { id: "safety", label: "🛡️ An toàn", group: "world" },
];

export const pillarLabel = (pillar: LessonPillar) => LESSON_PILLARS.find((p) => p.id === pillar)?.label ?? pillar;
