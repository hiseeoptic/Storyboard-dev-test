// TẦNG 9 — AUDIO & DIALOGUE (luật âm thanh: có vị trí, có thời lượng, im lặng là dữ liệu).
// Ported operationally from the GỐC app's voice system: every speaker carries a
// FULL voice profile (timbre / pitch Hz / rate wpm / accent / emotion band) —
// never a bare reference — and the profile is locked across every clip.

/**
 * Render-time voice contract repeated in every spoken Veo prompt. Vietnamese
 * speech defaults to a native Standard Northern / Hanoi accent; an explicitly
 * user-requested regional accent is the only allowed override.
 */
export const NORTHERN_VIETNAMESE_VOICE_RENDER_LOCK =
  "VOICE RENDER LOCK: for Vietnamese speech, use a native Standard Northern Vietnamese (Hanoi) accent by default and as the highest-priority accent; change region only when the user explicitly requests it. Pronounce every Vietnamese tone, initial and final consonant cleanly with native Hanoi prosody — never Southern, Central, overseas-Vietnamese or foreign-accent drift. Keep one stable speaker identity, age, gender, timbre and base pitch across the whole clip and every later clip. Pitch is a natural fundamental-frequency range, not one fixed musical note: male about 85-140 Hz, female about 180-260 Hz, child about 250-400 Hz, with small human micro-variation; never monotone, pitch-shifted or Auto-Tuned. Use clear warm midrange, natural breath and restrained conversational emotion; never nasal, boomy, shrill, metallic, robotic, announcer-like, commercial, theatrical or overacted. Preserve natural phrase stress, short pauses and sentence-final cadence at the character's locked speaking rate. Render clean wide-band speech equivalent to 48 kHz capture, stable around -16 LUFS with true peak at or below -1 dBTP: no clipping, crackle, distortion, pumping, phase smear, synthetic reverb, hard noise-gate cuts or aggressive denoising. Keep location ambience low and spatially credible so the voice remains intelligible without sounding studio-pasted.";

export const audioLaws = {
  __layer: "AUDIO",
  id: "audio_positional_v2_northern_voice",
  laws: [
    "Sound is POSITIONAL: the voice emanates from the speaker's mouth, with exact natural lip-sync; distance and space shape what we hear",
    "TURN-TAKING, NEVER OVERLAP: a clip may hold up to 3 sequential spoken turns, but exactly ONE mouth moves at any instant — turns do not overlap, everyone not speaking has their mouth closed, and camera framing never assigns or changes the speaker; a voice never jumps to the wrong face",
    "VIETNAMESE ACCENT PRIORITY: use a native Standard Northern Vietnamese (Hanoi) accent by default; pronounce tones, initials and finals cleanly with native Hanoi prosody; never drift into Southern, Central, overseas-Vietnamese or foreign-accent speech unless the user explicitly requests that region",
    "Every speaker has a FULL locked voice profile (timbre, natural fundamental-frequency range in Hz, speech rate in wpm, accent, emotion band) — identical in every clip; male ≈ 85-140 Hz, female ≈ 180-260 Hz, child ≈ 250-400 Hz; allow small human pitch variation, never monotone, pitch-shifted or Auto-Tuned; cross-gender voice swap is a critical failure",
    "VOICE IDENTITY AND TIMBRE never drift: keep the same apparent age, gender, vocal weight and resonance; clear warm midrange with natural breath, never nasal, boomy, shrill, metallic, robotic or synthetic",
    "PROSODY is restrained native conversation: natural phrase stress, short pauses and sentence-final cadence at the locked rate; never announcer, advertisement, dubbed-film, theatrical, shouted or overacted delivery",
    "VOICE FIDELITY is clean wide-band speech equivalent to 48 kHz capture, stable around -16 LUFS and true peak at or below -1 dBTP; no clipping, crackle, distortion, pumping, phase smear, synthetic reverb, hard noise-gate cuts or aggressive denoising",
    "The ambient bed is CONSTANT per location (one declared soundscape at low level ≈ -40dB feel) so stitched clips share one seamless soundstage; diegetic SFX follow the visible actions",
    "Silence is data: leave natural breathing room before and after the spoken line — no wall-to-wall talking, no music bed drowning the voice",
    "Dialogue start/end windows are the clip's ONLY numeric clock and fit at a natural rate; motion and camera remain untimed ordered descriptions; spoken words are AUDIO ONLY — no subtitles, captions, burned-in text or watermark",
  ],
} as const;

/** Default voice profile text by gender/child — used when the script model
 * didn't fill a character's voice. Keeps Tầng 9 law #3 satisfied. */
export function defaultVoiceFor(gender?: string, isChild?: boolean): string {
  if (isChild)
    return "native Standard Northern Vietnamese (Hanoi), bright clear child timbre, natural F0 250-360 Hz with small human variation, ~125 wpm, playful-sincere, clean tones and final consonants";
  if (gender === "female")
    return "native Standard Northern Vietnamese (Hanoi), warm clear female timbre, natural F0 185-235 Hz with small human variation, ~118 wpm, warm-sincere, restrained conversational prosody";
  return "native Standard Northern Vietnamese (Hanoi), warm grounded male timbre, natural F0 95-130 Hz with small human variation, ~110 wpm, calm-sincere, restrained conversational prosody";
}
