/**
 * One deterministic narrator identity shared by every independently generated
 * clip.  A vague label such as "off-screen narrator" lets a video model cast a
 * new voice for every request; this acoustic fingerprint gives every clip the
 * exact same casting instruction without requiring another AI call.
 */
export const NARRATOR_VOICE_ID = "NARRATOR_01";

export function lockedNarratorVoiceProfile(language = "Vietnamese"): string {
  const spokenLanguage = language.trim() || "Vietnamese";
  return `${NARRATOR_VOICE_ID} — exactly the same recurring adult narrator in every clip; warm low-mid timbre; steady natural pitch; about 128 words per minute; clear native ${spokenLanguage} pronunciation; restrained reflective cadence; close dry studio microphone; preserve the identical voice identity, accent, timbre, pitch range, speaking rate and microphone tone across the entire project; never recast, clone, alternate or vary this narrator between clips`;
}
