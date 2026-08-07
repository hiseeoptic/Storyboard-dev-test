import type { SceneBible, VideoSegment } from "@/types";
import type {
  CameraState,
  LightingState,
  ProductionRegistryEntry,
  ShotState,
} from "./types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function lower(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

function shotSize(text: string): CameraState["shot_size"] {
  if (/\b(?:extreme close[- ]?up|ecu)\b|\b(?:siêu cận)\b/iu.test(text)) return "extreme_close_up";
  if (/\b(?:close[- ]?up|cu)\b|\b(?:cận cảnh)\b/iu.test(text)) return "close_up";
  if (/\b(?:medium shot|medium close|ms|mcu)\b|\b(?:trung cảnh)\b/iu.test(text)) return "medium";
  if (/\b(?:wide shot|establishing|full shot|ws)\b|\b(?:toàn cảnh|cảnh rộng)\b/iu.test(text)) return "wide";
  return "unknown";
}

function angle(text: string, name: "yaw" | "pitch" | "roll"): number | null {
  const match = text.match(new RegExp(`\\b${name}\\s*[:=]?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(?:°|deg(?:rees?)?)?`, "iu"));
  return match?.[1] ? Number.parseFloat(match[1]) : null;
}

function direction(text: string, subject: "key" | "shadow"): LightingState["key_direction"] {
  const value = lower(text);
  const prefix = subject === "key" ? "(?:key|light|lighting)" : "(?:shadow|shadows)";
  const patterns: Array<[LightingState["key_direction"], RegExp]> = [
    ["left", new RegExp(`(?:${prefix}.{0,24}(?:from|to|toward)\\s+(?:the\\s+)?left|left[- ]?side\\s+${prefix})`, "iu")],
    ["right", new RegExp(`(?:${prefix}.{0,24}(?:from|to|toward)\\s+(?:the\\s+)?right|right[- ]?side\\s+${prefix})`, "iu")],
    ["front", new RegExp(`${prefix}.{0,24}(?:from|to|toward)\\s+(?:the\\s+)?front`, "iu")],
    ["back", new RegExp(`${prefix}.{0,24}(?:from|to|toward)\\s+(?:the\\s+)?back`, "iu")],
    ["top", new RegExp(`${prefix}.{0,24}(?:from|to|toward)\\s+(?:the\\s+)?(?:top|above)`, "iu")],
    ["bottom", new RegExp(`${prefix}.{0,24}(?:from|to|toward)\\s+(?:the\\s+)?(?:bottom|below)`, "iu")],
    ["diffuse", new RegExp(`(?:diffuse|overcast|shadowless).{0,24}${prefix}|${prefix}.{0,24}(?:diffuse|overcast|shadowless)`, "iu")],
  ];
  return patterns.find(([, pattern]) => pattern.test(value))?.[0] ?? "unknown";
}

function timeOfDay(text: string): string | null {
  const match = text.match(
    /\b(?:dawn|sunrise|morning|noon|afternoon|sunset|dusk|evening|night|midnight)\b|\b(?:bình minh|buổi sáng|buổi trưa|buổi chiều|hoàng hôn|chạng vạng|buổi tối|ban đêm|nửa đêm)\b/iu
  );
  return clean(match?.[0]) || null;
}

function lookTarget(text: string, registry: ProductionRegistryEntry[]): string | null {
  if (!/\b(?:focus(?:es)? on|frames?|looks? at|toward)\b|\b(?:lấy nét|hướng vào|quay về)\b/iu.test(text)) return null;
  const value = lower(text);
  return (
    registry.find((entry) =>
      [entry.display_name, entry.source_ref, ...entry.aliases]
        .filter((name): name is string => Boolean(name))
        .some((name) => value.includes(lower(name)))
    )?.entity_id ?? null
  );
}

function cameraMovement(text: string): string | null {
  const match = text.match(
    /\b(?:static|locked[- ]?off|pan(?:s|ning)?|tilt(?:s|ing)?|dolly|truck|crane|orbit|handheld|push(?:es|ing)? in|pull(?:s|ing)? out)\b|\b(?:máy tĩnh|lia máy|ngẩng máy|hạ máy|tiến máy|lùi máy|cầm tay)\b/iu
  );
  return clean(match?.[0]) || null;
}

export function compileCinematographyState(params: {
  shot: ShotState;
  segment: VideoSegment;
  registry: ProductionRegistryEntry[];
  sceneBible?: SceneBible;
}): void {
  const { shot, segment, registry, sceneBible } = params;
  const cameraText = [
    sceneBible?.lens,
    ...(segment.beats ?? []).map((beat) => beat.camera),
    segment.spatial_layout?.camera_zone,
    segment.first_frame_prompt,
  ]
    .map(clean)
    .filter(Boolean)
    .join(". ");
  const lensMatch = cameraText.match(/\b(\d+(?:\.\d+)?)\s*mm\b/iu);
  const axisMatch = cameraText.match(/\baxis(?:[_ -]?id)?\s*[:=]\s*([a-z0-9_-]+)/iu);
  const axisSide: CameraState["axis_side"] = /\b(?:camera|viewpoint).{0,24}(?:left of|left side of)\s+(?:the\s+)?axis\b/iu.test(cameraText)
    ? "left"
    : /\b(?:camera|viewpoint).{0,24}(?:right of|right side of)\s+(?:the\s+)?axis\b/iu.test(cameraText)
      ? "right"
      : /\b(?:camera|viewpoint).{0,24}(?:on|along)\s+(?:the\s+)?axis\b/iu.test(cameraText)
        ? "on_axis"
        : "unknown";
  const cameraZone = shot.spatial_graph?.zones.find((zone) =>
    lower(segment.spatial_layout?.camera_zone).includes(lower(zone.label))
  );
  shot.camera_state = {
    camera_id: `camera_${shot.shot_id}`,
    source: "legacy_compiled",
    zone_id: cameraZone?.zone_id ?? shot.spatial_graph?.camera_zone_id ?? null,
    position_label: clean(segment.spatial_layout?.camera_zone),
    shot_size: shotSize(cameraText),
    lens_mm: lensMatch?.[1] ? Number.parseFloat(lensMatch[1]) : null,
    yaw_deg: angle(cameraText, "yaw"),
    pitch_deg: angle(cameraText, "pitch"),
    roll_deg: angle(cameraText, "roll"),
    look_target_entity_id: lookTarget(cameraText, registry),
    axis_id: clean(axisMatch?.[1]) || null,
    axis_side: axisSide,
    movement: cameraMovement(cameraText),
  };

  const lightingText = [sceneBible?.lighting, segment.first_frame_prompt]
    .map(clean)
    .filter(Boolean)
    .join(". ");
  const kelvin = lightingText.match(/\b(\d{3,5})\s*k\b/iu)?.[1];
  const lux = lightingText.match(/\b(\d+(?:\.\d+)?)\s*lux\b/iu)?.[1];
  const storyTime = timeOfDay(lightingText);
  shot.lighting_state = {
    source: "legacy_compiled",
    time_of_day: storyTime,
    key_source: clean(sceneBible?.lighting) || null,
    key_direction: direction(lightingText, "key"),
    color_temperature_k: kelvin ? Number.parseInt(kelvin, 10) : null,
    intensity_lux: lux ? Number.parseFloat(lux) : null,
    shadow_direction: direction(lightingText, "shadow"),
    continuity_group: shot.location_id ? `${shot.location_id}:${lower(storyTime) || "time_unknown"}` : null,
  };
}
