// TẦNG 3 — ENTITY DNA (luật sinh thể: giải phẫu + danh tính bất biến).
// Answers exactly one question: "what IS a living being allowed to be?"

export const entityLaws = {
  __layer: "ENTITY_DNA",
  id: "entity_dna_human_anatomy_v1",
  laws: [
    "A human has EXACTLY one head, two arms, two legs and five fingers per hand — never more, never fewer, never fused, in every single frame",
    "Joints bend only in natural human directions and ranges (elbows, knees, wrists, neck) — no impossible twists",
    "Feet stay planted and carry the body's weight; weight shifts believably during any movement",
    "Skin is real human skin — visible pores, fine vellus hair, natural subsurface scattering, small imperfections; NEVER plastic, waxy, airbrushed or CGI",
    "Identity persistence is absolute: face geometry, hair, skin tone, wardrobe and accessories are IMMUTABLE across every clip — no model-default faces, no drift, no re-dressing",
    "A child stays a child: locked age bracket, true child proportions, clearly smaller than the adults in every shot",
    "Every person on screen is declared by name — no extra people, no phantom background figures, no duplicated characters",
  ],
} as const;
