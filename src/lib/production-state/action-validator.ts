import type {
  AtomicAction,
  ProductionFinding,
  ProductionState,
  ShotState,
} from "./types.ts";

function finding(params: Omit<ProductionFinding, "suggested_patch"> & {
  suggested_patch?: Record<string, unknown> | null;
}): ProductionFinding {
  return { ...params, suggested_patch: params.suggested_patch ?? null };
}

function isContactAction(text: string): boolean {
  return /\b(?:touch|grip|grasp|hold|pick|lift|place|release|push|pull|remove|take off)\b|\b(?:chạm|nắm|cầm|nhặt|nhấc|đặt|thả|đẩy|kéo|tháo|cởi)\b/iu.test(text);
}

function isMovementAction(text: string): boolean {
  return /\b(?:walk|move|cross|enter|exit|change seats?|swap seats?)\b|\b(?:đi|di chuyển|băng qua|đi vào|đi ra|đổi ghế|đổi chỗ)\b/iu.test(text);
}

function shoeRemovalIncomplete(
  action: AtomicAction,
  shot: ShotState
): Record<string, boolean> | null {
  if (!/\b(?:remove|take off)\b.{0,24}\b(?:shoe|boot)\b|\b(?:tháo|cởi)\b.{0,24}\b(?:giày|dép)\b/iu.test(action.verb)) return null;
  const character = action.subject_entity_id
    ? shot.start_snapshot.entities.find((entity) => entity.entity_id === action.subject_entity_id)
        ?.character_physics
    : undefined;
  const objectId = action.object_entity_id;
  const endObject = objectId
    ? shot.end_snapshot.entities.find((entity) => entity.entity_id === objectId)
    : undefined;
  const finalSupported = objectId
    ? shot.end_snapshot.supports.some(
        (support) => support.active && support.supported_entity_id === objectId
      )
    : false;
  return {
    subject_missing: !action.subject_entity_id,
    hand_missing: action.body_part !== "left_hand" && action.body_part !== "right_hand",
    shoe_contact_missing: !objectId || !action.contact_entity_ids.includes(objectId),
    foot_topology_missing:
      !character ||
      character.limbs.left_foot.exists !== true ||
      character.limbs.right_foot.exists !== true,
    balance_support_missing:
      !action.subject_entity_id ||
      !shot.start_snapshot.supports.some(
        (support) => support.active && support.supported_entity_id === action.subject_entity_id
      ),
    final_shoe_location_missing:
      !endObject || (!endObject.holder_entity_id && !finalSupported),
  };
}

function validateAction(action: AtomicAction, shot: ShotState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  if (!action.is_atomic) {
    findings.push(
      finding({
        code: "ACTION_NOT_ATOMIC",
        severity: "high",
        message: "Compound action prose must be split into ordered atomic transitions.",
        shot_id: shot.shot_id,
        entity_ids: [action.subject_entity_id, action.object_entity_id].filter(
          (value): value is string => Boolean(value)
        ),
        evidence: { action_id: action.action_id, verb: action.verb },
        suggested_patch: { op: "split_into_atomic_actions", action_id: action.action_id },
      })
    );
  }
  if (action.duration_s === null) {
    findings.push(
      finding({
        code: "ACTION_DURATION_MISSING",
        severity: "medium",
        message: "Atomic action has no explicit duration.",
        shot_id: shot.shot_id,
        entity_ids: [action.subject_entity_id, action.object_entity_id].filter(
          (value): value is string => Boolean(value)
        ),
        evidence: { action_id: action.action_id, minimum_duration_s: action.minimum_duration_s },
        suggested_patch: { op: "declare_action_duration", minimum_duration_s: action.minimum_duration_s },
      })
    );
  } else if (action.duration_s < action.minimum_duration_s) {
    findings.push(
      finding({
        code: "ACTION_DURATION_TOO_SHORT",
        severity: "high",
        message: "Declared action duration is shorter than its physical minimum.",
        shot_id: shot.shot_id,
        entity_ids: [action.subject_entity_id, action.object_entity_id].filter(
          (value): value is string => Boolean(value)
        ),
        evidence: {
          action_id: action.action_id,
          duration_s: action.duration_s,
          minimum_duration_s: action.minimum_duration_s,
        },
        suggested_patch: { op: "increase_duration_or_split_shot" },
      })
    );
  }
  // Only a manipulation of a REAL, external object needs the limb+contact
  // contract. Expressive / self-directed beats ("hand near ears", contact on
  // self) and verbs with no distinct object are not object manipulations, so
  // they must not be forced to declare a body part + object contact.
  const externalObject =
    action.object_entity_id && action.object_entity_id !== action.subject_entity_id
      ? action.object_entity_id
      : null;
  if (
    isContactAction(action.verb) &&
    externalObject &&
    (!action.body_part || !action.contact_entity_ids.includes(externalObject))
  ) {
    findings.push(
      finding({
        code: "ACTION_CONTACT_CONTRACT_INCOMPLETE",
        severity: "high",
        message: "Manipulation action needs an acting body part and explicit object contact.",
        shot_id: shot.shot_id,
        entity_ids: [action.subject_entity_id, action.object_entity_id].filter(
          (value): value is string => Boolean(value)
        ),
        evidence: {
          action_id: action.action_id,
          body_part: action.body_part,
          contact_entity_ids: action.contact_entity_ids,
        },
        suggested_patch: { op: "declare_action_limb_and_contact" },
      })
    );
  }
  if (isMovementAction(action.verb) && (!action.from_zone_id || !action.to_zone_id)) {
    findings.push(
      finding({
        code: "ACTION_ROUTE_MISSING",
        severity: "high",
        message: "Movement action needs explicit origin and destination zones.",
        shot_id: shot.shot_id,
        entity_ids: action.subject_entity_id ? [action.subject_entity_id] : [],
        evidence: {
          action_id: action.action_id,
          from_zone_id: action.from_zone_id,
          to_zone_id: action.to_zone_id,
        },
        suggested_patch: { op: "declare_action_route" },
      })
    );
  }
  const shoe = shoeRemovalIncomplete(action, shot);
  if (shoe && Object.values(shoe).some(Boolean)) {
    findings.push(
      finding({
        code: "SHOE_REMOVAL_CONTRACT_INCOMPLETE",
        severity: "critical",
        message: "Shoe removal lacks required hand, foot, balance, contact or final shoe state.",
        shot_id: shot.shot_id,
        entity_ids: [action.subject_entity_id, action.object_entity_id].filter(
          (value): value is string => Boolean(value)
        ),
        evidence: { action_id: action.action_id, missing: shoe },
        suggested_patch: { op: "complete_shoe_removal_contract" },
      })
    );
  }
  return findings;
}

function validateStateChain(actions: AtomicAction[], shot: ShotState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  const lastByObject = new Map<string, AtomicAction>();
  for (const action of actions) {
    if (!action.object_entity_id) continue;
    const previous = lastByObject.get(action.object_entity_id);
    if (previous && previous.end_state && action.start_state && previous.end_state !== action.start_state) {
      findings.push(
        finding({
          code: "ACTION_STATE_CHAIN_BROKEN",
          severity: "high",
          message: "Consecutive atomic actions disagree on the object's intermediate state.",
          shot_id: shot.shot_id,
          entity_ids: [action.object_entity_id],
          evidence: {
            previous_action_id: previous.action_id,
            previous_end_state: previous.end_state,
            action_id: action.action_id,
            action_start_state: action.start_state,
          },
          suggested_patch: { op: "align_atomic_state_chain" },
        })
      );
    }
    lastByObject.set(action.object_entity_id, action);
  }
  return findings;
}

export function validateAtomicActions(state: ProductionState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  for (const shot of state.shots) {
    for (const action of shot.actions) findings.push(...validateAction(action, shot));
    findings.push(...validateStateChain(shot.actions, shot));
    const declaredTotal = shot.actions.reduce(
      (sum, action) => sum + (action.duration_s ?? 0),
      0
    );
    // Action durations are model ESTIMATES, so a tiny overshoot (10.2s in a 10s
    // shot) is noise, not a real budget break. Tolerate the larger of +0.5s or
    // 5% of the shot before flagging.
    const shotDuration = shot.end_time_s - shot.start_time_s;
    if (declaredTotal > shotDuration + Math.max(0.5, shotDuration * 0.05)) {
      findings.push(
        finding({
          code: "ACTION_BUDGET_EXCEEDS_SHOT",
          severity: "high",
          message: "Atomic action durations exceed the shot duration.",
          shot_id: shot.shot_id,
          entity_ids: [],
          evidence: {
            action_duration_total_s: declaredTotal,
            shot_duration_s: shot.end_time_s - shot.start_time_s,
          },
          suggested_patch: { op: "split_shot_or_reduce_action_count" },
        })
      );
    }
  }
  return findings;
}
