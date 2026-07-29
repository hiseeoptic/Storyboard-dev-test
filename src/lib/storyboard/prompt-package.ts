import type { StoryboardGenerationOutput, VideoSegment } from "../../types";

export const STORYBOARD_PROMPT_PACKAGE_VERSION = "1.0" as const;

export interface StoryboardPanelPrompt {
  panel_number: number;
  source: "clip_opening" | "previous_clip_end" | "script_beat" | "clip_end";
  description: string;
  camera: string;
  continuity_locked: boolean;
}

export interface EnvironmentReferenceImagePrompt {
  view_id: "overview_a" | "overview_b";
  purpose: string;
  nano_banana_prompt: string;
}

export interface EnvironmentReferencePrompt {
  environment_id: string;
  name: string;
  source_clip_ids: string[];
  required_image_count: 2;
  images: [EnvironmentReferenceImagePrompt, EnvironmentReferenceImagePrompt];
}

export interface StoryboardClipPrompt {
  clip_id: string;
  segment_number: number;
  duration_seconds: number;
  panel_count: number;
  environment_id: string;
  starts_from_clip_id?: string;
  /** Schema 4.0 boundary mode. Must equal transition_mode. */
  continuity_mode: NonNullable<VideoSegment["transition_in"]>["mode"];
  /** Backward-compatible alias retained for current consumers. */
  transition_mode: NonNullable<VideoSegment["transition_in"]>["mode"];
  required_opening_state: string;
  required_end_state: string;
  panels: StoryboardPanelPrompt[];
  nano_banana_storyboard_prompt: string;
}

export interface StoryboardPromptPackage {
  format_version: typeof STORYBOARD_PROMPT_PACKAGE_VERSION;
  generator: "storyboard-ai";
  generated_at: string;
  project: {
    title: string;
    storyboard_schema_version: "4.0";
    aspect_ratio: "16:9" | "9:16";
    total_duration_seconds: number;
    reference_policy: string;
    post_render_policy: "report_only_no_auto_regeneration";
  };
  environment_references: EnvironmentReferencePrompt[];
  clips: StoryboardClipPrompt[];
}

export interface BuildStoryboardPromptPackageOptions {
  aspectRatio?: "16:9" | "9:16";
  generatedAt?: string;
  /** Structured Veo clips from buildVeoJson, in the same order as segments. */
  veoClips?: Array<Record<string, unknown>>;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 6);
}

function clipId(index: number): string {
  return `CLIP_${String(index + 1).padStart(3, "0")}`;
}

function environmentInfo(
  segment: VideoSegment,
  clip: Record<string, unknown> | undefined,
  index: number,
  fallbackBackdrop: string
): {
  key: string;
  id: string;
  name: string;
  setting: string;
  scenery: string;
  lighting: string;
} {
  const background = obj(clip?.background_lock);
  const locationId = (segment.location_id ?? "").trim();
  const ref = (segment.environment_ref ?? "").trim();
  const name =
    text(background.name) ||
    (ref && ref !== "custom" ? ref.replace(/[_-]+/g, " ") : "") ||
    `Environment ${index + 1}`;
  const setting =
    text(background.setting) ||
    (ref && ref !== "custom" ? ref.replace(/[_-]+/g, " ") : "") ||
    fallbackBackdrop.trim() ||
    name;
  const scenery = text(background.scenery);
  const lighting = text(background.lighting);
  const stableKey =
    locationId
      ? `location:${locationId}`
      : ref && ref !== "custom"
      ? `ref:${ref.toLowerCase()}`
      : `set:${[name, setting, lighting].join("|").toLowerCase()}`;
  const baseId =
    slug(locationId || (ref && ref !== "custom" ? ref : name)) || String(index + 1);
  const id =
    locationId
      ? `env_${baseId}`
      : ref && ref !== "custom"
      ? `env_${baseId}`
      : `env_${baseId}_${shortHash(stableKey)}`;
  return { key: stableKey, id, name, setting, scenery, lighting };
}

function environmentImagePrompt(
  environment: ReturnType<typeof environmentInfo>,
  view: "overview_a" | "overview_b",
  aspectRatio: "16:9" | "9:16",
  renderDirective: string
): EnvironmentReferenceImagePrompt {
  const isA = view === "overview_a";
  const prompt = {
    type: "environment_reference_image",
    purpose:
      "Create one clean reference image for all storyboard panels and Veo clips in this environment.",
    aspect_ratio: aspectRatio,
    view: isA
      ? "Wide establishing overview from the primary camera side; show the complete spatial layout and all fixed anchors."
      : "Reverse three-quarter overview from the opposite safe camera side; show the same architecture, furniture and connectors without redesigning them.",
    environment: {
      name: environment.name,
      setting: environment.setting,
      scenery: environment.scenery || undefined,
      lighting: environment.lighting || undefined,
    },
    hard_constraints: [
      "This is the exact same physical place as the other overview image.",
      "Keep architecture, doors, windows, furniture, props, materials, scale, light direction and time of day identical.",
      "Static empty set only: no people, no character action, no wardrobe sheet, no studio backdrop.",
      `${renderDirective}; no collage, no split screen, no text, no watermark.`,
    ],
  };
  return {
    view_id: view,
    purpose: isA ? "Primary spatial authority" : "Reverse-angle spatial authority",
    nano_banana_prompt: JSON.stringify(prompt),
  };
}

function buildPanels(
  segment: VideoSegment,
  previous: VideoSegment | undefined,
  inheritsPrevious: boolean
): StoryboardPanelPrompt[] {
  const beats = segment.beats ?? [];
  const panelCount = Math.min(5, Math.max(3, beats.length || 3));
  const firstBeat = beats[0];
  const lastBeat = beats[beats.length - 1];
  const opening = previous && inheritsPrevious
    ? previous.continuity_note?.trim()
    : segment.first_frame_prompt?.trim() || firstBeat?.beat?.trim();
  const ending =
    segment.continuity_note?.trim() ||
    lastBeat?.beat?.trim() ||
    segment.motion_prompt?.trim();
  const panels: StoryboardPanelPrompt[] = [
    {
      panel_number: 1,
      source: previous && inheritsPrevious ? "previous_clip_end" : "clip_opening",
      description: opening || "Opening state from the approved scene plan.",
      camera: previous && inheritsPrevious
        ? previous.beats?.[previous.beats.length - 1]?.camera?.trim() ||
          firstBeat?.camera?.trim() ||
          "Match the previous clip's final camera."
        : firstBeat?.camera?.trim() || "Establishing composition.",
      continuity_locked: Boolean(previous && inheritsPrevious),
    },
  ];

  for (let panelIndex = 2; panelIndex < panelCount; panelIndex++) {
    const beat = beats[Math.min(panelIndex - 1, Math.max(0, beats.length - 1))];
    panels.push({
      panel_number: panelIndex,
      source: "script_beat",
      description:
        beat?.beat?.trim() ||
        segment.motion_prompt?.trim() ||
        "Continue the approved action through real space.",
      camera: beat?.camera?.trim() || "Use the approved scene camera grammar.",
      continuity_locked: false,
    });
  }

  panels.push({
    panel_number: panelCount,
    source: "clip_end",
    description: ending || "Hold the approved physical end state.",
    camera: lastBeat?.camera?.trim() || "Hold a clear final composition.",
    continuity_locked: true,
  });
  return panels;
}

/**
 * Compile the already-approved Storyboard JSON into Nano Banana storyboard
 * prompts without another model call. This is an additive vNext package: the
 * current Nano Flow manifest remains untouched until the extension adopts it.
 */
export function buildStoryboardPromptPackage(
  breakdown: StoryboardGenerationOutput,
  options: BuildStoryboardPromptPackageOptions = {}
): StoryboardPromptPackage {
  const aspectRatio = options.aspectRatio ?? "9:16";
  const realityMode = breakdown.context_ir?.reality_profile.mode ?? "cinematic";
  const renderDirective = ["documentary", "cinematic", "commercial"].includes(
    realityMode
  )
    ? "Photorealistic filmed location reference"
    : `Location reference in the project's locked ${realityMode} visual medium; never convert it to photoreal`;
  const environments = new Map<
    string,
    {
      info: ReturnType<typeof environmentInfo>;
      sourceClipIds: string[];
    }
  >();

  const clips = (breakdown.segments ?? []).map((segment, index) => {
    const id = clipId(index);
    const previous = breakdown.segments[index - 1];
    const transitionMode =
      segment.transition_in?.mode ??
      (index === 0
        ? "opening"
        : breakdown.context_ir?.segment_contract_version === "1.0"
          ? "scene_cut"
          : "continuous");
    const inheritsPrevious = index > 0 && transitionMode === "continuous";
    const env = environmentInfo(
      segment,
      options.veoClips?.[index],
      index,
      breakdown.scene_bible?.backdrop ?? ""
    );
    const existing = environments.get(env.key);
    if (existing) {
      existing.sourceClipIds.push(id);
    } else {
      environments.set(env.key, { info: env, sourceClipIds: [id] });
    }

    const panels = buildPanels(segment, previous, inheritsPrevious);
    const opening = panels[0]?.description ?? "";
    const ending = panels[panels.length - 1]?.description ?? "";
    const boardPrompt = {
      type: "storyboard_board",
      purpose:
        "Generate one multi-panel storyboard board for this 10-second clip; this is not a standalone keyframe.",
      clip_id: id,
      duration_seconds: segment.duration_seconds || 10,
      aspect_ratio: aspectRatio,
      panel_count: panels.length,
      environment_reference: {
        environment_id: env.id,
        required_images: 2,
        authority:
          "Use both attached environment overview images as the only source of background architecture, furniture, props, layout, lighting and time of day.",
      },
      continuity: {
        continuity_mode: transitionMode,
        transition_mode: transitionMode,
        opening_source:
          previous && inheritsPrevious
            ? `${clipId(index - 1)} final panel`
            : "this clip's approved opening state",
        required_opening_state: opening,
        required_end_state: ending,
      },
      state_ledger: segment.state_ledger,
      panels,
      hard_constraints: [
        `Create exactly ${panels.length} numbered panels in chronological order.`,
        "Panel 1 must match required_opening_state exactly; the final panel must match required_end_state exactly.",
        "Do not create, chain or interpolate standalone keyframes.",
        "Do not redesign the environment between panels.",
        "Keep character identity, wardrobe, props and spatial topology unchanged unless the approved scene explicitly changes them.",
        "No text, subtitles, watermark or UI inside any panel.",
      ],
    };

    return {
      clip_id: id,
      segment_number: segment.segment_number || index + 1,
      duration_seconds: segment.duration_seconds || 10,
      panel_count: panels.length,
      environment_id: env.id,
      ...(previous && inheritsPrevious
        ? { starts_from_clip_id: clipId(index - 1) }
        : {}),
      continuity_mode: transitionMode,
      transition_mode: transitionMode,
      required_opening_state: opening,
      required_end_state: ending,
      panels,
      nano_banana_storyboard_prompt: JSON.stringify(boardPrompt),
    };
  });

  const environmentReferences = Array.from(environments.values()).map(
    ({ info, sourceClipIds }) => ({
      environment_id: info.id,
      name: info.name,
      source_clip_ids: sourceClipIds,
      required_image_count: 2 as const,
      images: [
        environmentImagePrompt(info, "overview_a", aspectRatio, renderDirective),
        environmentImagePrompt(info, "overview_b", aspectRatio, renderDirective),
      ] as [EnvironmentReferenceImagePrompt, EnvironmentReferenceImagePrompt],
    })
  );

  return {
    format_version: STORYBOARD_PROMPT_PACKAGE_VERSION,
    generator: "storyboard-ai",
    generated_at: options.generatedAt ?? new Date().toISOString(),
    project: {
      title: breakdown.title || "Untitled",
      storyboard_schema_version: "4.0",
      aspect_ratio: aspectRatio,
      total_duration_seconds: breakdown.total_duration_seconds,
      reference_policy:
        "Every environment has exactly two overview reference images. Storyboard panels may change action and camera only; the physical background remains authoritative and unchanged.",
      post_render_policy: "report_only_no_auto_regeneration",
    },
    environment_references: environmentReferences,
    clips,
  };
}

/** Deterministic package-level checks; no model/API call. */
export function validateStoryboardPromptPackage(
  promptPackage: StoryboardPromptPackage
): string[] {
  const errors: string[] = [];
  const environmentIds = new Set(
    promptPackage.environment_references.map(
      (environment) => environment.environment_id
    )
  );
  for (const environment of promptPackage.environment_references) {
    if (
      environment.required_image_count !== 2 ||
      environment.images.length !== 2
    ) {
      errors.push(
        `${environment.environment_id}: exactly two environment reference prompts are required.`
      );
    }
    if (
      new Set(environment.images.map((image) => image.view_id)).size !== 2
    ) {
      errors.push(`${environment.environment_id}: overview views must be unique.`);
    }
  }
  for (let index = 0; index < promptPackage.clips.length; index++) {
    const clip = promptPackage.clips[index]!;
    if (clip.continuity_mode !== clip.transition_mode) {
      errors.push(
        `${clip.clip_id}: continuity_mode must equal transition_mode.`
      );
    }
    if (clip.panels.length !== clip.panel_count || clip.panel_count < 3) {
      errors.push(`${clip.clip_id}: panel count is inconsistent.`);
    }
    const first = clip.panels[0];
    const last = clip.panels[clip.panels.length - 1];
    if (first?.description !== clip.required_opening_state) {
      errors.push(`${clip.clip_id}: first panel does not match its opening lock.`);
    }
    if (last?.description !== clip.required_end_state) {
      errors.push(`${clip.clip_id}: final panel does not match its end lock.`);
    }
    if (!environmentIds.has(clip.environment_id)) {
      errors.push(`${clip.clip_id}: environment reference is not declared.`);
    }
    if (index > 0 && clip.transition_mode === "continuous") {
      const previous = promptPackage.clips[index - 1]!;
      if (
        clip.starts_from_clip_id !== previous.clip_id ||
        clip.required_opening_state !== previous.required_end_state ||
        first?.source !== "previous_clip_end"
      ) {
        errors.push(
          `${clip.clip_id}: opening panel is not locked to ${previous.clip_id}'s final panel.`
        );
      }
    } else if (index > 0) {
      if (clip.starts_from_clip_id || first?.source === "previous_clip_end") {
        errors.push(
          `${clip.clip_id}: ${clip.transition_mode} must open from its own approved state, not the previous final panel.`
        );
      }
    }
  }
  return errors;
}
