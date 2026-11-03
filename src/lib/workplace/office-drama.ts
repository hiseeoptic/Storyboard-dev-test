// ============================================================
// CHUYỆN CÔNG SỞ — educational workplace-culture dramas for managers and
// employees, built like "Chuyện nhà" (a library case → a card config → a hard
// contract for the planner → a writers'-room seed): 6–18 clips (default 12 =
// 2 minutes), four movements:
//   HOOK → leo thang → CAO TRÀO → bước ngoặt + BÀI HỌC → TỈNH THỨC.
// Each case also carries two discussion questions and prints as a training
// handout (officeTrainingCase) for HR / L&D sessions.
// The research behind each practice is in ./office-techniques.ts.
// ============================================================

import { labelAiSocialPosts } from "../kids/cute-kids.ts";
import { familyActPlan, type FamilyAct, type FamilyActSlot } from "../family/family-drama.ts";
import { AUDIENCE_LABEL, OFFICE_ROLE_LABEL, type OfficeAudience, type OfficeLesson, type OfficeRole } from "./office-types.ts";
import { OFFICE_THEMES } from "./office-techniques.ts";
import { OFFICE_FEEDBACK_LESSONS, OFFICE_LEADERSHIP_LESSONS } from "./lessons/feedback-leadership.ts";
import { OFFICE_TEAM_LESSONS, OFFICE_NEWCOMER_LESSONS } from "./lessons/team-newcomers.ts";
import { OFFICE_MEETING_LESSONS, OFFICE_HOURS_LESSONS } from "./lessons/meetings-hours.ts";
import { OFFICE_GENERATION_LESSONS, OFFICE_FAIRNESS_LESSONS } from "./lessons/generations-fairness.ts";
import { OFFICE_MISTAKE_LESSONS, OFFICE_CLIENT_LESSONS } from "./lessons/mistakes-clients.ts";
import { OFFICE_RESPECT_LESSONS, OFFICE_CHANGE_LESSONS } from "./lessons/respect-change.ts";

export { AUDIENCE_LABEL, OFFICE_ROLE_LABEL, type OfficeAudience, type OfficeLesson, type OfficeRole } from "./office-types.ts";
export { OFFICE_THEMES, OFFICE_TECHNIQUES, type OfficeTheme } from "./office-techniques.ts";

/** The whole library, grouped by shelf in OFFICE_THEMES order. */
export const OFFICE_LESSONS: OfficeLesson[] = [
  ...OFFICE_FEEDBACK_LESSONS,
  ...OFFICE_LEADERSHIP_LESSONS,
  ...OFFICE_TEAM_LESSONS,
  ...OFFICE_NEWCOMER_LESSONS,
  ...OFFICE_MEETING_LESSONS,
  ...OFFICE_HOURS_LESSONS,
  ...OFFICE_GENERATION_LESSONS,
  ...OFFICE_FAIRNESS_LESSONS,
  ...OFFICE_MISTAKE_LESSONS,
  ...OFFICE_CLIENT_LESSONS,
  ...OFFICE_RESPECT_LESSONS,
  ...OFFICE_CHANGE_LESSONS,
];

const BY_ID = new Map(OFFICE_LESSONS.map((l) => [l.id, l]));
export const OFFICE_ROLES: readonly OfficeRole[] = ["staff", "manager", "director", "colleague", "newbie", "hr", "client", "senior"];
export const OFFICE_AUDIENCES: readonly OfficeAudience[] = ["manager", "staff", "all"];

export function findOfficeLesson(id: string | undefined | null): OfficeLesson | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Lessons of a shelf and/or audience ("all" audience lessons count for both sides). */
export function officeLessonsFor(filter: { theme?: string | null; audience?: OfficeAudience | null } = {}): OfficeLesson[] {
  return OFFICE_LESSONS.filter((l) => (!filter.theme || l.theme === filter.theme) && (!filter.audience || l.audience === filter.audience));
}

/** The shelves with how many lessons each holds. */
export function officeThemesWithCounts(): Array<{ id: string; label: string; count: number }> {
  return OFFICE_THEMES.map((t) => ({ ...t, count: OFFICE_LESSONS.filter((l) => l.theme === t.id).length }));
}

export function officeThemeLabel(lesson: Pick<OfficeLesson, "theme">): string {
  return OFFICE_THEMES.find((t) => t.id === lesson.theme)?.label ?? "";
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Lessons matching every word of the query (accents optional), titles first. */
export function searchOfficeLessons(query: string, pool: readonly OfficeLesson[] = OFFICE_LESSONS): OfficeLesson[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const text = (l: OfficeLesson) => fold(`${l.title} ${l.hook} ${l.situation} ${l.pattern} ${l.method} ${l.takeaway} ${officeThemeLabel(l)} ${AUDIENCE_LABEL[l.audience].vi}`);
  const hits = pool.filter((l) => words.every((w) => text(l).includes(w)));
  const inTitle = (l: OfficeLesson) => words.every((w) => fold(l.title).includes(w));
  return [...hits.filter(inTitle), ...hits.filter((l) => !inTitle(l))];
}

/** A case the creator has not made yet, at random; undefined when the pool is all used. */
export function pickUnusedOfficeLesson(pool: readonly OfficeLesson[], used: Iterable<string>, random: () => number = Math.random): OfficeLesson | undefined {
  const done = new Set(used);
  const fresh = pool.filter((l) => !done.has(l.id));
  if (!fresh.length) return undefined;
  return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
}

export type OfficeDialect = "north" | "south";
export type OfficeFilming = "cinematic" | "phone";
export type OfficeTone = "drama" | "warm";
export type OfficeWorkplace = "office" | "startup" | "bank" | "factory" | "retail" | "agency";

export const OFFICE_WORKPLACES: readonly OfficeWorkplace[] = ["office", "startup", "bank", "factory", "retail", "agency"];

export const WORKPLACE_LABEL: Record<OfficeWorkplace, { vi: string; en: string; attire: string }> = {
  office: { vi: "🏢 Văn phòng công ty", en: "a mid-size Vietnamese company office (open-plan desks, a glass-walled meeting room, a small pantry)", attire: "smart-casual office clothes" },
  startup: { vi: "🚀 Startup công nghệ", en: "a young Vietnamese tech startup (open space, whiteboards covered in notes, laptops, a bean-bag corner)", attire: "casual t-shirt or shirt with jeans" },
  bank: { vi: "🏦 Ngân hàng / tài chính", en: "a Vietnamese bank branch and its back office (service counters, a formal meeting room)", attire: "neat bank uniform, shirt or blouse with a name badge" },
  factory: { vi: "🏭 Nhà máy / xưởng", en: "a Vietnamese factory (production floor with safety signs, a shift office, a canteen)", attire: "factory work uniform with safety shoes; hard hat and gloves on the floor" },
  retail: { vi: "🛍️ Cửa hàng / chuỗi bán lẻ", en: "a Vietnamese retail store (shop floor, a service counter, a small staff room)", attire: "store uniform polo with a name badge" },
  agency: { vi: "🎨 Agency sáng tạo", en: "a Vietnamese creative agency (colourful studio, mood boards, a meeting corner)", attire: "creative casual clothes" },
};

export interface OfficeDramaConfig {
  /** The story request (Vietnamese) — prefilled from the case, editable. */
  request: string;
  lessonId?: string;
  /** A snapshot of the chosen case (the server swaps in the library's current version). */
  lesson?: OfficeLesson;
  /** Character names by role; empty roles use the defaults. */
  names: Partial<Record<OfficeRole, string>>;
  workplace: OfficeWorkplace;
  dialect: OfficeDialect;
  filming: OfficeFilming;
  /** 10-second clips: 6–18 (12 = 2 minutes). */
  shots: number;
  /** A warm narrator voices the awakening and the takeaway at the end. */
  narrator: boolean;
  /** "drama" = tense, emotional; "warm" = gentle, everyday office humour. */
  tone: OfficeTone;
}

export const OFFICE_MIN_SHOTS = 6;
export const OFFICE_MAX_SHOTS = 18;
export const OFFICE_DEFAULT_SHOTS = 12;

export const DEFAULT_OFFICE_NAMES: Record<OfficeRole, string> = {
  staff: "Thư",
  manager: "Khải",
  director: "Phượng",
  colleague: "Duy",
  newbie: "Ngọc",
  hr: "Trang",
  client: "Hùng",
  senior: "Bích",
};

export const DEFAULT_OFFICE_DRAMA: OfficeDramaConfig = {
  request: "",
  names: {},
  workplace: "office",
  dialect: "north",
  filming: "cinematic",
  shots: OFFICE_DEFAULT_SHOTS,
  narrator: true,
  tone: "drama",
};

/** How each role looks and sounds by default (the defaults match the default names). */
const ROLE_PROFILE: Record<OfficeRole, { age: string; person: string; voice: string; ownClothes?: string }> = {
  staff: { age: "about 27", person: "Vietnamese woman about 27, shoulder-length dark hair", voice: "clear young adult female voice" },
  manager: { age: "about 38", person: "Vietnamese man about 38, short neat hair", voice: "confident mid-low adult male voice" },
  director: { age: "about 48", person: "Vietnamese woman about 48, elegant short hair", voice: "calm, authoritative mature female voice", ownClothes: "elegant business attire" },
  colleague: { age: "about 30", person: "Vietnamese man about 30, glasses", voice: "friendly adult male voice" },
  newbie: { age: "about 22", person: "Vietnamese young woman about 22, ponytail", voice: "bright, slightly shy young female voice" },
  hr: { age: "about 34", person: "Vietnamese woman about 34, hair in a neat bun, staff lanyard", voice: "warm, measured adult female voice" },
  client: { age: "about 45", person: "Vietnamese man about 45, businesslike", voice: "firm mature male voice", ownClothes: "business shirt and trousers, a visitor badge" },
  senior: { age: "about 47", person: "Vietnamese woman about 47, short permed hair", voice: "mature female voice, practical and direct" },
};

const DEFAULT_ROLES: OfficeRole[] = ["staff", "manager"];

export function officeLessonOf(config: Pick<OfficeDramaConfig, "lessonId" | "lesson">): OfficeLesson | undefined {
  return config.lesson ?? findOfficeLesson(config.lessonId);
}

export interface OfficeCastMember {
  role: OfficeRole;
  name: string;
  /** Vietnamese role label ("Nhân viên", "Trưởng phòng"…). */
  label: string;
  appearance: string;
  voice: string;
}

/** The cast the story needs: the case's roles, else a staff member and a manager. */
export function officeDramaCast(config: Pick<OfficeDramaConfig, "lessonId" | "lesson" | "names" | "workplace">): OfficeCastMember[] {
  const roles = officeLessonOf(config)?.roles ?? DEFAULT_ROLES;
  const attire = WORKPLACE_LABEL[config.workplace]?.attire ?? WORKPLACE_LABEL.office.attire;
  return [...new Set(roles)].map((role) => ({
    role,
    name: (config.names?.[role] ?? "").trim() || DEFAULT_OFFICE_NAMES[role],
    label: OFFICE_ROLE_LABEL[role],
    appearance: `${ROLE_PROFILE[role].person}, ${ROLE_PROFILE[role].ownClothes ?? attire}`,
    voice: ROLE_PROFILE[role].voice,
  }));
}

const OFFICE_ACT_TEXT: Record<FamilyAct, string> = {
  hook: "the hook line or image in the first 2 seconds — drop the viewer straight into the workplace tension, no slow intro",
  rising: "the problem escalates: show the harmful pattern on BOTH sides, each with a real pressure underneath (a deadline, losing face, job security, wanting recognition); every clip raises the stakes by one step",
  climax: "the peak — a sharp sentence in a meeting, a resignation letter, a lost client, a long silence; never violence, never public humiliation played for laughs",
  turning: "the turning point: something makes one person stop and see the other (a document, a number, an overheard sentence, a memory)",
  lesson: "the practice acted out step by step in dialogue and action — both people take part; a manager or an employee watching can copy it tomorrow",
  awakening: "the awakening: the visible, mutual change days later at work, a warm final image",
};

/** The same four-movement split as "Chuyện nhà", with workplace purposes. */
export function officeActPlan(shots: number): FamilyActSlot[] {
  return familyActPlan(shots).map((s) => ({ ...s, purpose_en: OFFICE_ACT_TEXT[s.act] }));
}

const range = (s: FamilyActSlot) => (s.from === s.to ? `clip ${s.from}` : `clips ${s.from}–${s.to}`);
const rangeVi = (s: FamilyActSlot) => (s.from === s.to ? `shot ${s.from}` : `shot ${s.from}–${s.to}`);
const durationVi = (shots: number) => {
  const s = shots * 10;
  return `${Math.floor(s / 60)} phút${s % 60 ? ` ${s % 60} giây` : ""}`;
};

function lessonBriefVi(lesson: OfficeLesson): string[] {
  return [
    `💼 Case công sở (${officeThemeLabel(lesson)} · ${AUDIENCE_LABEL[lesson.audience].vi}): ${lesson.title}`,
    `Hook: ${lesson.hook}`,
    `Tình huống: ${lesson.situation}`,
    `Leo thang: ${lesson.conflict}`,
    `Cao trào: ${lesson.climax}`,
    `Bước ngoặt: ${lesson.turning}`,
    `Bài học thể hiện từng bước: ${lesson.lesson}`,
    `Tỉnh thức: ${lesson.awakening}`,
    `Câu chốt: ${lesson.takeaway}`,
    `Kiểu sai cần thể hiện trước: ${lesson.pattern}. Cách làm: ${lesson.method}.`,
  ];
}

/** The case brief prefilled into the card's request box. */
export function officeRequestFromLesson(lesson: OfficeLesson): string {
  return lessonBriefVi(lesson).join("\n");
}

const hasBrief = (request: string) => /💼 Case công sở/.test(request);

/** A training handout for HR / L&D: the case, the practice, the research note, the discussion questions. */
export function officeTrainingCase(lesson: OfficeLesson): string {
  return [
    `CASE ĐÀO TẠO VĂN HÓA DOANH NGHIỆP — ${lesson.title}`,
    `Chủ đề: ${officeThemeLabel(lesson)} · Đối tượng: ${AUDIENCE_LABEL[lesson.audience].vi}`,
    "",
    `Tình huống: ${lesson.situation}`,
    `Diễn biến: ${lesson.conflict}.`,
    `Cao trào: ${lesson.climax}.`,
    `Bước ngoặt: ${lesson.turning}.`,
    "",
    `Cách làm đúng (${lesson.method}):`,
    ...lesson.lesson.split(/;\s*/).filter(Boolean).map((step, i) => `${i + 1}. ${step.trim()}`),
    "",
    `Kết quả: ${lesson.awakening}.`,
    `Thông điệp: ${lesson.takeaway}`,
    "",
    `Kiểu sai cần tránh: ${lesson.pattern}.`,
    `Căn cứ: ${lesson.basis}`,
    "",
    "Câu hỏi thảo luận:",
    ...lesson.questions.map((q, i) => `${i + 1}. ${q}`),
  ].join("\n");
}

/** The story idea for the form (Vietnamese). */
export function officeDramaStoryIdea(config: OfficeDramaConfig): string {
  const lesson = officeLessonOf(config);
  const cast = officeDramaCast(config);
  const plan = officeActPlan(config.shots);
  const request = config.request.trim();
  return [
    request || (lesson ? officeRequestFromLesson(lesson) : ""),
    lesson && request && !hasBrief(request) ? lessonBriefVi(lesson).join("\n") : "",
    `Nhân vật: ${cast.map((c) => `${c.name} (${c.label})`).join(", ")}.`,
    `Thể loại: phim ngắn đào tạo văn hóa doanh nghiệp cho sếp và nhân viên, ${config.shots} shot × 10 giây = ${durationVi(config.shots)}.`,
    `Nơi làm việc: ${WORKPLACE_LABEL[config.workplace].vi.replace(/^\S+\s/, "")}.`,
    `Cấu trúc: ${plan.map((s) => `${s.label_vi} (${rangeVi(s)})`).join(" → ")}.`,
    config.narrator ? "Kết: giọng dẫn ấm áp nói câu chốt tỉnh thức ở shot cuối (≤ 25 từ)." : "Kết: nhân vật tự nói câu chốt bằng một câu tự nhiên, không giảng.",
    `Không khí: ${config.tone === "warm" ? "ấm áp, nhẹ nhàng, có chút hài công sở" : "chân thực, căng thẳng thật của công sở"}; giọng ${config.dialect === "north" ? "miền Bắc" : "miền Nam"}; quay ${config.filming === "phone" ? "kiểu điện thoại cầm tay" : "kiểu điện ảnh"}.`,
  ].filter(Boolean).join("\n");
}

function addressTerms(dialect: OfficeDialect): string {
  const south = dialect === "south";
  return [
    "address by age and seniority as in real Vietnamese workplaces: a junior says \"em\" and calls an older colleague or the manager \"anh\"/\"chị\" (by that person's gender); the manager calls juniors \"em\" or by name",
    "the director is called \"anh\"/\"chị\" + name (\"sếp\" only casually among staff, never in a formal meeting); colleagues of the same age use names or \"mình\"/\"bạn\"",
    `with a client, staff say "em" / "bên em" and call the client "anh"/"chị"${south ? "; Southern warmth (\"dạ\", \"nha\", \"hông\")" : "; Northern politeness (\"dạ\", \"vâng ạ\")"}`,
    "everyday office words like deadline, KPI, file, meeting are fine — the rest is natural Vietnamese",
  ].join("; ");
}

/** Hard contract for the script writer and the storyboard (English, like the other directives). */
export function officeDramaDirective(raw: OfficeDramaConfig | null | undefined): string {
  const config = normalizeOfficeDrama(raw);
  if (!config) return "";
  const lesson = officeLessonOf(config);
  const cast = officeDramaCast(config);
  const plan = officeActPlan(config.shots);
  const seconds = config.shots * 10;
  const last = plan[plan.length - 1]!;
  const workplace = WORKPLACE_LABEL[config.workplace];
  return [
    `WORKPLACE CULTURE DRAMA (HARD): an educational short drama for managers and employees — ${config.shots} clips × 10 s = ${seconds} s. Every viewer, boss or staff, should recognise their own workplace, feel the tension, see the mistake on both sides, learn ONE concrete practice and leave with an awakening they can use at work tomorrow.`,
    `- CAST (exact names, every clip uses them): ${cast.map((c) => `${c.name} = ${c.label} (${ROLE_PROFILE[c.role].age}; voice: ${c.voice})`).join("; ")}.`,
    `- WORKPLACE: ${workplace.en}; wardrobe: ${workplace.attire}.${lesson ? ` The case's own places win when it names them ("${lesson.place}").` : ""} At most three locations of this workplace; write each in location_blueprints and reuse it — the same room must look identical every time we return to it.`,
    `- FOUR MOVEMENTS, EXACT CLIP PLAN: ${plan.map((s) => `${range(s)} = ${s.label_vi.toUpperCase()} — ${s.purpose_en}`).join(" · ")}. One clear dramatic beat per clip; each clip ends on a physical and emotional state that leads into the next.`,
    ...(lesson
      ? [
          `- THE CASE "${lesson.title}" (trains: ${AUDIENCE_LABEL[lesson.audience].en.toLowerCase()}; practice: ${lesson.method}). HOOK: ${lesson.hook} SITUATION: ${lesson.situation} RISING: ${lesson.conflict}. CLIMAX: ${lesson.climax}. TURNING POINT: ${lesson.turning}. THE PRACTICE, STEP BY STEP (act it out across the lesson clips — one step per clip where possible): ${lesson.lesson}. AWAKENING: ${lesson.awakening}. Harmful pattern shown first: ${lesson.pattern}.`,
          `- TAKEAWAY IDEA: "${lesson.takeaway}"`,
        ]
      : ["- THE CASE comes from the request: show one harmful workplace pattern on both sides, then one concrete, respectful practice acted out step by step, then a mutual change."]),
    "- NO VILLAIN: the manager and the employee (or the colleagues) each have a real pressure under the behaviour — a deadline, a target, fear of losing face or the job, wanting to be seen. Show the harmful pattern on BOTH sides first; the change is MUTUAL and visible. Nobody is fired, humiliated or 'taught a lesson' on screen; when a company rule was broken, the consequence happens through the company's proper process, off screen, never as revenge.",
    "- SHOW, DON'T PREACH: the practice lives in what people say and do differently. No HR lecture, no slide of rules, nobody names the method out loud; the method name may appear only in the social caption.",
    config.narrator
      ? `- AWAKENING VOICE-OVER: only in ${range(last)} — a warm narrator (same regional accent) speaks the takeaway in Vietnamese, ≤ 25 words, as the final image holds${lesson ? `; the idea: "${lesson.takeaway}"` : ""}. It is the ONLY voice-over in the video.`
      : `- AWAKENING LINE: in ${range(last)} one character says the takeaway in one natural, warm sentence — never a lecture. No narrator.`,
    `- DIALOGUE: natural spoken Vietnamese of real colleagues — ${addressTerms(config.dialect)}. At most three short turns and two main speakers per 10-second clip; leave room for reactions, pauses and silence.`,
    `- ACTING: real, restrained adult performance — eyes, hands, breath, a pen put down, a laptop closed; anger that comes from pressure, hurt that is held back; nobody overacts. Every listener reacts live. ${config.tone === "warm" ? "Tone: warm and gentle with everyday office humour; the tension stays light." : "Tone: honest and tense like a real office; never cruel."}`,
    "- PACING: the hook clip starts IN the tension (the hook line in the first 2 seconds); the rising clips each add one new pressure; the climax is the highest tension; after the turning point the rhythm slows down, the light gets warmer, the camera holds longer on faces.",
    "- RESPECT & SAFETY: no real company, brand, logo, product or real person — generic signage only; no physical violence, no throwing things at people, no screaming insults or slurs; harassment or bullying is NEVER shown explicitly — at most one uncomfortable moment is implied (a message on a phone screen, a look, someone left out), no touching, no sexual content — and the story is about speaking up, support and the proper channel (HR, the internal rules); no drunkenness on screen (a refused toast is fine); no stereotypes about generations, regions, genders, disabilities or professions; no legal, medical or financial claims beyond 'the company's rules' or 'the law' in general terms.",
    `- ${config.filming === "phone" ? "FILMING: a handheld smartphone look — natural office light, steady, close to the people, a real Vietnamese workplace." : "FILMING: cinematic but realistic corporate-training drama — motivated natural light, mostly medium and two-shots, close-ups at the climax and the awakening, a real Vietnamese workplace."}`,
    "- SOCIAL POSTS: the caption names the lesson and the practice behind it in one line, ends with a question to the viewer (\"Nếu là sếp / nhân viên, bạn sẽ làm gì?\"), and carries the AI-generated label.",
  ].join("\n");
}

/** Short Vietnamese brief for the writers' room idea box. */
export function officeDramaRoomSeed(config: OfficeDramaConfig): string {
  const plan = officeActPlan(config.shots);
  return [
    officeDramaStoryIdea(config),
    `Yêu cầu: phim ngắn đào tạo văn hóa doanh nghiệp đúng ${config.shots} shot × 10 giây, chia theo kế hoạch: ${plan.map((s) => `${s.label_vi} ${rangeVi(s)}`).join("; ")}. Mỗi shot một nhịp rõ ràng, tối đa 3 lượt thoại ngắn, chừa chỗ cho phản ứng và khoảng lặng.`,
    "Không có nhân vật phản diện: sếp và nhân viên (hoặc đồng nghiệp) đều có áp lực thật; thể hiện cái sai của cả hai trước, rồi cách làm đúng được diễn ra từng bước bằng hành động và lời thoại tự nhiên — không giảng giải, không đọc nội quy.",
    "Kết là sự tỉnh thức: thay đổi nhìn thấy được và đến từ cả hai phía, khung hình cuối ấm áp nơi làm việc.",
    "An toàn: không dùng tên công ty, thương hiệu thật; không bạo lực, không lăng mạ; quấy rối hay bắt nạt không bao giờ được diễn trực tiếp — chỉ gợi một khoảnh khắc khó chịu rồi tập trung vào việc lên tiếng và báo đúng kênh; không say xỉn trên hình; không định kiến thế hệ, vùng miền, giới tính.",
  ].join("\n");
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A case snapshot from the client, kept only when complete and matching the picked id. */
function lessonSnapshot(raw: unknown, lessonId: unknown): OfficeLesson | undefined {
  if (!raw || typeof raw !== "object" || typeof lessonId !== "string") return undefined;
  const r = raw as Record<string, unknown>;
  const roles = Array.isArray(r.roles) ? r.roles.filter((x): x is OfficeRole => OFFICE_ROLES.includes(x as OfficeRole)) : [];
  const audience = OFFICE_AUDIENCES.includes(r.audience as OfficeAudience) ? (r.audience as OfficeAudience) : undefined;
  if (!roles.length || !audience || r.id !== lessonId) return undefined;
  const questions = Array.isArray(r.questions) ? r.questions.map((q) => clip(q, 240)).filter(Boolean).slice(0, 4) : [];
  const lesson: OfficeLesson = {
    id: clip(r.id, 60),
    theme: clip(r.theme, 40),
    audience,
    title: clip(r.title, 160),
    hook: clip(r.hook, 300),
    situation: clip(r.situation, 600),
    conflict: clip(r.conflict, 700),
    climax: clip(r.climax, 500),
    turning: clip(r.turning, 400),
    lesson: clip(r.lesson, 1200),
    awakening: clip(r.awakening, 600),
    takeaway: clip(r.takeaway, 200),
    pattern: clip(r.pattern, 120),
    method: clip(r.method, 200),
    basis: clip(r.basis, 700),
    questions,
    roles: [...new Set(roles)],
    place: clip(r.place, 160),
  };
  const required = [lesson.title, lesson.hook, lesson.situation, lesson.conflict, lesson.climax, lesson.turning, lesson.lesson, lesson.awakening, lesson.takeaway, lesson.method];
  return required.every(Boolean) ? lesson : undefined;
}

/** Normalise a config coming from the client (unknown values dropped, numbers clamped). */
export function normalizeOfficeDrama(raw: unknown): OfficeDramaConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const names: Partial<Record<OfficeRole, string>> = {};
  if (r.names && typeof r.names === "object") {
    for (const role of OFFICE_ROLES) {
      const value = clip((r.names as Record<string, unknown>)[role], 30);
      if (value) names[role] = value;
    }
  }
  const shots = Math.max(OFFICE_MIN_SHOTS, Math.min(OFFICE_MAX_SHOTS, Math.round(Number(r.shots)) || OFFICE_DEFAULT_SHOTS));
  const lessonId = typeof r.lessonId === "string" ? r.lessonId : undefined;
  const lesson = lessonSnapshot(r.lesson, lessonId) ?? findOfficeLesson(lessonId);
  return {
    request: clip(r.request, 4000),
    ...(lesson ? { lessonId: lesson.id, lesson } : {}),
    names,
    workplace: pick(r.workplace, OFFICE_WORKPLACES, "office"),
    dialect: pick(r.dialect, ["north", "south"] as const, "north"),
    filming: pick(r.filming, ["cinematic", "phone"] as const, "cinematic"),
    shots,
    narrator: r.narrator !== false,
    tone: pick(r.tone, ["drama", "warm"] as const, "drama"),
  };
}

/** Server: the client's case snapshot is replaced by the library's current version. */
export function withLibraryOfficeLesson<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const lesson = typeof r.lessonId === "string" ? findOfficeLesson(r.lessonId) : undefined;
  return (lesson ? { ...r, lesson } : raw) as T;
}

/** Social posts: the AI-generated label (same as the other reel formats). */
export function labelOfficeDramaPosts(posts: Parameters<typeof labelAiSocialPosts>[0]): void {
  labelAiSocialPosts(posts);
}
