// ============================================================
// LEDGER REPAIR — deterministic fixes for state-ledger mistakes that make a
// prop "belong" to the wrong hand, before any prompt is built from it.
//
// Found in "na-kiem-tra-gio-dien-thoai" (02/11/2026):
//   · "Bố … carries it to the basket, and releases it beside Mẹ's phone" gave
//     the phone to Mẹ: it ended INSIDE the basket yet "held by Mẹ", and that
//     holder travelled through shots 3–5.
//   · the holder "Na holds castle card in left hand" became its own entity
//     instead of Na's left hand.
//   · "phone on Bố's lap" was a hand hold without a hand.
// Each fix is recorded, the actions are recompiled with the corrected actor and
// contact rules, and the validator findings are re-run on the repaired copy so
// the export report no longer lists errors that are gone. The saved breakdown
// and its ledger stay untouched — only the canonical copy used for the export
// changes.
// ============================================================
import { compileAtomicActions, resolveLeadSubject } from "../production-state/action-compiler.ts";
import { inferLimbId } from "../production-state/physical-compiler.ts";
import { snapshotDifference } from "../production-state/normalizer.ts";
import { validatePhysicalState, type PhysicalValidationOptions } from "../production-state/physical-validator.ts";
import { validateSpatialState } from "../production-state/spatial-validator.ts";
import { validateAtomicActions } from "../production-state/action-validator.ts";
import { validateCinematographyState } from "../production-state/cinematography-validator.ts";
import { validateDialogueAudioState } from "../production-state/dialogue-audio-validator.ts";
import type {
  LimbId,
  ProductionEntitySnapshot,
  ProductionFinding,
  ProductionRegistryEntry,
  ProductionSnapshot,
  ProductionState,
} from "../production-state/types.ts";

export type LedgerRepairKind =
  | "holder_is_a_sentence"
  | "holder_but_inside_container"
  | "lap_is_body_support"
  | "hand_assigned";

export interface LedgerRepair {
  shot_id: string;
  entity_id: string;
  where: "start" | "end" | "change";
  kind: LedgerRepairKind;
  before: string | null;
  after: string | null;
}

/** The object lies in/on something — nobody's hand is holding it. */
const IN_OR_ON_SOMETHING =
  /\b(?:inside|into|in\s+(?:the\s+|a\s+|an\s+)?(?:[\p{L}-]+\s+){0,2}(?:basket|box|bag|drawer|tray|bowl|cup|pocket|bin|crate|case|jar|pot|sink|cabinet|shelf)|on\s+(?:top\s+of\s+)?(?:the\s+|a\s+)?(?:[\p{L}-]+\s+){0,2}(?:table|shelf|floor|rug|carpet|mat|sofa|couch|counter|desk|tray|plate|bed|chair|stool|bench|cushion|windowsill))\b/iu;
const HELD_WORDS = /\b(?:hands?|palms?|fingers?|grip(?:s|ped)?|holding|holds|held|clutch(?:es|ed)?|arms?|hug(?:s|ged)?|cradl(?:e|es|ed))\b|\b(?:tay|cầm|nắm|ôm|giữ)\b/iu;
const LAP_WORDS = /\b(?:lap|knees?|thighs?)\b|\b(?:đùi|lòng)\b/iu;

const lower = (value: unknown) => (typeof value === "string" ? value : "").toLocaleLowerCase();

function namesOf(entry: ProductionRegistryEntry | undefined): string[] {
  return entry ? [entry.display_name, entry.source_ref, ...entry.aliases].filter((n): n is string => Boolean(n)) : [];
}

function mentionsName(text: string, entry: ProductionRegistryEntry | undefined): boolean {
  const hay = lower(text);
  return namesOf(entry).some((name) => {
    const needle = lower(name);
    const at = hay.indexOf(needle);
    return at >= 0 && !/\p{L}/u.test(hay[at - 1] ?? "") && !/^\p{L}/u.test(hay.slice(at + needle.length));
  });
}

function fingerprint(finding: ProductionFinding): string {
  return [finding.code, finding.shot_id ?? "", [...finding.entity_ids].sort().join(","), finding.message, JSON.stringify(finding.evidence ?? {})].join("|");
}

function runValidators(state: ProductionState, options: PhysicalValidationOptions): ProductionFinding[] {
  return [
    ...validatePhysicalState(state, options),
    ...validateSpatialState(state),
    ...validateAtomicActions(state),
    ...validateCinematographyState(state),
    ...validateDialogueAudioState(state),
  ];
}

function boundaryFindings(state: ProductionState): ProductionFinding[] {
  const out: ProductionFinding[] = [];
  for (let index = 1; index < state.shots.length; index++) {
    const current = state.shots[index]!;
    const previous = state.shots[index - 1]!;
    const boundary = state.boundaries[index];
    if (!boundary || boundary.transition_mode !== "continuous") continue;
    const previousById = new Map(previous.end_snapshot.entities.map((entry) => [entry.entity_id, entry]));
    for (const currentEntry of current.start_snapshot.entities) {
      const previousEntry = previousById.get(currentEntry.entity_id);
      if (!previousEntry) continue;
      const differences = snapshotDifference(previousEntry, currentEntry);
      if (Object.keys(differences).length === 0) continue;
      out.push({
        code: "BOUNDARY_CONTINUITY_MISMATCH",
        severity: "high",
        message: "Continuous boundary start snapshot does not match the previous end snapshot.",
        shot_id: current.shot_id,
        entity_ids: [currentEntry.entity_id],
        evidence: { from_shot_id: previous.shot_id, differences },
        suggested_patch: {
          op: "review_boundary",
          from_shot_id: previous.shot_id,
          to_shot_id: current.shot_id,
          choices: ["inherit_previous_end", "add_visible_action", "declare_intentional_transition"],
        },
      });
    }
  }
  return out;
}

/** Remove every derived "hold" link between a holder and an object. */
function unlinkHold(snapshot: ProductionSnapshot, holderId: string, objectId: string): void {
  snapshot.contacts = snapshot.contacts.filter(
    (c) => !(c.source_entity_id === holderId && c.target_entity_id === objectId && c.kind === "hold")
  );
  snapshot.supports = snapshot.supports.filter(
    (s) => !(s.supported_entity_id === objectId && s.support_entity_id === holderId && s.kind === "hand")
  );
  const physics = snapshot.entities.find((e) => e.entity_id === holderId)?.character_physics;
  if (!physics) return;
  physics.unassigned_held_object_ids = physics.unassigned_held_object_ids.filter((id) => id !== objectId);
  for (const limb of Object.values(physics.limbs)) {
    limb.held_object_ids = limb.held_object_ids.filter((id) => id !== objectId);
    limb.contact_entity_ids = limb.contact_entity_ids.filter((id) => id !== objectId);
    if (limb.status === "holding" && limb.held_object_ids.length === 0) limb.status = "free";
  }
}

/** Add a hand hold (contact + support + limb bookkeeping) when the holder has a body model. */
function linkHold(snapshot: ProductionSnapshot, holderId: string, objectId: string, limb: LimbId | null): void {
  const physics = snapshot.entities.find((e) => e.entity_id === holderId)?.character_physics;
  if (!physics) return;
  const hand = limb && limb.endsWith("hand") ? limb : null;
  snapshot.contacts.push({ source_entity_id: holderId, source_limb_id: hand, target_entity_id: objectId, kind: "hold", active: true });
  snapshot.supports.push({ supported_entity_id: objectId, support_entity_id: holderId, kind: "hand", contact_part: hand, active: true });
  if (hand) {
    const state = physics.limbs[hand];
    state.status = "holding";
    if (!state.held_object_ids.includes(objectId)) state.held_object_ids.push(objectId);
    if (!state.contact_entity_ids.includes(objectId)) state.contact_entity_ids.push(objectId);
  } else if (!physics.unassigned_held_object_ids.includes(objectId)) {
    physics.unassigned_held_object_ids.push(objectId);
  }
}

function supportFor(position: string, snapshot: ProductionSnapshot, registry: ProductionRegistryEntry[], self: string): string | null {
  const text = lower(position);
  for (const entity of snapshot.entities) {
    if (entity.entity_id === self || entity.kind === "character") continue;
    const entry = registry.find((r) => r.entity_id === entity.entity_id);
    const head = lower(entry?.display_name ?? entity.entity_id).replace(/^(?:obj|prop)_/, "").split(/[_\s]+/).pop() ?? "";
    if (head.length >= 3 && new RegExp(`(?<!\\p{L})${head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(text)) return entity.entity_id;
  }
  return null;
}

/** Hand named for this object anywhere in the shot's own changes/actions. */
function handFromShot(shot: ProductionState["shots"][number], objectId: string, holderId: string): LimbId | null {
  for (const action of shot.actions) {
    if (action.subject_entity_id !== holderId) continue;
    if (action.object_entity_id !== objectId && !action.contact_entity_ids.includes(objectId)) continue;
    if (action.body_part && action.body_part !== "torso" && action.body_part.endsWith("hand")) return action.body_part;
  }
  for (const change of shot.changes) {
    if (change.entity_id !== objectId) continue;
    if (change.body_part && change.body_part !== "torso" && change.body_part.endsWith("hand")) return change.body_part;
    const limb = inferLimbId(`${change.action} ${change.caused_by}`);
    if (limb) return limb;
  }
  return null;
}

/**
 * Repair the canonical production state. Pure: returns a repaired deep copy
 * and the list of repairs; the input is never mutated.
 */
export function repairProductionStateContinuity(
  input: ProductionState,
  options: PhysicalValidationOptions = {}
): { state: ProductionState; repairs: LedgerRepair[] } {
  const state = JSON.parse(JSON.stringify(input)) as ProductionState;
  const repairs: LedgerRepair[] = [];
  const registry = state.registry ?? [];
  const byId = new Map(registry.map((entry) => [entry.entity_id, entry]));
  const isCharacter = (id: string | null | undefined) => Boolean(id && byId.get(id)?.kind === "character");

  // A holder written as a sentence ("Na holds castle card in left hand") is that
  // character's hand, not a new entity.
  const sentenceHolder = new Map<string, { characterId: string; limb: LimbId | null }>();
  for (const entry of registry) {
    if (entry.kind === "character" || entry.kind === "object" || entry.kind === "product" || entry.kind === "location") continue;
    const lead = resolveLeadSubject(entry.display_name, registry, true);
    if (lead) sentenceHolder.set(entry.entity_id, { characterId: lead, limb: inferLimbId(entry.display_name) });
  }

  for (const shot of state.shots ?? []) {
    for (const change of shot.changes ?? []) {
      for (const field of ["from_holder_entity_id", "to_holder_entity_id"] as const) {
        const holder = change[field];
        if (!holder) continue;
        const mapped = sentenceHolder.get(holder);
        if (mapped) {
          change[field] = mapped.characterId;
          repairs.push({ shot_id: shot.shot_id, entity_id: change.entity_id, where: "change", kind: "holder_is_a_sentence", before: holder, after: mapped.characterId });
          continue;
        }
        const position = field === "to_holder_entity_id" ? change.to_position ?? "" : change.from_position ?? "";
        if (isCharacter(holder) && IN_OR_ON_SOMETHING.test(position) && !HELD_WORDS.test(position) && !mentionsName(position, byId.get(holder))) {
          change[field] = null;
          repairs.push({ shot_id: shot.shot_id, entity_id: change.entity_id, where: "change", kind: "holder_but_inside_container", before: holder, after: null });
        }
      }
    }

    for (const [where, snapshot] of [["start", shot.start_snapshot], ["end", shot.end_snapshot]] as const) {
      if (!snapshot?.entities) continue;
      for (const entity of snapshot.entities as ProductionEntitySnapshot[]) {
        const holder = entity.holder_entity_id;
        if (!holder || entity.kind === "character") continue;
        const mapped = sentenceHolder.get(holder);
        if (mapped) {
          unlinkHold(snapshot, holder, entity.entity_id);
          snapshot.contacts = snapshot.contacts.filter((c) => c.source_entity_id !== holder || c.target_entity_id !== entity.entity_id);
          entity.holder_entity_id = mapped.characterId;
          linkHold(snapshot, mapped.characterId, entity.entity_id, mapped.limb ?? inferLimbId(`${entity.position} ${entity.state}`));
          repairs.push({ shot_id: shot.shot_id, entity_id: entity.entity_id, where, kind: "holder_is_a_sentence", before: holder, after: mapped.characterId });
          continue;
        }
        if (!isCharacter(holder)) continue;
        const holderEntry = byId.get(holder);
        const position = entity.position ?? "";
        if (IN_OR_ON_SOMETHING.test(position) && !HELD_WORDS.test(position) && !mentionsName(position, holderEntry)) {
          unlinkHold(snapshot, holder, entity.entity_id);
          entity.holder_entity_id = null;
          if (!snapshot.supports.some((s) => s.active && s.supported_entity_id === entity.entity_id)) {
            snapshot.supports.push({
              supported_entity_id: entity.entity_id,
              support_entity_id: supportFor(position, snapshot, registry, entity.entity_id),
              kind: "surface",
              contact_part: "object_base",
              active: true,
            });
          }
          repairs.push({ shot_id: shot.shot_id, entity_id: entity.entity_id, where, kind: "holder_but_inside_container", before: holder, after: null });
          continue;
        }
        const handContact = snapshot.contacts.some(
          (c) => c.active && c.source_entity_id === holder && c.target_entity_id === entity.entity_id && c.source_limb_id?.endsWith("hand")
        );
        if (handContact) continue;
        if (LAP_WORDS.test(position) && !HELD_WORDS.test(position)) {
          // Resting on a lap is body support, not a grip.
          unlinkHold(snapshot, holder, entity.entity_id);
          entity.holder_entity_id = null;
          snapshot.supports.push({ supported_entity_id: entity.entity_id, support_entity_id: holder, kind: "body", contact_part: "object_base", active: true });
          repairs.push({ shot_id: shot.shot_id, entity_id: entity.entity_id, where, kind: "lap_is_body_support", before: holder, after: null });
          continue;
        }
        const limb = inferLimbId(`${entity.position} ${entity.state}`) ?? handFromShot(shot, entity.entity_id, holder);
        if (limb) {
          unlinkHold(snapshot, holder, entity.entity_id);
          linkHold(snapshot, holder, entity.entity_id, limb);
          repairs.push({ shot_id: shot.shot_id, entity_id: entity.entity_id, where, kind: "hand_assigned", before: null, after: limb });
        }
      }
    }
    // Recompile the ordered actions with the corrected actor/contact rules.
    compileAtomicActions(shot, registry);
  }

  // Replace exactly the validator + boundary findings: the normaliser's own
  // findings (timeline, missing ledger…) stay as they were.
  let before: ProductionFinding[];
  let after: ProductionFinding[];
  try {
    before = [...runValidators(input, options), ...boundaryFindings(input)];
    after = [...runValidators(state, options), ...boundaryFindings(state)];
  } catch {
    // A partial legacy state the validators cannot read: keep its findings.
    return { state: { ...state, findings: [...(input.findings ?? [])] }, repairs };
  }
  const stale = new Map<string, number>();
  for (const finding of before) stale.set(fingerprint(finding), (stale.get(fingerprint(finding)) ?? 0) + 1);
  const kept = (input.findings ?? []).filter((finding) => {
    const key = fingerprint(finding);
    const count = stale.get(key) ?? 0;
    if (count <= 0) return true;
    stale.set(key, count - 1);
    return false;
  });
  state.findings = [...kept, ...after];
  return { state, repairs };
}

/** One line of the continuity log for a repair (Vietnamese, for the user). */
export function describeLedgerRepair(repair: LedgerRepair, registry: ProductionRegistryEntry[]): string {
  const name = (id: string | null) => {
    if (!id) return "không ai";
    const entry = registry.find((r) => r.entity_id === id);
    return (entry?.display_name ?? id).replace(/^(?:obj|prop|product)_/i, "").replace(/_/g, " ");
  };
  const where = repair.where === "change" ? "hành động" : repair.where === "start" ? "đầu shot" : "cuối shot";
  switch (repair.kind) {
    case "holder_is_a_sentence":
      return `${name(repair.entity_id)} (${where}): người cầm ghi thành câu "${name(repair.before)}" → sửa thành ${name(repair.after)}.`;
    case "holder_but_inside_container":
      return `${name(repair.entity_id)} (${where}): đã nằm trong/trên vật khác nhưng vẫn ghi "${name(repair.before)} cầm" → bỏ người cầm.`;
    case "lap_is_body_support":
      return `${name(repair.entity_id)} (${where}): đặt trên đùi ${name(repair.before)} là đỡ bằng người, không phải tay cầm.`;
    case "hand_assigned":
      return `${name(repair.entity_id)} (${where}): ghi rõ tay cầm — ${String(repair.after).replace(/_/g, " ")}.`;
    default:
      return `${name(repair.entity_id)} (${where}): đã sửa.`;
  }
}
