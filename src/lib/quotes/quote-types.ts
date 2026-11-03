// ============================================================
// LỜI XƯA – CHUYỆN NAY — the shape of a timeless saying (Vietnamese proverbs
// and folk verse, Chinese classics, European and American great minds, world
// wisdom) and the modern everyday story that makes it land.
//
// Accuracy first: every entry carries where it comes from and how sure we are
// (`verification`). A famous line that the person never said is kept only as
// a "Nghĩ lại cho đúng" correction story, with the true origin.
// The great person is never shown or voiced on screen — ordinary people live
// the saying; the name appears only in the narration / caption.
// ============================================================

/** Where the saying comes from; "doanh_nhan" is the shelf of billionaires, entrepreneurs and speakers (any country). */
export type QuoteRegion = "viet_nam" | "trung_hoa" | "chau_au" | "my" | "the_gioi" | "doanh_nhan";

export type QuoteKind = "tuc_ngu" | "ca_dao" | "thanh_ngu" | "danh_ngon" | "kinh_dien";

/**
 * source       — the exact words are in a known work, letter or speech;
 * folk         — anonymous folk wisdom (proverb, folk verse);
 * paraphrase   — the familiar wording condenses what the person really said;
 * misattributed — widely credited to someone who did not say it (correction story).
 */
export type QuoteVerification = "source" | "folk" | "paraphrase" | "misattributed";

/** story = "Một câu – một chuyện"; rethink = "Nghĩ lại cho đúng" (misused, outdated or misattributed). */
export type QuoteFormat = "story" | "rethink";

export type QuoteTheme =
  | "kien_tri"
  | "hoc_tap"
  | "loi_noi"
  | "biet_on"
  | "doan_ket"
  | "trung_thuc"
  | "khiem_ton"
  | "tu_chu"
  | "thoi_gian"
  | "lanh_dao"
  | "song_dep"
  | "gia_dinh"
  | "kinh_doanh";

export type QuoteRole = "main" | "elder" | "parent" | "child" | "friend" | "colleague" | "boss" | "teacher";

export interface QuoteEntry {
  id: string;
  region: QuoteRegion;
  kind: QuoteKind;
  verification: QuoteVerification;
  format: QuoteFormat;
  theme: QuoteTheme;
  /** The saying as spoken in the video (Vietnamese). */
  text: string;
  /** The original wording (Hán + Hán Việt, English, Latin, French…) when it is not Vietnamese. */
  original?: string;
  /** Who said it ("" for folk sayings). For misattributed entries: who it is usually credited to. */
  author: string;
  /** Work / chapter / letter / speech and year; for folk: the tradition. */
  source: string;
  /** What it means (for the creator and the caption). */
  meaning: string;
  /** rethink: how it is misused or what is wrong; misattributed: the true origin (spoken in the video). */
  misread?: string;
  /** 0–3 s: the line or image that stops the scroll. */
  hook: string;
  /** The modern everyday setup. */
  situation: string;
  /** The mistake that escalates (rethink: the wrong reading in action). */
  mistake: string;
  /** What makes the character stop and see. */
  turning: string;
  /** The visible change at the end. */
  awakening: string;
  /** One modern reading of the saying (≤ 30 words). */
  takeaway: string;
  /** Two questions to think about after the video. */
  questions: string[];
  roles: QuoteRole[];
  place: string;
  /** Who each role is when the story text alone is ambiguous. */
  gender?: Partial<Record<QuoteRole, "female" | "male">>;
}

export const REGION_LABEL: Record<QuoteRegion, { vi: string; en: string }> = {
  viet_nam: { vi: "🇻🇳 Việt Nam", en: "Vietnam" },
  trung_hoa: { vi: "🏮 Trung Hoa", en: "China" },
  chau_au: { vi: "🏛️ Châu Âu", en: "Europe" },
  my: { vi: "🗽 Mỹ", en: "America" },
  the_gioi: { vi: "🌏 Thế giới", en: "World" },
  doanh_nhan: { vi: "💼 Tỉ phú, doanh nhân & diễn giả", en: "Business leaders & speakers" },
};

export const KIND_LABEL: Record<QuoteKind, string> = {
  tuc_ngu: "Tục ngữ",
  ca_dao: "Ca dao",
  thanh_ngu: "Thành ngữ",
  danh_ngon: "Danh ngôn",
  kinh_dien: "Kinh điển",
};

export const VERIFICATION_LABEL: Record<QuoteVerification, { vi: string; en: string }> = {
  source: { vi: "✅ Có văn bản gốc", en: "Sourced" },
  folk: { vi: "🌾 Dân gian", en: "Folk" },
  paraphrase: { vi: "✍️ Diễn đạt lại từ lời gốc", en: "Paraphrase" },
  misattributed: { vi: "⚠️ Thường bị gán sai", en: "Misattributed" },
};

export const FORMAT_LABEL: Record<QuoteFormat, { vi: string; en: string }> = {
  story: { vi: "🎬 Một câu – một chuyện", en: "One saying, one story" },
  rethink: { vi: "🔍 Nghĩ lại cho đúng", en: "Think again" },
};

export const QUOTE_THEMES: Array<{ id: QuoteTheme; label: string }> = [
  { id: "kien_tri", label: "💪 Kiên trì & vượt khó" },
  { id: "hoc_tap", label: "📚 Học tập & hiểu biết" },
  { id: "loi_noi", label: "🗣️ Lời nói & lắng nghe" },
  { id: "biet_on", label: "🙏 Biết ơn & hiếu thảo" },
  { id: "doan_ket", label: "🤝 Đoàn kết & tình người" },
  { id: "trung_thuc", label: "⚖️ Trung thực & chính trực" },
  { id: "khiem_ton", label: "🌾 Khiêm tốn & tự biết mình" },
  { id: "tu_chu", label: "🧘 Làm chủ cảm xúc" },
  { id: "thoi_gian", label: "⏳ Thời gian & hành động" },
  { id: "lanh_dao", label: "👑 Lãnh đạo & trách nhiệm" },
  { id: "song_dep", label: "🌿 Sống đẹp & giản dị" },
  { id: "gia_dinh", label: "🏡 Gia đình & dạy con" },
  { id: "kinh_doanh", label: "💰 Kinh doanh & tiền bạc" },
];

export const QUOTE_ROLE_LABEL: Record<QuoteRole, string> = {
  main: "Nhân vật chính",
  elder: "Người lớn tuổi",
  parent: "Cha/mẹ",
  child: "Con nhỏ",
  friend: "Bạn thân",
  colleague: "Đồng nghiệp",
  boss: "Sếp",
  teacher: "Thầy/cô giáo",
};

/** The compact way the library is written; region is set per file. */
export interface CompactQuote {
  id: string;
  kind: QuoteKind;
  ver: QuoteVerification;
  format?: QuoteFormat;
  theme: QuoteTheme;
  text: string;
  original?: string;
  author?: string;
  source: string;
  meaning: string;
  misread?: string;
  hook: string;
  situation: string;
  mistake: string;
  turning: string;
  awakening: string;
  takeaway: string;
  questions: [string, string];
  roles?: QuoteRole[];
  place?: string;
  gender?: Partial<Record<QuoteRole, "female" | "male">>;
}

export function quotesOf(region: QuoteRegion, list: CompactQuote[]): QuoteEntry[] {
  return list.map((q) => ({
    id: q.id,
    region,
    kind: q.kind,
    verification: q.ver,
    format: q.format ?? (q.ver === "misattributed" ? "rethink" : "story"),
    theme: q.theme,
    text: q.text,
    ...(q.original ? { original: q.original } : {}),
    author: q.author ?? "",
    source: q.source,
    meaning: q.meaning,
    ...(q.misread ? { misread: q.misread } : {}),
    hook: q.hook,
    situation: q.situation,
    mistake: q.mistake,
    turning: q.turning,
    awakening: q.awakening,
    takeaway: q.takeaway,
    questions: [...q.questions],
    roles: q.roles ?? ["main", "elder"],
    place: q.place ?? "một khu phố Việt Nam hiện đại",
    ...(q.gender ? { gender: { ...q.gender } } : {}),
  }));
}
