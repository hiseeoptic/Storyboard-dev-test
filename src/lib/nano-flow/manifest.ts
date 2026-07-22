// buildNanoFlowManifest — maps a finished StoryboardGenerationOutput into the
// shared Nano Flow manifest (docs/nano-flow-pipeline/manifest.schema.json) that
// the AutoFlow Reel extension consumes. Pure + side-effect free so it is easy
// to unit-test and for Codex to reason about. See DESIGN.md §4.1.

import type { StoryboardGenerationOutput } from "@/types";
import type {
  NanoFlowAsset,
  NanoFlowManifest,
  NanoFlowRefSelector,
  NanoFlowShot,
} from "@/types/nano-flow";

export interface BuildNanoFlowManifestOptions {
  aspectRatio?: "16:9" | "9:16";
  dialogueLanguage?: string;
  projectId?: string;
  /** ISO timestamp; defaults to now. Injectable for deterministic tests. */
  generatedAt?: string;
  /** Optional product reference names to declare as shared assets. */
  productNames?: string[];
}

/** Turn a display name into a stable ascii slug id (Vietnamese-aware). */
export function slugify(name: string): string {
  return (name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritical marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

/** Prettify an environment archetype id ("misty_mountain_ridge_dawn") into a
 * human label ("Misty mountain ridge dawn"). */
function humanizeEnvId(id: string): string {
  const words = id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Build the shared manifest from a finished breakdown. */
export function buildNanoFlowManifest(
  breakdown: StoryboardGenerationOutput,
  opts: BuildNanoFlowManifestOptions = {}
): NanoFlowManifest {
  const segments = breakdown.segments ?? [];
  const title = breakdown.title || "Untitled";

  // ── Character assets: union of character_locks + every characters_in_scene
  //    name, so no shot can reference a character that isn't declared. ──
  const charIdByName = new Map<string, string>(); // lowercased name -> asset id
  const characters: NanoFlowAsset[] = [];
  const referenceNames = new Set(
    (breakdown.character_locks ?? []).map((l) => l.name?.trim()).filter(Boolean) as string[]
  );
  const addCharacter = (rawName: string, required: boolean) => {
    const name = (rawName || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (charIdByName.has(key)) return;
    const id = `char_${slugify(name) || characters.length + 1}`;
    charIdByName.set(key, id);
    characters.push({ id, name, image: null, required });
  };
  for (const lock of breakdown.character_locks ?? []) addCharacter(lock.name, true);
  for (const seg of segments) {
    for (const name of seg.characters_in_scene ?? []) {
      addCharacter(name, referenceNames.has(name.trim()));
    }
  }

  // ── Environment assets: unique non-custom environment_ref ids. ──
  const envIdSeen = new Set<string>();
  const environments: NanoFlowAsset[] = [];
  for (const seg of segments) {
    const ref = (seg.environment_ref ?? "").trim();
    if (!ref || ref === "custom" || envIdSeen.has(ref)) continue;
    envIdSeen.add(ref);
    environments.push({ id: ref, name: humanizeEnvId(ref), image: null });
  }

  // ── Product assets: from explicit names, else one slot if a product DNA
  //    was locked. Images are attached on the extension side. ──
  const products: NanoFlowAsset[] = [];
  if (opts.productNames?.length) {
    for (const name of opts.productNames) {
      products.push({ id: `prod_${slugify(name) || products.length + 1}`, name, image: null });
    }
  } else if (breakdown.product_dna) {
    products.push({ id: "prod_main", name: "Product", image: null });
  }

  const charIds = (names?: string[]): string[] =>
    (names ?? [])
      .map((n) => charIdByName.get(n.trim().toLowerCase()))
      .filter((v): v is string => Boolean(v));

  // ── Shots ──
  const shots: NanoFlowShot[] = segments.map((seg, i) => {
    const index = seg.segment_number || i + 1;
    const inScene = seg.characters_in_scene ?? [];
    const envRef = (seg.environment_ref ?? "").trim();
    const envIds = envRef && envRef !== "custom" ? [envRef] : [];

    const image_refs: NanoFlowRefSelector = {
      characters: charIds(inScene),
      environments: envIds,
      products: [], // step A default: leave product to the user/Storyboard to opt in per shot
    };

    return {
      shot_id: `SHOT_${String(index).padStart(3, "0")}`,
      index,
      storyboard_name: `${title} ${index}`,
      duration_seconds: seg.duration_seconds || 10,
      marketing_role: seg.marketing_role,

      storyboard_prompt: (seg.first_frame_prompt || seg.motion_prompt || "").trim(),
      image_refs,

      video_prompt: (seg.full_prompt || seg.motion_prompt || "").trim(),
      characters_in_scene: inScene,
      video_refs: {
        // DESIGN.md §6: keyframe = first frame; characters = identity ref;
        // environments/products OFF (already baked into the keyframe).
        use_generated_storyboard: true,
        characters: charIds(inScene),
        environments: [],
        products: [],
      },

      dialogue: seg.dialogue ?? null,
      voice: null,
      beats: (seg.beats ?? []).map((b) => ({ beat: b.beat, camera: b.camera })),
    };
  });

  return {
    manifest_version: "1.0",
    generator: "storyboard-ai",
    generated_at: opts.generatedAt ?? new Date().toISOString(),
    project: {
      project_id: opts.projectId ?? `prj_${slugify(title)}`,
      title,
      aspect_ratio: opts.aspectRatio ?? "9:16",
      dialogue_language: opts.dialogueLanguage ?? "Vietnamese",
      total_duration_seconds: breakdown.total_duration_seconds,
      thumbnail_title: breakdown.thumbnail_title,
      social_posts: breakdown.social_posts,
    },
    assets: {
      characters,
      environments,
      products,
    },
    shots,
  };
}
