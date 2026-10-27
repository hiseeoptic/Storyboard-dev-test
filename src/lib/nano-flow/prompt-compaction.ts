// Export projection for the Flow-facing prompts.
//
// buildNanoFlowManifest compiles the canonical contract: every block restates
// its rules in full so each one can be checked on its own. Sent as-is, a
// single keyframe ran past 40k characters and a video clip past 43k, which is
// more than a Flow Agent turn can copy into its tool calls. This pass removes
// only COPIES — a rule written once per character, a sentence repeated across
// blocks, the whole-clip motion inside a still frame, empty fields — so every
// fact still reaches the model exactly once. Pure and idempotent; the full
// canonical state stays in manifest.production_state.

import type { NanoFlowManifest } from "@/types/nano-flow";

type Json = Record<string, unknown>;

function isObj(value: unknown): value is Json {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** null, "", [], {} and the placeholder "unknown" carry no instruction. */
function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return !value.trim() || /^unknown$/i.test(value.trim());
  if (Array.isArray(value)) return value.length === 0;
  if (isObj(value)) return Object.keys(value).length === 0;
  return false;
}

function pruneEmpty(value: Json): Json {
  const out: Json = {};
  for (const [key, entry] of Object.entries(value)) if (!isEmpty(entry)) out[key] = entry;
  return out;
}

/** Rebuild `obj` in order, replacing each key with `map(key, value)` (undefined drops it). */
function mapKeys(obj: Json, map: (key: string, value: unknown) => Array<[string, unknown]> | undefined): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(obj)) {
    const entries = map(key, value) ?? [[key, value]];
    for (const [k, v] of entries) if (v !== undefined) out[k] = v;
  }
  return out;
}

const norm = (text: string) =>
  text.toLocaleLowerCase().replace(/\s+/g, " ").replace(/[\s.;,…]+$/u, "").trim();

/** Share of `text`'s content words that also occur in `corpus`. */
function coverage(text: string, corpus: string): number {
  const words = (t: string) => t.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2);
  const have = new Set(words(corpus));
  const need = words(text);
  if (!need.length) return 1;
  return need.filter((w) => have.has(w)).length / need.length;
}

// ── Wardrobe ────────────────────────────────────────────────────────────────

/** A top/outfit text that already names the lower garment or a one-piece. */
const NAMES_LOWER_GARMENT =
  /(?:^|[^\p{L}])(?:trousers?|pants|jeans|shorts|skirt|leggings|joggers|slacks|chinos|culottes|dress|gown|one-?piece|onesie|jumpsuit|romper|overalls|dungarees|bodysuit|sleepsuit|robe|kimono|áo dài|váy|quần|đầm|yếm)(?=$|[^\p{L}])/iu;

export function outfitNamesLowerGarment(text: string): boolean {
  return NAMES_LOWER_GARMENT.test(text);
}

// The old outfit splitter appended this to a costume that was one phrase, even
// when that phrase already named the trousers ("…blue cotton trousers., a plain
// matching pair of trousers…").
const TROUSERS_FILLER = "a plain matching pair of trousers completing the locked outfit, kept identical in every clip";

function cleanWardrobe(text: string): string {
  if (!text.includes(TROUSERS_FILLER)) return text;
  const [before] = text.split(TROUSERS_FILLER);
  const top = (before ?? "").replace(/[\s.,;]+$/u, "");
  return outfitNamesLowerGarment(top) ? top : `${top}, ${TROUSERS_FILLER}`;
}

// ── Keyframe ────────────────────────────────────────────────────────────────

/** Per-character face binding of a clean keyframe; manifest.ts builds it from here. */
export function keyframeReferenceBinding(name: string, styled: boolean): string {
  return styled
    ? `Use ONLY the attached character/design sheet labelled ${name} for ${name}; keep the exact proportions, line/shape/material language, palette and identity markers.`
    : `Use ONLY the attached wardrobe sheet labelled ${name} for ${name}. That sheet holds THREE framings of the SAME person: take ${name}'s FRONTAL FACE — eyes, nose, mouth, face shape, skin tone, hairline — from the SHARP CHEST-UP CLOSE-UP panel, which is the DEFINITIVE face. The 90° SIDE-PROFILE panel is ONLY for head/silhouette shape and the full-body panel ONLY for wardrobe and proportion — NEVER build a front-facing face from the side-profile panel. Never blend ${name}'s face with another character's.`;
}

const SHARED_BINDING = {
  styled:
    "Each identity uses ONLY the attached character/design sheet labelled with its own name; keep the exact proportions, line/shape/material language, palette and identity markers.",
  photoreal:
    "Each identity uses ONLY the attached wardrobe sheet labelled with its own name. That sheet holds THREE framings of the SAME person: take the FRONTAL FACE — eyes, nose, mouth, face shape, skin tone, hairline — from the SHARP CHEST-UP CLOSE-UP panel, which is the DEFINITIVE face. The 90° SIDE-PROFILE panel is ONLY for head/silhouette shape and the full-body panel ONLY for wardrobe and proportion — NEVER build a front-facing face from the side-profile panel. Never blend one character's face with another's.",
  // With the full reference law present ("copy EACH character's face … from that
  // same-named attached reference … the sharp FRONTAL CLOSE-UP panel is the
  // definitive face … never blend two people"), only the panel roles are new.
  photorealUnderLaw:
    "Sheet roles: the sharp chest-up close-up gives eyes, nose, mouth, face shape, skin tone and hairline; the 90° side-profile panel is ONLY for head/silhouette shape and the full-body panel ONLY for wardrobe and proportion.",
};

function compactEntity(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const entity = pruneEmpty(raw);
  const id = str(entity.entity_id);
  if (
    (entity.kind === "character" && id.startsWith("char_")) ||
    (entity.kind === "object" && id.startsWith("obj_"))
  ) {
    delete entity.kind;
  }
  return entity;
}

/**
 * An object's state and place are already in the set-dressing lock, and a
 * character's facing in the placement contract; keep only what those miss
 * (holder, orientation of an object, pose and state of a person).
 */
function withoutRestatedFields(entity: Json, dressing: string, placementOrientation: Map<string, string>): Json {
  const id = str(entity.entity_id);
  const out = { ...entity };
  if (id.startsWith("obj_") && dressing && str(out.state) && str(out.position) &&
      dressing.includes(norm(str(out.state))) && dressing.includes(norm(str(out.position)))) {
    delete out.state;
    delete out.position;
  }
  if (str(out.orientation) && placementOrientation.get(id) === str(out.orientation)) delete out.orientation;
  return out;
}

function compactPlacement(raw: unknown): unknown {
  return isObj(raw) ? pruneEmpty(raw) : raw;
}

/**
 * A still frame shows ONE instant. Keep only that instant's state (who holds
 * what, where, facing which way); the clip's motion, dialogue, camera path and
 * other end of the clip belong to the video prompt.
 */
function keyframeAuthority(authority: Json, keyframe: Json): Json {
  const end = keyframe.interpolation_role === "end";
  const snapshotKey = end ? "end_snapshot" : "start_snapshot";
  const snapshot = isObj(authority[snapshotKey]) ? (authority[snapshotKey] as Json) : {};
  const hasPlacementContract = isObj(keyframe.placement_continuity_contract);
  const dressing = norm(str(keyframe.set_dressing_lock));
  const placementOrientation = new Map(
    (hasPlacementContract && Array.isArray((keyframe.placement_continuity_contract as Json).canonical_placements)
      ? ((keyframe.placement_continuity_contract as Json).canonical_placements as unknown[])
      : []
    ).filter(isObj).map((entry) => [str(entry.entity_id), str(entry.body_orientation)] as const)
  );
  const projected: Json = {
    entities: (Array.isArray(snapshot.entities) ? snapshot.entities : []).map((raw) => {
      const entity = compactEntity(raw);
      return isObj(entity) ? withoutRestatedFields(entity, dressing, placementOrientation) : entity;
    }),
  };
  // The placement contract below already carries the same placements.
  if (!hasPlacementContract && Array.isArray(snapshot.placements) && snapshot.placements.length) {
    projected.placements = snapshot.placements.map(compactPlacement);
  }
  const out: Json = {
    production_shot_id: authority.production_shot_id,
    canonical_manifest_path: authority.canonical_manifest_path,
  };
  if (str(authority.authority_fingerprint) && authority.authority_fingerprint !== keyframe.authority_fingerprint) {
    out.authority_fingerprint = authority.authority_fingerprint;
  }
  out[snapshotKey] = projected;
  const script = isObj(authority.script_contract) ? authority.script_contract : {};
  const firstFrame = str(script.first_frame_prompt);
  const described = [keyframe.moment, keyframe.setting, keyframe.scenery].map(str).join(" ");
  // The script's own first-frame text stays only where it says more than moment/setting.
  if (!end && firstFrame && coverage(firstFrame, described) < 0.9) out.script_first_frame = firstFrame;
  if (!out.script_first_frame && str(authority.script_first_frame)) out.script_first_frame = authority.script_first_frame;
  return pruneEmpty(out);
}

function compactCardinality(contract: unknown, styled: boolean, underLaw: boolean): unknown {
  if (!isObj(contract) || !Array.isArray(contract.identities)) return contract;
  const identities = contract.identities.filter(isObj);
  const allStandard = identities.length > 0 && identities.every(
    (entry) => str(entry.reference_binding) === keyframeReferenceBinding(str(entry.name), styled)
  );
  if (!allStandard) return contract;
  return {
    identities: identities.map((entry) => ({
      name: entry.name,
      maximum_instances_per_panel: entry.maximum_instances_per_panel,
    })),
    reference_binding: styled ? SHARED_BINDING.styled : underLaw ? SHARED_BINDING.photorealUnderLaw : SHARED_BINDING.photoreal,
    rule: contract.rule,
  };
}

/** True when every per-name clause of wardrobe_note is already in that character's cast entry. */
function wardrobeNoteCovered(note: string, cast: unknown): boolean {
  if (!note || !Array.isArray(cast) || cast.length === 0) return false;
  const byName = new Map(
    cast.filter(isObj).map((entry) => [norm(str(entry.name)), norm(str(entry.wardrobe))] as const)
  );
  const body = note.replace(/^[^:]*:\s*/u, "");
  const clauses = body.split(/;\s*/u).map((part) => part.trim()).filter(Boolean);
  if (!clauses.length) return false;
  return clauses.every((clause) => {
    const match = clause.match(/^(.+?)\s+(?:in|wears|wearing)\s+(.+)$/iu);
    if (!match) return false;
    const wardrobe = byName.get(norm(match[1]!));
    return !!wardrobe && wardrobe.includes(norm(match[2]!));
  });
}

function compactPlacementContract(contract: unknown): unknown {
  if (!isObj(contract) || !Array.isArray(contract.canonical_placements)) return contract;
  const entries = contract.canonical_placements.map(compactPlacement).filter(isObj);
  const labels = entries.map((entry) => str(entry.position_label));
  const shared = entries.length > 1 && labels[0] && labels.every((label) => label === labels[0]) ? labels[0] : "";
  const out: Json = {};
  for (const [key, value] of Object.entries(contract)) {
    if (key === "canonical_placements") {
      if (shared) out.shared_position_label = shared;
      out.canonical_placements = shared
        ? entries.map(({ position_label: _label, ...rest }) => rest)
        : entries;
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Compact one clean keyframe prompt (JSON string). A multi-panel board, a
 * product-only frame's own contracts and any non-JSON prompt are left as they
 * are apart from the shared clean-ups.
 */
export function compactKeyframePrompt(prompt: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(prompt);
  } catch {
    return prompt;
  }
  if (!isObj(parsed) || Array.isArray(parsed.panels) || !/keyframe$/.test(str(parsed.type))) return prompt;
  const k = parsed;
  const styled = str(k.type) === "styled_keyframe";

  const cast = Array.isArray(k.cast)
    ? k.cast.map((entry) => (isObj(entry) && typeof entry.wardrobe === "string" ? { ...entry, wardrobe: cleanWardrobe(entry.wardrobe) } : entry))
    : k.cast;
  const dropWardrobeNote = typeof k.wardrobe_note === "string" && wardrobeNoteCovered(k.wardrobe_note, cast);

  // One reference law, early. The short restatement and the full law said the
  // same thing in two places.
  const fidelity = str(k.reference_fidelity_contract);
  const law = str(k.reference_authority);
  const photorealLaw = law.startsWith("ABSOLUTE REFERENCE LAW");
  let referenceLaw = "";
  if (fidelity && law) referenceLaw = photorealLaw ? law : `${fidelity} ${law}`;
  const pointAtCast = (text: string) =>
    dropWardrobeNote ? text.replace("outfit in wardrobe_note", "outfit in cast[].wardrobe") : text;

  const persistent = Array.isArray(k.persistent_prop_authority) ? k.persistent_prop_authority.filter(isObj) : [];
  const propRule = persistent.length && new Set(persistent.map((entry) => str(entry.rule))).size === 1 ? str(persistent[0]!.rule) : "";
  const propIds = persistent.map((entry) => str(entry.entity_id));
  // consistency already lists every persistent prop; give it the prop rule and
  // drop the per-prop copies of that rule.
  const propList = `(${propIds.join(", ")})`;
  // "obj_phone_mother (phone_mother)" names the prop twice.
  const shortList = `(${propIds.map((id) => id.replace(/^obj_(.+?) \(\1\)$/u, "obj_$1")).join(", ")})`;
  const propClause = `Persistent props ${propList} keep one exact shape, material, colour and wear across shots.`;
  const propRuleAsClause = propRule.replace(/^The first /u, "their first ");
  const propsInConsistency = !!propRule && propRuleAsClause !== propRule && str(k.consistency).includes(propClause);

  const seated = isObj(k.support_surface_contract) ? k.support_surface_contract.seated_characters : undefined;
  const setting = str(k.setting);

  const out = mapKeys(k, (key, value) => {
    switch (key) {
      case "production_state_authority":
        return [[key, isObj(value) ? keyframeAuthority(value, k) : value]];
      // The video prompt's own blocks; a still frame needs only its instant (moment, camera, set).
      case "video_prompt_projection":
      // camera + moment + set + light + wardrobe glued together, each already a field here.
      case "opening_frame":
        return [];
      case "reference_fidelity_contract":
        return referenceLaw ? [["reference_authority", pointAtCast(referenceLaw)]] : [[key, value]];
      case "reference_authority":
        return referenceLaw ? [] : [[key, typeof value === "string" ? pointAtCast(value) : value]];
      case "cast":
        return [[key, cast]];
      case "wardrobe_note":
        return dropWardrobeNote ? [] : [[key, value]];
      case "character_cardinality_contract":
        return [[key, compactCardinality(value, styled, photorealLaw)]];
      // Same rule as camera_subject_contract + the cardinality and reference law.
      case "staging":
        return isObj(k.camera_subject_contract) ? [] : [[key, value]];
      case "support_surface_contract":
        return Array.isArray(seated) && seated.length === 0 ? [] : [[key, value]];
      case "placement_continuity_contract":
        return [[key, compactPlacementContract(value)]];
      case "persistent_prop_authority":
        if (propsInConsistency) return [];
        return propRule ? [[key, { entity_ids: propIds, rule: propRule }]] : [[key, value]];
      case "consistency": {
        const text = str(value);
        if (propsInConsistency) {
          const merged = `${propClause.replace(/\.$/u, "").replace(propList, shortList)}; ${propRuleAsClause}`;
          return [[key, text.replace(propClause, merged)]];
        }
        return [[key, propRule && text.includes(propList) ? text.replace(propList, "(listed in persistent_prop_authority)") : value]];
      }
      case "negative": {
        let text = str(value);
        if (str(k.layout).includes("NO text of any kind")) {
          text = text.replace(
            "This is ONE single film frame: no storyboard grid, no panels, no split frames, no collage, no captions, no numbers, no watermark, no logo, NO text of any kind.",
            "No watermark, no logo."
          );
        }
        if (str(k.body_visibility_contract).includes("disembodied")) {
          text = text.replace(" never render disembodied hands, arm-only crops or headless people;", "");
        }
        return [[key, text || value]];
      }
      case "setting_authority": {
        // Point (3) of the photoreal reference law already says this in full.
        if (photorealLaw && law.includes("(3) LOCATION comes from the attached location reference")) return [];
        const text = str(value);
        const quoted = `from this description: ${setting}`;
        return [[key, setting && text.includes(quoted) ? text.replace(quoted, "from the setting and scenery fields").replace(/\.\.\s/u, ". ") : value]];
      }
      default:
        return [[key, value]];
    }
  });
  return JSON.stringify(out);
}

// ── Video ───────────────────────────────────────────────────────────────────

const OPENING_FRAME_RULE = (aspect: string) =>
  `OPENING FRAME${aspect ? ` (${aspect})` : ""}: the attached keyframe IS frame 0 of this clip — begin from exactly that picture (the same people in the same screen positions, poses, facing directions and hands; the same framing and camera angle; the same room, furniture, decor, light and wardrobe) and animate the scripted action forward from it as ONE continuous full-frame shot. Never re-stage it, invent another set or camera setup, or turn it into a montage, grid, collage, split screen, numbered board, caption strip, border or picture-in-picture.`;

const REFERENCE_PRIORITY_COMPACT = {
  photoreal:
    "AUTHORITY ORDER (do NOT reverse it): this script-derived structured video prompt is the sole semantic authority for story action, dialogue, timing, state transition and ending. The keyframe (opening_frame) owns only the opening look and never adds, removes or reorders events; where start_state text or the location board differs from it, KEEP THE KEYFRAME'S LAYOUT AND SET — never re-stage, re-seat or relocate anyone and never swap to another room. Each attached character WARDROBE SHEET locks ONLY that character's face, hair and full outfit — copy them exactly and ignore the sheet's plain studio backdrop. The location board keeps the environment consistent where the keyframe does not show it (background, spatial layout, furniture, props, doors, windows, lighting and materials). Bind EVERY named character to their OWN same-named wardrobe sheet for the WHOLE clip — never drop a reference, never map one character's face onto another, never let a face, outfit or the set drift mid-shot.",
  styled:
    "AUTHORITY ORDER (do NOT reverse it): this script-derived structured video prompt owns story action, dialogue, timing, state transition and ending. The keyframe (opening_frame) owns only the opening look; where start_state text differs from it, the keyframe's layout wins. The selected STYLE LOCK owns the render medium for characters, the complete script-derived environment and props. Character sheets lock each design/identity; the location board locks the scripted terrain/architecture, landmarks, layout and light wherever the keyframe does not show them. Never replace the scripted location with a blank canvas, generic studio or unrelated template.",
};

const STORYBOARD_ROLE_COMPACT =
  "Visual continuity only: never infer new actions from the keyframe and never let it override ordered actions, dialogue, timing or end state.";

const SEMANTIC_PRIORITY_COMPACT =
  "Follow state_transition_contract (ordered_atomic_actions, then end_changes) for WHAT HAPPENS. The storyboard image is downstream of that: it sets only the opening frame and cannot change the narrative, motion or ending.";

const OUTPUT_AUDIO_FULL =
  "One clean native voice at a time, each line taken from its own dialogue row's voice_personality — never use the first character as a default and never infer the speaker from camera framing or the visible face. Keep one low constant ambient bed; dialogue is audio only, with no captions or subtitles.";
const OUTPUT_AUDIO_COMPACT =
  "One clean native voice at a time, bound as in lip_sync_director_note; one low constant ambient bed; dialogue is audio only, with no captions or subtitles.";

// Synonym groups merged in negative_prompt. Each replacement keeps every
// failure the group names; only the repeated wording goes.
const NEGATIVE_MERGES: Array<[string, string]> = [
  [
    "resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual",
    "resembling a real, famous or identifiable person (celebrity or public-figure lookalike)",
  ],
  [
    "extra or fused fingers, malformed or mutated hands, third hand, extra pair of hands, disembodied hand entering the frame, more hands than the people present",
    "extra, fused, malformed or mutated fingers or hands, a third hand or extra pair, a disembodied hand entering the frame, more hands than people present",
  ],
  [
    "the same person or character duplicated or appearing twice in one frame, a second copy of a named character in the background or reflection",
    "the same character appearing twice in one frame, including in the background or a reflection",
  ],
  [
    "both characters talking at once, overlapping or simultaneous voices, doubled voice, chorus, echo, a spoken line repeated or duplicated",
    "people talking at once, overlapping, doubled, chorus or echo voices, a spoken line repeated",
  ],
  [
    "wrong-speaker lip sync, swapped voices, male voice for a female speaker, female voice for a male speaker, cross-gender voice swap",
    "wrong-speaker lip sync, swapped voices, a cross-gender voice swap (male voice for a female speaker or the reverse)",
  ],
  [
    "changed speaker age, changed speaker timbre, changed base pitch",
    "changed speaker age, timbre or base pitch",
  ],
  [
    "speech bubble, on-screen text, captions, subtitles, burned-in dialogue text, title cards, karaoke or lyric text, translation text, camera or lens spec overlay, technical readout or HUD, info card in a corner, floating character name tag, a character name or age rendered as a label, character info card overlaid on the footage, colour-temperature or Kelvin label, exposure or Kelvin or lux or timecode text, any readable letters numbers or typography anywhere in the frame",
    "any readable letters, numbers or typography anywhere in the frame — on-screen text, captions, subtitles, burned-in dialogue, speech bubbles, title cards, karaoke, lyric or translation text, a character name, age or info card or name tag, camera, lens, Kelvin, exposure, lux or timecode readouts, HUD",
  ],
];

function compactNegative(text: string): string {
  let out = text;
  for (const [from, to] of NEGATIVE_MERGES) out = out.replace(from, to);
  return out;
}

const IDENTITY_FROM_REFERENCE = "REFERENCE_IMAGE";

/**
 * character_lock: 27 of 33 fields were the same scaffolding for every person
 * and 15 only said "REFERENCE_IMAGE". Rules shared by everyone are written once
 * in character_lock_common; each person keeps name, gender, voice, outfit and
 * whatever differs.
 */
function compactCharacterLock(locks: Json, negative: string): { common?: Json; locks: Json } {
  const KEEP_PER_CHARACTER = new Set(["id", "name", "gender", "voice_personality", "outfit_top", "outfit_bottom", "outfit_materials"]);
  const entries = Object.entries(locks).filter(([, value]) => isObj(value)) as Array<[string, Json]>;
  const cleaned = entries.map(([key, lock]) => {
    const next: Json = {};
    for (const [field, value] of Object.entries(lock)) {
      if (field === "outfit_bottom" && typeof value === "string") {
        const top = str(lock.outfit_top);
        if (value.trim() === TROUSERS_FILLER && outfitNamesLowerGarment(top)) continue;
      }
      if (isEmpty(value)) continue;
      next[field] = value;
    }
    return [key, next] as [string, Json];
  });
  const common: Json = {};
  if (cleaned.length >= 2) {
    const fields = Object.keys(cleaned[0]![1]).filter(
      (field) => !KEEP_PER_CHARACTER.has(field) && cleaned.every(([, lock]) => field in lock)
    );
    for (const field of fields) {
      // Whole-name matches only: "Na" must not turn "Natural hands" into a template.
      const templates = cleaned.map(([, lock]) => {
        const name = str(lock.name);
        const text = JSON.stringify(lock[field]);
        if (!name) return text;
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "gu"), "\u0000");
      });
      if (!templates.every((template) => template === templates[0])) continue;
      const generic = templates[0]!
        .split("\u0000's").join("each character's")
        .split("\u0000").join("each character");
      common[field] = JSON.parse(generic) as unknown;
      for (const [, lock] of cleaned) delete lock[field];
    }
  }
  // "REFERENCE_IMAGE" in each identity field said the same thing ~15 times.
  const referenceFields = (lock: Json) =>
    Object.keys(lock).filter((field) => !KEEP_PER_CHARACTER.has(field) && str(lock[field]) === IDENTITY_FROM_REFERENCE);
  // Word for word in negative_prompt already.
  const artifacts = str(common.avoid_character_surface_artifacts);
  if (artifacts && negative.includes(artifacts)) delete common.avoid_character_surface_artifacts;
  const commonReference = Object.keys(common).filter((field) => str(common[field]) === IDENTITY_FROM_REFERENCE);
  if (commonReference.length) {
    for (const field of commonReference) delete common[field];
    common.identity_from_reference_image = `${commonReference.join(", ")} — taken only from each character's own attached reference image`;
  }
  for (const [, lock] of cleaned) {
    const fields = referenceFields(lock);
    if (!fields.length) continue;
    for (const field of fields) delete lock[field];
    lock.identity_from_reference_image = `${fields.join(", ")} — taken only from this character's attached reference image`;
  }
  return {
    ...(Object.keys(common).length ? { common: { scope: "Applies to EVERY character in character_lock.", ...common } } : {}),
    locks: Object.fromEntries(cleaned),
  };
}

/** Entities whose end differs from the start, with only the fields that changed. */
function endChanges(start: unknown[], end: unknown[]): Json[] {
  const startById = new Map(
    start.filter(isObj).map((entity) => [str(entity.entity_id), entity] as const)
  );
  const changes: Json[] = [];
  for (const raw of end) {
    if (!isObj(raw)) continue;
    const id = str(raw.entity_id);
    const before = startById.get(id);
    if (!before) {
      changes.push(raw);
      continue;
    }
    const delta: Json = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(raw)]);
    for (const key of keys) {
      if (key === "entity_id") continue;
      if (JSON.stringify(before[key] ?? null) !== JSON.stringify(raw[key] ?? null)) delta[key] = raw[key] ?? null;
    }
    if (Object.keys(delta).length) changes.push({ entity_id: id, ...delta });
  }
  return changes;
}

function compactAction(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const action = pruneEmpty(raw);
  if (action.from_zone_id !== undefined && action.from_zone_id === action.to_zone_id) {
    action.zone_id = action.from_zone_id;
    delete action.from_zone_id;
    delete action.to_zone_id;
  }
  return action;
}

/** Start state once, the ordered actions without empty fields, then only what changed. */
function compactTransition(contract: Json, fingerprint: string, dressing: string): Json {
  const start = isObj(contract.start_snapshot) && Array.isArray(contract.start_snapshot.entities)
    ? contract.start_snapshot.entities.map(compactEntity)
    : [];
  const end = isObj(contract.end_snapshot) && Array.isArray(contract.end_snapshot.entities)
    ? contract.end_snapshot.entities.map(compactEntity)
    : [];
  const out: Json = {};
  for (const [key, value] of Object.entries(contract)) {
    if (key === "authority_fingerprint") {
      if (str(value) !== fingerprint) out[key] = value;
    } else if (key === "start_snapshot") {
      out.start_snapshot = {
        entities: start.map((entity) => (isObj(entity) ? withoutRestatedFields(entity, dressing, new Map()) : entity)),
      };
    } else if (key === "ordered_atomic_actions") {
      out.ordered_atomic_actions = Array.isArray(value) ? value.map(compactAction) : value;
    } else if (key === "end_snapshot") {
      out.end_changes = endChanges(start, end);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** The raw clip's state_ledger: same idea — start, changes, and the end only where it differs. */
function compactLedger(ledger: Json): Json {
  const start = Array.isArray(ledger.start) ? ledger.start.map((entry) => (isObj(entry) ? pruneEmpty(entry) : entry)) : [];
  const end = Array.isArray(ledger.end) ? ledger.end.map((entry) => (isObj(entry) ? pruneEmpty(entry) : entry)) : [];
  const out: Json = {};
  for (const [key, value] of Object.entries(ledger)) {
    if (key === "start") out.start = start;
    else if (key === "changes") out.changes = Array.isArray(value) ? value.map((entry) => (isObj(entry) ? pruneEmpty(entry) : entry)) : value;
    else if (key === "end") out.end_changes = endChanges(start, end);
    else out[key] = value;
  }
  return out;
}

/**
 * Compact one structured video clip. A flat-string prompt is returned as is.
 * Applying it twice gives the same result.
 */
export function compactVideoPrompt<T>(video: T): T {
  if (!isObj(video)) return video;
  const clip = clone(video) as Json;
  const fingerprint = str(isObj(clip.production_state_authority) ? clip.production_state_authority.authority_fingerprint : "");
  const foley = isObj(clip.foley_and_ambience) ? clip.foley_and_ambience : {};
  const bed = str(foley.environment_sound_bed);
  const reverb = str(foley.environment_reverb);
  const bg = isObj(clip.background_lock) ? clip.background_lock : {};
  const visualStyle = str(clip.visual_style);
  const camera = isObj(clip.camera) ? clip.camera : {};
  const keyframeLed = typeof clip.opening_frame === "string" || typeof clip.board_usage === "string";
  const styled = isObj(clip.output_rules) && !!str(clip.output_rules.character_style_lock);
  const { common, locks } = isObj(clip.character_lock) ? compactCharacterLock(clip.character_lock, str(clip.negative_prompt)) : { common: undefined, locks: undefined };

  const out = mapKeys(clip, (key, value) => {
    switch (key) {
      case "opening_frame":
        return [[key, OPENING_FRAME_RULE(str(clip.aspect_ratio))]];
      // Merged into opening_frame.
      case "board_usage":
        return typeof clip.opening_frame === "string" ? [] : [["opening_frame", OPENING_FRAME_RULE(str(clip.aspect_ratio))]];
      case "character_lock":
        return [
          ...(common ? [["character_lock_common", common] as [string, unknown]] : []),
          [key, locks],
        ];
      case "production_profile": {
        if (!isObj(value)) return [[key, value]];
        const direction = str(value.camera_direction);
        if (direction && str(camera.movement).includes(direction)) {
          const { camera_direction: _direction, ...rest } = value;
          return [[key, rest]];
        }
        return [[key, value]];
      }
      case "scene_bible_tokens": {
        if (!isObj(value)) return [[key, value]];
        const tokens: Json = {};
        for (const [token, text] of Object.entries(value)) {
          const t = str(text);
          const duplicate =
            ((token === "lens" || token === "color_grade" || token === "film_grain") && t && visualStyle.includes(t)) ||
            (token === "lighting" && t && t === str(bg.lighting)) ||
            (token === "backdrop" && t && t === str(bg.scenery)) ||
            (token === "audio_bed" && t && t === bed) ||
            (token === "reverb" && t && t === reverb);
          if (!duplicate) tokens[token] = text;
        }
        return Object.keys(tokens).length ? [[key, tokens]] : [];
      }
      case "audio_transition": {
        if (!isObj(value)) return [[key, value]];
        const next = { ...value };
        if (bed && str(next.sound_bed) === bed) delete next.sound_bed;
        if (reverb && str(next.reverb_profile) === reverb) delete next.reverb_profile;
        return [[key, next]];
      }
      case "foley_and_ambience": {
        if (!isObj(value)) return [[key, value]];
        const next: Json = {};
        for (const [field, entry] of Object.entries(value)) {
          if (field === "ambience" && Array.isArray(entry)) {
            const rest = entry.filter((line) => str(line) !== bed);
            if (rest.length) next[field] = rest;
          } else if (!isEmpty(entry)) {
            next[field] = entry;
          }
        }
        return [[key, next]];
      }
      case "dialogue_audio_contract": {
        if (!isObj(value)) return [[key, value]];
        const next = { ...value };
        if (fingerprint && str(next.authority_fingerprint) === fingerprint) delete next.authority_fingerprint;
        if (isObj(next.audio_state)) {
          const audio = { ...next.audio_state };
          if (bed && str(audio.environment_sound_bed) === bed) delete audio.environment_sound_bed;
          if (reverb && str(audio.environment_reverb) === reverb) delete audio.environment_reverb;
          next.audio_state = pruneEmpty(audio);
        }
        return [[key, next]];
      }
      case "state_transition_contract":
        return [[key, isObj(value) ? compactTransition(value, fingerprint, norm(str(bg.props))) : value]];
      case "state_ledger":
        return [[key, isObj(value) ? compactLedger(value) : value]];
      case "output_rules": {
        if (!isObj(value)) return [[key, value]];
        const rules: Json = {};
        for (const [rule, text] of Object.entries(value)) {
          const t = str(text);
          if (rule === "board_is_reference_not_a_frame" && keyframeLed) continue;
          if (rule === "reference_priority" && t.startsWith("AUTHORITY ORDER (do NOT reverse it): the SCRIPT-DERIVED STRUCTURED VIDEO PROMPT")) {
            rules[rule] = styled || t.includes("STYLE LOCK") ? REFERENCE_PRIORITY_COMPACT.styled : REFERENCE_PRIORITY_COMPACT.photoreal;
          } else if (rule === "storyboard_reference_role" && t.startsWith("Visual continuity only for events")) {
            rules[rule] = STORYBOARD_ROLE_COMPACT;
          } else if (rule === "semantic_priority" && t.startsWith("Follow script_contract + ordered_atomic_actions + end_snapshot")) {
            rules[rule] = SEMANTIC_PRIORITY_COMPACT;
          } else if (rule === "audio" && t === OUTPUT_AUDIO_FULL && typeof clip.lip_sync_director_note === "string") {
            rules[rule] = OUTPUT_AUDIO_COMPACT;
          } else {
            rules[rule] = text;
          }
        }
        return [[key, rules]];
      }
      case "negative_prompt":
        return [[key, typeof value === "string" ? compactNegative(value) : value]];
      default:
        return [[key, value]];
    }
  });
  return out as T;
}

/** Compact every Flow-facing prompt of a manifest (keyframes and video clips). */
export function compactNanoFlowManifest<T extends NanoFlowManifest>(manifest: T): T {
  return {
    ...manifest,
    shots: (manifest.shots ?? []).map((shot) => ({
      ...shot,
      storyboard_prompt: compactKeyframePrompt(shot.storyboard_prompt),
      ...(typeof shot.end_storyboard_prompt === "string"
        ? { end_storyboard_prompt: compactKeyframePrompt(shot.end_storyboard_prompt) }
        : {}),
      video_prompt: compactVideoPrompt(shot.video_prompt),
    })),
  };
}
