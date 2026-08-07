import type {
  AtomicAction,
  EntityPlacementState,
  ProductionRegistryEntry,
  ShotState,
} from "./types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function lower(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

function explicitDuration(text: string): number | null {
  const match = text.match(/\b(\d+(?:\.\d+)?)\s*(?:s|sec(?:ond)?s?|giây)\b/iu);
  return match?.[1] ? Number.parseFloat(match[1]) : null;
}

function minimumDuration(text: string): number {
  if (/\b(?:remove|take off)\b.{0,24}\b(?:shoe|boot|sock)\b|\b(?:tháo|cởi)\b.{0,24}\b(?:giày|dép|tất)\b/iu.test(text)) return 2.5;
  if (/\b(?:put on|wear)\b.{0,24}\b(?:shoe|boot|sock)\b|\b(?:mang|đi|xỏ)\b.{0,24}\b(?:giày|dép|tất)\b/iu.test(text)) return 3;
  if (/\b(?:stand up|sit down|kneel|lie down)\b|\b(?:đứng lên|ngồi xuống|quỳ|nằm xuống)\b/iu.test(text)) return 1.5;
  if (/\b(?:walk|cross|enter|exit|change seats?|swap seats?)\b|\b(?:đi|băng qua|đi vào|đi ra|đổi ghế|đổi chỗ)\b/iu.test(text)) return 1.5;
  if (/\b(?:pick up|place|set down|put down|lift|release)\b|\b(?:nhặt|đặt|nhấc|thả)\b/iu.test(text)) return 0.8;
  if (/\b(?:open|close|press|touch|turn)\b|\b(?:mở|đóng|ấn|chạm|xoay)\b/iu.test(text)) return 0.6;
  return 0.4;
}

function isAtomic(text: string): boolean {
  const explicitSequence = (text.match(/\b(?:then|after that|next|while)\b|\b(?:sau đó|tiếp theo|đồng thời)\b|(?:->|→)/giu) ?? []).length;
  const clauses = text.split(/[;]+/).map(clean).filter(Boolean).length;
  return explicitSequence === 0 && clauses <= 1;
}

function resolveSubject(text: string, registry: ProductionRegistryEntry[]): string | null {
  const value = lower(text);
  const candidates = registry
    .filter((entry) => entry.kind === "character")
    .filter((entry) =>
      [entry.display_name, entry.source_ref, ...entry.aliases]
        .filter((name): name is string => Boolean(name))
        .some((name) => value.includes(lower(name)))
    )
    .sort((a, b) => b.display_name.length - a.display_name.length);
  return candidates[0]?.entity_id ?? null;
}

function placementFor(
  placements: EntityPlacementState[],
  entityId: string | null
): EntityPlacementState | undefined {
  return entityId ? placements.find((placement) => placement.entity_id === entityId) : undefined;
}

/** One legacy state change becomes one candidate action; compound prose is flagged, never invented/split. */
export function compileAtomicActions(
  shot: ShotState,
  registry: ProductionRegistryEntry[]
): void {
  shot.actions = shot.changes.map((change, index): AtomicAction => {
    const evidence = clean(`${change.caused_by} ${change.action}`);
    const subject = resolveSubject(change.caused_by || change.action, registry);
    const fromPlacement = placementFor(shot.start_snapshot.placements, subject);
    const toPlacement = placementFor(shot.end_snapshot.placements, subject);
    return {
      action_id: `${shot.shot_id}_action_${String(index + 1).padStart(3, "0")}`,
      source_change_index: index,
      subject_entity_id: subject,
      verb: clean(change.action),
      object_entity_id: change.entity_id || null,
      body_part: change.body_part ?? null,
      start_state: clean(change.from),
      transition_states: [],
      end_state: clean(change.to),
      contact_entity_ids: [...(change.contact_entity_ids ?? [])],
      duration_s: change.duration_s ?? explicitDuration(change.action),
      minimum_duration_s: minimumDuration(change.action),
      physical_conditions: [...(change.physical_conditions ?? [])],
      from_zone_id: fromPlacement?.zone_id ?? null,
      to_zone_id: toPlacement?.zone_id ?? null,
      is_atomic: isAtomic(change.action),
      evidence,
    };
  });
}
