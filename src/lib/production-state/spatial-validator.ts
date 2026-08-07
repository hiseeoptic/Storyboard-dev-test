import type {
  EntityPlacementState,
  ProductionFinding,
  ProductionState,
  ShotState,
  SpatialGraphState,
} from "./types.ts";

function finding(params: Omit<ProductionFinding, "suggested_patch"> & {
  suggested_patch?: Record<string, unknown> | null;
}): ProductionFinding {
  return { ...params, suggested_patch: params.suggested_patch ?? null };
}

function graphErrors(shot: ShotState, graph: SpatialGraphState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  const zoneIds = new Set(graph.zones.map((zone) => zone.zone_id));
  const anchorIds = new Set(graph.anchors.map((anchor) => anchor.anchor_id));
  for (const connector of graph.connectors) {
    if (!zoneIds.has(connector.from_zone_id) || !zoneIds.has(connector.to_zone_id)) {
      findings.push(
        finding({
          code: "SPATIAL_CONNECTOR_INVALID",
          severity: "high",
          message: "Spatial connector references a zone that is not in the graph.",
          shot_id: shot.shot_id,
          entity_ids: [],
          evidence: { connector },
          suggested_patch: { op: "repair_connector_zone_reference" },
        })
      );
    }
  }
  for (const snapshot of [shot.start_snapshot, shot.end_snapshot]) {
    for (const placement of snapshot.placements) {
      if (placement.zone_id && !zoneIds.has(placement.zone_id)) {
        findings.push(
          finding({
            code: "SPATIAL_PLACEMENT_ZONE_INVALID",
            severity: "high",
            message: "Entity placement references an unknown zone.",
            shot_id: shot.shot_id,
            entity_ids: [placement.entity_id],
            evidence: { placement },
            suggested_patch: { op: "assign_existing_zone" },
          })
        );
      }
      if (placement.anchor_id && !anchorIds.has(placement.anchor_id)) {
        findings.push(
          finding({
            code: "SPATIAL_PLACEMENT_ANCHOR_INVALID",
            severity: "high",
            message: "Entity placement references an unknown anchor.",
            shot_id: shot.shot_id,
            entity_ids: [placement.entity_id],
            evidence: { placement },
            suggested_patch: { op: "assign_existing_anchor" },
          })
        );
      }
    }
  }
  return findings;
}

function changedPlacement(before: EntityPlacementState, after: EntityPlacementState): boolean {
  return (
    before.zone_id !== after.zone_id ||
    before.anchor_id !== after.anchor_id ||
    (before.world_side !== "unknown" &&
      after.world_side !== "unknown" &&
      before.world_side !== after.world_side)
  );
}

function hasMovementEvidence(shot: ShotState, entityId: string): boolean {
  return shot.changes.some(
    (change) =>
      change.entity_id === entityId &&
      /\b(?:walk|move|cross|step|enter|exit|sit|stand|swap|change seats?)\b|\b(?:đi|di chuyển|bước|vào|ra|đổi chỗ|đổi ghế)\b/iu.test(
        `${change.action} ${change.caused_by}`
      )
  );
}

function connected(graph: SpatialGraphState | null, from: string, to: string): boolean {
  if (from === to) return true;
  if (!graph) return false;
  const adjacency = new Map<string, string[]>();
  for (const connector of graph.connectors.filter((item) => item.path_clear !== false)) {
    adjacency.set(connector.from_zone_id, [...(adjacency.get(connector.from_zone_id) ?? []), connector.to_zone_id]);
    if (connector.bidirectional !== false) {
      adjacency.set(connector.to_zone_id, [...(adjacency.get(connector.to_zone_id) ?? []), connector.from_zone_id]);
    }
  }
  const queue = [from];
  const visited = new Set(queue);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (next === to) return true;
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}

export function validateSpatialState(state: ProductionState): ProductionFinding[] {
  const findings: ProductionFinding[] = [];
  for (const shot of state.shots) {
    if (shot.spatial_graph) findings.push(...graphErrors(shot, shot.spatial_graph));
    for (const [boundary, snapshot] of [
      ["start", shot.start_snapshot],
      ["end", shot.end_snapshot],
    ] as const) {
      const visibleCharacters = snapshot.entities.filter((entity) => entity.kind === "character");
      const placed = new Set(snapshot.placements.map((placement) => placement.entity_id));
      if (visibleCharacters.length >= 2) {
        const missing = visibleCharacters.filter((entity) => !placed.has(entity.entity_id));
        if (missing.length > 0 || !shot.spatial_graph) {
          findings.push(
            finding({
              code: "SPATIAL_MULTI_CHARACTER_PLACEMENT_MISSING",
              severity: "high",
              message: "Every character in a multi-character shot needs canonical placement.",
              shot_id: shot.shot_id,
              entity_ids: missing.map((entity) => entity.entity_id),
              evidence: { boundary, has_spatial_graph: Boolean(shot.spatial_graph) },
              suggested_patch: { op: "declare_character_placements" },
            })
          );
        }
      }
    }
  }

  for (let index = 1; index < state.shots.length; index++) {
    if (state.boundaries[index]?.transition_mode !== "continuous") continue;
    const previous = state.shots[index - 1]!;
    const current = state.shots[index]!;
    const beforeById = new Map(
      previous.end_snapshot.placements.map((placement) => [placement.entity_id, placement])
    );
    for (const after of current.start_snapshot.placements) {
      const before = beforeById.get(after.entity_id);
      if (!before || !changedPlacement(before, after) || hasMovementEvidence(current, after.entity_id)) continue;
      const pathExists =
        before.zone_id && after.zone_id
          ? connected(current.spatial_graph ?? previous.spatial_graph, before.zone_id, after.zone_id)
          : false;
      findings.push(
        finding({
          code: pathExists ? "SPATIAL_UNEXPLAINED_REPOSITION" : "SPATIAL_TELEPORT_OR_SWAP",
          severity: "high",
          message: pathExists
            ? "Entity changes placement across a continuous boundary without visible movement."
            : "Entity changes to an unconnected zone/anchor across a continuous boundary.",
          shot_id: current.shot_id,
          entity_ids: [after.entity_id],
          evidence: { from: before, to: after, path_exists: pathExists },
          suggested_patch: {
            op: "review_spatial_transition",
            choices: ["add_visible_movement", "restore_previous_placement", "change_transition_mode"],
          },
        })
      );
    }
  }
  return findings;
}
