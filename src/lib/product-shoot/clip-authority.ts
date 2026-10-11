// ============================================================
// CLIP CAMERA AUTHORITY — the last step before a structured Veo clip leaves the
// app. The legacy clip compiler keeps only the FIRST beat's camera clause and
// rewrites every move into "hold the same axis, subtle push" plus a "never whip,
// make it smaller" valve, so every selected camera style collapsed into the same
// generic coverage. This module re-applies the user's selection:
//   · product_only / hands_only shoot → the product-shoot camera block, product
//     negatives, product foley, product label text allowed, no cast;
//   · an explicitly selected camera profile → the full ordered camera path of all
//     beats + that profile's directing laws, at that profile's natural speed.
// Projects without an explicit selection pass through unchanged.
// ============================================================
import { DIRECTING_LAWS, DIRECTING_PROFILE_OPTIONS } from "../creative-routing/profiles.ts";
import type { DirectingProfileId } from "@/types";
import type { LockedGenreProductionProfile } from "@/lib/video-context/types";
export { shootFromProfile } from "./contract.ts";
import {
  productShootCameraBlock,
  productShootNegatives,
  shootFromProfile,
  type PlannedBeat,
  type ResolvedProductShoot,
} from "./contract.ts";

type Clip = Record<string, unknown>;
interface SegBeat { beat?: string; camera?: string }

/** Profiles whose real speed is fast; the generic "never whip / make it smaller" valve would erase them. */
const ENERGETIC = new Set<string>([
  "immersive_action", "handheld_vlog", "rhythmic_music_video", "creator_ugc",
  "reaction_comedy", "broadcast_sports", "cinematic_sports",
]);

/** Shot-size code from a camera line (understands MACRO/POV/OVH/TOP-DOWN/AERIAL, not only the legacy five). */
export function framingFromCamera(camera: string): "ECU" | "CU" | "MS" | "WS" {
  const c = camera.toLowerCase();
  if (/\[(?:extreme_close|ecu|macro|insert)\]|extreme close|macro|probe/.test(c)) return "ECU";
  if (/\[(?:close|cu|mcu|medium_close|ots|pov)\]|close-up|close up|\bclose\b|\bpov\b/.test(c)) return "CU";
  if (/\[(?:wide|ws|aerial|est|ovh)\]|wide|establish|aerial|drone|bird'?s[- ]eye/.test(c)) return "WS";
  return "MS";
}

export function angleFromCamera(camera: string): string {
  const c = camera.toLowerCase();
  if (/\[(?:ovh|top)\]|overhead|top-down|top down|bird'?s[- ]eye|straight[- ]down|flat[- ]?lay/.test(c)) return "overhead (top-down)";
  if (/\[aerial\]|aerial|drone/.test(c)) return "high aerial";
  if (/\[pov\]|\bpov\b|first-person|first person/.test(c)) return "first-person eye-line";
  if (/\[high\]|high angle/.test(c)) return "high angle";
  if (/\[low\]|low angle|\blow\b/.test(c)) return "low angle";
  return "eye level";
}

function beatsToPlan(beats: SegBeat[], duration: number): PlannedBeat[] {
  const list = beats.filter((b) => (b?.camera || b?.beat || "").trim());
  const step = duration / Math.max(1, list.length);
  return list.map((b, i) => ({
    role: "detail",
    camera: String(b.camera || "").trim() || "[CLOSE] locked-off",
    action: String(b.beat || "").trim(),
    start: Math.round(i * step * 10) / 10,
    end: Math.round((i + 1) * step * 10) / 10,
  }));
}

const profileLabel = (id: string) => DIRECTING_PROFILE_OPTIONS.find((o) => o.value === id)?.label_en || id;

function stripCode(camera: string): string {
  return camera.replace(/^\s*\[[A-Z_ -]+\]\s*/, "").trim();
}

/** Re-apply the user's camera / product-shoot selection to one compiled clip. */
export function applyCameraAuthorityToClip(
  clip: Clip,
  seg: { beats?: SegBeat[]; duration_seconds?: number },
  profile: LockedGenreProductionProfile | undefined | null,
): Clip {
  const duration = Math.max(1, Number(seg.duration_seconds) || Number(clip.duration_sec) || 10);
  const beats = Array.isArray(seg.beats) ? seg.beats : [];
  const shoot = shootFromProfile(profile);

  if (shoot && shoot.presence !== "with_characters") return applyProductShoot(clip, shoot, beats, duration);

  if (!profile?.camera_explicit) {
    if (!shoot) return clip;
    // People + product: keep the people coverage, add the product-insert style.
    return {
      ...clip,
      camera: {
        ...(clip.camera as Record<string, unknown>),
        product_insert_style: `${shoot.style.label_en}: ${shoot.style.description_en} Lighting: ${shoot.style.lighting}. Lens: ${shoot.style.lens}.`,
      },
    };
  }

  const ids = (profile.camera_profile_ids?.length ? profile.camera_profile_ids : [profile.camera_profile_id]).filter((id) => id && id !== "auto");
  const laws = ids.flatMap((id) => DIRECTING_LAWS[id as Exclude<DirectingProfileId, "auto">] ?? []);
  const plan = beatsToPlan(beats, duration);
  const path = plan.map((b) => `${b.start}–${b.end}s ${stripCode(b.camera)}`).join(" → ");
  const energetic = ids.some((id) => ENERGETIC.has(id));
  const hasDialogue = Array.isArray(clip.dialogue) && (clip.dialogue as unknown[]).length > 0;
  const first = plan[0]?.camera || "";
  const camera = clip.camera as Record<string, unknown> | undefined;
  return {
    ...clip,
    camera: {
      ...camera,
      framing: first ? framingFromCamera(first) : camera?.framing,
      angle: first ? angleFromCamera(first) : camera?.angle,
      movement: [
        `USER-SELECTED CAMERA: ${ids.map(profileLabel).join(" + ")}${profile.camera_direction ? ` — ${profile.camera_direction}` : ""}.`,
        path ? `Camera path through this ONE continuous take (each reframing is reached by physically moving the camera along one path, no cut, never jumping to the opposite side): ${path}.` : "",
        laws.length ? `Directing laws: ${laws.join(" ")}` : "",
        energetic
          ? "Keep the selected grammar's natural energy and speed; every fast move resolves into a crisp readable hold."
          : "Moves are smooth and controlled at the selected grammar's natural pace.",
        hasDialogue ? "Hold the declared visual subject; never pan to a speaker merely because they talk." : "",
      ].filter(Boolean).join(" "),
    },
  };
}

function applyProductShoot(clip: Clip, shoot: ResolvedProductShoot, beats: SegBeat[], duration: number): Clip {
  const plan = beatsToPlan(beats, duration);
  const s = shoot.style;
  const c = shoot.category;
  const productOnly = shoot.presence === "product_only";
  const audio = (clip.foley_and_ambience as Record<string, unknown>) || {};
  const rules = (clip.output_rules as Record<string, unknown>) || {};
  const action = (clip.scene_action as Record<string, unknown>) || {};
  const camera = productShootCameraBlock(shoot, plan, duration);
  return {
    ...clip,
    ...(productOnly ? { characters_in_scene: [], character_lock: {} } : {}),
    visual_style: [`${s.label_en} product cinematography`, s.lighting, s.lens, clip.visual_style].filter(Boolean).join("; "),
    product_shoot: {
      presence: shoot.presence,
      style: `${s.label_en}: ${s.description_en}`,
      set: s.set,
      product_motion: s.product_motion,
      category: c.label_en,
      geometry_lock: c.geometry_lock,
      ...(shoot.styleNotes ? { user_style_notes: shoot.styleNotes } : {}),
    },
    camera,
    scene_action: {
      ...action,
      execution_contract: productOnly
        ? "ONE continuous product take: only the light, the camera, the set element and the product's own moving parts act; nothing is added or removed; the product keeps its exact shape, colour, label and scale the whole time."
        : `ONE continuous hands-and-product take: anonymous hands perform ${c.hand_action} at real human speed; never show a face, head or body; the product keeps its exact shape, colour, label and scale.`,
    },
    foley_and_ambience: {
      ...audio,
      fx: audio.fx && Array.isArray(audio.fx) && (audio.fx as unknown[]).length === 0
        ? []
        : [`${c.foley}; ${s.sound}`],
    },
    lip_sync_director_note: "No on-camera speech. Any voice-over is an off-screen narrator; no mouth appears on screen.",
    output_rules: {
      ...rules,
      on_screen_text: "none except the product's own printed label, logo and markings, reproduced exactly as on the reference — no captions, HUD or watermark",
      reference_priority: `Attached product image(s) are the absolute authority for the product's shape, proportions, colour, materials, label and logo (${c.geometry_lock}). An attached set/location image controls the background only.`,
    },
    negative_prompt: [
      "morphing, warping, teleporting, flicker, duplicated product, changing product geometry, warped or altered label or logo text, brand-colour change, captions, watermark",
      ...productShootNegatives(shoot),
    ].join(", "),
  };
}
