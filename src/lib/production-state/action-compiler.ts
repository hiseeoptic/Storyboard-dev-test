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
  const explicitSequence = (text.match(/\b(?:then|after that|next|while|and then)\b|\b(?:sau đó|tiếp theo|đồng thời)\b|(?:->|→)/giu) ?? []).length;
  const clauses = text.split(/[;]+/).map(clean).filter(Boolean).length;
  return explicitSequence === 0 && clauses <= 1;
}

/** Split legacy/model choreography into deterministic ordered transitions.
 * This is deliberately syntax-led: it never invents an action, it only turns
 * the model's own semicolon/then/comma verb chain into separate records. */
function splitAtomicAction(text: string): string[] {
  const orderedVerb = "(?:sit(?:s|ting)?(?: down)?|stand(?:s|ing)?(?: up)?|walk(?:s|ed|ing)?|move(?:s|d|ing)?|turn(?:s|ed|ing)?|use(?:s|d|ing)?|reach(?:es|ed|ing)?|withdraw(?:s|n|ing)?|grip(?:s|ped|ping)?|grasp(?:s|ed|ing)?|lift(?:s|ed|ing)?|tap(?:s|ped|ping)?|smooth(?:s|ed|ing)?|place(?:s|d|ing)?|set(?:s|ting)?|release(?:s|d|ing)?|push(?:es|ed|ing)?|pull(?:s|ed|ing)?|open(?:s|ed|ing)?|close(?:s|d|ing)?|press(?:es|ed|ing)?|rotate(?:s|d|ing)?|ngồi(?: xuống)?|đứng(?: lên)?|đi|di chuyển|xoay|dùng|vươn|rút tay|nắm|cầm|nhấc|chạm|vuốt|đặt|thả|đẩy|kéo|mở|đóng|ấn)";
  const primary = clean(text)
    .split(
      new RegExp(
        `\\s*;\\s*|\\s+(?:then|after that|next|while|and then|sau đó|tiếp theo|đồng thời)\\s+|\\s+and\\s+(?=${orderedVerb}\\b)`,
        "iu"
      )
    )
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

const POSSESSIVE_AFTER = /^\s*(?:['’]s\b|['’](?=\s))/u;

function nameIndex(text: string, name: string, allowPossessive: boolean): number {
  const hay = lower(text);
  const needle = lower(name);
  if (!needle) return -1;
  let from = 0;
  while (from <= hay.length) {
    const at = hay.indexOf(needle, from);
    if (at < 0) return -1;
    const before = at === 0 ? "" : hay[at - 1]!;
    const after = hay.slice(at + needle.length);
    const wholeWord = !/\p{L}/u.test(before) && !/^\p{L}/u.test(after);
    if (wholeWord && (allowPossessive || !POSSESSIVE_AFTER.test(after))) return at;
    from = at + 1;
  }
  return -1;
}

/**
 * The character who performs a clause: the FIRST character named in it, as a
 * whole word, ignoring owners ("releases it beside Mẹ's phone" names Mẹ as the
 * phone's owner, not as the actor). The older longest-name rule made Mẹ the
 * actor of Bố's release, so the phone ended "held by Mẹ" inside the basket and
 * that wrong holder travelled through every later shot (02/11/2026).
 */
export function resolveLeadSubject(
  text: string,
  registry: ProductionRegistryEntry[],
  allowPossessive = false
): string | null {
  let best: { id: string; at: number; length: number } | null = null;
  for (const entry of registry) {
    if (entry.kind !== "character") continue;
    for (const name of [entry.display_name, entry.source_ref, ...entry.aliases]) {
      if (!name) continue;
      const at = nameIndex(text, name, allowPossessive);
      if (at < 0) continue;
      if (!best || at < best.at || (at === best.at && name.length > best.length)) {
        best = { id: entry.entity_id, at, length: name.length };
      }
    }
  }
  return best?.id ?? null;
}

/** Manipulation verbs the first contact list missed ("gathers the cards", "rests her hand on the box rim"). */
const CONTACT_VERB_MORE =
  /\b(?:gather(?:s|ed|ing)?|transfer(?:s|red|ring)?|carr(?:y|ies|ied|ying)|mov(?:e|es|ed|ing)|slid(?:e|es|ing)|stack(?:s|ed|ing)?|rest(?:s|ed|ing)?\s+(?:[\p{L}'’]+\s+){0,3}(?:hand|palm|fingers?)|put(?:s|ting)?|tak(?:e|es|ing)|took|remov(?:e|es|ed|ing)|hand(?:s|ed)?\s+over|giv(?:e|es|ing)|gave|drop(?:s|ped|ping)?|insert(?:s|ed|ing)?|tuck(?:s|ed|ing)?|grab(?:s|bed|bing)?|collect(?:s|ed|ing)?|scoop(?:s|ed|ing)?|pat(?:s|ted|ting)?|hold(?:s|ing)?|held|squeez(?:e|es|ed|ing)|lay(?:s|ing)?|laid|arrang(?:e|es|ed|ing)|straighten(?:s|ed|ing)?)\b|(?:^|\s)(?:gom|chuyển|xếp|bỏ|lấy|cất|đưa|ôm|giữ|đặt tay)(?=\s|$)/iu;

const humanName = (value: string) => lower(value).replace(/^(?:obj|prop|product)_/, "").replace(/_/g, " ").trim();

/**
 * Objects a clause names ("the box rim" → the paper box): the full name, an
 * alias, or the last word of the name when only one object ends with it.
 */
export function mentionedObjects(text: string, registry: ProductionRegistryEntry[]): string[] {
  const objects = registry.filter((entry) => entry.kind === "object" || entry.kind === "product");
  const found = new Set<string>();
  for (const entry of objects) {
    const names = [entry.display_name, entry.source_ref, ...entry.aliases].filter((n): n is string => Boolean(n)).map(humanName);
    if (names.some((name) => name && nameIndex(text, name, true) >= 0)) found.add(entry.entity_id);
  }
  const heads = new Map<string, string[]>();
  for (const entry of objects) {
    const head = humanName(entry.display_name).split(/\s+/).pop() ?? "";
    if (head.length < 3) continue;
    heads.set(head, [...(heads.get(head) ?? []), entry.entity_id]);
  }
  for (const [head, ids] of heads) {
    if (ids.length !== 1) continue;
    const singular = head.replace(/s$/, "");
    if (headAlone(text, head) || (singular.length >= 3 && headAlone(text, singular))) found.add(ids[0]!);
  }
  return [...found];
}

/** Words that may follow a bare object noun: its parts ("box rim") or grammar ("the box and…"). */
const AFTER_HEAD = /^(?:rim|edge|lid|side|sides|corner|top|bottom|handle|wall|walls|base|front|back|end|opening|surface|and|or|with|on|in|into|onto|from|to|of|beside|while|as|then|so|but|at|by|for|again|down|up|over|under|near|that|which|without|until|before|after|toward|towards|against|behind|across|through|around|is|stays|remains)$/iu;

/** "the box rim" names the box; "the castle card" does not name the cushion castle. */
function headAlone(text: string, head: string): boolean {
  const hay = lower(text);
  let from = 0;
  while (from <= hay.length) {
    const at = nameIndex(hay.slice(from), head, true);
    if (at < 0) return false;
    const end = from + at + head.length;
    const next = /^\s+([\p{L}'’-]+)/u.exec(hay.slice(end))?.[1];
    if (!next || AFTER_HEAD.test(next)) return true;
    from = from + at + 1;
  }
  return false;
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
  // Subject of the first part of each change: a continuation clause ("…,
  // releases it beside Mẹ's phone") keeps the actor of the clause it continues.
  const firstPartSubject = new Map<number, string | null>();
  shot.actions = candidates.map((candidate, index): AtomicAction => {
    const { change, changeIndex, verb, partIndex, partCount } = candidate;
    const evidence = clean(`${change.caused_by} ${verb}`);
    const changedCharacter = registry.find((entry) => entry.entity_id === change.entity_id && entry.kind === "character");
    const selfNamed = changedCharacter && resolveLeadSubject(verb, [changedCharacter], true) ? changedCharacter.entity_id : null;
    const subject =
      selfNamed ??
      resolveLeadSubject(verb, registry) ??
      (partIndex > 0 ? firstPartSubject.get(changeIndex) ?? null : null) ??
      resolveLeadSubject(change.caused_by, registry, true) ??
      resolveSubject(`${verb} ${change.caused_by}`, registry);
    if (partIndex === 0) firstPartSubject.set(changeIndex, subject);
    const fromPlacement = placementFor(shot.start_snapshot.placements, subject);
    const toPlacement = placementFor(shot.end_snapshot.placements, subject);
    const minimum = minimumDuration(verb);
    const declared = declaredDurations[index];
    const duration = declared ?? Math.max(minimum, inferredShare);
    const changedEntity = registry.find((entry) => entry.entity_id === change.entity_id);
    const objectEntityId = changedEntity?.kind === "character" && change.entity_id === subject
      ? null
      : change.entity_id || null;
    const contactVerb = /\b(?:touch(?:es|ed|ing)?|contact(?:s|ed|ing)?|cut(?:s|ting)?|grip(?:s|ped|ping)?|grasp(?:s|ed|ing)?|hold(?:s|ing)?|pick(?:s|ed|ing)?|lift(?:s|ed|ing)?|place(?:s|d|ing)?|release(?:s|d|ing)?|push(?:es|ed|ing)?|pull(?:s|ed|ing)?|reach(?:es|ed|ing)?|tap(?:s|ped|ping)?|smooth(?:s|ed|ing)?)\b|\b(?:chạm|tiếp xúc|cắt|cứa|nắm|cầm|nhấc|đặt|thả|đẩy|kéo|đưa tay|vươn tay|vuốt)\b/iu.test(verb);
    const externalObjectId = objectEntityId && objectEntityId !== subject
      ? objectEntityId
      : null;
    const bodyPart = change.body_part ?? (contactVerb && externalObjectId ? "right_hand" : null);
    const contactEntityIds = [...(change.contact_entity_ids ?? [])];
    if (contactVerb && externalObjectId && !contactEntityIds.includes(externalObjectId)) {
      contactEntityIds.push(externalObjectId);
    }
    // A hand that gathers, carries, rests on or removes a named prop touches it,
    // even when the ledger did not list the contact ("rests her right hand on the
    // box rim" listed only Na herself). A contact with oneself is no contact.
    const manipulates = contactVerb || CONTACT_VERB_MORE.test(verb);
    // Structured contacts from the planner are the authority: no text guessing on top.
    if (manipulates && !change.declared_contact_entity_ids) {
      if (externalObjectId && !contactEntityIds.includes(externalObjectId)) contactEntityIds.push(externalObjectId);
      for (const mentioned of mentionedObjects(verb, registry)) {
        if (!contactEntityIds.includes(mentioned)) contactEntityIds.push(mentioned);
      }
    }
    if (subject && contactEntityIds.length > 1 && contactEntityIds.includes(subject)) {
      contactEntityIds.splice(contactEntityIds.indexOf(subject), 1);
    }
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
