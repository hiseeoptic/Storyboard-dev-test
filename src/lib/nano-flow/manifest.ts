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
  /** The STRUCTURED Veo scene clips from buildVeoJson (one per segment, in
   * order). When present, each shot's video_prompt carries the full structured
   * clip (high-quality Veo input) instead of a flat prose paragraph, and the
   * keyframe prompt is composed from that same structured scene so the image
   * stays in sync with the video. */
  veoClips?: Array<Record<string, unknown>>;
}

/** Extract a trimmed string field from an unknown clip sub-object. */
function clipStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function clipObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

// Generic scaffolding phrases buildVeoJson writes into empty lock fields — they
// are instructions to Veo, not real appearance, so they must NOT leak into the
// image prompt.
const GENERIC_LOCK_VALUE =
  /^(use |begin |perform |finish |match the attached|reference_image|context-appropriate everyday|only props|physically grounded|natural hands|cons=|see wardrobe_state|real individual hair strands|real skin with visible pores|none unless|unspecified$)/i;
function meaningful(v: string): string {
  return v && !GENERIC_LOCK_VALUE.test(v) ? v : "";
}

/**
 * Compose a RICH keyframe (image) prompt from the STRUCTURED Veo clip so Nano
 * Banana renders a keyframe faithful to the whole scene — cast appearance,
 * wardrobe, placement, setting, composition and film look — instead of a
 * one-line summary of the setting. Falls back to the raw scene text when no
 * structured clip is available (e.g. unit tests).
 */
// The photoreal render note baked into every structured keyframe prompt (the
// JSON analogue of lockStyle's anchors) so Nano Banana never drifts to cartoon.
const KEYFRAME_RENDER_NOTE =
  "Photorealistic cinematic film still, shot on a professional cinema camera: " +
  "natural realistic lighting, true-to-life skin and material textures, shallow " +
  "depth of field, sharp focus, high dynamic range, professional colour grading, " +
  "ultra-detailed — a real photograph.";
const KEYFRAME_NEGATIVE =
  "NOT cartoon, NOT anime, NOT illustration, NOT 3D render, NOT CGI, NOT painting, " +
  "NOT drawing, NOT sketch; no on-screen text, caption, watermark or logo; no extra, " +
  "missing or fused fingers; no identity drift; the same character never duplicated in frame.";
// IDENTITY + WARDROBE authority: the keyframe MUST follow the attached full-body
// character reference (the wardrobe sheet) for BOTH face and outfit — this is the
// clause the user asked for so the image obeys the reference, not a random outfit.
const KEYFRAME_REFERENCE_AUTHORITY =
  "For every character in cast: their face, hair and body build AND their FULL outfit " +
  "must EXACTLY match that character's ATTACHED full-body character reference image " +
  "(the wardrobe sheet) — copy the exact garments, colours and footwear; do NOT invent, " +
  "restyle or swap clothing, and do NOT copy the reference's plain studio background. " +
  "If a location photo is attached, stage the scene inside that real place. If a previous " +
  "shot's keyframe is attached, keep the same characters, outfits, location, furniture and " +
  "props consistent with it — only the action, pose and camera angle change.";

/**
 * Compose a STRUCTURED (JSON) keyframe image prompt from the Veo clip. Nano
 * Banana yields far better, more faithful keyframes from a compact JSON scene
 * than from a prose paragraph (user request), and JSON lets us pin the
 * identity+wardrobe reference authority as its own field. Returns a JSON string
 * ready for Flow's prompt box. Falls back to the prose style-lock only when no
 * structured clip exists (e.g. unit tests without veoClips).
 */
function buildKeyframePromptFromClip(
  clip: Record<string, unknown> | undefined,
  fallbackSceneText: string,
  wardrobeClause: string
): string {
  if (!clip) return lockStyle(fallbackSceneText + wardrobeClause);

  const bg = clipObj(clip.background_lock);
  const setting = clipStr(bg.setting) || fallbackSceneText;
  const scenery = clipStr(bg.scenery);
  const lighting = clipStr(bg.lighting);
  const startState = clipStr(clipObj(clip.scene_action).start_state);
  const placement = clipStr(clipObj(clip.spatial_topology).character_placement);
  const visualStyle = clipStr(clip.visual_style);
  const cam = clipObj(clip.camera);

  const locks = clipObj(clip.character_lock);
  const cast: Array<Record<string, string>> = [];
  for (const key of Object.keys(locks)) {
    const c = clipObj(locks[key]);
    const name = clipStr(c.name);
    if (!name) continue;
    const appearance = [
      meaningful(clipStr(c.gender)),
      meaningful(clipStr(c.age)),
      meaningful(clipStr(c.body_build)),
      meaningful(clipStr(c.hair)) ? `hair ${clipStr(c.hair)}` : "",
      meaningful(clipStr(c.skin_or_fur_color)),
    ].filter(Boolean).join(", ");
    const wardrobe = [clipStr(c.outfit_top), clipStr(c.outfit_bottom)]
      .map(meaningful).filter(Boolean).join(", ");
    const entry: Record<string, string> = { name };
    if (appearance) entry.appearance = appearance;
    if (wardrobe) entry.wardrobe = wardrobe;
    cast.push(entry);
  }

  const camera: Record<string, string> = {};
  if (clipStr(cam.framing)) camera.framing = clipStr(cam.framing);
  if (clipStr(cam.angle)) camera.angle = clipStr(cam.angle);

  const prompt: Record<string, unknown> = {
    type: "photoreal_keyframe",
    render: KEYFRAME_RENDER_NOTE,
    visual_style: visualStyle || undefined,
    setting,
    scenery: scenery && scenery !== setting ? scenery : undefined,
    lighting: lighting || undefined,
    cast,
    placement: placement || undefined,
    composition: startState || undefined,
    camera: Object.keys(camera).length ? camera : undefined,
    reference_authority: KEYFRAME_REFERENCE_AUTHORITY,
    wardrobe_note: wardrobeClause ? wardrobeClause.trim() : undefined,
    negative: KEYFRAME_NEGATIVE,
  };
  // JSON.stringify drops the undefined-valued keys, leaving a clean payload.
  return JSON.stringify(prompt);
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

/**
 * Nano Flow runs image-to-video: the generated keyframe IS the first frame the
 * clip animates from. So for the VIDEO step the START (and END) frame image is
 * the single authority for wardrobe, hairstyle and the set — never a character
 * reference photo (those governed only the IMAGE step). Patch the structured
 * clip's output_rules so Veo follows the keyframe's outfit exactly.
 */
export function withKeyframeAuthority(
  clip: Record<string, unknown>
): Record<string, unknown> {
  const rules =
    clip.output_rules && typeof clip.output_rules === "object"
      ? { ...(clip.output_rules as Record<string, unknown>) }
      : {};
  rules.reference_priority =
    "START-FRAME AUTHORITY: this clip is generated image-to-video from an attached start frame (and possibly an end frame). That frame is the SINGLE source of truth for each character's outfit, hairstyle, grooming, props in hand and the location's layout/furniture/lighting — continue them EXACTLY as shown; never restyle wardrobe or hair away from the start frame, and never import clothing from any other reference. Character identity (face) also continues from the start frame.";
  return { ...clip, output_rules: rules };
}

/** Prettify an environment archetype id ("misty_mountain_ridge_dawn") into a
 * human label ("Misty mountain ridge dawn"). */
function humanizeEnvId(id: string): string {
  const words = id.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ── Style lock (DESIGN.md §6) ───────────────────────────────────────────────
// The extension feeds `storyboard_prompt` straight into Flow's nano banana as
// the image prompt. Without an explicit photoreal anchor, nano banana tends to
// drift to cartoon/anime/illustration. We wrap every prompt so each shot yields
// ONE photorealistic, cinematic keyframe that stays faithful to the scene the
// script describes — never re-describing or altering the scene, only pinning
// the render style. Idempotent: it won't double-apply anchors already present.
const STYLE_PREFIX = "Photorealistic cinematic film still. ";
const STYLE_SUFFIX =
  " Rendered as a real photograph: shot on a professional cinema camera, " +
  "natural realistic lighting, true-to-life skin and material textures, " +
  "shallow depth of field, sharp focus, high dynamic range, professional " +
  "color grading, ultra-detailed. Strictly photorealistic — NOT cartoon, " +
  "NOT anime, NOT illustration, NOT 3D render, NOT CGI, NOT painting, " +
  "NOT drawing, NOT sketch.";

/**
 * Wrap a raw first-frame prompt with a hard photoreal/cinematic style lock so
 * generated keyframes never come back as cartoon. The scene text is preserved
 * verbatim in the middle; only style anchors are added, and only when missing.
 */
export function lockStyle(rawPrompt: string): string {
  const base = (rawPrompt || "").trim();
  if (!base) return (STYLE_PREFIX + STYLE_SUFFIX.trim()).trim();
  const lower = base.toLowerCase();
  const hasPhotoAnchor = /\bphoto ?realistic|photo-realistic|photoreal\b/.test(lower);
  const hasNegativeLock = lower.includes("not cartoon");
  let out = base;
  if (!hasPhotoAnchor) out = STYLE_PREFIX + out;
  if (!hasNegativeLock) {
    // Ensure a clean sentence boundary before appending technical/negative cues.
    if (!/[.!?]$/.test(out.trim())) out = out.trim() + ".";
    out = out + STYLE_SUFFIX;
  }
  return out.trim();
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

  // ── Wardrobe map: the story-locked outfit per character. Direction B — an
  //    uploaded character's clothing is this generated CONTEXT outfit, never the
  //    reference photo's clothing — and text-only characters need it too because
  //    first_frame_prompt no longer restates appearance. The keyframe prompt
  //    must therefore state the outfit explicitly (the image only fixes the
  //    face/identity), or every shot would invent new clothes (wardrobe drift).
  const baseCostumeByName = new Map<string, string>();
  for (const lock of breakdown.character_locks ?? []) {
    const name = (lock.name ?? "").trim();
    if (name && (lock.costume ?? "").trim()) {
      baseCostumeByName.set(name.toLowerCase(), (lock.costume ?? "").trim());
    }
  }
  // Stamp each character asset with its story-locked base outfit so the extension
  // can build one full-body wardrobe sheet per character and reuse it for every
  // keyframe (face + clothes identical across shots).
  for (const c of characters) {
    const outfit = baseCostumeByName.get(c.name.trim().toLowerCase());
    if (outfit) c.wardrobe = outfit;
  }

  // ── Shots ──
  const shots: NanoFlowShot[] = segments.map((seg, i) => {
    const index = seg.segment_number || i + 1;
    const inScene = seg.characters_in_scene ?? [];
    // A visibly motivated change (shower, rain, change of clothes) overrides the
    // base outfit for this one shot; otherwise inherit the locked outfit.
    const wardrobeOverride = new Map(
      (seg.wardrobe_state ?? [])
        .filter((w) => w && (w.character ?? "").trim() && (w.outfit ?? "").trim())
        .map((w) => [w.character.trim().toLowerCase(), w.outfit.trim()])
    );
    const wardrobeParts = inScene
      .map((n) => {
        const key = (n ?? "").trim().toLowerCase();
        const outfit = wardrobeOverride.get(key) ?? baseCostumeByName.get(key) ?? "";
        return outfit ? `${(n ?? "").trim()} in ${outfit}` : "";
      })
      .filter(Boolean);
    const wardrobeClause =
      wardrobeParts.length > 0
        ? ` Wardrobe (story-locked, identical across shots, never copied from a reference photo): ${wardrobeParts.join("; ")}.`
        : "";
    // A wardrobe_state override that differs from the character's base outfit is
    // a real change of clothes → tell the extension to regenerate that
    // character's full-body sheet with the new outfit from this shot onward.
    const wardrobeChange: Record<string, string> = {};
    for (const n of inScene) {
      const key = (n ?? "").trim().toLowerCase();
      const override = wardrobeOverride.get(key);
      if (override && override !== baseCostumeByName.get(key)) {
        wardrobeChange[(n ?? "").trim()] = override;
      }
    }
    // The matching STRUCTURED Veo clip (same order as segments). Drives both the
    // high-quality video payload and the keyframe prompt below.
    const clip = opts.veoClips?.[i];
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

      // RICH keyframe prompt built from the structured clip (cast appearance +
      // wardrobe + placement + setting + composition + film look), style-locked
      // so Nano Banana yields a photoreal keyframe faithful to the scene and in
      // sync with the video — never a one-line summary, never cartoon. See §6.
      storyboard_prompt: buildKeyframePromptFromClip(
        clip,
        seg.first_frame_prompt || seg.motion_prompt || "",
        wardrobeClause
      ),
      image_refs,

      // STEP B video payload = the STRUCTURED Veo scene JSON (high quality);
      // falls back to the flat prose prompt only when no structured clip exists.
      // KEYFRAME AUTHORITY (Nano Flow §6): the clip is animated FROM the
      // generated keyframe, so the start frame — not any uploaded photo — is
      // the wardrobe/hair/set authority. Patch reference_priority accordingly.
      video_prompt: clip ? withKeyframeAuthority(clip) : (seg.full_prompt || seg.motion_prompt || "").trim(),
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
      wardrobe_change: Object.keys(wardrobeChange).length ? wardrobeChange : null,
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
