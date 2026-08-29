import type {
  LimbState,
  ProductionEntitySnapshot,
  ProductionFinding,
  ProductionSnapshot,
  ProductionState,
  ShotState,
} from "./types.ts";

export interface PhysicalValidationOptions {
  physicsMode?: string;
  intentionalExceptions?: readonly string[];
}

function finding(params: Omit<ProductionFinding, "suggested_patch"> & {
  suggested_patch?: Record<string, unknown> | null;
}): ProductionFinding {
  return { ...params, suggested_patch: params.suggested_patch ?? null };
}

function activeSupport(snapshot: ProductionSnapshot, entityId: string, kinds: string[]): boolean {
  return snapshot.supports.some(
    (relation) =>
      relation.active && relation.supported_entity_id === entityId && kinds.includes(relation.kind)
  );
}

function anyActiveSupport(snapshot: ProductionSnapshot, entityId: string): boolean {
  return snapshot.supports.some(
    (relation) => relation.active && relation.supported_entity_id === entityId
  );
}

function activeHandContact(
  snapshot: ProductionSnapshot,
  holderEntityId: string,
  objectEntityId: string
): boolean {
  return snapshot.contacts.some(
    (contact) =>
      contact.active &&
      contact.source_entity_id === holderEntityId &&
      contact.target_entity_id === objectEntityId &&
      (contact.source_limb_id === "left_hand" || contact.source_limb_id === "right_hand")
  );
}

function isNoHolderEntityId(value: string | null | undefined): boolean {
  return /^(?:entity_)?(?:none|null|nil|no_holder|nobody|no_one)$/iu.test(value ?? "");
}

// A room / set / architecture entity (obj_bedroom, "kitchen floor", a wall…) is
// the ENVIRONMENT itself — not a portable object resting on ground/surface/hand
// — so it never needs a holder or support relation and must not raise
// OBJECT_SUPPORT_MISSING.
function isEnvironmentEntity(entityId: string | null | undefined): boolean {
  return /\b(?:room|bedroom|kitchen|bathroom|living_?room|hall(?:way)?|corridor|floor|wall|ceiling|window|door(?:way)?|background|backdrop|scene|scenery|set|space|environment|interior|exterior|street|road|sky|building|house|store|shop|market|garden|yard)\b/iu.test(
    String(entityId ?? "")
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function permitsUnsupportedObject(
  state: ProductionState,
  entityId: string,
  options: PhysicalValidationOptions
): boolean {
  const exceptions = options.intentionalExceptions ?? [];
  if (exceptions.length === 0) return false;
  const entry = state.registry.find((candidate) => candidate.entity_id === entityId);
  const names = [entityId, entry?.display_name, entry?.source_ref, ...(entry?.aliases ?? [])]
    .filter((value): value is string => Boolean(value?.trim()));
  return exceptions.some((exception) => {
    const allowsUnsupported = /\b(?:levitat|float|hover|fly|airborne|weightless|zero gravity|no gravity|telekinesis|phase through)\w*\b|\b(?:bay|lơ lửng|không trọng lực|phi trọng lực|xuyên vật|dịch chuyển bằng ý niệm)\b/iu.test(exception);
    if (!allowsUnsupported) return false;
    const universal = /\b(?:all|every|entire world|everything|zero gravity|no gravity)\b|\b(?:mọi|tất cả|toàn bộ|không trọng lực|phi trọng lực)\b/iu.test(exception);
    return universal || names.some((name) => new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`,
      "iu"
    ).test(exception));
  });
}

function mentionedReceivingObjects(
  state: ProductionState,
  shot: ShotState,
  text: string,
  excludedEntityIds: Array<string | null>
): string[] {
  if (!/\b(?:into|onto|inside|in|on)\b|\b(?:vào|lên|trong)\b/iu.test(text)) return [];
  const excluded = new Set(excludedEntityIds.filter((value): value is string => Boolean(value)));
  const snapshotIds = new Set(
    [...shot.start_snapshot.entities, ...shot.end_snapshot.entities]
      .filter((entity) => entity.kind === "object" || entity.kind === "product")
      .map((entity) => entity.entity_id)
  );
  return state.registry
    .filter((entry) => snapshotIds.has(entry.entity_id) && !excluded.has(entry.entity_id))
    .filter((entry) =>
      [entry.display_name, entry.source_ref, ...entry.aliases]
        .filter((name): name is string => Boolean(name?.trim()))
        .some((name) => new RegExp(
          `\\b(?:into|onto|inside|in|on)\\s+(?:the\\s+)?${escapeRegExp(name)}(?:$|[^\\p{L}\\p{N}])|\\b(?:vào|lên|trong)\\s+(?:cái|chiếc)?\\s*${escapeRegExp(name)}(?:$|[^\\p{L}\\p{N}])`,
          "iu"
        ).test(text))
    )
    .map((entry) => entry.entity_id);
}

function validateLimb(
  limb: LimbState,
  shotId: string,
  characterId: string,
  boundary: "start" | "end"
): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  if (limb.limb_id.endsWith("hand") && limb.held_object_ids.length > 1) {
    findings.push(
      finding({
        code: "HAND_OCCUPANCY_CONFLICT",
        severity: "critical",
        message: "One hand cannot hold multiple independent objects at the same time.",
        shot_id: shotId,
        entity_ids: [characterId, ...limb.held_object_ids],
        evidence: { boundary, limb_id: limb.limb_id, held_object_ids: limb.held_object_ids },
        suggested_patch: {
          op: "split_hand_tasks",
          character_id: characterId,
          limb_id: limb.limb_id,
        },
      })
    );
  }
  if (limb.limb_id.endsWith("hand") && limb.activities.length > 1) {
    findings.push(
      finding({
        code: "HAND_SIMULTANEOUS_TASK_CONFLICT",
        severity: "critical",
        message: "One hand has multiple simultaneous physical jobs.",
        shot_id: shotId,
        entity_ids: [characterId],
        evidence: { boundary, limb_id: limb.limb_id, activities: limb.activities },
        suggested_patch: { op: "serialize_actions", limb_id: limb.limb_id },
      })
    );
  }
  return findings;
}

function validateSnapshot(
  shot: ShotState,
  snapshot: ProductionSnapshot,
  boundary: "start" | "end",
  state: ProductionState,
  options: PhysicalValidationOptions
): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  const occupied = new Map<string, ProductionEntitySnapshot>();

  for (const entity of snapshot.entities) {
    const character = entity.character_physics;
    if (character) {
      if (character.instance_count !== 1) {
        findings.push(
          finding({
            code: "IDENTITY_MULTIPLICITY_INVALID",
            severity: "critical",
            message: "A character contract must contain exactly one physical instance.",
            shot_id: shot.shot_id,
            entity_ids: [entity.entity_id],
            evidence: { boundary, instance_count: character.instance_count },
            suggested_patch: { op: "set_instance_count", value: 1 },
          })
        );
      }
      const topology = character.topology;
      if (topology.model === "human") {
        const expected = {
          torso_count: 1,
          arm_count: 2,
          hand_count: 2,
          leg_count: 2,
          foot_count: 2,
        };
        const mismatches = Object.fromEntries(
          Object.entries(expected).filter(([field, value]) => topology[field as keyof typeof expected] !== value)
        );
        if (Object.keys(mismatches).length > 0) {
          findings.push(
            finding({
              code: "BODY_TOPOLOGY_INVALID",
              severity: "critical",
              message: "Human body topology has missing or extra declared parts.",
              shot_id: shot.shot_id,
              entity_ids: [entity.entity_id],
              evidence: { boundary, topology, expected },
              suggested_patch: { op: "review_body_topology", expected },
            })
          );
        }
        const missingLimbs = Object.values(character.limbs)
          .filter((limb) => limb.exists === false)
          .map((limb) => limb.limb_id);
        if (missingLimbs.length > 0) {
          findings.push(
            finding({
              code: "BODY_LIMB_MISSING",
              severity: "critical",
              message: "A declared human body is missing one or more required limbs.",
              shot_id: shot.shot_id,
              entity_ids: [entity.entity_id],
              evidence: { boundary, missing_limb_ids: missingLimbs },
              suggested_patch: { op: "review_limb_state", limb_ids: missingLimbs },
            })
          );
        }
      }
      for (const limb of Object.values(character.limbs)) {
        findings.push(...validateLimb(limb, shot.shot_id, entity.entity_id, boundary));
      }
      const pose = character.pose.pose;
      if (pose === "sitting" && !activeSupport(snapshot, entity.entity_id, ["seat", "body"])) {
        findings.push(
          finding({
            code: "SUPPORT_MISSING_FOR_SITTING",
            severity: "high",
            message: "Sitting pose has no active seat/body support relation.",
            shot_id: shot.shot_id,
            entity_ids: [entity.entity_id],
            evidence: { boundary, pose, supports: snapshot.supports },
            suggested_patch: { op: "declare_support", kind: "seat" },
          })
        );
      }
      if (pose === "standing" && !activeSupport(snapshot, entity.entity_id, ["ground", "surface"])) {
        findings.push(
          finding({
            code: "SUPPORT_MISSING_FOR_STANDING",
            severity: "high",
            message: "Standing pose has no active ground/surface support relation.",
            shot_id: shot.shot_id,
            entity_ids: [entity.entity_id],
            evidence: { boundary, pose, supports: snapshot.supports },
            suggested_patch: { op: "declare_support", kind: "ground" },
          })
        );
      }

    }

    const object = entity.object_physics;
    if (
      object?.existence === "exists" &&
      object.visibility === "visible" &&
      !entity.holder_entity_id &&
      entity.position &&
      !isEnvironmentEntity(entity.entity_id) &&
      !permitsUnsupportedObject(state, entity.entity_id, options) &&
      !activeSupport(snapshot, entity.entity_id, ["ground", "surface", "hand", "body"])
    ) {
      findings.push(
        finding({
          code: "OBJECT_SUPPORT_MISSING",
          severity: "high",
          message: "A visible existing object has no holder or support relation.",
          shot_id: shot.shot_id,
          entity_ids: [entity.entity_id],
          evidence: { boundary, position: entity.position },
          suggested_patch: { op: "declare_holder_or_support" },
        })
      );
    }
    if (
      entity.holder_entity_id &&
      !isNoHolderEntityId(entity.holder_entity_id) &&
      !snapshot.contacts.some(
        (contact) =>
          contact.active &&
          contact.source_entity_id === entity.holder_entity_id &&
          contact.target_entity_id === entity.entity_id
      )
    ) {
      findings.push(
        finding({
          code: "HOLDER_CONTACT_MISSING",
          severity: "high",
          message: "An object declares a holder but has no active holder-to-object contact.",
          shot_id: shot.shot_id,
          entity_ids: [entity.holder_entity_id, entity.entity_id],
          evidence: { boundary, holder_entity_id: entity.holder_entity_id },
          suggested_patch: { op: "declare_active_contact" },
        })
      );
    }
    if (
      entity.holder_entity_id &&
      !isNoHolderEntityId(entity.holder_entity_id) &&
      snapshot.entities.some(
        (candidate) =>
          candidate.entity_id === entity.holder_entity_id && Boolean(candidate.character_physics)
      ) &&
      !activeHandContact(snapshot, entity.holder_entity_id, entity.entity_id)
    ) {
      findings.push(
        finding({
          code: "HELD_OBJECT_HAND_UNASSIGNED",
          severity: "high",
          message: "A character-held object must identify the hand that grips and supports it.",
          shot_id: shot.shot_id,
          entity_ids: [entity.holder_entity_id, entity.entity_id],
          evidence: { boundary, holder_entity_id: entity.holder_entity_id },
          suggested_patch: { op: "assign_held_object_to_free_hand" },
        })
      );
    }

    if (character) {
      for (const limb of Object.values(character.limbs)) {
        for (const heldObjectId of limb.held_object_ids) {
          const heldObject = snapshot.entities.find(
            (candidate) => candidate.entity_id === heldObjectId
          );
          if (heldObject?.holder_entity_id !== entity.entity_id) {
            findings.push(
              finding({
                code: "HOLDER_LIMB_MISMATCH",
                severity: "critical",
                message: "Hand occupancy and object holder state disagree.",
                shot_id: shot.shot_id,
                entity_ids: [entity.entity_id, heldObjectId],
                evidence: {
                  boundary,
                  limb_id: limb.limb_id,
                  object_holder_entity_id: heldObject?.holder_entity_id ?? null,
                },
                suggested_patch: { op: "reconcile_holder_and_hand_state" },
              })
            );
          }
        }
      }
    }

    const volume = character?.occupied_volume_id ?? object?.occupied_volume_id;
    if (volume) {
      const previous = occupied.get(volume);
      if (previous) {
        findings.push(
          finding({
            code: "COLLISION_OCCUPIED_VOLUME_CONFLICT",
            severity: "critical",
            message: "Two physical entities occupy the same declared volume.",
            shot_id: shot.shot_id,
            entity_ids: [previous.entity_id, entity.entity_id],
            evidence: { boundary, occupied_volume_id: volume },
            suggested_patch: { op: "separate_occupied_volumes" },
          })
        );
      } else occupied.set(volume, entity);
    }
  }
  return findings;
}

export function validatePhysicalState(
  state: ProductionState,
  options: PhysicalValidationOptions = {}
): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  for (const shot of state.shots) {
    findings.push(...validateSnapshot(shot, shot.start_snapshot, "start", state, options));
    findings.push(...validateSnapshot(shot, shot.end_snapshot, "end", state, options));
    for (const change of shot.changes) {
      const holderChanged = change.from_holder_entity_id !== change.to_holder_entity_id;
      if (
        holderChanged &&
        (!change.body_part || !change.contact_entity_ids?.includes(change.entity_id))
      ) {
        findings.push(
          finding({
            code: "CONTACT_CAUSALITY_MISSING",
            severity: "high",
            message: "Holder changes without a declared limb and contact point.",
            shot_id: shot.shot_id,
            entity_ids: [change.entity_id].concat(
              [change.from_holder_entity_id, change.to_holder_entity_id].filter(
                (value): value is string => Boolean(value)
              )
            ),
            evidence: {
              action: change.action,
              body_part: change.body_part ?? null,
              contact_entity_ids: change.contact_entity_ids ?? [],
            },
            suggested_patch: { op: "declare_contact_transition", entity_id: change.entity_id },
          })
        );
      }
      if (
        holderChanged &&
        change.body_part &&
        change.body_part !== "left_hand" &&
        change.body_part !== "right_hand"
      ) {
        findings.push(
          finding({
            code: "INVALID_HOLD_BODY_PART",
            severity: "critical",
            message: "Pickup, handoff or release must use a declared hand, not a non-hand body part.",
            shot_id: shot.shot_id,
            entity_ids: [change.entity_id],
            evidence: { action: change.action, body_part: change.body_part },
            suggested_patch: { op: "assign_free_hand_to_holder_transition" },
          })
        );
      }
      if (
        holderChanged &&
        Boolean(change.from_holder_entity_id) &&
        !change.to_holder_entity_id &&
        !permitsUnsupportedObject(state, change.entity_id, options) &&
        !anyActiveSupport(shot.end_snapshot, change.entity_id)
      ) {
        findings.push(
          finding({
            code: "RELEASE_WITHOUT_SUPPORT",
            severity: "critical",
            message: "An object is released without a receiving hand, body, surface or ground support.",
            shot_id: shot.shot_id,
            entity_ids: [change.entity_id, change.from_holder_entity_id!],
            evidence: { action: change.action, end_supports: shot.end_snapshot.supports },
            suggested_patch: { op: "add_receiving_support_before_release" },
          })
        );
      }
    }

    for (const action of shot.actions) {
      const text = `${action.verb} ${action.evidence} ${action.physical_conditions.join(" ")}`;
      const receiverIds = mentionedReceivingObjects(state, shot, text, [
        action.subject_entity_id,
        action.object_entity_id,
      ]);
      for (const receiverId of receiverIds) {
        const start = shot.start_snapshot.entities.find((entity) => entity.entity_id === receiverId);
        const end = shot.end_snapshot.entities.find((entity) => entity.entity_id === receiverId);
        const supportedAtStart = Boolean(start?.holder_entity_id) || anyActiveSupport(shot.start_snapshot, receiverId);
        const supportedAtEnd = Boolean(end?.holder_entity_id) || anyActiveSupport(shot.end_snapshot, receiverId);
        if (
          (supportedAtStart && supportedAtEnd) ||
          permitsUnsupportedObject(state, receiverId, options)
        ) continue;
        findings.push(
          finding({
            code: "RECEIVER_SUPPORT_MISSING",
            severity: "critical",
            message: "A receiving container or work object loses physical support during another object's action.",
            shot_id: shot.shot_id,
            entity_ids: [receiverId].concat(
              action.object_entity_id ? [action.object_entity_id] : []
            ),
            evidence: {
              action_id: action.action_id,
              action: action.verb,
              supported_at_start: supportedAtStart,
              supported_at_end: supportedAtEnd,
            },
            suggested_patch: { op: "preserve_receiver_support_through_action" },
          })
        );
      }
    }

    const startById = new Map(shot.start_snapshot.entities.map((entity) => [entity.entity_id, entity]));
    for (const endEntity of shot.end_snapshot.entities) {
      const startEntity = startById.get(endEntity.entity_id);
      const startPose = startEntity?.character_physics?.pose.pose;
      const endPose = endEntity.character_physics?.pose.pose;
      if (startPose !== "sitting" || endPose !== "standing") continue;
      const transitionText = shot.changes
        .filter((change) => change.entity_id === endEntity.entity_id)
        .map((change) => `${change.action} ${change.caused_by} ${(change.physical_conditions ?? []).join(" ")}`)
        .join(" ");
      const hasStandMechanics =
        /\b(?:push|brace|shift(?:s|ed|ing)? weight|lean(?:s|ed|ing)? forward|extend(?:s|ed|ing)? (?:the )?legs?|stand(?:s|ing)? up)\b|\b(?:chống tay|chuyển trọng tâm|duỗi chân|đứng lên)\b/iu.test(
          transitionText
        );
      if (!hasStandMechanics) {
        findings.push(
          finding({
            code: "POSE_TRANSITION_UNSUPPORTED",
            severity: "high",
            message: "Sitting-to-standing transition lacks brace, weight shift or leg-extension mechanics.",
            shot_id: shot.shot_id,
            entity_ids: [endEntity.entity_id],
            evidence: { start_pose: startPose, end_pose: endPose, transition_text: transitionText },
            suggested_patch: { op: "add_visible_pose_transition_mechanics" },
          })
        );
      }
    }
  }

  for (let index = 1; index < state.shots.length; index++) {
    const boundary = state.boundaries[index];
    if (boundary?.transition_mode !== "continuous") continue;
    const previous = state.shots[index - 1]!;
    const current = state.shots[index]!;
    const previousObjects = new Map(
      previous.end_snapshot.entities
        .filter((entity) => entity.object_physics?.existence === "exists")
        .map((entity) => [entity.entity_id, entity])
    );
    for (const entity of current.start_snapshot.entities) {
      if (
        previousObjects.has(entity.entity_id) &&
        entity.object_physics?.existence === "does_not_exist"
      ) {
        findings.push(
          finding({
            code: "OBJECT_PERSISTENCE_BROKEN",
            severity: "critical",
            message: "An existing object explicitly disappears across a continuous boundary.",
            shot_id: current.shot_id,
            entity_ids: [entity.entity_id],
            evidence: { from_shot_id: previous.shot_id, to_shot_id: current.shot_id },
            suggested_patch: {
              op: "review_object_lifecycle",
              choices: ["restore_object", "add_visible_removal", "change_transition_mode"],
            },
          })
        );
      }
    }
  }
  return findings;
}
