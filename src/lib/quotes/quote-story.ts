// ============================================================
// LỜI XƯA – CHUYỆN NAY — one timeless saying, one modern everyday story.
// Built like the other lesson formats (a library entry → a card config → a
// hard contract for the planner → a writers'-room seed), 4–12 clips (default
// 6 = 1 minute):
//   HOOK → sai lầm → bước ngoặt → LỜI XƯA (the saying, verbatim) → áp dụng → TỈNH THỨC.
// Two formats: "Một câu – một chuyện" and "Nghĩ lại cho đúng" (a saying that
// is misused, outdated, misquoted or misattributed — the video corrects it).
// The great person is never shown or imitated; the saying is never rendered as
// AI text on screen (the caption is added in editing — quoteCaption()).
// ============================================================

import { labelAiSocialPosts } from "../kids/cute-kids.ts";
import {
  FIELD_LABEL,
  FORMAT_LABEL,
  KIND_LABEL,
  QUOTE_ROLE_LABEL,
  QUOTE_THEMES,
  REGION_LABEL,
  VERIFICATION_LABEL,
  type QuoteEntry,
  type QuoteField,
  type QuoteFormat,
  type QuoteRegion,
  type QuoteRole,
  type QuoteTheme,
} from "./quote-types.ts";
import { VIETNAM_QUOTES } from "./lessons/viet-nam.ts";
import { CHINA_QUOTES } from "./lessons/trung-hoa.ts";
import { EUROPE_QUOTES } from "./lessons/chau-au.ts";
import { AMERICA_QUOTES, WORLD_QUOTES } from "./lessons/my-the-gioi.ts";
import { BUSINESS_QUOTES } from "./lessons/doanh-nhan.ts";
import { CHINA_SEEDS, VIETNAM_SEEDS } from "./lessons/seeds-dong-a.ts";
import { EUROPE_SEEDS } from "./lessons/seeds-chau-au.ts";
import { AMERICA_SEEDS } from "./lessons/seeds-my.ts";
import { WORLD_SEEDS } from "./lessons/seeds-the-gioi.ts";
import { BUSINESS_SEEDS } from "./lessons/seeds-doanh-nhan.ts";
import { BUSINESS_SEEDS_2 } from "./lessons/seeds-doanh-nhan-2.ts";

export {
  FIELD_LABEL,
  FORMAT_LABEL,
  KIND_LABEL,
  QUOTE_ROLE_LABEL,
  QUOTE_THEMES,
  REGION_LABEL,
  VERIFICATION_LABEL,
  type QuoteEntry,
  type QuoteField,
  type QuoteFormat,
  type QuoteRegion,
  type QuoteRole,
  type QuoteTheme,
} from "./quote-types.ts";

/** Full-story entries (written six beats) first, then the reference library (one-line story idea each). */
export const QUOTE_LIBRARY: QuoteEntry[] = [
  ...VIETNAM_QUOTES,
  ...CHINA_QUOTES,
  ...EUROPE_QUOTES,
  ...AMERICA_QUOTES,
  ...WORLD_QUOTES,
  ...BUSINESS_QUOTES,
  ...VIETNAM_SEEDS,
  ...CHINA_SEEDS,
  ...EUROPE_SEEDS,
  ...AMERICA_SEEDS,
  ...WORLD_SEEDS,
  ...BUSINESS_SEEDS,
  ...BUSINESS_SEEDS_2,
];

const BY_ID = new Map(QUOTE_LIBRARY.map((q) => [q.id, q]));
export const QUOTE_REGIONS: readonly QuoteRegion[] = ["viet_nam", "trung_hoa", "chau_au", "my", "the_gioi", "doanh_nhan"];
export const QUOTE_FORMATS: readonly QuoteFormat[] = ["story", "rethink"];
export const QUOTE_ROLES: readonly QuoteRole[] = ["main", "elder", "parent", "child", "friend", "colleague", "boss", "teacher"];
export const QUOTE_FIELDS: readonly QuoteField[] = ["dan_gian", "triet_gia", "khoa_hoc", "van_nghe", "doanh_nhan", "lich_su", "giao_duc", "tam_linh", "the_thao"];

/** A reference-library entry: the saying, its source and a one-line story idea (the script writer builds the beats). */
export function isSeedOnly(q: Pick<QuoteEntry, "hook" | "seed">): boolean {
  return !q.hook && Boolean(q.seed);
}

/** The field of each author in the full-story entries (the reference entries carry their own `field`). */
export const QUOTE_AUTHOR_FIELD: Readonly<Record<string, QuoteField>> = {
  // Việt Nam
  "Nguyễn Trãi": "lich_su",
  "Trần Nhân Tông": "lich_su",
  "Trần Hưng Đạo": "lich_su",
  "Thân Nhân Trung": "lich_su",
  "Phan Châu Trinh": "lich_su",
  "Đặng Thùy Trâm": "lich_su",
  "Nguyễn Du": "van_nghe",
  "Nguyễn Đình Chiểu": "van_nghe",
  "Nguyễn Bỉnh Khiêm": "van_nghe",
  // Trung Hoa
  "Khổng Tử": "triet_gia",
  "Lão Tử": "triet_gia",
  "Tuân Tử": "triet_gia",
  "Mạnh Tử": "triet_gia",
  "Tôn Tử": "triet_gia",
  "Trang Tử": "triet_gia",
  "Hàn Phi Tử": "triet_gia",
  "Sách Đại học": "triet_gia",
  "Phạm Trọng Yêm": "lich_su",
  "Gia Cát Lượng": "lich_su",
  "Lỗ Tấn": "van_nghe",
  // Châu Âu
  Socrates: "triet_gia",
  Aristotle: "triet_gia",
  Heraclitus: "triet_gia",
  Seneca: "triet_gia",
  "Marcus Aurelius": "triet_gia",
  Epictetus: "triet_gia",
  Cicero: "triet_gia",
  Voltaire: "triet_gia",
  "William Shakespeare": "van_nghe",
  "Johann Wolfgang von Goethe": "van_nghe",
  "Winston Churchill": "lich_su",
  "Albert Einstein": "khoa_hoc",
  "Isaac Newton": "khoa_hoc",
  "Charles Darwin": "khoa_hoc",
  // Mỹ & thế giới
  "Benjamin Franklin": "lich_su",
  "Abraham Lincoln": "lich_su",
  "Thomas Jefferson": "lich_su",
  "Theodore Roosevelt": "lich_su",
  "Franklin D. Roosevelt": "lich_su",
  "Martin Luther King Jr.": "lich_su",
  "Nelson Mandela": "lich_su",
  "Mahatma Gandhi": "lich_su",
  "Booker T. Washington": "giao_duc",
  "Mark Twain": "van_nghe",
  "Ralph Waldo Emerson": "van_nghe",
  "Henry David Thoreau": "van_nghe",
  "Maya Angelou": "van_nghe",
  "Kahlil Gibran": "van_nghe",
  "Walt Disney": "van_nghe",
  "Thomas Edison": "khoa_hoc",
  "Đức Phật": "tam_linh",
  // Doanh nhân & diễn giả
  "Steve Jobs": "doanh_nhan",
  "Warren Buffett": "doanh_nhan",
  "Charlie Munger": "doanh_nhan",
  "Bill Gates": "doanh_nhan",
  "Jeff Bezos": "doanh_nhan",
  "Henry Ford": "doanh_nhan",
  "Andrew Carnegie": "doanh_nhan",
  "Sam Walton": "doanh_nhan",
  "Richard Branson": "doanh_nhan",
  "Ray Dalio": "doanh_nhan",
  "Satya Nadella": "doanh_nhan",
  "Jack Ma (Mã Vân)": "doanh_nhan",
  "Inamori Kazuo": "doanh_nhan",
  "Peter Drucker": "doanh_nhan",
  "Dale Carnegie": "giao_duc",
  "Napoleon Hill": "giao_duc",
  "Simon Sinek": "giao_duc",
  "Brené Brown": "giao_duc",
};

/** Who said it, by field: the entry's own field, else its author's; folk sayings are "Dân gian". */
export function quoteField(q: Pick<QuoteEntry, "field" | "author" | "verification">): QuoteField {
  if (q.field) return q.field;
  if (q.verification === "folk" || !q.author) return "dan_gian";
  return QUOTE_AUTHOR_FIELD[q.author] ?? "triet_gia";
}

export function findQuote(id: string | undefined | null): QuoteEntry | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function quotesFor(filter: { region?: string | null; theme?: string | null; format?: string | null; field?: string | null } = {}): QuoteEntry[] {
  return QUOTE_LIBRARY.filter(
    (q) =>
      (!filter.region || q.region === filter.region) &&
      (!filter.theme || q.theme === filter.theme) &&
      (!filter.format || q.format === filter.format) &&
      (!filter.field || quoteField(q) === filter.field)
  );
}

export function quoteThemeLabel(q: Pick<QuoteEntry, "theme">): string {
  return QUOTE_THEMES.find((t) => t.id === q.theme)?.label ?? "";
}

export function quoteCounts(pool: readonly QuoteEntry[] = QUOTE_LIBRARY) {
  return {
    regions: QUOTE_REGIONS.map((id) => ({ id, label: REGION_LABEL[id].vi, count: pool.filter((q) => q.region === id).length })),
    themes: QUOTE_THEMES.map((t) => ({ ...t, count: pool.filter((q) => q.theme === t.id).length })),
    formats: QUOTE_FORMATS.map((id) => ({ id, label: FORMAT_LABEL[id].vi, count: pool.filter((q) => q.format === id).length })),
    fields: QUOTE_FIELDS.map((id) => ({ id, label: FIELD_LABEL[id], count: pool.filter((q) => quoteField(q) === id).length })),
  };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Entries matching every word of the query (accents optional): the saying and its author first. */
export function searchQuotes(query: string, pool: readonly QuoteEntry[] = QUOTE_LIBRARY): QuoteEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const text = (q: QuoteEntry) =>
    fold(`${q.text} ${q.author} ${q.source} ${q.original ?? ""} ${q.meaning} ${q.hook} ${q.situation} ${q.seed ?? ""} ${q.takeaway} ${quoteThemeLabel(q)} ${REGION_LABEL[q.region].vi} ${KIND_LABEL[q.kind]} ${FIELD_LABEL[quoteField(q)]}`);
  const hits = pool.filter((q) => words.every((w) => text(q).includes(w)));
  const head = (q: QuoteEntry) => words.every((w) => fold(`${q.text} ${q.author}`).includes(w));
  return [...hits.filter(head), ...hits.filter((q) => !head(q))];
}

export function pickUnusedQuote(pool: readonly QuoteEntry[], used: Iterable<string>, random: () => number = Math.random): QuoteEntry | undefined {
  const done = new Set(used);
  const fresh = pool.filter((q) => !done.has(q.id));
  if (!fresh.length) return undefined;
  return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
}

// ---------- the saying, its attribution and the caption ----------

const shortSource = (q: QuoteEntry) => q.source.split(/[,(;]/)[0]!.trim();

/** Where it comes from, as written on the card: a misattributed line never shows the famous name as its author. */
export function quoteOriginLine(q: QuoteEntry): string {
  if (q.verification === "misattributed") return `thường bị gán cho ${q.author} — ${q.source}`;
  return `${q.author ? `${q.author} — ` : ""}${q.source}`;
}

/** The attribution spoken after the saying (Vietnamese). */
export function quoteSpokenAttribution(q: QuoteEntry): string {
  switch (q.verification) {
    case "folk":
      return q.source;
    case "source":
      return q.author && !q.source.startsWith(q.author) ? `${q.author}, ${shortSource(q)}` : shortSource(q);
    case "paraphrase":
      return `theo ý của ${q.author}`;
    case "misattributed":
      return `câu này thường được cho là của ${q.author}`;
  }
}

/** The text an editor overlays on the saying clip (the video itself never renders it). */
export function quoteCaption(q: QuoteEntry): string {
  const quoted = `“${q.text.replace(/[.。]$/, "")}”`;
  if (q.verification === "folk") return `${quoted}\n— ${q.source}`;
  if (q.verification === "misattributed") return `${quoted}\n⚠️ Thường bị gán cho ${q.author}. ${q.source}.`;
  if (q.verification === "paraphrase") return `${quoted}\n— Theo ý của ${q.author} (${q.source})`;
  return `${quoted}\n— ${q.author ? `${q.author}, ` : ""}${q.source}`;
}

/** A study card for teachers, parents and trainers. */
export function quoteStudyCard(q: QuoteEntry): string {
  return [
    `LỜI XƯA – CHUYỆN NAY — ${q.text}`,
    q.original ? `Nguyên văn: ${q.original}` : "",
    `Xuất xứ: ${quoteOriginLine(q)} · ${REGION_LABEL[q.region].vi} · ${KIND_LABEL[q.kind]} · ${VERIFICATION_LABEL[q.verification].vi}`,
    `Ý nghĩa: ${q.meaning}`,
    q.misread ? `${q.verification === "misattributed" ? "Sự thật về nguồn gốc" : "Hiểu cho đúng"}: ${q.misread}` : "",
    `${q.situation ? "Chuyện hôm nay" : "Gợi ý câu chuyện"}: ${q.situation || q.seed || ""}`,
    `Thông điệp: ${q.takeaway}`,
    ...(q.questions.length ? ["Câu hỏi suy ngẫm:", ...q.questions.map((x, i) => `${i + 1}. ${x}`)] : []),
  ].filter(Boolean).join("\n");
}

// ---------- the clip plan ----------

export type QuoteAct = "hook" | "rising" | "turning" | "saying" | "apply" | "awakening";

export interface QuoteActSlot {
  act: QuoteAct;
  from: number;
  to: number;
  label_vi: string;
  purpose_en: string;
}

export const QUOTE_MIN_SHOTS = 4;
export const QUOTE_MAX_SHOTS = 12;
export const QUOTE_DEFAULT_SHOTS = 6;

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

function actText(act: QuoteAct, format: QuoteFormat): { vi: string; en: string } {
  const rethink = format === "rethink";
  switch (act) {
    case "hook":
      return { vi: "Hook", en: rethink ? "the hook in the first 2 seconds — someone quotes the saying the familiar (wrong) way, or uses it as an excuse" : "the hook line or image in the first 2 seconds — straight into the everyday tension" };
    case "rising":
      return { vi: rethink ? "Hiểu sai" : "Sai lầm", en: rethink ? "the wrong reading in action: what goes wrong when people use the saying this way; each clip raises the stakes by one step" : "the mistake grows: a real, sympathetic character does the thing the saying warns about; each clip raises the stakes by one step" };
    case "turning":
      return { vi: "Bước ngoặt", en: "the turning point: something makes the character stop and see (an object, a memory, a question from someone they love)" };
    case "saying":
      return { vi: "Lời xưa", en: rethink ? "the saying is spoken VERBATIM, then the correction (its true meaning or true origin) — the moment of understanding" : "the saying is spoken VERBATIM — the moment of understanding; calm framing with negative space for the caption" };
    case "apply":
      return { vi: "Áp dụng", en: "the character acts differently because of the saying — concrete, visible actions" };
    case "awakening":
      return { vi: "Tỉnh thức", en: "the awakening: the visible change and a warm final image" };
  }
}

/** Clips per act: 1 hook, 1 turning (from 5 clips), 1–2 saying, 1–2 awakening; the rest split between mistake and application. */
export function quoteActPlan(shots: number, entry?: Pick<QuoteEntry, "format" | "text" | "misread"> | null): QuoteActSlot[] {
  const n = Math.max(QUOTE_MIN_SHOTS, Math.min(QUOTE_MAX_SHOTS, Math.round(shots) || QUOTE_DEFAULT_SHOTS));
  const format: QuoteFormat = entry?.format ?? "story";
  const long = entry ? wordCount(entry.text) > 18 || (format === "rethink" && Boolean(entry.misread)) : false;
  const turning = n >= 5 ? 1 : 0;
  const saying = n >= 6 && long ? 2 : 1;
  const awakening = n >= 12 ? 2 : 1;
  const rest = n - 1 - turning - saying - awakening;
  const apply = n >= 7 ? Math.round(rest * 0.45) : 0;
  const rising = Math.max(1, rest - apply);
  const counts: Array<[QuoteAct, number]> = [["hook", 1], ["rising", rising], ["turning", turning], ["saying", saying], ["apply", apply], ["awakening", awakening]];
  const out: QuoteActSlot[] = [];
  let at = 1;
  for (const [act, count] of counts) {
    if (count <= 0) continue;
    const t = actText(act, format);
    out.push({ act, from: at, to: at + count - 1, label_vi: t.vi, purpose_en: t.en });
    at += count;
  }
  return out;
}

// ---------- config and cast ----------

export type QuoteVoice = "narrator" | "elder" | "main";
export type QuoteDialect = "north" | "south";
export type QuoteFilming = "cinematic" | "phone";
export type QuoteTone = "warm" | "drama";

export interface QuoteStoryConfig {
  /** The story request (Vietnamese) — prefilled from the entry, editable. */
  request: string;
  quoteId?: string;
  /** A snapshot of the chosen entry (the server swaps in the library's current version). */
  quote?: QuoteEntry;
  names: Partial<Record<QuoteRole, string>>;
  /** Who speaks the saying: a narrator voice-over, an older character in dialogue, or the main character's inner voice. */
  voice: QuoteVoice;
  dialect: QuoteDialect;
  filming: QuoteFilming;
  /** 10-second clips: 4–12 (6 = 1 minute). */
  shots: number;
  tone: QuoteTone;
}

export const DEFAULT_QUOTE_STORY: QuoteStoryConfig = {
  request: "",
  names: {},
  voice: "narrator",
  dialect: "north",
  filming: "cinematic",
  shots: QUOTE_DEFAULT_SHOTS,
  tone: "warm",
};

type Gender = "female" | "male";

const ROLE_PROFILE: Record<QuoteRole, { age: string; isChild: boolean; female: { name: string; look: string; voice: string }; male: { name: string; look: string; voice: string }; fallback: Gender }> = {
  main: { age: "about 25", isChild: false, fallback: "male", female: { name: "Ngân", look: "Vietnamese young woman about 25, long dark hair, casual modern clothes", voice: "clear young adult female voice" }, male: { name: "Khoa", look: "Vietnamese young man about 25, short dark hair, casual modern clothes", voice: "clear young adult male voice" } },
  elder: { age: "about 70", isChild: false, fallback: "male", female: { name: "Bà Sáu", look: "Vietnamese woman about 70, grey hair in a low bun, áo bà ba or simple blouse", voice: "warm, slow older female voice" }, male: { name: "Ông Bảy", look: "Vietnamese man about 70, white hair, kind wrinkled face, simple shirt", voice: "warm, slow older male voice" } },
  parent: { age: "about 40", isChild: false, fallback: "female", female: { name: "Hiền", look: "Vietnamese woman about 40, shoulder-length hair, everyday clothes", voice: "warm adult female voice" }, male: { name: "Bình", look: "Vietnamese man about 42, short hair, everyday shirt", voice: "calm adult male voice" } },
  child: { age: "about 8", isChild: true, fallback: "female", female: { name: "Bống", look: "Vietnamese girl about 8, ponytail, school or home clothes", voice: "a real 8-year-old girl's voice" }, male: { name: "Tít", look: "Vietnamese boy about 8, short hair, school or home clothes", voice: "a real 8-year-old boy's voice" } },
  friend: { age: "about 25", isChild: false, fallback: "female", female: { name: "Nhi", look: "Vietnamese young woman about 25, shoulder-length hair, casual clothes", voice: "bright young female voice" }, male: { name: "Phúc", look: "Vietnamese young man about 25, casual clothes", voice: "friendly young male voice" } },
  colleague: { age: "about 30", isChild: false, fallback: "male", female: { name: "Hằng", look: "Vietnamese woman about 30, neat hair, office blouse", voice: "friendly adult female voice" }, male: { name: "Tú", look: "Vietnamese man about 30, glasses, office shirt", voice: "friendly adult male voice" } },
  boss: { age: "about 42", isChild: false, fallback: "female", female: { name: "Vân", look: "Vietnamese woman about 42, neat bob hair, blazer", voice: "calm, confident adult female voice" }, male: { name: "Long", look: "Vietnamese man about 45, short neat hair, business shirt", voice: "confident mid-low male voice" } },
  teacher: { age: "about 55", isChild: false, fallback: "male", female: { name: "Cô Mai", look: "Vietnamese woman about 55, glasses, neat áo dài or blouse", voice: "measured, warm teacher's voice" }, male: { name: "Thầy Định", look: "Vietnamese man about 55, greying hair, glasses, neat shirt", voice: "measured, warm teacher's voice" } },
};

/** Who each role is in the story text, from the words that name them. */
const GENDER_CUES: Partial<Record<QuoteRole, { female: RegExp; male: RegExp }>> = {
  main: {
    female: /(cô gái|cô bé|bé gái|cô sinh viên|cô nhân viên|cô học sinh|cô giáo trẻ|cô quản lý|cô thợ|người phụ nữ|nhà thiết kế cầu toàn|cô bạn|trưởng nhóm trẻ muốn|người quản lý trẻ chạy)/iu,
    male: /(chàng trai|cậu sinh viên|cậu học sinh|cậu học trò|cậu nhân viên|cậu thanh niên|cậu shipper|cậu game thủ|cậu vận động viên|cậu kỹ sư|cậu trưởng nhóm|người đàn ông|người kỹ sư|kỹ sư trẻ|kỹ sư kiểm định|kỹ sư giỏi|anh thợ|người thợ trẻ|ông chủ|chủ quán trẻ|chủ cửa hàng nhỏ|huấn luyện viên trẻ|bác sĩ trẻ)/iu,
  },
  parent: { female: /(người mẹ|bà mẹ|mẹ trẻ|hai mẹ con)/iu, male: /(người bố|người cha|hai bố con|bố cầm|bố giơ)/iu },
  child: { female: /(cô bé|bé gái|con gái)/iu, male: /(cậu bé|thằng bé|con trai)/iu },
  elder: { female: /(người bà|bà nội|bà ngoại|bà cụ|cụ bà|bà hàng xóm|người mẹ già|sư cô|(?<!\p{L})bà(?!\p{L}))/iu, male: /(người ông|ông nội|ông ngoại|ông cụ|cụ ông|ông thợ|người thợ già|vị sư già|bác bảo vệ|người ông)/iu },
  teacher: { female: /(cô giáo)/iu, male: /((?<!\p{L})thầy(?!\p{L}))/iu },
  boss: { female: /(cô quản lý|sếp nữ|chị quản lý)/iu, male: /(ông chủ|giám đốc chi nhánh mới|nhà sáng lập trẻ|người đàn ông thành đạt|người trưởng phòng)/iu },
  friend: { female: /(cô bạn|bạn gái|cô em)/iu, male: /(cậu bạn|người bạn thân|anh bạn)/iu },
  colleague: { female: /(đồng nghiệp nữ|cô đồng nghiệp)/iu, male: /(đồng nghiệp nam|anh đồng nghiệp|học việc)/iu },
};

/** Gender of each role in an entry: the earliest cue in the story text wins; else the role's default. */
export function quoteRoleGenders(q: Pick<QuoteEntry, "roles" | "hook" | "situation" | "mistake" | "turning" | "awakening" | "gender" | "seed">): Partial<Record<QuoteRole, Gender>> {
  const text = `${q.hook} ${q.situation} ${q.mistake} ${q.turning} ${q.awakening} ${q.seed ?? ""}`;
  const out: Partial<Record<QuoteRole, Gender>> = {};
  for (const role of q.roles) {
    const cues = GENDER_CUES[role];
    const f = cues ? text.search(cues.female) : -1;
    const m = cues ? text.search(cues.male) : -1;
    out[role] = q.gender?.[role] ?? (f >= 0 && (m < 0 || f < m) ? "female" : m >= 0 ? "male" : ROLE_PROFILE[role].fallback);
  }
  return out;
}

export function quoteOf(config: Pick<QuoteStoryConfig, "quoteId" | "quote">): QuoteEntry | undefined {
  return config.quote ?? findQuote(config.quoteId);
}

export interface QuoteCastMember {
  role: QuoteRole;
  name: string;
  label: string;
  appearance: string;
  voice: string;
  isChild: boolean;
}

/** The cast: the entry's roles (an older character joins when they speak the saying). */
export function quoteStoryCast(config: Pick<QuoteStoryConfig, "quoteId" | "quote" | "names" | "voice">): QuoteCastMember[] {
  const entry = quoteOf(config);
  const roles: QuoteRole[] = [...new Set(entry?.roles ?? (["main", "elder"] as QuoteRole[]))];
  if (config.voice === "elder" && !roles.includes("elder")) roles.push("elder");
  const genders = entry ? quoteRoleGenders({ ...entry, roles }) : {};
  return roles.map((role) => {
    const profile = ROLE_PROFILE[role];
    const g = genders[role] ?? profile.fallback;
    const look = profile[g];
    return {
      role,
      name: (config.names?.[role] ?? "").trim() || look.name,
      label: QUOTE_ROLE_LABEL[role],
      appearance: look.look,
      voice: look.voice,
      isChild: profile.isChild,
    };
  });
}

// ---------- brief, story idea, contract, seed ----------

const range = (s: QuoteActSlot) => (s.from === s.to ? `clip ${s.from}` : `clips ${s.from}–${s.to}`);
const rangeVi = (s: QuoteActSlot) => (s.from === s.to ? `shot ${s.from}` : `shot ${s.from}–${s.to}`);
const durationVi = (shots: number) => {
  const s = shots * 10;
  return `${Math.floor(s / 60) ? `${Math.floor(s / 60)} phút` : ""}${s % 60 ? `${Math.floor(s / 60) ? " " : ""}${s % 60} giây` : ""}`;
};

function briefVi(q: QuoteEntry): string[] {
  return [
    `📜 Lời xưa (${REGION_LABEL[q.region].vi} · ${KIND_LABEL[q.kind]} · ${FORMAT_LABEL[q.format].vi}): “${q.text}”`,
    `Xuất xứ: ${quoteOriginLine(q)} (${VERIFICATION_LABEL[q.verification].vi})`,
    `Ý nghĩa: ${q.meaning}`,
    q.misread ? `${q.verification === "misattributed" ? "Sự thật về nguồn gốc" : "Hiểu cho đúng"}: ${q.misread}` : "",
    ...(isSeedOnly(q)
      ? [`Gợi ý câu chuyện: ${q.seed}`, "(Kịch bản tự dựng đủ các nhịp: Hook → Sai lầm → Bước ngoặt → Lời xưa → Áp dụng → Tỉnh thức từ gợi ý này.)"]
      : [`Hook: ${q.hook}`, `Tình huống: ${q.situation}`, `Sai lầm: ${q.mistake}`, `Bước ngoặt: ${q.turning}`, `Tỉnh thức: ${q.awakening}`]),
    `Thông điệp: ${q.takeaway}`,
  ].filter(Boolean);
}

export function quoteRequestFromEntry(q: QuoteEntry): string {
  return briefVi(q).join("\n");
}

const hasBrief = (request: string) => /📜 Lời xưa/.test(request);

const VOICE_VI: Record<QuoteVoice, string> = {
  narrator: "giọng dẫn đọc nguyên văn câu nói và xuất xứ",
  elder: "một người lớn tuổi trong truyện nói câu ấy bằng lời thoại tự nhiên",
  main: "nhân vật chính nhớ lại câu ấy bằng giọng nội tâm",
};

export function quoteStoryIdea(config: QuoteStoryConfig): string {
  const q = quoteOf(config);
  const cast = quoteStoryCast(config);
  const plan = quoteActPlan(config.shots, q);
  const request = config.request.trim();
  return [
    request || (q ? quoteRequestFromEntry(q) : ""),
    q && request && !hasBrief(request) ? briefVi(q).join("\n") : "",
    `Nhân vật: ${cast.map((c) => `${c.name} (${c.label})`).join(", ")}.`,
    `Thể loại: video Lời xưa – Chuyện nay, ${config.shots} shot × 10 giây = ${durationVi(config.shots)}.`,
    `Cấu trúc: ${plan.map((s) => `${s.label_vi} (${rangeVi(s)})`).join(" → ")}.`,
    `Câu nói: ${VOICE_VI[config.voice]}; không viết chữ lên hình — phụ đề câu nói được chèn khi dựng.`,
    `Không khí: ${config.tone === "warm" ? "ấm áp, nhẹ nhàng, đời thường" : "chân thực, giàu cảm xúc"}; giọng ${config.dialect === "north" ? "miền Bắc" : "miền Nam"}; quay ${config.filming === "phone" ? "kiểu điện thoại cầm tay" : "kiểu điện ảnh"}.`,
  ].filter(Boolean).join("\n");
}

function spokenLines(q: QuoteEntry): string {
  const attribution = quoteSpokenAttribution(q);
  if (q.verification === "misattributed") {
    return `«${q.text}» — then: «${attribution[0]!.toUpperCase()}${attribution.slice(1)}. ${q.misread ?? ""}»`;
  }
  if (q.format === "rethink" && q.misread) return `«${q.text}» (— ${attribution}) — then the correction: «${q.misread}»`;
  return `«${q.text}» — then the attribution «${attribution}»`;
}

/** Hard contract for the script writer and the storyboard (English, like the other directives). */
export function quoteStoryDirective(raw: QuoteStoryConfig | null | undefined): string {
  const config = normalizeQuoteStory(raw);
  if (!config) return "";
  const q = quoteOf(config);
  const cast = quoteStoryCast(config);
  const plan = quoteActPlan(config.shots, q);
  const saying = plan.find((s) => s.act === "saying")!;
  const seconds = config.shots * 10;
  const hasChild = cast.some((c) => c.isChild);
  const elder = cast.find((c) => c.role === "elder");
  const main = cast.find((c) => c.role === "main") ?? cast[0]!;
  const voiceRule =
    config.voice === "narrator"
      ? `WHO SPEAKS IT: a warm narrator voice-over (same regional accent) in ${range(saying)} — it is the ONLY voice-over in the video; characters keep natural dialogue elsewhere.`
      : config.voice === "elder"
        ? `WHO SPEAKS IT: ${elder?.name ?? "the older character"} says it in natural dialogue in ${range(saying)} (for a folk saying: "ông bà mình có câu…"; for a named author: "… đã nói / có câu…"). No narrator.`
        : `WHO SPEAKS IT: ${main.name}'s inner voice (voice-over in ${main.name}'s own voice, as a memory) in ${range(saying)}; no other narrator.`;
  return [
    `TIMELESS SAYING STORY (HARD): "Lời xưa – Chuyện nay" — a short modern Vietnamese story of ${config.shots} clips × 10 s = ${seconds} s in which ONE saying is the answer. The viewer recognises an everyday moment, sees the mistake, hears the saying at the turning point and leaves with a visible change.`,
    `- CAST (exact names, every clip uses them): ${cast.map((c) => `${c.name} = ${c.label} (${ROLE_PROFILE[c.role].age}; voice: ${c.voice})`).join("; ")}.`,
    ...(q
      ? [
          `- THE SAYING (${REGION_LABEL[q.region].en}, ${KIND_LABEL[q.kind]}; ${VERIFICATION_LABEL[q.verification].en}): «${q.text}»${q.original ? ` (original: ${q.original})` : ""}. ${q.verification === "misattributed" ? `Commonly credited to ${q.author}, wrongly; true origin: ${q.source}` : `Source: ${q.author ? `${q.author} — ` : ""}${q.source}`}. Meaning: ${q.meaning}`,
          `- SPEAK IT VERBATIM in ${range(saying)}: ${spokenLines(q)}. Never paraphrase, shorten, "improve" or translate it differently; never credit it to anyone else; never invent a source.`,
          ...(q.verification === "misattributed"
            ? [`- THINK-AGAIN FORMAT (misattributed): the hook may show a character quoting it with the famous name; the saying clip must say plainly that ${q.author} did not say it and give the true origin as written above. The idea can still be good — the lesson includes checking sources.`]
            : q.format === "rethink"
              ? ["- THINK-AGAIN FORMAT: the hook/mistake clips show the saying used the wrong way; the saying clip gives its right reading (as written above); the change at the end follows the right reading."]
              : []),
          isSeedOnly(q)
            ? `- THE STORY (write it from this idea): ${q.seed} Build every beat of the clip plan from it — an ordinary present-day Vietnamese setting (${q.place}), a sympathetic mistake that grows, one concrete turning point, the saying, then visible actions and a warm final image. Keep the cast to the roles above; invent no famous person. Modern reading (for the closing image, not a lecture): "${q.takeaway}"`
            : `- THE STORY: HOOK: ${q.hook} SITUATION: ${q.situation} MISTAKE: ${q.mistake}. TURNING POINT: ${q.turning}. AFTER THE SAYING: ${q.awakening}. Modern reading (for the closing image, not a lecture): "${q.takeaway}"`,
        ]
      : ["- THE SAYING comes from the request: speak it verbatim exactly as the request writes it, with the attribution the request gives; if the request gives no reliable source, attribute it to no one (\"người xưa có câu\")."]),
    `- ${voiceRule}`,
    `- CLIP PLAN: ${plan.map((s) => `${range(s)} = ${s.label_vi.toUpperCase()} — ${s.purpose_en}`).join(" · ")}. One clear beat per clip; each clip ends on a state that leads into the next.`,
    `- NEVER SHOW THE AUTHOR: no actor, portrait, statue, AI likeness or imitated voice of ${q?.author ? q.author : "any real historical or famous person"} — ordinary present-day Vietnamese people live the story; the author exists only as a name in the spoken attribution.`,
    ...(q?.region === "doanh_nhan"
      ? [`- REAL BUSINESS FIGURE: never imply that ${q.author} endorses this video, a product, a brand or an investment; no real company logos or products; no financial advice — the story is about everyday life and character.`]
      : []),
    "- NO TEXT ON SCREEN: do not render the saying or any words as text in the video (AI text, especially Vietnamese diacritics, is unreliable). In the saying clip(s) hold a calm composition with clean negative space (sky, a wall, window light, a table top) where the editor will add the caption.",
    "- SHOW, DON'T PREACH: the saying is the only \"lesson line\"; nobody lectures or explains it at length; after it, the change is shown in actions and short natural dialogue.",
    `- DIALOGUE: natural spoken Vietnamese with the right address terms for each relation (cháu/ông bà, con/bố mẹ, anh/chị/em, thầy/cô–em)${config.dialect === "south" ? "; Southern accent and particles (\"dạ\", \"nha\", \"hông\")" : "; Northern accent (\"dạ\", \"vâng ạ\")"}. At most three short turns per 10-second clip; leave room for silence.`,
    `- ACTING & PACING: restrained, real performance; the hook starts in the tension; the saying clip slows down — the camera holds on a face, the light gets warmer. ${config.tone === "warm" ? "Tone: warm, gentle, everyday." : "Tone: honest and emotional, never cruel."}`,
    "- PLACES: at most three locations; write each in location_blueprints and reuse it — the same place must look identical every time.",
    "- RESPECT & SAFETY: treat religious sources with reverence (no comedy around the Buddha or scripture, no depiction of the Buddha, no monk or nun as a joke); respect every nation and culture, no stereotypes; no political leaders, no current politics; no violence, no humiliation, no dangerous stunts.",
    ...(hasChild ? ["- CHILDREN ON SCREEN: the child is never frightened on purpose, never in danger, never the target of anger, always supervised by an adult."] : []),
    `- ${config.filming === "phone" ? "FILMING: a handheld smartphone look — natural light, steady, close to the people." : "FILMING: cinematic but intimate — motivated natural light, medium and close shots, a warm final image."}`,
    `- SOCIAL POSTS: the caption carries the saying in quotation marks with its correct attribution${q?.verification === "misattributed" ? ` and the note that it is often wrongly credited to ${q.author}` : ""}, one question to the viewer, and the AI-generated label.`,
  ].join("\n");
}

export function quoteRoomSeed(config: QuoteStoryConfig): string {
  const q = quoteOf(config);
  const plan = quoteActPlan(config.shots, q);
  return [
    quoteStoryIdea(config),
    `Yêu cầu: video ngắn đúng ${config.shots} shot × 10 giây, chia theo kế hoạch: ${plan.map((s) => `${s.label_vi} ${rangeVi(s)}`).join("; ")}.`,
    "Câu nói phải được nói NGUYÊN VĂN ở đoạn \"Lời xưa\", kèm xuất xứ đúng; không sửa chữ, không gán cho người khác. Không dựng hình hay giọng của danh nhân — người đời thường sống câu nói ấy. Không viết chữ lên hình.",
    "Không giảng giải: câu nói là lời duy nhất mang tính bài học; sau đó thay đổi được thể hiện bằng hành động.",
    "Tôn trọng tôn giáo, văn hóa các nước; không chính trị; không bạo lực.",
  ].join("\n");
}

// ---------- normalisation ----------

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function quoteSnapshot(raw: unknown, quoteId: unknown): QuoteEntry | undefined {
  if (!raw || typeof raw !== "object" || typeof quoteId !== "string") return undefined;
  const r = raw as Record<string, unknown>;
  const region = QUOTE_REGIONS.includes(r.region as QuoteRegion) ? (r.region as QuoteRegion) : undefined;
  const format = QUOTE_FORMATS.includes(r.format as QuoteFormat) ? (r.format as QuoteFormat) : undefined;
  const verification = ["source", "folk", "paraphrase", "misattributed"].includes(r.verification as string) ? (r.verification as QuoteEntry["verification"]) : undefined;
  const kind = Object.keys(KIND_LABEL).includes(r.kind as string) ? (r.kind as QuoteEntry["kind"]) : undefined;
  const theme = QUOTE_THEMES.some((t) => t.id === r.theme) ? (r.theme as QuoteTheme) : undefined;
  const roles = Array.isArray(r.roles) ? r.roles.filter((x): x is QuoteRole => QUOTE_ROLES.includes(x as QuoteRole)) : [];
  if (!region || !format || !verification || !kind || !theme || !roles.length || r.id !== quoteId) return undefined;
  const entry: QuoteEntry = {
    id: clip(r.id, 60),
    region,
    kind,
    verification,
    format,
    theme,
    text: clip(r.text, 400),
    ...(clip(r.original, 400) ? { original: clip(r.original, 400) } : {}),
    author: clip(r.author, 80),
    source: clip(r.source, 300),
    meaning: clip(r.meaning, 400),
    ...(clip(r.misread, 500) ? { misread: clip(r.misread, 500) } : {}),
    hook: clip(r.hook, 300),
    situation: clip(r.situation, 400),
    mistake: clip(r.mistake, 400),
    turning: clip(r.turning, 400),
    awakening: clip(r.awakening, 400),
    takeaway: clip(r.takeaway, 200),
    questions: Array.isArray(r.questions) ? r.questions.map((x) => clip(x, 200)).filter(Boolean).slice(0, 3) : [],
    roles: [...new Set(roles)],
    place: clip(r.place, 160),
    ...(r.gender && typeof r.gender === "object"
      ? { gender: Object.fromEntries(Object.entries(r.gender as Record<string, unknown>).filter(([k, v]) => QUOTE_ROLES.includes(k as QuoteRole) && (v === "female" || v === "male"))) as QuoteEntry["gender"] }
      : {}),
    ...(clip(r.seed, 400) ? { seed: clip(r.seed, 400) } : {}),
    ...(QUOTE_FIELDS.includes(r.field as QuoteField) ? { field: r.field as QuoteField } : {}),
  };
  const story = isSeedOnly(entry) || [entry.hook, entry.situation, entry.mistake, entry.turning, entry.awakening].every(Boolean);
  return entry.text && entry.source && story ? entry : undefined;
}

export function normalizeQuoteStory(raw: unknown): QuoteStoryConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const names: Partial<Record<QuoteRole, string>> = {};
  if (r.names && typeof r.names === "object") {
    for (const role of QUOTE_ROLES) {
      const value = clip((r.names as Record<string, unknown>)[role], 30);
      if (value) names[role] = value;
    }
  }
  const shots = Math.max(QUOTE_MIN_SHOTS, Math.min(QUOTE_MAX_SHOTS, Math.round(Number(r.shots)) || QUOTE_DEFAULT_SHOTS));
  const quoteId = typeof r.quoteId === "string" ? r.quoteId : undefined;
  const quote = quoteSnapshot(r.quote, quoteId) ?? findQuote(quoteId);
  return {
    request: clip(r.request, 4000),
    ...(quote ? { quoteId: quote.id, quote } : {}),
    names,
    voice: pick(r.voice, ["narrator", "elder", "main"] as const, "narrator"),
    dialect: pick(r.dialect, ["north", "south"] as const, "north"),
    filming: pick(r.filming, ["cinematic", "phone"] as const, "cinematic"),
    shots,
    tone: pick(r.tone, ["warm", "drama"] as const, "warm"),
  };
}

/** Server: the client's snapshot is replaced by the library's current version (accuracy lives in the library). */
export function withLibraryQuote<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const quote = typeof r.quoteId === "string" ? findQuote(r.quoteId) : undefined;
  return (quote ? { ...r, quote } : raw) as T;
}

export function labelQuoteStoryPosts(posts: Parameters<typeof labelAiSocialPosts>[0]): void {
  labelAiSocialPosts(posts);
}
