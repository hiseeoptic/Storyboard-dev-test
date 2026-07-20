/**
 * One shared, camera-grounded human-face contract for every photoreal image and
 * video path. Wording is conditional so an environment/product-only scene does
 * not invent a person just because this lock is present.
 */
export const HUMAN_FACE_REALISM_LOCK =
  "HUMAN FACE REALISM LOCK (apply whenever a human face is visible): preserve one stable, age-appropriate facial topology — skull and face shape, forehead, temples, cheekbones, cheeks, jaw, chin, ears, nose, philtrum, lips, eyelids and natural left-right asymmetry never morph or become generically beautified. Skin must behave like living skin at the camera's real viewing distance: pore size and density vary by zone; fine vellus hair and follicles catch side/back light; faint capillaries, freckles, tiny blemishes, healed marks, under-eye texture, age-appropriate fine lines and subtle uneven tone remain; cheeks are softly matte while the T-zone and lips may carry restrained natural moisture; ears and nostril edges show gentle living translucency. Never erase texture with beauty smoothing. Eyes have off-white sclera with extremely subtle vessels, detailed iris fibres, round pupils, moist corneal catchlights, a real tear line and anatomically correct upper/lower eyelid folds. Eyebrows are made from separate rooted hairs with a believable growth direction, density gradient, tapered ends, small gaps and mild asymmetry — never a painted block, stamped arch or identical pair. Eyelashes grow individually from the eyelid margin: upper and lower lashes have varied length, spacing, curvature, direction, subtle clumping and tiny shadows; never a uniform fan, doll lashes, solid black strip or duplicated rows unless explicit cosmetic false lashes are part of the character. Nose skin keeps pores and soft cartilage transitions; lips retain fine vertical lines, natural edge softness and realistic hydration; visible teeth are naturally off-white with slight human variation, never a perfect glowing denture row. Hair preserves the exact hairline, temple shape, parting, density, colour, curl pattern and cut; show separate strands, root variation, limited scalp visibility at the part, baby hairs and a few flyaways with anisotropic natural sheen — never helmet hair, a solid plastic mass, wig-like edges or repeated clumps. Facial hair, when present, follows real follicle density and growth direction. Makeup, when requested, sits on top of this real anatomy and texture instead of replacing it. Keep all of these traits identical across frames and clips while expression changes only through anatomically plausible muscle movement.";

export const HUMAN_FACE_REALISM_NEGATIVE =
  "plastic, wax, porcelain or rubber skin, airbrushed poreless face, beauty-filter blur, excessive frequency separation, uniform pore noise, crunchy oversharpening, generic beautified face, facial topology drift, perfect bilateral symmetry, painted block eyebrows, stamped identical brows, missing brow hairs, solid-strip eyelashes, uniform doll-lash fan, duplicated lash rows, missing lower lashes, glass eyes, glowing white sclera, perfect denture teeth, helmet hair, plastic hair, wig edge, solid hair mass, repeated hair clumps, missing hairline, floating flyaway strands";

/**
 * Uploaded character photos are already the complete visual specification.
 * Do not translate them back into prose: that creates a second, conflicting
 * identity source. Only this small rendering guard may accompany a reference.
 */
export const REFERENCE_CHARACTER_APPEARANCE_LOCK =
  "REFERENCE IMAGE ONLY: use the attached image as the appearance authority for this named character; add no appearance description in text.";

export const REFERENCE_CHARACTER_ANTI_PLASTIC =
  "plastic-looking hair, plastic-looking eyebrows, plastic-looking skin";

/**
 * Remove appearance prose that an upstream model (or an older edited JSON)
 * may have put back into a scene after a named character reference was
 * uploaded. This intentionally targets only identity/wardrobe clauses; names,
 * positions, actions, dialogue and ordinary expressions remain intact.
 */
export function stripUploadedCharacterAppearance(
  text: string | null | undefined,
  characterNames: readonly string[]
): string {
  if (!text || characterNames.length === 0) return text ?? "";

  // Keep ordinary acting language intact ("eyes widen", "brows lift",
  // "mouth stays closed"). Match eyes/brows/lashes only when the clause is
  // describing their static visual design, not when it is an expression.
  const appearance =
    "face|facial|skin|hair|nose|lip|age|height|body\\s+(?:type|shape|build|size|proportion)|" +
    "(?:eye|eyes)\\s+(?:colour|color|shape|details?|iris|pupil|sclera|eyelid|catchlight|tear[- ]line)|" +
    "(?:eyebrow|brows?)\\s+(?:details?|shape|colour|color|thickness|density|arch|tail|hair)|" +
    "(?:eyelash|lashes?)\\s+(?:details?|length|spacing|curvature|direction)|" +
    "wardrobe|outfit|clothes|shirt|blouse|trouser|pants|skirt|dress|jacket|" +
    "sweater|uniform|shoe|footwear|accessor";
  const escaped = characterNames
    .map((name) => name.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return text;

  let out = text;
  // Preserve blocking/gaze language such as "faces Lan" or "face toward the
  // camera"; these are actions/positions, not appearance descriptions.
  out = out
    .replace(/\bface\s+(?=(?:toward|to)\b)/gi, "gaze ")
    .replace(/\bfaces?\s+(?=(?:toward|to)\b)/gi, "looks ")
    .replace(/\bface\s+the\s+camera\b/gi, "gaze toward the camera")
    .replace(/\bfaces?\s+the\s+camera\b/gi, "looks toward the camera");
  // Known legacy wording that was emitted by the old FORCE_REF prompt.
  out = out.replace(
    /\b(?:with|having)\s+(?:their|his|her)?\s*(?:unchanged|natural|exact|same|real)\s+(?:age|facial anatomy|face|skin|brows?|eyelashes?|lashes?|hair)(?:\s*,?\s*(?:and|or)?\s*(?:age|facial anatomy|face|skin|brows?|eyelashes?|lashes?|hair))*/gi,
    ""
  );

  // Remove short comma-delimited appearance clauses, but only when they
  // contain an appearance token. A harmless clause such as "with a cup" is
  // therefore left alone.
  const clause = new RegExp(
    `\\b(?:with|having|whose|has|wears)\\s+[^,.;!?]*(?:${appearance})[^,.;!?]*`,
    "gi"
  );
  const clothing = new RegExp(
    `\\b(?:wearing|dressed\\s+in)\\s+[^,.;!?]*(?:${appearance})[^,.;!?]*`,
    "gi"
  );
  for (const name of escaped) {
    const nameRe = new RegExp(`\\b${name}\\b`, "gi");
    // Only strip these clauses in text that actually names a referenced
    // character. This prevents unrelated prop descriptions from being edited.
    if (nameRe.test(out)) {
      out = out.replace(clause, "").replace(clothing, "");
      out = out.replace(
        new RegExp(
          `\\b${name}\\b\\s*(?:is|,)?\\s*(?:a|an|the)?\\s*(?:young|older|elderly|middle[- ]aged|adult|male|female|man|woman|girl|boy|person|\\d{1,2}[- ]year[- ]old)[^,.;!?]*(?=[,.;!?]|\\s+(?:stands|sits|walks|looks|turns|reaches|holds|speaks|faces)\\b)`,
          "gi"
        ),
        name.replace(/\\\\/g, "")
      );
      out = out.replace(
        new RegExp(`\\b${name}['’]s\\s+[^,.;!?]*(?:${appearance})[^,.;!?]*`, "gi"),
        ""
      );
      out = out.replace(
        new RegExp(
          `\\b(?:the\\s+)?(?:young|older|elderly|middle[- ]aged|adult|male|female|man|woman|girl|boy|person)\\s+(?=${name}\\b)`,
          "gi"
        ),
        ""
      );
    }
  }

  // Remove explicit identity-copy phrases without touching action verbs.
  out = out
    .replace(/\b(?:exact|same|real|unchanged)\s+(?:face|identity|appearance)\b/gi, "")
    .replace(/\b(?:matching|copied from|taken from)\s+(?:the\s+)?(?:attached\s+)?(?:reference|photo|image)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([,;])\s*([,.!?])/g, "$2")
    .replace(/(^|[.;!?])\s*[,;]+/g, "$1")
    .trim();
  return out;
}
