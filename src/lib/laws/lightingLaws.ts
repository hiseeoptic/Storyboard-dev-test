// TẦNG 8 — LIGHTING & VFX (luật ánh sáng: có nguồn, có nhiệt độ, bóng không hoàn hảo).

export const lightingLaws = {
  __layer: "LIGHTING",
  id: "lighting_motivated_v1",
  laws: [
    "Every light is MOTIVATED: it comes from a declared source in the environment (sun, window, lamp, fire, screen) — no sourceless glow, no unexplained rim light",
    "Lighting is declared physically: Kelvin colour temperature + approximate Lux for every scene",
    "Shadows have imperfect, soft edges and follow the real light direction — never CGI-crisp, never contradictory",
    "Kelvin may track the emotional arc (warm for comfort, cool for tension) but only through PLAUSIBLE sources and time-of-day",
    "Colour grade + film grain are ONE fingerprint held constant across every clip (from STYLE TOKENS) — no palette shift between clips",
    "Chained clips keep light continuity: no sudden time-of-day or weather change without the story showing time passing",
  ],
} as const;
