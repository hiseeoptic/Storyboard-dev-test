import type { ResolvedVideoContext } from "@/lib/video-context/types";
import type { StoryboardGenerationInput } from "@/types";
import { isStylizedCharacterRepresentation } from "../creative-routing/profiles.ts";
import {
  buildReport,
  type SemanticFinding,
  type SemanticValidationReport,
} from "./semantic-validator.ts";

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const PLACEHOLDER =
  /^(?:n\/?a|none|unknown|unspecified|tbd|todo|missing|not set|chưa rõ|không rõ)$/i;

function isAuthority(value: unknown): boolean {
  const normalized = text(value);
  return !!normalized && !PLACEHOLDER.test(normalized);
}

/**
 * Deterministic validation of the resolved 10-layer Context IR. This is called
 * immediately after context analysis and before storyboard generation.
 */
export function validateResolvedVideoContext(
  context: ResolvedVideoContext,
  input?: StoryboardGenerationInput
): SemanticValidationReport {
  const findings: SemanticFinding[] = [];
  const push = (finding: SemanticFinding) => findings.push(finding);
  const high = (code: string, message: string, evidence?: string) =>
    push({ code, severity: "high", scope: "project", message, evidence });
  const medium = (code: string, message: string, evidence?: string) =>
    push({ code, severity: "medium", scope: "project", message, evidence });

  if (context.version !== "2.0" || context.state !== "locked") {
    high(
      "CTX-001",
      "Context IR must be version 2.0 and locked before storyboard generation.",
      `version=${String(context.version)}, state=${String(context.state)}`
    );
  }

  const layers = context.layers;
  if (!layers) {
    high("CTX-002", "Context IR has no 10-layer authority payload.");
    return buildReport(findings, "context IR gate");
  }

  const required: Array<[string, unknown, string]> = [
    ["CTX-003", layers.project_intent?.purpose, "project purpose"],
    ["CTX-003", layers.project_intent?.platform, "target platform"],
    ["CTX-004", layers.project_intent?.aspect_ratio, "aspect ratio"],
    ["CTX-005", layers.world_context?.world_type, "world type"],
    ["CTX-005", layers.world_context?.genre, "world genre"],
    ["CTX-005", layers.world_context?.time_period, "time period"],
    ["CTX-005", layers.world_context?.physics_mode, "world physics"],
    ["CTX-006", layers.temporal?.timeline_mode, "timeline mode"],
    ["CTX-006", layers.temporal?.time_of_day, "time of day"],
    ["CTX-007", layers.environment?.strategy, "environment strategy"],
    ["CTX-008", layers.motion_continuity?.continuity_mode, "continuity mode"],
    ["CTX-009", layers.visual_language?.style_mode, "visual style"],
    ["CTX-010", layers.audio_validation?.language, "audio language"],
    ["CTX-010", layers.audio_validation?.voice_strategy, "voice strategy"],
    ["CTX-010", layers.audio_validation?.ambience_strategy, "ambience strategy"],
  ];
  for (const [code, value, label] of required) {
    if (!isAuthority(value)) high(code, `Context IR is missing its ${label} authority.`);
  }

  if (
    !Number.isFinite(layers.project_intent?.duration_seconds) ||
    layers.project_intent.duration_seconds <= 0
  ) {
    high("CTX-003", "Project duration must be a positive number.");
  }
  if (
    layers.audio_validation?.post_render_policy !==
    "report_only_no_auto_regeneration"
  ) {
    high(
      "CTX-010",
      "Post-render policy must report defects without automatic paid regeneration."
    );
  }

  const locations = layers.environment?.locations ?? [];
  if (locations.length === 0) {
    high("CTX-007", "Context IR declares no project location.");
  }
  const locationIds = new Set<string>();
  for (const location of locations) {
    const id = text(location.id);
    if (!id || locationIds.has(id.toLocaleLowerCase())) {
      high("CTX-011", "Location ids must be non-empty and unique.", `id=${id || "EMPTY"}`);
    }
    locationIds.add(id.toLocaleLowerCase());
    if (!isAuthority(location.description)) {
      high("CTX-012", `Location "${id || "(unnamed)"}" has no physical description.`);
    }
    if (!isAuthority(location.lighting_motivation)) {
      high("CTX-013", `Location "${id || "(unnamed)"}" has no motivated lighting.`);
    }
    if (!isAuthority(location.sound_bed)) {
      high("CTX-014", `Location "${id || "(unnamed)"}" has no audio-bed authority.`);
    }
    if (!isAuthority(location.reverb_profile)) {
      high("CTX-020", `Location "${id || "(unnamed)"}" has no reverb authority.`);
    }
    if ((location.spatial_anchors?.length ?? 0) === 0) {
      medium("CTX-015", `Location "${id || "(unnamed)"}" has no spatial anchors.`);
    }
    if ((location.fixed_elements?.length ?? 0) === 0) {
      medium("CTX-016", `Location "${id || "(unnamed)"}" has no fixed elements.`);
    }
  }

  const transitionModes = new Set(
    layers.motion_continuity?.allowed_transition_modes ?? []
  );
  if (
    (transitionModes.has("parallel_intercut") ||
      layers.motion_continuity?.continuity_mode === "parallel_intercut") &&
    locations.length < 2
  ) {
    high(
      "CTX-017",
      "Parallel intercut requires at least two independently locked locations."
    );
  }

  const castIds = layers.character?.cast_ids ?? [];
  if (new Set(castIds.map((id) => text(id).toLocaleLowerCase())).size !== castIds.length) {
    high("CTX-018", "Context cast ids must be unique.");
  }

  const stylizedRepresentation = isStylizedCharacterRepresentation(
    input?.character_representation
  );
  if (
    stylizedRepresentation &&
    /\b(?:photoreal|live[- ]action|documentary realism)\b/i.test(
      text(layers.visual_language?.style_mode)
    )
  ) {
    high(
      "CTX-019",
      "Resolved visual style contradicts the selected stylized character representation."
    );
  }

  return buildReport(findings, "context IR gate");
}
