// TẦNG 9 — AUDIO & DIALOGUE (luật âm thanh: có vị trí, có thời lượng, im lặng là dữ liệu).
// Ported operationally from the GỐC app's voice system: every speaker carries a
// FULL voice profile (timbre / pitch Hz / rate wpm / accent / emotion band) —
// never a bare reference — and the profile is locked across every clip.

export const audioLaws = {
  __layer: "AUDIO",
  id: "audio_positional_v1",
  laws: [
    "Sound is POSITIONAL: the voice emanates from the speaker's mouth, with exact natural lip-sync; distance and space shape what we hear",
    "ONE speaker per clip; everyone else present is silent with mouths closed — a voice never jumps to another face",
    "Every speaker has a FULL locked voice profile (timbre, pitch range in Hz, speech rate in wpm, accent, emotion band) — identical in every clip; male ≈ 85-140 Hz, female ≈ 180-260 Hz, child ≈ 250-400 Hz; cross-gender voice swap is a critical failure",
    "The ambient bed is CONSTANT per location (one declared soundscape at low level ≈ -40dB feel) so stitched clips share one seamless soundstage; diegetic SFX follow the visible actions",
    "Silence is data: leave natural breathing room before and after the spoken line — no wall-to-wall talking, no music bed drowning the voice",
    "Dialogue fits the clip's seconds at a natural speaking rate; the words are AUDIO ONLY — absolutely no subtitles, captions, burned-in text or watermark",
  ],
} as const;

/** Default voice profile text by gender/child — used when the script model
 * didn't fill a character's voice. Keeps Tầng 9 law #3 satisfied. */
export function defaultVoiceFor(gender?: string, isChild?: boolean): string {
  if (isChild) return "bright clear child timbre, 250-400 Hz, Vietnamese, ~130 wpm, playful-sincere";
  if (gender === "female") return "warm clear female timbre, 190-250 Hz, Vietnamese neutral accent, ~120 wpm, warm-sincere";
  return "warm low male timbre, 95-140 Hz, Vietnamese neutral accent, ~112 wpm, calm-grounded";
}
