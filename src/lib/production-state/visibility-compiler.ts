import type { VideoSegment } from "@/types";
import type {
  ProductionRegistryEntry,
  ProductionSnapshot,
  ShotState,
} from "./types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function lower(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

function namedInText(entry: ProductionRegistryEntry, text: string): boolean {
  const value = lower(text);
  return [entry.display_name, entry.source_ref, ...entry.aliases]
    .filter((name): name is string => Boolean(name))
    .some((name) => value.includes(lower(name)));
}

function compileSnapshot(
  snapshot: ProductionSnapshot,
  text: string,
  registry: ProductionRegistryEntry[],
  boundary: "start" | "end"
): void {
  const byId = new Map(registry.map((entry) => [entry.entity_id, entry]));
  const mirror = registry.find(
    (entry) => /\b(?:mirror|reflective surface)\b|\b(?:gương|bề mặt phản chiếu)\b/iu.test(entry.display_name)
  );
  for (const entity of snapshot.entities.filter((entry) => entry.kind === "character")) {
    const registryEntry = byId.get(entity.entity_id);
    const entityText = `${entity.state} ${entity.position}`;
    const outOfFrame = /\b(?:out of frame|off frame)\b|\b(?:ngoài khung)\b/iu.test(entityText);
    const occluded = /\b(?:occluded|hidden behind|fully hidden)\b|\b(?:bị che|khuất|ẩn sau)\b/iu.test(entityText);
    if (!outOfFrame && !occluded) {
      snapshot.visual_instances.push({
        instance_id: `${entity.entity_id}_${boundary}_primary`,
        entity_id: entity.entity_id,
        classification: "primary",
        visible: true,
        source_surface_id: null,
      });
    } else {
      snapshot.occlusions.push({
        occluded_entity_id: entity.entity_id,
        occluder_entity_id: null,
        state: outOfFrame ? "out_of_frame" : "full",
        entity_still_exists: true,
        expected_reappearance: null,
      });
    }

    if (
      registryEntry &&
      namedInText(registryEntry, text) &&
      /\b(?:mirror image|reflection|reflected)\b|\b(?:ảnh gương|phản chiếu|trong gương)\b/iu.test(text)
    ) {
      snapshot.visual_instances.push({
        instance_id: `${entity.entity_id}_${boundary}_reflection`,
        entity_id: entity.entity_id,
        classification: "reflection",
        visible: true,
        source_surface_id: mirror?.entity_id ?? null,
      });
    }
    if (
      registryEntry &&
      namedInText(registryEntry, text) &&
      /\b(?:duplicate|clone|copied person|second identical person)\b|\b(?:nhân bản|bản sao|người giống hệt thứ hai)\b/iu.test(text)
    ) {
      snapshot.visual_instances.push({
        instance_id: `${entity.entity_id}_${boundary}_duplicate`,
        entity_id: entity.entity_id,
        classification: "background_duplicate",
        visible: true,
        source_surface_id: null,
      });
    }
  }
}

export function compileVisibilityState(
  shot: ShotState,
  segment: VideoSegment,
  registry: ProductionRegistryEntry[]
): void {
  const text = `${segment.first_frame_prompt} ${segment.motion_prompt} ${segment.continuity_note}`;
  compileSnapshot(shot.start_snapshot, text, registry, "start");
  compileSnapshot(shot.end_snapshot, text, registry, "end");
}
