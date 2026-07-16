import type { CookingRecipeAnalysisInput, CookingRecipeIR, CookingStyle } from "./types";

export function buildCookingAnalysisPrompt(input: CookingRecipeAnalysisInput): string {
  const sourceText = input.text.trim() || "[No pasted text — read only the attached recipe images.]";
  return `You are a recipe OCR and production-data analyst. Convert the supplied recipe text and/or cookbook photos into ONE canonical Recipe IR. This is extraction and normalization, not creative recipe writing.

NON-NEGOTIABLE ACCURACY RULES:
- Read printed text in every attached image carefully, including ingredient columns, directions, sub-recipes, tips and serving count.
- Preserve every stated quantity and unit exactly. Never convert units unless the source explicitly gives both.
- Never invent, substitute, add or remove an ingredient, quantity, temperature, duration, cooking tool or step.
- If a value is absent or unreadable, use an empty string and add a precise note to uncertainties. Never guess.
- If pasted text and image text conflict, prefer the pasted text because it may contain the user's correction, but record the conflict in uncertainties.
- Keep ingredients in source order. Assign stable ids ing_01, ing_02, ... and reference only those ids in steps/mise_en_place.
- Split sauces/seasonings/garnishes into their correct group, but do not duplicate an ingredient.
- Mise en place is a production plan: group ingredients into the smallest sensible bowls/plates by the step in which they are used. Ingredients that must be added at different times stay in different vessels. Do not combine chemically or procedurally incompatible items.
- Steps stay in exact causal cooking order. Each step states one main physical operation and a visible end state. Repetitive prep may be time-compressed later, but the recipe itself must remain complete.
- asmr_cues name only sounds physically caused by the step (knife-board contact, dry ingredient falling into a bowl, whisk, pour, sizzle, bubbling, scrape, plating contact). No music or invented ambience.
- Write names/action notes in clear Vietnamese for the editor, while preserving source-specific proper names such as Udon, Mentsuyu, Tian Mian Jiang. source_text retains the short original wording.
- version MUST be "1.0". confidence is 0..1 and reflects OCR/source certainty, not recipe quality.

PASTED SOURCE:
${sourceText}

Return only the JSON object required by the response schema.`;
}

export function cookingStyleDirective(style: CookingStyle): string {
  switch (style) {
    case "nature_asmr":
      return "Nature ASMR: derive one real outdoor cooking place from the user's setting/location reference (never assume mountains, snow, lake, forest or stone stove). Shoot POV-into-the-scene: ONE pair of hands works the food in the lower foreground while that location stays alive and visible in the upper depth of frame (weather, water, fire, foliage in motion). Brisk, no-dead-air tempo; only diegetic ingredient/tool/fire/nature sound, no speech or music. Vary framing from the current recipe and terrain instead of copying a creator's sequence.";
    case "kitchen_asmr":
      return "Kitchen ASMR: ONE pair of hands and the food are the heroes in one locked kitchen workstation, shot POV from the cook's viewpoint with the kitchen alive in the frame's depth; clean macro inserts, brisk no-dead-air tempo, only close-mic cooking and room sound, no speech, no music.";
    case "fast_cut":
      return "Fast visual recipe: brisk match-on-action pacing and speed ramps for repetitive prep only; never teleport ingredients or skip a causal cooking state; speech optional and minimal.";
    case "cinematic_food":
      return "Cinematic food film: controlled macro lighting, steam, gloss, texture and transformation payoff; restrained camera, sparse optional narration, cooking sound remains primary.";
    case "pov_hands":
      return "POV hands: stable first-person workstation geography from the cook's own viewpoint, exactly ONE pair of hands with identical sleeves/tools throughout, the workspace and setting readable in the frame's depth; brisk tactile tempo, actions and cooking sound lead; no face required.";
  }
}

/** Compact single-source block injected once per model call. */
export function compileCookingRecipeDigest(recipe: CookingRecipeIR, style: CookingStyle): string {
  const ingredientLines = recipe.ingredients.map((item) => {
    const amount = [item.amount, item.unit].filter(Boolean).join(" ");
    return `${item.id}=${item.name}${amount ? ` | ${amount}` : " | amount unspecified"}${item.preparation ? ` | ${item.preparation}` : ""} | ${item.group}`;
  });
  const vessels = recipe.mise_en_place.map(
    (item) => `${item.order}. ${item.vessel}: ${item.ingredient_ids.join(", ")}${item.staging_note ? ` (${item.staging_note})` : ""}`
  );
  const steps = recipe.steps.map(
    (step) => `${step.order}. ${step.title}: ${step.action} | uses ${step.ingredient_ids.join(", ") || "none"} | tools ${step.tools.join(", ") || "unspecified"}${step.heat ? ` | heat ${step.heat}` : ""}${step.duration ? ` | duration ${step.duration}` : ""} | end ${step.visible_end_state} | ASMR ${step.asmr_cues.join(", ") || "natural contact sound"}`
  );

  return `=== CANONICAL COOKING RECIPE IR — SOURCE OF TRUTH ===
Dish: ${recipe.dish_name} | Servings: ${recipe.servings || "unspecified"} | Serve: ${recipe.serving_temperature || "unspecified"}
Style: ${cookingStyleDirective(style)}
INGREDIENTS (exact; never add/drop/substitute):
${ingredientLines.join("\n")}
MISE EN PLACE (vessels and order):
${vessels.join("\n") || "derive only from listed ingredients and steps"}
COOKING ORDER (exact causal order):
${steps.join("\n")}
PLATING: ${recipe.plating || "follow source"}
HERO RESULT: ${recipe.hero_visual || recipe.dish_name}
UNCERTAINTIES: ${recipe.uncertainties.join("; ") || "none"}
=== END CANONICAL COOKING RECIPE IR ===`;
}
