// MASTER MANIFEST COMPILER — đúng kiến trúc canonical từ hội thoại thiết kế:
//   · 9 tầng KHÔNG bị trộn — mỗi tầng một namespace, có dấu niêm phong __layer
//   · Compiler chỉ GOM + VALIDATE + FREEZE ("người đóng dấu") — không sinh luật,
//     không hiểu scene, không chứa state
//   · Sai dấu tầng → THROW ngay khi module load (không compile được là biết)
//   · Manifest = HIẾN PHÁP (luật bất biến). State (cảnh, nhân vật cụ thể) sống
//     ở breakdown/segments — không bao giờ nằm trong manifest này.
// Tầng 2 (Environment DNA) sống ở src/lib/environment (archetype library) và
// được manifest tham chiếu bằng ID — không copy data vào đây.

import { worldLaws } from "./worldLaws";
import { entityLaws } from "./entityLaws";
import { objectLaws } from "./objectLaws";
import { actionLaws } from "./actionLaws";
import { sceneIntentLaws } from "./sceneIntentLaws";
import { cameraLaws } from "./cameraLaws";
import { lightingLaws } from "./lightingLaws";
import { audioLaws } from "./audioLaws";

interface LawBlock {
  readonly __layer: string;
  readonly id: string;
  readonly laws: readonly string[];
}

/** GIẢI PHÁP 1+4 của kiến trúc: dấu niêm phong tầng, sai → HALT. */
function assertLayer(block: LawBlock, expected: string): LawBlock {
  if (block.__layer !== expected) {
    throw new Error(`LAYER VIOLATION: expected ${expected}, got ${block.__layer}`);
  }
  if (!block.laws || block.laws.length === 0) {
    throw new Error(`EMPTY LAW LAYER: ${expected} has no laws`);
  }
  return block;
}

function deepFreeze<T extends object>(obj: T): T {
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object" && !Object.isFrozen(v)) deepFreeze(v as object);
  }
  return Object.freeze(obj);
}

function compileProductionManifest() {
  return deepFreeze({
    manifest_meta: { version: "1.0.0", immutable: true as const },
    world_laws: assertLayer(worldLaws, "WORLD_DNA"),
    // TẦNG 2 — Environment DNA: referenced by archetype id (src/lib/environment)
    environment_laws_ref: "src/lib/environment (archetype library, Kelvin+Lux, material physics, stability locks)",
    entity_laws: assertLayer(entityLaws, "ENTITY_DNA"),
    object_laws: assertLayer(objectLaws, "OBJECT_DNA"),
    action_continuity_laws: assertLayer(actionLaws, "ACTION_CONTINUITY"),
    scene_intent_laws: assertLayer(sceneIntentLaws, "SCENE_INTENT"),
    camera_laws: assertLayer(cameraLaws, "CAMERA"),
    lighting_laws: assertLayer(lightingLaws, "LIGHTING"),
    audio_laws: assertLayer(audioLaws, "AUDIO"),
  });
}

/** The frozen constitution. Every prompt builder reads THIS, never raw layers. */
export const PRODUCTION_LAWS = compileProductionManifest();

// ─── Renderers (manifest → prompt text; the ONLY way laws reach the AI) ─────

/** Compact digest injected into the storyboard SYSTEM prompt — the 9-layer
 * constitution the script/storyboard model must obey when writing every field. */
export function lawsSystemDigest(): string {
  const block = (title: string, b: LawBlock) =>
    `▸ ${title} [${b.id}]:\n${b.laws.map((l) => `  · ${l}`).join("\n")}`;
  return `PRODUCTION LAWS (9-layer constitution v${PRODUCTION_LAWS.manifest_meta.version} — IMMUTABLE. Every segment, beat, first_frame_prompt, motion_prompt, dialogue and camera note MUST obey ALL of these; they outrank style preferences):
${block("TẦNG 1 · WORLD", PRODUCTION_LAWS.world_laws)}
▸ TẦNG 2 · ENVIRONMENT: governed by the ENVIRONMENT ENGINE archetypes (materials with real physics, Kelvin+Lux light, locked geometry — see that section).
${block("TẦNG 3 · ENTITY", PRODUCTION_LAWS.entity_laws)}
${block("TẦNG 4 · OBJECT", PRODUCTION_LAWS.object_laws)}
${block("TẦNG 5 · ACTION CONTINUITY", PRODUCTION_LAWS.action_continuity_laws)}
${block("TẦNG 6 · SCENE INTENT", PRODUCTION_LAWS.scene_intent_laws)}
${block("TẦNG 7 · CAMERA", PRODUCTION_LAWS.camera_laws)}
${block("TẦNG 8 · LIGHTING", PRODUCTION_LAWS.lighting_laws)}
${block("TẦNG 9 · AUDIO", PRODUCTION_LAWS.audio_laws)}`;
}

/** One-line motion/physics law clause for every per-clip Veo prompt tail. */
export function clipMotionLawLine(): string {
  return "LAWS (world/entity/action): gravity and real weight at all times; time continuous — no jumps; exactly one head, two arms, two legs, five fingers per hand in every frame; joints bend only naturally; feet planted carrying real weight; ONE continuous primary action travelling start-pose → end-pose through real space — NO teleporting, NO mid-clip cuts; hands make real contact and never pass through objects; objects keep one solid form and move only when moved. CAUSAL CHAIN: every object interaction shows the FULL visible chain — the hand reaches to the object, fingers close on it, it is carried along one continuous path, then released — an object never appears in a hand or changes place without this chain. CAUSE BEFORE EFFECT: nothing moves, falls or tips by itself — the visible physical cause makes contact first, the effect follows with real physics timing. ONE LOCATION: the whole clip stays in one continuous space; the background never switches mid-clip.";
}

/** One-line camera law clause for per-clip prompts. */
export function clipCameraLawLine(): string {
  return "CAMERA LAW: one smooth motivated move only (slow push-in / gentle pan / slow orbit), continuous like a real operator — no teleports, no hard cuts; same lens as every other clip; horizon locked ±3°; the speaker's face in medium-close focus during the line.";
}

/** One-line audio law clause for per-clip prompts. */
export function clipAudioLawLine(): string {
  return "AUDIO LAW: the voice comes from the speaker's mouth with exact lip-sync; one constant low ambient bed for this location; diegetic sounds follow the visible actions; natural breathing room around the line; no music drowning the voice.";
}

/** Compact JSON block for the Veo JSON export (laws travel with the prompts). */
export function lawsForVeoJson(): Record<string, unknown> {
  return {
    version: PRODUCTION_LAWS.manifest_meta.version,
    world: PRODUCTION_LAWS.world_laws.id,
    entity: PRODUCTION_LAWS.entity_laws.laws.slice(0, 3),
    // Includes the causal-chain / cause-before-effect / one-location laws.
    action: PRODUCTION_LAWS.action_continuity_laws.laws.slice(0, 7),
    camera: PRODUCTION_LAWS.camera_laws.laws.slice(0, 4),
    lighting: PRODUCTION_LAWS.lighting_laws.laws.slice(0, 3),
    audio: PRODUCTION_LAWS.audio_laws.laws.slice(0, 4),
  };
}

// ─── Prompt validation (ported from GỐC promptValidator: lazy-shorthand ban) ─
// The model may not "reference" prior clips instead of restating state — that
// shorthand is exactly what makes Veo drift.
export const LAW_FORBIDDEN_SHORTHAND = [
  "same environment as",
  "same scene as",
  "same character as",
  "same outfit as",
  "same camera as",
  "same lighting as",
  "same as before",
  "same as above",
  "like before",
  "as previously",
  "refer to previous clip",
  "use previous clip",
  "identical to clip",
  "copy from clip",
  "as in clip",
  "ignore time memory",
] as const;

/** Returns the lazy-shorthand violations found in a prompt (empty = clean). */
export function findLawViolations(text: string): string[] {
  const lower = (text || "").toLowerCase();
  return LAW_FORBIDDEN_SHORTHAND.filter((t) => lower.includes(t));
}
