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

/** Split legacy/model choreography into deterministic ordered transitions.
 * This is deliberately syntax-led: it never invents an action, it only turns
 * the model's own semicolon/then/comma verb chain into separate records. */
function splitAtomicAction(text: string): string[] {
  const primary = clean(text)
    .split(/\s*;\s*|\s+(?:then|after that|next|sau đó|tiếp theo)\s+/iu)
    .map(clean)
    .filter(Boolean);
  const verbContinuation = /^(?:turn(?:s|ed|ing)?|use(?:s|d|ing)?|reach(?:es|ed|ing)?|grip(?:s|ped|ping)?|grasp(?:s|ed|ing)?|lift(?:s|ed|ing)?|tap(?:s|ped|ping)?|smooth(?:s|ed|ing)?|place(?:s|d|ing)?|set(?:s|ting)?|release(?:s|d|ing)?|push(?:es|ed|ing)?|pull(?:s|ed|ing)?|open(?:s|ed|ing)?|close(?:s|d|ing)?|xoay|dùng|vươn|nắm|cầm|nhấc|chạm|vuốt|đặt|thả|đẩy|kéo|mở|đóng)\b/iu;
  const parts = primary.flatMap((clause) => {
    const chunks = clause.split(/,\s+(?=[\p{L}])/u).map(clean).filter(Boolean);
    if (chunks.length <= 1) return [clause];
    const out: string[] = [];
    for (const chunk of chunks) {
      if (out.length > 0 && verbContinuation.test(chunk)) out.push(chunk);
      else if (out.length > 0) out[out.length - 1] = `${out[out.length - 1]}, ${chunk}`;
      else out.push(chunk);
    }
    return out;
  });
  return parts.length ? parts : [clean(text)];
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

function resolveObject(
  text: string,
  registry: ProductionRegistryEntry[],
  subjectEntityId: string | null
): string | null {
  const value = lower(text);
  const candidates = registry
    .filter((entry) => entry.entity_id !== subjectEntityId && entry.kind !== "character")
    .flatMap((entry) =>
      [entry.display_name, entry.source_ref, ...entry.aliases]
        .filter((name): name is string => Boolean(name))
        .map((name) => ({ entry, name: clean(name) }))
    )
    .filter(({ name }) => {
      if (!name) return false;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(value);
    })
    .sort((a, b) => b.name.length - a.name.length);
  return candidates[0]?.entry.entity_id ?? null;
}

function isManipulationVerb(text: string): boolean {
  return /\b(?:touch(?:es|ed|ing)?|grip(?:s|ped|ping)?|grasp(?:s|ed|ing)?|hold(?:s|ing)?|held|pick(?:s|ed|ing)?|lift(?:s|ed|ing)?|place(?:s|d|ing)?|release(?:s|d|ing)?|push(?:es|ed|ing)?|pull(?:s|ed|ing)?|remove(?:s|d|ing)?|take(?:s|n|ing)? off|reach(?:es|ed|ing)?)\b|\b(?:chạm|nắm|cầm|nhặt|nhấc|đặt|thả|đẩy|kéo|tháo|cởi|vươn tay|đưa tay)\b/iu.test(text);
}

function placementFor(
  placements: EntityPlacementState[],
  entityId: string | null
): EntityPlacementState | undefined {
  return entityId ? placements.find((placement) => placement.entity_id === entityId) : undefined;
}

/** Legacy state changes compile into ordered atomic actions without changing the
 * source ledger. Compound prose is split locally, so export does not strand the
 * user behind a repair loop for a mechanical formatting issue. */
export function compileAtomicActions(
  shot: ShotState,
  registry: ProductionRegistryEntry[]
): void {
  const candidates = shot.changes.flatMap((change, changeIndex) => {
    const parts = splitAtomicAction(change.action);
    const declared = change.duration_s ?? explicitDuration(change.action);
    return parts.map((verb, partIndex) => ({
      change,
      changeIndex,
      verb,
      partIndex,
      partCount: parts.length,
      declaredDuration: declared == null ? null : declared / parts.length,
    }));
  });
  const declaredDurations = candidates.map((candidate) => candidate.declaredDuration);
  const declaredTotal = declaredDurations.reduce<number>(
    (sum, duration) => sum + (duration ?? 0),
    0
  );
  const missingCount = declaredDurations.filter((duration) => duration === null || duration === undefined).length;
  const shotDuration = Math.max(0, shot.end_time_s - shot.start_time_s);
  // Legacy ledgers rarely carried action duration. Allocate the unclaimed shot
  // budget deterministically so the validator can assess feasibility without
  // spending another AI repair call. The source ledger stays untouched.
  const inferredShare = missingCount > 0
    ? Math.max(0, shotDuration - declaredTotal) / missingCount
    : 0;
  shot.actions = candidates.map((candidate, index): AtomicAction => {
    const { change, changeIndex, verb, partIndex, partCount } = candidate;
    const evidence = clean(`${change.caused_by} ${verb}`);
    const subject = resolveSubject(`${verb} ${change.caused_by}`, registry);
    const fromPlacement = placementFor(shot.start_snapshot.placements, subject);
    const toPlacement = placementFor(shot.end_snapshot.placements, subject);
    const minimum = minimumDuration(verb);
    const declared = declaredDurations[index];
    const duration = declared ?? Math.max(minimum, inferredShare);
    const changedEntity = registry.find((entry) => entry.entity_id === change.entity_id);
    // Models sometimes attach a manipulation row to the actor ("Lan changes
    // from resting to reaching") while the actual prop is named only in the
    // action prose. In that case `change.entity_id` is not the contact target.
    // Resolve the named non-character entity and keep the original ledger row
    // untouched; this only repairs the additive canonical action contract.
    const namedObjectEntityId = resolveObject(
      `${verb} ${change.action} ${change.caused_by}`,
      registry,
      subject
    );
    const objectEntityId = changedEntity?.kind === "character" && change.entity_id === subject
      ? namedObjectEntityId
      : change.entity_id || namedObjectEntityId;
    const manipulation = isManipulationVerb(verb);
    const bodyPart = change.body_part ?? (manipulation && objectEntityId ? "right_hand" : null);
    const contactEntityIds = manipulation && objectEntityId
      ? Array.from(new Set([
          ...(change.contact_entity_ids ?? []).filter((entityId) => entityId !== subject),
          objectEntityId,
        ]))
      : [...(change.contact_entity_ids ?? [])];
    return {
      action_id: `${shot.shot_id}_action_${String(index + 1).padStart(3, "0")}`,
      source_change_index: changeIndex,
      subject_entity_id: subject,
      verb,
      object_entity_id: objectEntityId,
      body_part: bodyPart,
      start_state: partIndex === 0 ? clean(change.from) : "",
      transition_states: [],
      end_state: partIndex === partCount - 1 ? clean(change.to) : "",
      contact_entity_ids: contactEntityIds,
      duration_s: Number.isFinite(duration) && duration > 0
        ? Math.round(duration * 10) / 10
        : null,
      minimum_duration_s: minimum,
      physical_conditions: [...(change.physical_conditions ?? [])],
      from_zone_id: fromPlacement?.zone_id ?? null,
      to_zone_id: toPlacement?.zone_id ?? null,
      is_atomic: isAtomic(verb),
      evidence,
    };
  });
}
