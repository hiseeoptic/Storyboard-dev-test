// ============================================================
// KHO DẠY CON — parenting lessons told through everyday cute-kid moments.
// Each lesson is a relatable situation, the kid's behaviour, the parent's
// respectful technique, a one-line takeaway for the narrator/caption and a
// mild "ineffective" reaction for the optional A/B format (never hitting,
// yelling, threats or shaming). Techniques follow well-known programmes:
// Positive Discipline (Nelsen), emotion coaching (Gottman), "How to Talk So
// Kids Will Listen" and "Siblings Without Rivalry" (Faber & Mazlish),
// Montessori, Harvard's serve and return, CASEL, growth mindset (Dweck),
// Whole-Brain Child / No-Drama Discipline (Siegel & Bryson), Good Inside,
// RIE, Love and Logic, Conscious Discipline, Triple P, Hunt Gather Parent,
// Japanese-style self-reliance, Ehon reading and UNICEF's positive parenting
// tips. The situations come from everyday Vietnamese family life.
// The data lives in ./lessons/*; this index is server-side and lazy-loaded
// on the client (the card imports it when the "Dạy con" panel opens).
// ============================================================

import type { KidAge } from "./cute-kids.ts";
import { LESSON_PILLARS, type LessonPillar, type ParentingLesson } from "./lesson-pillars.ts";
import { CORE_LESSONS } from "./lessons/core.ts";
import { FEELINGS_LESSONS } from "./lessons/feelings.ts";
import { DAILY_LIFE_LESSONS } from "./lessons/daily-life.ts";
import { CONDUCT_LESSONS } from "./lessons/conduct.ts";
import { PEOPLE_LESSONS } from "./lessons/people.ts";
import { MIND_AND_WORLD_LESSONS } from "./lessons/mind-and-world.ts";
import { SEASONS_AND_OUTINGS_LESSONS } from "./lessons/seasons-and-outings.ts";
import { INNER_WORLD_LESSONS } from "./lessons/inner-world.ts";
import { CLOSENESS_LESSONS } from "./lessons/closeness.ts";
import { HOME_RHYTHM_LESSONS } from "./lessons/home-rhythm.ts";
import { GROWING_UP_LESSONS } from "./lessons/growing-up.ts";
import { SPEAKING_AND_BEHAVING_LESSONS } from "./lessons/speaking-and-behaving.ts";
import { FAIRNESS_LESSONS } from "./lessons/fairness.ts";
import { SCHOOL_MONEY_IDEAS_LESSONS } from "./lessons/school-money-ideas.ts";
import { NATURE_AND_PETS_LESSONS } from "./lessons/nature-and-pets.ts";
import { OCCASIONS_AND_OUTINGS_LESSONS } from "./lessons/occasions-and-outings.ts";
import { PLAY_AND_TRAVEL_LESSONS } from "./lessons/play-and-travel.ts";
import { OLDER_INNER_WORLD_LESSONS } from "./lessons/older-inner-world.ts";
import { OLDER_DAILY_LIFE_LESSONS } from "./lessons/older-daily-life.ts";
import { OLDER_CONDUCT_LESSONS } from "./lessons/older-conduct.ts";
import { OLDER_PEOPLE_LESSONS } from "./lessons/older-people.ts";
import { OLDER_MIND_AND_WORLD_LESSONS } from "./lessons/older-mind-and-world.ts";
import { OLDER_PRETEEN_AND_OUTINGS_LESSONS } from "./lessons/older-preteen-and-outings.ts";
import { OLDER_MORE_DAILY_LESSONS } from "./lessons/older-more-daily.ts";
import { OLDER_MORE_CONDUCT_LESSONS } from "./lessons/older-more-conduct.ts";
import { OLDER_MORE_WORLD_LESSONS } from "./lessons/older-more-world.ts";
import { TEEN_INNER_WORLD_LESSONS } from "./lessons/teen-inner-world.ts";
import { TEEN_DAILY_LIFE_LESSONS } from "./lessons/teen-daily-life.ts";
import { TEEN_CONDUCT_LESSONS } from "./lessons/teen-conduct.ts";
import { TEEN_PEOPLE_LESSONS } from "./lessons/teen-people.ts";
import { TEEN_MIND_AND_WORLD_LESSONS } from "./lessons/teen-mind-and-world.ts";
import { TEEN_YEARS_AND_OUTINGS_LESSONS } from "./lessons/teen-years-and-outings.ts";

export { LESSON_PILLARS, PILLAR_GROUPS, pillarLabel, type LessonPillar, type ParentingLesson } from "./lesson-pillars.ts";

export const PARENTING_LESSONS: ParentingLesson[] = [
  ...CORE_LESSONS,
  ...FEELINGS_LESSONS,
  ...DAILY_LIFE_LESSONS,
  ...CONDUCT_LESSONS,
  ...PEOPLE_LESSONS,
  ...MIND_AND_WORLD_LESSONS,
  ...SEASONS_AND_OUTINGS_LESSONS,
  ...INNER_WORLD_LESSONS,
  ...CLOSENESS_LESSONS,
  ...HOME_RHYTHM_LESSONS,
  ...GROWING_UP_LESSONS,
  ...SPEAKING_AND_BEHAVING_LESSONS,
  ...FAIRNESS_LESSONS,
  ...SCHOOL_MONEY_IDEAS_LESSONS,
  ...NATURE_AND_PETS_LESSONS,
  ...OCCASIONS_AND_OUTINGS_LESSONS,
  ...PLAY_AND_TRAVEL_LESSONS,
  ...OLDER_INNER_WORLD_LESSONS,
  ...OLDER_DAILY_LIFE_LESSONS,
  ...OLDER_CONDUCT_LESSONS,
  ...OLDER_PEOPLE_LESSONS,
  ...OLDER_MIND_AND_WORLD_LESSONS,
  ...OLDER_PRETEEN_AND_OUTINGS_LESSONS,
  ...OLDER_MORE_DAILY_LESSONS,
  ...OLDER_MORE_CONDUCT_LESSONS,
  ...OLDER_MORE_WORLD_LESSONS,
  ...TEEN_INNER_WORLD_LESSONS,
  ...TEEN_DAILY_LIFE_LESSONS,
  ...TEEN_CONDUCT_LESSONS,
  ...TEEN_PEOPLE_LESSONS,
  ...TEEN_MIND_AND_WORLD_LESSONS,
  ...TEEN_YEARS_AND_OUTINGS_LESSONS,
];

const BY_ID = new Map(PARENTING_LESSONS.map((l) => [l.id, l]));

export function findLesson(id: string | undefined | null): ParentingLesson | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Lessons for one pillar written for the kid's age (the library is sorted by age group). */
export function lessonsFor(pillar: LessonPillar, age: KidAge): ParentingLesson[] {
  return PARENTING_LESSONS.filter((l) => l.pillar === pillar && l.ages.includes(age));
}

/** How many lessons the library holds for each age. */
export function lessonCountByAge(age: KidAge): number {
  return PARENTING_LESSONS.filter((l) => l.ages.includes(age)).length;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

const startsWord = (text: string, phrase: string) => new RegExp(`(?:^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);

/**
 * Lessons matching the query (accents optional): the whole phrase first
 * ("li xi" → lì xì), otherwise every word at the start of a word; title
 * matches come first.
 */
export function searchLessons(query: string, age?: KidAge): ParentingLesson[] {
  const q = fold(query).replace(/\s+/g, " ").trim();
  if (!q) return [];
  const pool = PARENTING_LESSONS.filter((l) => !age || l.ages.includes(age)).map((l) => ({
    lesson: l,
    title: fold(l.title),
    text: fold(`${l.title} ${l.situation} ${l.behavior} ${l.takeaway} ${l.method} ${LESSON_PILLARS.find((p) => p.id === l.pillar)?.label ?? ""}`),
  }));
  const words = q.split(" ");
  const phrase = pool.filter((e) => startsWord(e.text, q));
  const hits = phrase.length ? phrase : pool.filter((e) => words.every((w) => startsWord(e.text, w)));
  const inTitle = (e: (typeof pool)[number]) => (phrase.length ? startsWord(e.title, q) : words.every((w) => startsWord(e.title, w)));
  return [...hits.filter(inTitle), ...hits.filter((e) => !inTitle(e))].map((e) => e.lesson);
}

/** A lesson for this age that has not been used yet (any lesson for the age when all are used). */
export function pickFreshLesson(age: KidAge, used: readonly string[], pillar?: LessonPillar, random: () => number = Math.random): ParentingLesson | undefined {
  const forAge = PARENTING_LESSONS.filter((l) => l.ages.includes(age) && (!pillar || l.pillar === pillar));
  const fresh = forAge.filter((l) => !used.includes(l.id));
  const pool = fresh.length ? fresh : forAge;
  return pool.length ? pool[Math.floor(random() * pool.length)] : undefined;
}

/** Server: a client config's lesson snapshot is replaced by the library's current version of that lesson. */
export function withLibraryLesson<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const lesson = typeof r.lessonId === "string" ? findLesson(r.lessonId) : undefined;
  return (lesson ? { ...r, lesson } : raw) as T;
}
