import type { VideoSegment } from "@/types";
import { stableIdSlug } from "./id-registry.ts";
import type {
  EntityPlacementState,
  ProductionEntitySnapshot,
  ProductionRegistryEntry,
  ShotState,
  SpatialConnectorState,
  SpatialGraphState,
  SpatialZoneKind,
  SpatialZoneState,
} from "./types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function lower(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  used.add(id);
  return id;
}

function canonicalZoneLabel(value: string): string {
  const normalized = lower(value)
    .replace(/\b(?:only|declared|continuous|walkable|scene|zone|area)\b/giu, " ")
    .replace(/\b(?:duy nhất|đã khai báo|liên tục|đi được|khu vực|vùng cảnh)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || lower(value);
}

function zoneKind(label: string): SpatialZoneKind {
  if (/\b(?:stair|stairs|staircase|landing)\b|\b(?:cầu thang|bậc thang|chiếu nghỉ)\b/iu.test(label)) return "stairs";
  if (/\b(?:doorway|threshold|entrance|exit)\b|\b(?:cửa|ngưỡng)\b/iu.test(label)) return "threshold";
  if (/\b(?:chair|seat|bench|sofa|stool)\b|\b(?:ghế)\b/iu.test(label)) return "seat";
  if (/\b(?:table|counter|desk|shelf)\b|\b(?:bàn|quầy|kệ)\b/iu.test(label)) return "support_surface";
  if (/\b(?:wall|railing|barrier|fence)\b|\b(?:tường|lan can|rào)\b/iu.test(label)) return "barrier";
  if (/\b(?:floor|room|lobby|balcony|path|hall|kitchen|street|office)\b|\b(?:sàn|phòng|sảnh|ban công|lối|bếp|đường|văn phòng)\b/iu.test(label)) return "walkable";
  return "unknown";
}

function connectorKind(text: string): SpatialConnectorState["kind"] {
  if (/\b(?:stairs?|staircase)\b|\b(?:cầu thang|bậc thang)\b/iu.test(text)) return "stairs";
  if (/\b(?:doorway|door)\b|\b(?:cửa)\b/iu.test(text)) return "doorway";
  if (/\b(?:threshold)\b|\b(?:ngưỡng)\b/iu.test(text)) return "threshold";
  if (/\b(?:path|route|floor|open)\b|\b(?:lối|đường|sàn|mở)\b/iu.test(text)) return "open_path";
  return "unknown";
}

function placementSentence(text: string, names: string[]): string {
  const parts = text.split(/[.;\n]+/).map(clean).filter(Boolean);
  const ranked = parts
    .map((part) => {
      const value = lower(part);
      const positions = names
        .map((name) => value.indexOf(lower(name)))
        .filter((position) => position >= 0);
      return { part, position: positions.length > 0 ? Math.min(...positions) : Number.POSITIVE_INFINITY };
    })
    .filter((candidate) => Number.isFinite(candidate.position))
    .sort((a, b) => a.position - b.position);
  return ranked[0]?.part ?? text;
}

function findZone(sentence: string, zones: SpatialZoneState[]): string | null {
  if (zones.length === 1) return zones[0]?.zone_id ?? null;
  const value = lower(sentence);
  const matches = zones.filter((zone) => value.includes(lower(zone.label)));
  return matches.length === 1 ? matches[0]!.zone_id : null;
}

function side(text: string, screen: boolean): EntityPlacementState["world_side"] {
  const value = lower(text);
  if (screen) {
    if (/\b(?:screen[- ]left|frame[- ]left)\b|\b(?:trái khung hình)\b/iu.test(value)) return "left";
    if (/\b(?:screen[- ]right|frame[- ]right)\b|\b(?:phải khung hình)\b/iu.test(value)) return "right";
  } else {
    if (/\b(?:world[- ]left|to the left of|on the left)\b|\b(?:bên trái|phía trái)\b/iu.test(value)) return "left";
    if (/\b(?:world[- ]right|to the right of|on the right)\b|\b(?:bên phải|phía phải)\b/iu.test(value)) return "right";
  }
  if (/\b(?:center|centre|middle)\b|\b(?:trung tâm|ở giữa)\b/iu.test(value)) return "center";
  return "unknown";
}

function distance(text: string): string | null {
  return clean(
    text.match(/\b(?:about|approximately|roughly)?\s*\d+(?:\.\d+)?\s*(?:cm|m|meter|meters|metre|metres|feet|ft)\b/iu)?.[0]
  ) || null;
}

function facingEntity(
  sentence: string,
  currentId: string,
  registry: ProductionRegistryEntry[]
): string | null {
  if (!/\b(?:facing|faces|looks? toward)\b|\b(?:đối diện|hướng về|nhìn về)\b/iu.test(sentence)) return null;
  const value = lower(sentence);
  const target = registry.find(
    (entry) =>
      entry.entity_id !== currentId &&
      [entry.display_name, entry.source_ref, ...entry.aliases]
        .filter((name): name is string => Boolean(name))
        .some((name) => value.includes(lower(name)))
  );
  return target?.entity_id ?? null;
}

function compilePlacements(
  entities: ProductionEntitySnapshot[],
  placementText: string,
  zones: SpatialZoneState[],
  registry: ProductionRegistryEntry[]
): EntityPlacementState[] {
  const registryById = new Map(registry.map((entry) => [entry.entity_id, entry]));
  return entities
    .filter((entity) => entity.kind === "character")
    .map((entity) => {
      const entry = registryById.get(entity.entity_id);
      const names = [entry?.display_name, entry?.source_ref, ...(entry?.aliases ?? [])].filter(
        (name): name is string => Boolean(name)
      );
      const sentence = placementSentence(placementText, names);
      return {
        entity_id: entity.entity_id,
        zone_id: findZone(sentence, zones),
        anchor_id: null,
        position_label: sentence,
        body_orientation: clean(entity.orientation) || null,
        facing_entity_id: facingEntity(sentence, entity.entity_id, registry),
        distance_to_anchor: distance(sentence),
        world_side: side(sentence, false),
        screen_side: side(sentence, true),
      };
    });
}

/** Compile legacy prose into a conservative graph; ambiguous zone links stay null. */
export function compileLegacySpatialGraph(
  shot: ShotState,
  segment: VideoSegment,
  registry: ProductionRegistryEntry[]
): void {
  const layout = segment.spatial_layout;
  if (!layout) return;

  const rawLabels = clean(layout.zone_order)
    .split(/\s*(?:->|→|=>)\s*/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 16);
  const labels = rawLabels.length > 0 ? rawLabels : ["declared scene zone"];
  const usedZoneIds = new Set<string>();
  const zones: SpatialZoneState[] = labels.map((label, index) => {
    const kind = zoneKind(label);
    // A single walkable zone inside one locked location is the same physical
    // floor across continuous shots even when an LLM adds filler suffixes such
    // as "only" or "continuous declared walkable scene zone".
    const stableBase =
      labels.length === 1 && kind === "walkable" && shot.location_id
        ? `${shot.location_id}_walkable`
        : canonicalZoneLabel(label);
    return {
      zone_id: uniqueId(`zone_${stableIdSlug(stableBase) || index + 1}`, usedZoneIds),
      label,
      kind,
      walkable: kind === "barrier" || kind === "support_surface" ? false : kind === "unknown" ? null : true,
      description: label,
    };
  });

  const pathText = clean(layout.walkable_path);
  const pathClear = /\b(?:clear|unobstructed|walkable|open)\b|\b(?:thông thoáng|không bị cản|đi được)\b/iu.test(pathText)
    ? true
    : /\b(?:blocked|obstructed|closed)\b|\b(?:bị chặn|bị cản|đóng)\b/iu.test(pathText)
      ? false
      : null;
  const connectors: SpatialConnectorState[] = zones.slice(0, -1).map((zone, index) => {
    const next = zones[index + 1]!;
    const description = `${zone.label} -> ${next.label}. ${pathText}`.trim();
    return {
      connector_id: `connector_${String(index + 1).padStart(3, "0")}`,
      from_zone_id: zone.zone_id,
      to_zone_id: next.zone_id,
      kind: connectorKind(description),
      bidirectional: null,
      path_clear: pathClear,
      description,
    };
  });

  const graph: SpatialGraphState = {
    graph_id: `spatial_${shot.shot_id}`,
    source: "legacy_compiled",
    zones,
    connectors,
    anchors: clean(layout.fixed_architecture)
      ? [
          {
            anchor_id: "anchor_fixed_architecture",
            zone_id: zones[0]!.zone_id,
            label: "legacy fixed architecture",
            kind: "architecture",
            entity_id: null,
            description: clean(layout.fixed_architecture),
          },
        ]
      : [],
    camera_zone_id:
      zones.find((zone) => lower(layout.camera_zone).includes(lower(zone.label)))?.zone_id ?? null,
  };
  shot.spatial_graph = graph;
  shot.start_snapshot.placements = compilePlacements(
    shot.start_snapshot.entities,
    clean(layout.character_placement),
    zones,
    registry
  );
  shot.end_snapshot.placements = compilePlacements(
    shot.end_snapshot.entities,
    clean(layout.character_placement),
    zones,
    registry
  );
  for (const snapshot of [shot.start_snapshot, shot.end_snapshot]) {
    for (const placement of snapshot.placements) {
      const character = snapshot.entities.find((entity) => entity.entity_id === placement.entity_id)
        ?.character_physics;
      if (!character) continue;
      character.pose.zone_id = placement.zone_id;
      character.pose.anchor = placement.position_label || null;
    }
  }
}
