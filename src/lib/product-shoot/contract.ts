// ============================================================
// PRODUCT SHOOT CONTRACT — turns the user's presence / style / category choice
// into HARD instructions for every stage:
//   · the script LLM (what to write, who may appear, which camera words exist),
//   · each shot's beats (a deterministic beat plan drawn from the chosen style),
//   · the exported video prompt camera block (timed choreography, lens, light),
//   · the keyframe still (product fidelity, no people / hands only).
// The chosen style is the ONLY camera grammar; nothing here is a soft lens.
// ============================================================
import {
  CATEGORY_BY_ID,
  STYLE_BY_ID,
  detectProductCategory,
  isPresenceMode,
  isProductCategoryId,
  resolveShotStyle,
  type BeatRole,
  type PresenceMode,
  type ProductCategory,
  type ProductCategoryId,
  type ProductShotStyle,
  type ProductShotStyleId,
} from "./catalog.ts";

export interface ProductShootSettings {
  presence?: PresenceMode | string;
  /** Style id or "auto" (best fit for the category). */
  style?: ProductShotStyleId | "auto" | string;
  /** Category id or "auto" (detected from product name / topic). */
  category?: ProductCategoryId | "auto" | string;
  /** Free-text notes about a reference video or look the user wants. */
  style_notes?: string;
}

export interface ResolvedProductShoot {
  presence: PresenceMode;
  styleId: ProductShotStyleId;
  style: ProductShotStyle;
  categoryId: ProductCategoryId;
  category: ProductCategory;
  styleNotes: string;
  /** True when the user explicitly picked the style (not auto). */
  styleLocked: boolean;
}

export interface PlannedBeat {
  role: BeatRole;
  /** Camera line with a leading framing code, e.g. "[EXTREME_CLOSE] MACRO, slow push-in…". */
  camera: string;
  action: string;
  /** Seconds from clip start. */
  start: number;
  end: number;
}

const FAST_STYLES: ProductShotStyleId[] = ["motion_control", "color_pop_studio", "stop_motion"];

/** The product shoot recorded in a locked production profile (null when none). */
export function shootFromProfile(profile: { product_shoot?: { presence: string; style: string; category: string; style_notes?: string } } | undefined | null): ResolvedProductShoot | null {
  const ps = profile?.product_shoot;
  if (!ps) return null;
  return resolveProductShoot({ presence: ps.presence, style: ps.style, category: ps.category, style_notes: ps.style_notes });
}

export function resolveProductShoot(
  settings: ProductShootSettings | null | undefined,
  productText: Array<string | null | undefined> = [],
): ResolvedProductShoot | null {
  if (!settings || !isPresenceMode(settings.presence)) return null;
  const presence = settings.presence;
  const categoryId = isProductCategoryId(settings.category)
    ? settings.category
    : detectProductCategory(...productText);
  const styleLocked = typeof settings.style === "string" && settings.style !== "auto" && !!STYLE_BY_ID[settings.style as ProductShotStyleId];
  const styleId = resolveShotStyle(settings.style, categoryId, presence);
  return {
    presence,
    styleId,
    style: STYLE_BY_ID[styleId],
    categoryId,
    category: CATEGORY_BY_ID[categoryId],
    styleNotes: String(settings.style_notes || "").replace(/\s+/g, " ").trim().slice(0, 600),
    styleLocked,
  };
}

/** Framing code the existing camera parsers understand. */
export function framingCode(camera: string): "EXTREME_CLOSE" | "CLOSE" | "MEDIUM" | "WIDE" {
  const c = camera.toLowerCase();
  if (/extreme|macro|probe/.test(c)) return "EXTREME_CLOSE";
  if (/close/.test(c)) return "CLOSE";
  if (/wide|establish/.test(c)) return "WIDE";
  return "MEDIUM";
}

function withCode(camera: string): string {
  return /^\s*\[/.test(camera) ? camera : `[${framingCode(camera)}] ${camera}`;
}

/** Ordered beat roles for the whole video, ~beatsPerClip per clip, always ending on the hero frame. */
function roleSequence(totalBeats: number): BeatRole[] {
  if (totalBeats <= 1) return ["hero"];
  if (totalBeats === 2) return ["reveal", "hero"];
  if (totalBeats === 3) return ["reveal", "detail", "hero"];
  const middle: BeatRole[] = [];
  for (let i = 0; i < totalBeats - 3; i++) middle.push(i % 2 === 0 ? "detail" : "proof");
  // Make sure at least one proof moment exists before the hero frame.
  if (!middle.includes("proof")) middle[middle.length - 1] = "proof";
  return ["hook", "reveal", ...middle, "hero"];
}

/**
 * Deterministic beat plan for every clip, drawn ONLY from the chosen style's
 * camera vocabulary and the category's hero details / proof moments.
 */
export function planProductBeats(
  shoot: ResolvedProductShoot,
  clipDurations: number[],
): PlannedBeat[][] {
  const perClip = FAST_STYLES.includes(shoot.styleId) ? 3 : 2;
  const roles = roleSequence(Math.max(1, clipDurations.length * perClip));
  const byRole = (role: BeatRole) => shoot.style.beats.find((b) => b.role === role) || shoot.style.beats[0]!;
  let detailN = 0, proofN = 0;
  const details = shoot.category.hero_details;
  const proofs = shoot.category.proof_moments;
  const handsNote = shoot.presence === "hands_only" ? ` Only ${shoot.category.hand_action} — hands/wrist/forearm only, no face.` : "";
  const flat = roles.map((role) => {
    const tpl = byRole(role);
    let focus = "";
    if (role === "detail") { focus = details[detailN++ % Math.max(1, details.length)] || ""; }
    if (role === "proof") { focus = proofs[proofN++ % Math.max(1, proofs.length)] || ""; }
    const action = [tpl.action, focus ? `Featured: ${focus}.` : "", handsNote].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    return { role, camera: withCode(tpl.camera), action };
  });
  const out: PlannedBeat[][] = [];
  let k = 0;
  clipDurations.forEach((dur, i) => {
    const remainingClips = clipDurations.length - i;
    const remainingBeats = flat.length - k;
    const n = i === clipDurations.length - 1 ? remainingBeats : Math.max(1, Math.round(remainingBeats / remainingClips));
    const slice = flat.slice(k, k + n);
    k += n;
    const d = Math.max(1, Number(dur) || 8);
    const step = d / Math.max(1, slice.length);
    out.push(slice.map((b, j) => ({ ...b, start: Math.round(j * step * 10) / 10, end: Math.round((j + 1) * step * 10) / 10 })));
  });
  return out;
}

const PRESENCE_RULE: Record<PresenceMode, string> = {
  product_only: "PRODUCT ONLY: no person, no face, no hands, no fingers, no arms, no body part, no mannequin and no human silhouette or reflection appears in ANY shot. The product is the protagonist; light, material, set elements and the camera tell the story. character_locks and characters_in_scene are EMPTY.",
  hands_only: "HANDS ONLY: the only human presence is hands, wrists and forearms performing the real product action; never a face, head, hair, torso, full body or a mirror reflection of a person. Frame tightly so the crop stays at the forearm. Hands are anonymous (no named character, no dialogue on camera).",
  with_characters: "WITH PEOPLE — AFFILIATE PROBLEM → SOLUTION: a real person meets one recognisable everyday problem, the product arrives as the solution by 3–5 seconds, one real operation is demonstrated, the visible result proves the benefit, and the video closes on one exact CTA.",
};

/** Hard directive for the script / shot-breakdown LLM. */
export function productShootScriptDirective(shoot: ResolvedProductShoot, opts: { productName?: string } = {}): string {
  const s = shoot.style;
  const c = shoot.category;
  const name = opts.productName?.trim() || c.label_en;
  const lines = [
    `PRODUCT SHOOT CONTRACT (HARD — overrides any genre, story-format or camera-profile default):`,
    `- Product: ${name} · category ${c.label_en}. Materials: ${c.materials}. Geometry lock: ${c.geometry_lock}.`,
    `- Presence: ${PRESENCE_RULE[shoot.presence]}`,
  ];
  if (shoot.presence === "with_characters") {
    lines.push(`- Problem to dramatise (adapt to the product and audience): ${c.problem_hint}. Show the problem with a visible consequence before the product appears; never open on the product. The solution beat shows a person using the product: ${c.hand_action}.`);
    lines.push(`- Every product insert (reveal, detail, proof, hero) is shot in the "${s.label_en}" style: ${s.description_en} Lighting: ${s.lighting}. Lens: ${s.lens}.`);
  } else {
    lines.push(`- SHOT STYLE "${s.label_en}" (the user's choice — use it for EVERY shot): ${s.description_en}`);
    lines.push(`- Lighting: ${s.lighting}.`);
    lines.push(`- Set: ${s.set}.`);
    lines.push(`- Lens: ${s.lens}.`);
    lines.push(`- Product motion: ${s.product_motion}. Pacing: ${s.pacing}.`);
    lines.push(`- Story arc across the video: hook → reveal → detail → proof → hero frame + CTA. Detail beats show: ${c.hero_details.join("; ")}. Proof beats show: ${c.proof_moments.join("; ")}.`);
    lines.push(`- Sound: ${s.sound}; product foley: ${c.foley}. Voice-over (if enabled) is short, benefit-led and spoken by an off-screen narrator.`);
  }
  lines.push(`- CAMERA VOCABULARY (the ONLY allowed moves): ${s.camera_moves.join("; ")}. Every beats[].camera MUST start with a framing code [EXTREME_CLOSE] / [CLOSE] / [MEDIUM] / [WIDE] and then use one of these moves. Do not invent other moves${FAST_STYLES.includes(shoot.styleId) ? "" : ", never whip, shake or cut fast"}.`);
  lines.push(`- Keyframe rule: ${s.keyframe_rule}.`);
  lines.push(`- Avoid: ${[...s.negative, ...(shoot.presence === "product_only" ? ["any person or body part"] : [])].join("; ")}.`);
  if (shoot.styleNotes) lines.push(`- User's reference / look notes (follow them when they do not conflict with the presence rule): ${shoot.styleNotes}`);
  return lines.join("\n");
}

/** Camera block for one exported video clip (replaces the generic human-coverage camera). */
export function productShootCameraBlock(shoot: ResolvedProductShoot, beats: PlannedBeat[], duration: number) {
  const s = shoot.style;
  const fast = FAST_STYLES.includes(shoot.styleId);
  const timeline = beats.map((b) => `${fmt(b.start)}–${fmt(b.end)}s: ${b.camera.replace(/^\s*\[[A-Z_]+\]\s*/, "")} — ${b.action.replace(/[.\s]*$/, ".")}`).join(" ");
  const first = beats[0];
  return {
    framing: first ? ({ EXTREME_CLOSE: "ECU", CLOSE: "CU", MEDIUM: "MS", WIDE: "WS" } as const)[framingCode(first.camera)] : "CU",
    angle: first && /low angle|\blow\b/i.test(first.camera) ? "low angle" : first && /top-down|overhead|high angle/i.test(first.camera) ? "high angle" : "eye level",
    movement: `${s.label_en.toUpperCase()} — one continuous ${Math.round(duration)}-second take, the moves flow into each other with no cut: ${timeline} Allowed camera moves ONLY: ${s.camera_moves.join("; ")}. Pacing: ${s.pacing}${fast ? "; every fast move ends in a crisp hold" : "; smooth, controlled, never rushed or shaky"}.`,
    lens: s.lens,
    lighting_choreography: s.lighting,
    set: s.set,
    focus: shoot.presence === "with_characters"
      ? "Product inserts keep the product tack-sharp; person shots follow the acting subject."
      : "Focus always stays on the product; rack focus only between product details; the product is never soft, blurred or partly out of frame unless the beat says so.",
  };
}

/** Negative terms for exported prompts. */
export function productShootNegatives(shoot: ResolvedProductShoot): string[] {
  const base = [...shoot.style.negative, "product shape, colour, text or logo different from the reference", "extra or missing product parts", "melting or morphing product"];
  if (shoot.presence === "product_only") base.push("any person", "face", "hands", "fingers", "arms", "body parts", "mannequin", "human silhouette or reflection");
  if (shoot.presence === "hands_only") base.push("face", "head", "hair", "torso", "full body", "mirror reflection of a person", "extra fingers", "deformed hands");
  return Array.from(new Set(base));
}

/** Keyframe (still image) contract for a product-shoot shot. */
export function productShootKeyframeContract(shoot: ResolvedProductShoot, beat: PlannedBeat | undefined) {
  const s = shoot.style;
  return {
    subject: shoot.presence === "with_characters"
      ? "as written in the scene — product inserts keep the product as the hero"
      : `the product (${shoot.category.label_en}) is the ONLY subject${shoot.presence === "hands_only" ? ", with anonymous hands/wrist only" : ""}`,
    presence_rule: PRESENCE_RULE[shoot.presence],
    style: `${s.label_en}: ${s.description_en}`,
    first_frame: beat ? `${beat.camera} — ${beat.action}` : s.beats[0]!.camera,
    keyframe_rule: s.keyframe_rule,
    lighting: s.lighting,
    set: s.set,
    lens: s.lens,
    product_fidelity: `Copy the product EXACTLY from its reference image(s): ${shoot.category.geometry_lock}. The product's own printed label, logo and markings are part of the product and must be reproduced faithfully — they are the ONLY text allowed in the frame.`,
  };
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
