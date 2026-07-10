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
    "ONE-SUN RULE: a scene has one coherent key-light logic — outdoors exactly one sun; every object's shadow direction agrees with it; no duplicate, crossed or contradictory shadows, no object casting a shadow toward the light source",
    "REFLECTION & BOUNCE TRUTH: mirrors, glass, water and glossy surfaces reflect what is actually in the scene (never invent content in a reflection); bounced light carries the colour of the surface it bounced from",
    "HUMAN-EYE EXPOSURE: the frame reads like human vision — faces and the primary action are never lost in blown-out whites or crushed blacks unless the locked visual style deliberately calls for it",
  ],
} as const;
