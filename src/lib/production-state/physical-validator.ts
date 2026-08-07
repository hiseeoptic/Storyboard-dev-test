import type {
  LimbState,
  ProductionEntitySnapshot,
  ProductionFinding,
  ProductionSnapshot,
  ProductionState,
  ShotState,
} from "./types.ts";

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
  boundary: "start" | "end"
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

export function validatePhysicalState(state: ProductionState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  for (const shot of state.shots) {
    findings.push(...validateSnapshot(shot, shot.start_snapshot, "start"));
    findings.push(...validateSnapshot(shot, shot.end_snapshot, "end"));
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
