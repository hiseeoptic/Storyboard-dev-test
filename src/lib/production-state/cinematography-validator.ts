import type {
  LightingState,
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

function validateShotCamera(shot: ShotState): ProductionFinding[] {
  const graph = shot.spatial_graph;
  if (
    shot.camera_state.zone_id &&
    graph &&
    !graph.zones.some((zone) => zone.zone_id === shot.camera_state.zone_id)
  ) {
    return [
      finding({
        code: "CAMERA_ZONE_INVALID",
        severity: "high",
        message: "Camera references a zone outside the shot's spatial graph.",
        shot_id: shot.shot_id,
        entity_ids: [],
        evidence: { camera_zone_id: shot.camera_state.zone_id },
        suggested_patch: { op: "assign_camera_to_existing_zone" },
      }),
    ];
  }
  return [];
}

function placementScreenFlips(previous: ShotState, current: ShotState): string[] {
  const before = new Map(
    previous.end_snapshot.placements.map((placement) => [placement.entity_id, placement.screen_side])
  );
  return current.start_snapshot.placements
    .filter((placement) => {
      const old = before.get(placement.entity_id);
      return (
        old &&
        old !== "unknown" &&
        placement.screen_side !== "unknown" &&
        old !== placement.screen_side
      );
    })
    .map((placement) => placement.entity_id);
}

function oppositeDirection(a: LightingState["key_direction"], b: LightingState["key_direction"]): boolean {
  return (
    (a === "left" && b === "right") ||
    (a === "right" && b === "left") ||
    (a === "front" && b === "back") ||
    (a === "back" && b === "front") ||
    (a === "top" && b === "bottom") ||
    (a === "bottom" && b === "top")
  );
}

function validateLightingGeometry(shot: ShotState): ProductionFinding[] {
  const light = shot.lighting_state;
  if (
    light.key_direction !== "unknown" &&
    light.key_direction !== "diffuse" &&
    light.shadow_direction !== "unknown" &&
    light.shadow_direction !== "diffuse" &&
    !oppositeDirection(light.key_direction, light.shadow_direction)
  ) {
    return [
      finding({
        code: "LIGHTING_SHADOW_GEOMETRY_INVALID",
        severity: "high",
        message: "Declared shadow direction is not opposite the directional key light.",
        shot_id: shot.shot_id,
        entity_ids: [],
        evidence: {
          key_direction: light.key_direction,
          shadow_direction: light.shadow_direction,
        },
        suggested_patch: { op: "review_light_shadow_geometry" },
      }),
    ];
  }
  return [];
}

function validateVisibilitySnapshot(
  shot: ShotState,
  snapshot: ProductionSnapshot,
  boundary: "start" | "end"
): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  const byEntity = new Map<string, typeof snapshot.visual_instances>();
  for (const instance of snapshot.visual_instances) {
    byEntity.set(instance.entity_id, [...(byEntity.get(instance.entity_id) ?? []), instance]);
    if (instance.classification === "reflection" && !instance.source_surface_id) {
      findings.push(
        finding({
          code: "REFLECTION_SOURCE_MISSING",
          severity: "high",
          message: "Reflection instance must identify its mirror/reflective source surface.",
          shot_id: shot.shot_id,
          entity_ids: [instance.entity_id],
          evidence: { boundary, instance },
          suggested_patch: { op: "declare_reflection_surface" },
        })
      );
    }
    if (instance.classification === "background_duplicate") {
      findings.push(
        finding({
          code: "IDENTITY_BACKGROUND_DUPLICATE",
          severity: "critical",
          message: "A character is duplicated as another physical background instance.",
          shot_id: shot.shot_id,
          entity_ids: [instance.entity_id],
          evidence: { boundary, instance },
          suggested_patch: { op: "remove_background_duplicate" },
        })
      );
    }
  }
  for (const [entityId, instances] of byEntity) {
    const physicalCount = instances.filter(
      (instance) => instance.visible && instance.classification === "primary"
    ).length;
    if (physicalCount > 1) {
      findings.push(
        finding({
          code: "IDENTITY_MULTIPLE_PRIMARY_INSTANCES",
          severity: "critical",
          message: "One character has more than one primary physical visual instance.",
          shot_id: shot.shot_id,
          entity_ids: [entityId],
          evidence: { boundary, primary_instance_count: physicalCount },
          suggested_patch: { op: "keep_single_primary_instance" },
        })
      );
    }
  }
  for (const occlusion of snapshot.occlusions) {
    if (!occlusion.entity_still_exists) {
      findings.push(
        finding({
          code: "OCCLUSION_ERASES_EXISTENCE",
          severity: "critical",
          message: "Occlusion or out-of-frame state cannot delete the entity from the world.",
          shot_id: shot.shot_id,
          entity_ids: [occlusion.occluded_entity_id],
          evidence: { boundary, occlusion },
          suggested_patch: { op: "preserve_occluded_entity_existence" },
        })
      );
    }
  }
  return findings;
}

export function validateCinematographyState(state: ProductionState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  for (const shot of state.shots) {
    findings.push(...validateShotCamera(shot));
    findings.push(...validateLightingGeometry(shot));
    findings.push(...validateVisibilitySnapshot(shot, shot.start_snapshot, "start"));
    findings.push(...validateVisibilitySnapshot(shot, shot.end_snapshot, "end"));
  }
  for (let index = 1; index < state.shots.length; index++) {
    const boundary = state.boundaries[index];
    if (boundary?.transition_mode !== "continuous") continue;
    const previous = state.shots[index - 1]!;
    const current = state.shots[index]!;
    const beforeCamera = previous.camera_state;
    const afterCamera = current.camera_state;
    if (
      beforeCamera.axis_id &&
      beforeCamera.axis_id === afterCamera.axis_id &&
      ((beforeCamera.axis_side === "left" && afterCamera.axis_side === "right") ||
        (beforeCamera.axis_side === "right" && afterCamera.axis_side === "left"))
    ) {
      findings.push(
        finding({
          code: "CAMERA_AXIS_180_CROSS",
          severity: "high",
          message: "Continuous edit crosses the established 180-degree axis.",
          shot_id: current.shot_id,
          entity_ids: [],
          evidence: { from: beforeCamera, to: afterCamera },
          suggested_patch: { op: "restore_axis_side_or_add_visible_axis_crossing" },
        })
      );
    }
    const flippedEntities = placementScreenFlips(previous, current);
    if (flippedEntities.length > 0) {
      findings.push(
        finding({
          code: "CAMERA_SCREEN_DIRECTION_FLIP",
          severity: "high",
          message: "Character screen direction flips across a continuous edit.",
          shot_id: current.shot_id,
          entity_ids: flippedEntities,
          evidence: { from_shot_id: previous.shot_id, to_shot_id: current.shot_id },
          suggested_patch: { op: "restore_screen_direction" },
        })
      );
    }

    const beforeLight = previous.lighting_state;
    const afterLight = current.lighting_state;
    const temperatureDrift =
      beforeLight.color_temperature_k !== null &&
      afterLight.color_temperature_k !== null &&
      Math.abs(beforeLight.color_temperature_k - afterLight.color_temperature_k) > 300;
    const directionDrift =
      beforeLight.key_direction !== "unknown" &&
      afterLight.key_direction !== "unknown" &&
      beforeLight.key_direction !== afterLight.key_direction;
    const timeDrift =
      beforeLight.time_of_day &&
      afterLight.time_of_day &&
      lower(beforeLight.time_of_day) !== lower(afterLight.time_of_day);
    if (temperatureDrift || directionDrift || timeDrift) {
      findings.push(
        finding({
          code: "LIGHTING_CONTINUITY_DRIFT",
          severity: "high",
          message: "Lighting changes across a continuous boundary without a declared reset.",
          shot_id: current.shot_id,
          entity_ids: [],
          evidence: {
            temperature_drift: temperatureDrift,
            direction_drift: directionDrift,
            time_drift: Boolean(timeDrift),
            from: beforeLight,
            to: afterLight,
          },
          suggested_patch: { op: "restore_previous_lighting_or_change_transition" },
        })
      );
    }
  }
  return findings;
}

function lower(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}
