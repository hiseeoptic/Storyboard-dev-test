// TẦNG 3 — ENTITY DNA (luật sinh thể: giải phẫu + danh tính bất biến).
// Answers exactly one question: "what IS a living being allowed to be?"

export const entityLaws = {
  __layer: "ENTITY_DNA",
  id: "entity_dna_human_anatomy_v2_face_realism",
  laws: [
    "A human has EXACTLY one head, two arms, two legs and five fingers per hand — never more, never fewer, never fused, in every single frame",
    "Joints bend only in natural human directions and ranges (elbows, knees, wrists, neck) — no impossible twists",
    "Feet stay planted and carry the body's weight; weight shifts believably during any movement",
    "FACIAL TOPOLOGY is anatomical and persistent: skull/face shape, forehead, temples, cheekbones, jaw, chin, ears, nose, philtrum, lips, eyelids and mild natural asymmetry remain fixed; expressions use plausible facial-muscle movement, never morphing or generic beautification",
    "SKIN is living human skin at a physically plausible detail scale: zone-varying pores, fine vellus hair and follicles, subtle uneven tone, faint capillaries, tiny blemishes/marks, under-eye texture and age-appropriate fine lines; restrained T-zone moisture and natural translucency; NEVER plastic, waxy, porcelain, airbrushed, poreless or CGI",
    "EYES remain anatomical: iris fibres, round pupils, moist corneal catchlights, off-white sclera with extremely subtle vessels, real tear line and correct eyelid folds — never glass eyes or glowing-white sclera",
    "EYEBROWS consist of individual rooted hairs with real growth direction, density gradient, tapered ends, small gaps and mild asymmetry — never painted blocks, stamped arches or identical mirrored brows",
    "EYELASHES grow individually from the upper/lower lid margins with varied length, spacing, curvature, direction, subtle clumping and tiny shadows — never solid strips, uniform doll fans, duplicated rows or missing lower lashes unless explicit cosmetics require otherwise",
    "HAIR preserves hairline, temple shape, parting, density, colour, curl pattern and cut, with individual strands, root variation, limited scalp visibility, baby hairs and a few flyaways — never helmet hair, plastic mass, wig edge or repeated clumps",
    "Identity persistence is absolute: facial geometry, skin details, eyebrows, eyelashes, hair, skin tone, wardrobe and accessories are IMMUTABLE across every clip — no model-default faces, no drift, no re-dressing",
    "A child stays a child: locked age bracket, true child proportions, clearly smaller than the adults in every shot",
    "Every person on screen is declared by name — no extra people, no phantom background figures, no duplicated characters",
  ],
} as const;
