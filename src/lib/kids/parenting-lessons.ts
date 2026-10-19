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

export { LESSON_PILLARS, PILLAR_GROUPS, pillarLabel, type LessonPillar, type ParentingLesson } from "./lesson-pillars.ts";

export const PARENTING_LESSONS: ParentingLesson[] = [...CORE_LESSONS];

const BY_ID = new Map(PARENTING_LESSONS.map((l) => [l.id, l]));

export function findLesson(id: string | undefined | null): ParentingLesson | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Lessons for one pillar that suit the kid's age (all when no age match). */
export function lessonsFor(pillar: LessonPillar, age: KidAge): ParentingLesson[] {
  const inPillar = PARENTING_LESSONS.filter((l) => l.pillar === pillar);
  const fit = inPillar.filter((l) => l.ages.includes(age));
  return fit.length ? fit : inPillar;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Lessons whose title, situation, takeaway or method contain every word of the query (accents optional). */
export function searchLessons(query: string, age?: KidAge): ParentingLesson[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return PARENTING_LESSONS.filter((l) => {
    if (age && !l.ages.includes(age)) return false;
    const text = fold(`${l.title} ${l.situation} ${l.behavior} ${l.takeaway} ${l.method} ${LESSON_PILLARS.find((p) => p.id === l.pillar)?.label ?? ""}`);
    return words.every((w) => text.includes(w));
  });
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
