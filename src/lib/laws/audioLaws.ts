// TẦNG 9 — AUDIO & DIALOGUE (luật âm thanh: có vị trí, có thời lượng, im lặng là dữ liệu).
// Ported operationally from the GỐC app's voice system: every speaker carries a
// FULL voice profile (timbre / pitch Hz / rate wpm / accent / emotion band) —
// never a bare reference — and the profile is locked across every clip.

/** Render-time voice contract. Language, region and accent come only from the
 * locked project context or explicit character voice; there is no global
 * Vietnamese-region default. */
export const CONTEXTUAL_VOICE_RENDER_LOCK =
  "VOICE RENDER LOCK: use the exact language, regional accent and dialect declared by the locked project context or the character's voice profile; never invent a regional default and never drift to another accent. Keep one stable speaker identity, apparent age, gender, timbre and base pitch across the whole clip and every later clip. Pitch is a natural fundamental-frequency range, not one fixed musical note: male about 85-140 Hz, female about 180-260 Hz, child about 250-400 Hz, with small human micro-variation; never monotone, pitch-shifted or Auto-Tuned. Use clear natural breath and restrained context-appropriate emotion; never nasal, boomy, shrill, metallic, robotic, announcer-like, commercial, theatrical or overacted unless the project explicitly requires it. Preserve native phrase stress, short pauses and sentence-final cadence at the character's locked speaking rate. Render clean wide-band speech equivalent to 48 kHz capture, stable around -16 LUFS with true peak at or below -1 dBTP: no clipping, crackle, distortion, pumping, phase smear, synthetic reverb, hard noise-gate cuts or aggressive denoising. Keep location ambience low and spatially credible so the voice remains intelligible without sounding studio-pasted.";

export const audioLaws = {
  __layer: "AUDIO",
  id: "audio_positional_v3_contextual_voice",
  laws: [
    "Sound is POSITIONAL: the voice emanates from the speaker's mouth, with exact natural lip-sync; distance and space shape what we hear",
    "TURN-TAKING, NEVER OVERLAP: a clip may hold up to 3 sequential spoken turns, but exactly ONE mouth moves at any instant — turns do not overlap, everyone not speaking has their mouth closed, and camera framing never assigns or changes the speaker; a voice never jumps to the wrong face",
    "CONTEXTUAL LANGUAGE/ACCENT: use only the language, regional accent and dialect locked by the project or character profile; never assume a default region and never drift between accents",
    "Every speaker has a FULL locked voice profile (timbre, natural fundamental-frequency range in Hz, speech rate in wpm, accent, emotion band) — identical in every clip; male ≈ 85-140 Hz, female ≈ 180-260 Hz, child ≈ 250-400 Hz; allow small human pitch variation, never monotone, pitch-shifted or Auto-Tuned; cross-gender voice swap is a critical failure",
    "VOICE IDENTITY AND TIMBRE never drift: keep the same apparent age, gender, vocal weight and resonance; clear warm midrange with natural breath, never nasal, boomy, shrill, metallic, robotic or synthetic",
    "PROSODY is restrained native conversation: natural phrase stress, short pauses and sentence-final cadence at the locked rate; never announcer, advertisement, dubbed-film, theatrical, shouted or overacted delivery",
    "VOICE FIDELITY is clean wide-band speech equivalent to 48 kHz capture, stable around -16 LUFS and true peak at or below -1 dBTP; no clipping, crackle, distortion, pumping, phase smear, synthetic reverb, hard noise-gate cuts or aggressive denoising",
    "The ambient bed is CONSTANT per location (one declared soundscape at low level ≈ -40dB feel) so stitched clips share one seamless soundstage; diegetic SFX follow the visible actions",
    "Silence is data: leave natural breathing room before and after the spoken line — no wall-to-wall talking, no music bed drowning the voice",
    "Dialogue start/end windows are the clip's ONLY numeric clock and fit at a natural rate; motion and camera remain untimed ordered descriptions; spoken words are AUDIO ONLY — no subtitles, captions, burned-in text or watermark",
  ],
} as const;

/** Context-neutral fallback used only when the script omitted a voice. */
export function defaultVoiceFor(gender?: string, isChild?: boolean): string {
  if (isChild)
    return "native voice in the project's locked language and regional accent, bright clear child timbre, natural F0 250-360 Hz with small human variation, ~125 wpm, playful-sincere, context-appropriate native prosody";
  if (gender === "female")
    return "native voice in the project's locked language and regional accent, warm clear female timbre, natural F0 185-235 Hz with small human variation, ~118 wpm, warm-sincere, restrained context-appropriate prosody";
  return "native voice in the project's locked language and regional accent, warm grounded male timbre, natural F0 95-130 Hz with small human variation, ~110 wpm, calm-sincere, restrained context-appropriate prosody";
}

const VOICE_RANGE = /(\d{2,3})\s*(?:-|–|—|to)\s*(\d{2,3})\s*hz/i;
const VOICE_RATE = /\b\d{2,3}\s*wpm\b/i;
const VOICE_TIMBRE =
  /\b(?:timbre|voice|warm|bright|dark|breathy|clear|raspy|resonant|soft|deep|light|husky|nasal|trầm|ấm|sáng|khàn|mỏng|dày)\b/i;

/**
 * Complete a model-written voice note locally. A single pitch such as
 * "220 Hz" is not a stable human voice identity; renderers need a natural F0
 * range plus one speaking rate. Preserve the model's acting description, but
 * replace incomplete/conflicting numeric fragments with the canonical
 * gender/age-safe production lock. No model call is required.
 */
export function completeVoiceProfile(
  profile?: string | null,
  gender?: string,
  isChild?: boolean
): string {
  const raw = (profile ?? "").trim();
  const range = raw.match(VOICE_RANGE);
  const singlePitch = raw.match(/(\d{2,3})\s*hz/i);
  const inferredGender =
    gender ??
    (!isChild && singlePitch
      ? Number(singlePitch[1]) >= 160
        ? "female"
        : "male"
      : undefined);
  const low = range ? Number(range[1]) : Number.NaN;
  const high = range ? Number(range[2]) : Number.NaN;
  const pitchConflict =
    !!range &&
    ((isChild && high < 200) ||
      (!isChild && inferredGender === "male" && low >= 160) ||
      (!isChild && inferredGender === "female" && high <= 160) ||
      low >= high);
  if (
    raw &&
    range &&
    !pitchConflict &&
    VOICE_RATE.test(raw) &&
    VOICE_TIMBRE.test(raw)
  ) {
    return raw;
  }

  const actingDescription = raw
    .replace(
      /\b(?:natural\s+)?(?:f0|fundamental frequency|pitch)?\s*~?\d{2,3}\s*(?:-|–|—|to)\s*\d{2,3}\s*hz(?:\s+with\s+small\s+human\s+variation)?/gi,
      ""
    )
    .replace(
      /\b(?:natural\s+)?(?:f0|fundamental frequency|pitch)?\s*~?\d{2,3}\s*hz\b/gi,
      ""
    )
    .replace(/\b(?:speaking\s+rate\s*)?~?\d{2,3}\s*wpm\b/gi, "")
    .replace(/\s*[,;]\s*[,;]+/g, ", ")
    .replace(/^[\s,;.-]+|[\s,;.-]+$/g, "")
    .replace(/\s{2,}/g, " ");
  const fallback = defaultVoiceFor(inferredGender, isChild);
  return actingDescription
    ? `${actingDescription}; ${fallback}`
    : fallback;
}
