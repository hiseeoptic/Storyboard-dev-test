// ============================================================
// CHUYỆN NHÀ — educational family dramas for adults: couples, mother-in-law
// & daughter-in-law, sister-in-law & the husband's younger sibling. Built like
// the "Bé cưng" reel (a library lesson → a card config → a hard contract for
// the planner → a writers'-room seed), but longer (6–18 clips, default 15 =
// 2 min 30) and told in four movements:
//   HOOK → leo thang → CAO TRÀO → bước ngoặt + BÀI HỌC → TỈNH THỨC.
// The research behind each lesson is in ./lesson-types.ts and the lessons.
// ============================================================

import { labelAiSocialPosts } from "../kids/cute-kids.ts";
import { RELATION_LABEL, ROLE_LABEL, type FamilyLesson, type FamilyRelation, type FamilyRole } from "./lesson-types.ts";
import { COUPLE_LESSONS } from "./lessons/couple.ts";
import { IN_LAW_LESSONS } from "./lessons/in-laws.ts";
import { SIBLING_IN_LAW_LESSONS } from "./lessons/siblings-in-law.ts";
import { milLibrary } from "./lessons/mil/index.ts";
import { MIL_THEMES } from "./techniques.ts";

export { RELATION_LABEL, ROLE_LABEL, type FamilyLesson, type FamilyRelation, type FamilyRole } from "./lesson-types.ts";

export { MIL_THEMES, type MilTheme } from "./techniques.ts";

// The mother-in-law shelf is the first 10 lessons + the themed library (≈200).
export const FAMILY_LESSONS: FamilyLesson[] = [...COUPLE_LESSONS, ...milLibrary(IN_LAW_LESSONS), ...SIBLING_IN_LAW_LESSONS];

/** Library shelves per relation (only the in-law library is shelved so far). */
export const FAMILY_THEMES: Partial<Record<FamilyRelation, ReadonlyArray<{ id: string; label: string }>>> = { mil_dil: MIL_THEMES };

const BY_ID = new Map(FAMILY_LESSONS.map((l) => [l.id, l]));
export const FAMILY_RELATIONS: readonly FamilyRelation[] = ["couple", "mil_dil", "sil"];
export const FAMILY_ROLES: readonly FamilyRole[] = ["wife", "husband", "mother_in_law", "father_in_law", "sister_in_law", "brother_in_law", "child", "baby"];

export function findFamilyLesson(id: string | undefined | null): FamilyLesson | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function familyLessonsFor(relation: FamilyRelation, theme?: string | null): FamilyLesson[] {
  return FAMILY_LESSONS.filter((l) => l.relation === relation && (!theme || l.theme === theme));
}

/** The shelves of a relation with how many lessons each holds (empty when it has none). */
export function familyThemesFor(relation: FamilyRelation): Array<{ id: string; label: string; count: number }> {
  const pool = familyLessonsFor(relation);
  return (FAMILY_THEMES[relation] ?? []).map((t) => ({ ...t, count: pool.filter((l) => l.theme === t.id).length })).filter((t) => t.count > 0);
}

/** The label of a lesson's shelf ("" when it has none). */
export function familyThemeLabel(lesson: Pick<FamilyLesson, "relation" | "theme">): string {
  return FAMILY_THEMES[lesson.relation]?.find((t) => t.id === lesson.theme)?.label ?? "";
}

/**
 * A lesson the creator has not made yet, at random, from `pool`. Returns
 * undefined when every lesson in the pool is already used (the card then
 * offers to start the shelf over).
 */
export function pickUnusedFamilyLesson(pool: readonly FamilyLesson[], used: Iterable<string>, random: () => number = Math.random): FamilyLesson | undefined {
  const done = new Set(used);
  const fresh = pool.filter((l) => !done.has(l.id));
  if (!fresh.length) return undefined;
  return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))];
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Lessons matching every word of the query (accents optional), titles first. */
export function searchFamilyLessons(query: string, relation?: FamilyRelation): FamilyLesson[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pool = FAMILY_LESSONS.filter((l) => !relation || l.relation === relation);
  const text = (l: FamilyLesson) => fold(`${l.title} ${l.hook} ${l.situation} ${l.pattern} ${l.method} ${l.takeaway} ${familyThemeLabel(l)}`);
  const hits = pool.filter((l) => words.every((w) => text(l).includes(w)));
  const inTitle = (l: FamilyLesson) => words.every((w) => fold(l.title).includes(w));
  return [...hits.filter(inTitle), ...hits.filter((l) => !inTitle(l))];
}

export type FamilyDialect = "north" | "south";
export type FamilyFilming = "cinematic" | "phone";
export type FamilyTone = "drama" | "warm";

export interface FamilyDramaConfig {
  /** The story request (Vietnamese) — prefilled from the lesson, editable. */
  request: string;
  relation: FamilyRelation;
  lessonId?: string;
  /** A snapshot of the chosen lesson (the server swaps in the library's current version). */
  lesson?: FamilyLesson;
  /** Character names by role; empty roles use the defaults. */
  names: Partial<Record<FamilyRole, string>>;
  dialect: FamilyDialect;
  filming: FamilyFilming;
  /** 10-second clips: 6–18 (15 = 2 min 30). */
  shots: number;
  /** A warm narrator voices the awakening and the takeaway at the end. */
  narrator: boolean;
  /** "drama" = tense, emotional; "warm" = gentle, everyday humour. */
  tone: FamilyTone;
}

export const FAMILY_MIN_SHOTS = 6;
export const FAMILY_MAX_SHOTS = 18;
export const FAMILY_DEFAULT_SHOTS = 15;

export const DEFAULT_FAMILY_NAMES: Record<FamilyRole, string> = {
  wife: "Lan",
  husband: "Minh",
  mother_in_law: "Bà Hạnh",
  father_in_law: "Ông Quang",
  sister_in_law: "Thảo",
  brother_in_law: "Tuấn",
  child: "Bin",
  baby: "Bé Su",
};

export const DEFAULT_FAMILY_DRAMA: FamilyDramaConfig = {
  request: "",
  relation: "couple",
  names: {},
  dialect: "north",
  filming: "cinematic",
  shots: FAMILY_DEFAULT_SHOTS,
  narrator: true,
  tone: "drama",
};

/** How each role looks and sounds by default (a lived-in Vietnamese family). */
const ROLE_PROFILE: Record<FamilyRole, { age: string; looks: string; isChild: boolean; voice: string }> = {
  wife: { age: "about 30", looks: "Vietnamese woman about 30, shoulder-length dark hair, natural everyday look", isChild: false, voice: "warm, clear adult female voice" },
  husband: { age: "about 33", looks: "Vietnamese man about 33, short dark hair, everyday office worker look", isChild: false, voice: "calm, mid-low adult male voice" },
  mother_in_law: { age: "about 60", looks: "Vietnamese woman about 60, greying hair in a low bun, simple home clothes", isChild: false, voice: "mature female voice, a little husky, measured" },
  father_in_law: { age: "about 63", looks: "Vietnamese man about 63, grey short hair, simple shirt", isChild: false, voice: "older male voice, slow and gentle" },
  sister_in_law: { age: "about 24", looks: "Vietnamese young woman about 24, long hair, casual student/office look", isChild: false, voice: "bright young adult female voice" },
  brother_in_law: { age: "about 26", looks: "Vietnamese young man about 26, casual look", isChild: false, voice: "young adult male voice" },
  child: { age: "about 6", looks: "Vietnamese child about 6, home clothes", isChild: true, voice: "a real 6-year-old child's voice" },
  baby: { age: "under 1", looks: "Vietnamese baby under one year old, always held or cared for by an adult", isChild: true, voice: "baby sounds only, no words" },
};

const RELATION_ROLES: Record<FamilyRelation, FamilyRole[]> = {
  couple: ["wife", "husband"],
  mil_dil: ["wife", "mother_in_law", "husband"],
  sil: ["wife", "sister_in_law", "husband"],
};

export function familyLessonOf(config: Pick<FamilyDramaConfig, "lessonId" | "lesson">): FamilyLesson | undefined {
  return config.lesson ?? findFamilyLesson(config.lessonId);
}

export interface FamilyCastMember {
  role: FamilyRole;
  name: string;
  /** Vietnamese role label ("Vợ", "Mẹ chồng"…). */
  label: string;
  appearance: string;
  isChild: boolean;
  voice: string;
}

/** The cast the story needs: the lesson's roles, else the relation's. */
export function familyDramaCast(config: Pick<FamilyDramaConfig, "relation" | "lessonId" | "lesson" | "names">): FamilyCastMember[] {
  const roles = familyLessonOf(config)?.roles ?? RELATION_ROLES[config.relation];
  return [...new Set(roles)].map((role) => ({
    role,
    name: (config.names?.[role] ?? "").trim() || DEFAULT_FAMILY_NAMES[role],
    label: ROLE_LABEL[role],
    appearance: ROLE_PROFILE[role].looks,
    isChild: ROLE_PROFILE[role].isChild,
    voice: ROLE_PROFILE[role].voice,
  }));
}

export type FamilyAct = "hook" | "rising" | "climax" | "turning" | "lesson" | "awakening";

export interface FamilyActSlot {
  act: FamilyAct;
  from: number;
  to: number;
  label_vi: string;
  purpose_en: string;
}

const ACT_TEXT: Record<FamilyAct, { vi: string; en: string }> = {
  hook: { vi: "Hook", en: "the hook line or image in the first 2 seconds — drop the viewer straight into the tension, no slow intro" },
  rising: { vi: "Leo thang", en: "the conflict escalates: show the harmful pattern on BOTH sides, each with a real need underneath; every clip raises the stakes by one step" },
  climax: { vi: "Cao trào", en: "the emotional peak — a sharp sentence, tears, a door, a silence; never violence or humiliation" },
  turning: { vi: "Bước ngoặt", en: "the turning point: something makes one person stop and see the other (an object, a memory, a child's question, a pause)" },
  lesson: { vi: "Bài học", en: "the technique acted out step by step in dialogue and action — both people take part; the viewer can copy it" },
  awakening: { vi: "Tỉnh thức", en: "the awakening: the visible, mutual change days later, a warm final image" },
};

/**
 * Clips per movement for a story of `shots` clips: 1 hook, 1–2 climax, 1
 * turning, 1–2 awakening; the rest split between the rising conflict (~45%)
 * and the lesson (~55%) — the lesson gets the most room.
 */
export function familyActPlan(shots: number): FamilyActSlot[] {
  const n = Math.max(FAMILY_MIN_SHOTS, Math.min(FAMILY_MAX_SHOTS, Math.round(shots) || FAMILY_DEFAULT_SHOTS));
  const climax = n >= 12 ? 2 : 1;
  const awakening = n >= 10 ? 2 : 1;
  const rest = n - 1 - climax - 1 - awakening;
  const rising = Math.max(1, Math.floor(rest * 0.45));
  const lesson = Math.max(1, rest - rising);
  const counts: Array<[FamilyAct, number]> = [["hook", 1], ["rising", rising], ["climax", climax], ["turning", 1], ["lesson", lesson], ["awakening", awakening]];
  const out: FamilyActSlot[] = [];
  let at = 1;
  for (const [act, count] of counts) {
    out.push({ act, from: at, to: at + count - 1, label_vi: ACT_TEXT[act].vi, purpose_en: ACT_TEXT[act].en });
    at += count;
  }
  return out;
}

const range = (s: FamilyActSlot) => (s.from === s.to ? `clip ${s.from}` : `clips ${s.from}–${s.to}`);
const rangeVi = (s: FamilyActSlot) => (s.from === s.to ? `shot ${s.from}` : `shot ${s.from}–${s.to}`);

function lessonBriefVi(lesson: FamilyLesson): string[] {
  return [
    `📚 Bài học (${RELATION_LABEL[lesson.relation].vi}): ${lesson.title}`,
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

/** The lesson brief prefilled into the card's request box. */
export function familyRequestFromLesson(lesson: FamilyLesson): string {
  return lessonBriefVi(lesson).join("\n");
}

const hasBrief = (request: string) => /📚 Bài học/.test(request);

/** The story idea for the form (Vietnamese). */
export function familyDramaStoryIdea(config: FamilyDramaConfig): string {
  const lesson = familyLessonOf(config);
  const cast = familyDramaCast(config);
  const plan = familyActPlan(config.shots);
  const request = config.request.trim();
  return [
    request || (lesson ? familyRequestFromLesson(lesson) : ""),
    lesson && request && !hasBrief(request) ? lessonBriefVi(lesson).join("\n") : "",
    `Nhân vật: ${cast.map((c) => `${c.name} (${c.label})`).join(", ")}.`,
    `Thể loại: phim ngắn giáo dục gia đình, ${config.shots} shot × 10 giây = ${Math.floor((config.shots * 10) / 60)} phút ${(config.shots * 10) % 60 ? `${(config.shots * 10) % 60} giây` : ""}`.trim() + ".",
    `Cấu trúc: ${plan.map((s) => `${s.label_vi} (${rangeVi(s)})`).join(" → ")}.`,
    config.narrator ? "Kết: giọng dẫn ấm áp nói câu chốt tỉnh thức ở shot cuối (≤ 25 từ)." : "Kết: nhân vật tự nói câu chốt bằng một câu tự nhiên, không giảng.",
    `Không khí: ${config.tone === "warm" ? "ấm áp, nhẹ nhàng, có chút hài đời thường" : "chân thực, giàu cảm xúc, có căng thẳng thật"}; giọng ${config.dialect === "north" ? "miền Bắc" : "miền Nam"}; quay ${config.filming === "phone" ? "kiểu điện thoại gia đình" : "kiểu điện ảnh"}.`,
  ].filter(Boolean).join("\n");
}

/** Address terms per relation, so dialogue sounds like a real Vietnamese family. */
function addressTerms(relation: FamilyRelation, dialect: FamilyDialect): string {
  const south = dialect === "south";
  switch (relation) {
    case "couple":
      return `spouses call each other "anh" / "em"${south ? " (Southern warmth: \"nghen\", \"hông\", \"dạ\")" : ""}; with the child they say "bố"/"mẹ"${south ? " or \"ba\"/\"mẹ\"" : ""}`;
    case "mil_dil":
      return `the daughter-in-law calls her mother-in-law "mẹ" and says "con" (with "dạ"/"vâng"${south ? "/\"dạ\"" : ""}); the mother-in-law says "mẹ" and calls her "con"; the husband says "mẹ" and "con" with his mother, "anh"/"em" with his wife`;
    case "sil":
      return `the elder brother's wife says "chị" and calls the husband's younger sibling "em"; the sibling says "em" and calls her "chị"; the brother says "anh" to his sibling, "anh"/"em" to his wife`;
  }
}

/** Hard contract for the script writer and the storyboard (English, like the other directives). */
export function familyDramaDirective(raw: FamilyDramaConfig | null | undefined): string {
  const config = normalizeFamilyDrama(raw);
  if (!config) return "";
  const lesson = familyLessonOf(config);
  const cast = familyDramaCast(config);
  const plan = familyActPlan(config.shots);
  const seconds = config.shots * 10;
  const last = plan[plan.length - 1]!;
  const hasChild = cast.some((c) => c.isChild);
  return [
    `FAMILY LESSON DRAMA (HARD): an educational short drama for adults about ${RELATION_LABEL[config.relation].en.toLowerCase()} — ${config.shots} clips × 10 s = ${seconds} s. Every viewer should recognise their own family, feel the tension, see the mistake, learn ONE concrete technique and leave with an awakening.`,
    `- CAST (exact names, every clip uses them): ${cast.map((c) => `${c.name} = ${c.label} (${ROLE_PROFILE[c.role].age}; voice: ${c.voice})`).join("; ")}.`,
    `- FOUR MOVEMENTS, EXACT CLIP PLAN: ${plan.map((s) => `${range(s)} = ${s.label_vi.toUpperCase()} — ${s.purpose_en}`).join(" · ")}. One clear dramatic beat per clip; each clip ends on a physical and emotional state that leads into the next.`,
    ...(lesson
      ? [
          `- THE LESSON "${lesson.title}" (approach: ${lesson.method}). HOOK: ${lesson.hook} SITUATION: ${lesson.situation} RISING: ${lesson.conflict}. CLIMAX: ${lesson.climax}. TURNING POINT: ${lesson.turning}. THE TECHNIQUE, STEP BY STEP (act it out across the lesson clips — one step per clip where possible): ${lesson.lesson}. AWAKENING: ${lesson.awakening}. Harmful pattern shown first: ${lesson.pattern}.`,
          `- TAKEAWAY IDEA: "${lesson.takeaway}"`,
        ]
      : ["- THE LESSON comes from the request: show one harmful pattern on both sides, then one concrete, respectful technique acted out step by step, then a mutual change."]),
    "- NO VILLAIN: both sides have a real, sympathetic need under the anger (to be respected, to be needed, to feel safe, to not lose someone). Show the harmful pattern on BOTH sides first; the change at the end is MUTUAL and visible — never one person winning and the other humiliated or 'taught a lesson'.",
    "- SHOW, DON'T PREACH: the lesson lives in actions and natural dialogue (what they say differently, what they do differently). No character lectures; nobody names a psychological method out loud; no explanatory monologues.",
    config.narrator
      ? `- AWAKENING VOICE-OVER: only in ${range(last)} — a warm narrator (same regional accent) speaks the takeaway in Vietnamese, ≤ 25 words, as the final image holds${lesson ? `; the idea: "${lesson.takeaway}"` : ""}. It is the ONLY voice-over in the video.`
      : `- AWAKENING LINE: in ${range(last)} one character says the takeaway in one natural, warm sentence — never a lecture. No narrator.`,
    `- DIALOGUE: natural spoken Vietnamese of real adults — ${addressTerms(config.relation, config.dialect)}. At most three short turns and two main speakers per 10-second clip; leave room for reactions, pauses and silence — silence is a tool in drama.`,
    `- ACTING: real, restrained adult performance — micro-expressions, eyes, hands, breath; anger that comes from hurt, tears that are held back; nobody overacts. Every listener reacts live. ${config.tone === "warm" ? "Tone: warm and gentle with everyday humour, the tension stays light." : "Tone: honest and emotional; the tension is real but never cruel."}`,
    "- PACING: the hook clip starts IN the tension (the hook line in the first 2 seconds); the rising clips each add one new pressure; the climax is the highest emotion; after the turning point the rhythm slows down, the light gets warmer, the camera holds longer on faces.",
    "- PLACES: at most three locations (e.g. the kitchen, the living room, the bedroom of one home); write each in location_blueprints and reuse it — the same room must look identical every time we return to it.",
    "- RESPECT & SAFETY: honour Vietnamese family values (respect for elders, filial love) together with healthy boundaries; no stereotypes (no 'evil mother-in-law', no gender blame); no physical violence, no hitting, no throwing objects at people, no threats, no screaming insults, no humiliation played for laughs, no alcohol abuse scene; no medical, legal or psychological claims — the method name may appear only in the social caption. This format does not depict abuse; a story that would need violence or coercion is out of scope.",
    ...(hasChild ? ["- CHILDREN ON SCREEN: the child or baby is never the target of anger, never frightened on purpose and never left alone; a child may witness tension only from a safe distance and is comforted; the baby is always held or watched by an adult."] : []),
    `- ${config.filming === "phone" ? "FILMING: a family smartphone look — natural light, handheld but steady, real lived-in Vietnamese home." : "FILMING: cinematic but intimate — natural motivated light, mostly medium and two-shots with close-ups at the climax and the awakening, a real lived-in Vietnamese home."}`,
    "- SOCIAL POSTS: the caption names the lesson and the approach behind it in one line, ends with a question to the viewer, and carries the AI-generated label.",
  ].join("\n");
}

/** Short Vietnamese brief for the writers' room idea box. */
export function familyDramaRoomSeed(config: FamilyDramaConfig): string {
  const plan = familyActPlan(config.shots);
  return [
    familyDramaStoryIdea(config),
    `Yêu cầu: phim ngắn giáo dục gia đình đúng ${config.shots} shot × 10 giây, chia theo kế hoạch: ${plan.map((s) => `${s.label_vi} ${rangeVi(s)}`).join("; ")}. Mỗi shot một nhịp rõ ràng, tối đa 3 lượt thoại ngắn, chừa chỗ cho phản ứng và khoảng lặng.`,
    "Không có nhân vật phản diện: cả hai phía đều có nhu cầu thật; thể hiện cái sai của cả hai trước, rồi cách làm đúng được diễn ra từng bước bằng hành động và lời thoại tự nhiên — không giảng giải.",
    "Kết là sự tỉnh thức: thay đổi nhìn thấy được và đến từ cả hai phía, khung hình cuối ấm áp.",
    "An toàn: không bạo lực, không đánh, không ném đồ vào người, không đe dọa, không lăng mạ; tôn trọng gia đình Việt Nam và ranh giới lành mạnh; không khẳng định y khoa/tâm lý.",
  ].join("\n");
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** A lesson snapshot from the client, kept only when complete and matching the picked id. */
function lessonSnapshot(raw: unknown, lessonId: unknown): FamilyLesson | undefined {
  if (!raw || typeof raw !== "object" || typeof lessonId !== "string") return undefined;
  const r = raw as Record<string, unknown>;
  const relation = FAMILY_RELATIONS.includes(r.relation as FamilyRelation) ? (r.relation as FamilyRelation) : undefined;
  const roles = Array.isArray(r.roles) ? r.roles.filter((x): x is FamilyRole => FAMILY_ROLES.includes(x as FamilyRole)) : [];
  if (!relation || !roles.length || r.id !== lessonId) return undefined;
  const lesson: FamilyLesson = {
    id: clip(r.id, 60),
    relation,
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
    method: clip(r.method, 160),
    basis: clip(r.basis, 600),
    roles: [...new Set(roles)],
    place: clip(r.place, 160),
    ...(clip(r.theme, 40) ? { theme: clip(r.theme, 40) } : {}),
  };
  const required = [lesson.title, lesson.hook, lesson.situation, lesson.conflict, lesson.climax, lesson.turning, lesson.lesson, lesson.awakening, lesson.takeaway, lesson.method];
  return required.every(Boolean) ? lesson : undefined;
}

/** Normalise a config coming from the client (unknown values dropped, numbers clamped). */
export function normalizeFamilyDrama(raw: unknown): FamilyDramaConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(v as T) ? (v as T) : fallback);
  const relation = pick(r.relation, FAMILY_RELATIONS, DEFAULT_FAMILY_DRAMA.relation);
  const names: Partial<Record<FamilyRole, string>> = {};
  if (r.names && typeof r.names === "object") {
    for (const role of FAMILY_ROLES) {
      const value = clip((r.names as Record<string, unknown>)[role], 30);
      if (value) names[role] = value;
    }
  }
  const shots = Math.max(FAMILY_MIN_SHOTS, Math.min(FAMILY_MAX_SHOTS, Math.round(Number(r.shots)) || FAMILY_DEFAULT_SHOTS));
  const lessonId = typeof r.lessonId === "string" ? r.lessonId : undefined;
  const lesson = lessonSnapshot(r.lesson, lessonId) ?? findFamilyLesson(lessonId);
  return {
    request: clip(r.request, 4000),
    relation: lesson?.relation ?? relation,
    ...(lesson ? { lessonId: lesson.id, lesson } : {}),
    names,
    dialect: pick(r.dialect, ["north", "south"] as const, "north"),
    filming: pick(r.filming, ["cinematic", "phone"] as const, "cinematic"),
    shots,
    narrator: r.narrator !== false,
    tone: pick(r.tone, ["drama", "warm"] as const, "drama"),
  };
}

/** Server: the client's lesson snapshot is replaced by the library's current version. */
export function withLibraryFamilyLesson<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const lesson = typeof r.lessonId === "string" ? findFamilyLesson(r.lessonId) : undefined;
  return (lesson ? { ...r, lesson } : raw) as T;
}

/** Social posts: the AI-generated label (same as the other reel formats). */
export function labelFamilyDramaPosts(posts: Parameters<typeof labelAiSocialPosts>[0]): void {
  labelAiSocialPosts(posts);
}
