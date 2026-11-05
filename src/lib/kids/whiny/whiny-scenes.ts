// ============================================================
// NA NHÕNG NHẼO — the scene library (~255 whiny moments of a 4–5-year-old in
// 17 trigger groups) with lookup, search, the "not made yet" picker and the
// server-side snapshot swap. Loaded on demand by the card.
// Triggers grounded in what child-health and parenting sources describe for
// preschoolers: being told "no", tiredness and hunger, wanting attention,
// fairness and sibling rivalry, jealousy of affection, bedtime stalling and
// the drive to "do it myself".
// ============================================================

import { WHINY_GROUPS, type WhinyGroup, type WhinyScene } from "./whiny-types.ts";
import { CAUGHT_SCENES, JEALOUS_SCENES, ME_TOO_SCENES } from "./scenes/caught-jealous-metoo.ts";
import { ATTENTION_SCENES, FAIR_SCENES, NO_SCENES } from "./scenes/no-fair-attention.ts";
import { BEDTIME_SCENES, MEAL_SCENES, TEASE_SCENES } from "./scenes/bedtime-meal-tease.ts";
import { MORNING_SCENES, MYSELF_SCENES, OUTING_SCENES } from "./scenes/outing-myself-morning.ts";
import { GRAND_SCENES, PET_SCENES, SIBLING_SCENES } from "./scenes/grand-sibling-pet.ts";
import { HOME_SCENES, OCCASION_SCENES } from "./scenes/occasion-home.ts";

export { WHINE_LEVELS, WHINE_LEVEL_LABEL, WHINY_GROUPS, type WhineLevel, type WhinyGroup, type WhinyScene } from "./whiny-types.ts";

export const WHINY_SCENES: WhinyScene[] = [
  ...CAUGHT_SCENES,
  ...JEALOUS_SCENES,
  ...ME_TOO_SCENES,
  ...NO_SCENES,
  ...FAIR_SCENES,
  ...ATTENTION_SCENES,
  ...BEDTIME_SCENES,
  ...MEAL_SCENES,
  ...TEASE_SCENES,
  ...OUTING_SCENES,
  ...MYSELF_SCENES,
  ...MORNING_SCENES,
  ...GRAND_SCENES,
  ...SIBLING_SCENES,
  ...PET_SCENES,
  ...OCCASION_SCENES,
  ...HOME_SCENES,
];

const BY_ID = new Map(WHINY_SCENES.map((s) => [s.id, s]));

export function findScene(id: string | undefined | null): WhinyScene | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function scenesFor(group?: WhinyGroup | null): WhinyScene[] {
  return group ? WHINY_SCENES.filter((s) => s.group === group) : WHINY_SCENES;
}

export function sceneCountByGroup(): Array<{ id: WhinyGroup; label: string; count: number }> {
  return WHINY_GROUPS.map((g) => ({ id: g.id, label: g.label, count: WHINY_SCENES.filter((s) => s.group === g.id).length }));
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

/** Scenes matching every word of the query (accents optional): titles first. */
export function searchScenes(query: string, pool: readonly WhinyScene[] = WHINY_SCENES): WhinyScene[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const label = (s: WhinyScene) => WHINY_GROUPS.find((g) => g.id === s.group)?.label ?? "";
  const text = (s: WhinyScene) => fold(`${s.title} ${s.place} ${s.hook} ${s.whine} ${s.punch} ${s.naLines.join(" ")} ${s.adultLines.join(" ")} ${label(s)}`);
  const hits = pool.filter((s) => words.every((w) => text(s).includes(w)));
  const head = (s: WhinyScene) => words.every((w) => fold(s.title).includes(w));
  return [...hits.filter(head), ...hits.filter((s) => !head(s))];
}

/** A scene not made yet (in the group when given); any scene of the group once all are made. */
export function pickFreshScene(used: readonly string[], group?: WhinyGroup | null, random: () => number = Math.random): WhinyScene | undefined {
  const pool = scenesFor(group);
  const fresh = pool.filter((s) => !used.includes(s.id));
  const from = fresh.length ? fresh : pool;
  return from.length ? from[Math.min(from.length - 1, Math.floor(random() * from.length))] : undefined;
}

/** Server: a client config's scene snapshot is replaced by the library's current version. */
export function withLibraryScene<T>(raw: T): T {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const scene = typeof r.sceneId === "string" ? findScene(r.sceneId) : undefined;
  return (scene ? { ...r, scene } : raw) as T;
}
