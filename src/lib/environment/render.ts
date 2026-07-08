// Resolve + render an environment archetype into prompt text / structured JSON.
// Two resolution paths (so it works with old breakdowns too):
//   1. exact archetype_id (the LLM picks one via `environment_ref`)
//   2. keyword auto-match against the segment's setting text (EN + VI)

import type { EnvironmentArchetype } from "./types";
import { environmentArchetypes } from "./library";

/**
 * Resolve an environment: by exact id first, else by scoring the archetype
 * keywords against the setting text. Returns undefined when nothing fits —
 * callers must degrade gracefully (prompt still works without the block).
 */
export function resolveEnvironment(
  ref?: string | null,
  settingText?: string | null
): EnvironmentArchetype | undefined {
  const id = (ref ?? "").trim().toLowerCase();
  if (id && id !== "custom" && environmentArchetypes[id]) {
    return environmentArchetypes[id];
  }

  const text = (settingText ?? "").toLowerCase();
  if (!text) return undefined;

  let best: EnvironmentArchetype | undefined;
  let bestScore = 0;
  for (const arch of Object.values(environmentArchetypes)) {
    let score = 0;
    for (const kw of arch.keywords) {
      if (text.includes(kw.toLowerCase())) {
        // Longer keywords are more specific → weigh by word count.
        score += kw.trim().split(/\s+/).length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = arch;
    }
  }
  // Require at least one solid hit; a single 1-word match on a long text is
  // accepted too (keywords are curated to be unambiguous).
  return bestScore > 0 ? best : undefined;
}

/**
 * Render the archetype as ONE compact ENVIRONMENT LOCK paragraph for the Veo
 * prompt. Carries the veoflow realism payload: material physics, Kelvin+Lux
 * light, atmosphere, micro-details, imperfections and the stability lock.
 * Kept ~120 words so it never crowds out identity/motion tokens.
 */
export function renderEnvironmentBlock(env: EnvironmentArchetype): string {
  const materials = env.materials
    .map((m) => `${m.surface} — ${m.material}: ${m.physics}`)
    .join("; ");
  const light = [
    `key ${env.lighting.key_kelvin}K`,
    env.lighting.ambient_kelvin ? `ambient ${env.lighting.ambient_kelvin}K` : "",
    `~${env.lighting.ambient_lux} lux`,
    env.lighting.sources.join(" + "),
    `shadows: ${env.lighting.shadows}`,
  ]
    .filter(Boolean)
    .join(", ");
  const atmo = [
    env.atmosphere.time_of_day,
    env.atmosphere.weather !== "n/a" ? env.atmosphere.weather : "",
    env.atmosphere.particulates.join(", "),
    `ambient motion: ${env.atmosphere.ambient_motion}`,
  ]
    .filter(Boolean)
    .join("; ");

  return `ENVIRONMENT LOCK — ${env.display_name} (${env.environment_class}): ${env.scale}. REAL MATERIALS (render true physical surface behaviour): ${materials}. LIGHT: ${light}. ATMOSPHERE: ${atmo}. Believable micro-details: ${env.micro_details.join(", ")}. Keep the natural imperfections (${env.imperfections.join(", ")}) — they make it real. AMBIENT SOUND BED (constant): ${env.sound_bed}. The set stays IDENTICAL for the whole clip — only ${env.micro_variation_allowed.join(", ")} may subtly vary; never change geometry, materials, layout, palette, weather or time of day.`;
}

/** Structured environment object for the Veo JSON export (buildVeoJson). */
export function environmentToJson(env: EnvironmentArchetype): Record<string, unknown> {
  return {
    archetype_id: env.archetype_id,
    display_name: env.display_name,
    environment_class: env.environment_class,
    element: env.element ?? null,
    scale: env.scale,
    materials: env.materials,
    lighting: {
      key_kelvin: env.lighting.key_kelvin,
      ambient_kelvin: env.lighting.ambient_kelvin ?? null,
      ambient_lux: env.lighting.ambient_lux,
      sources: env.lighting.sources,
      shadows: env.lighting.shadows,
    },
    atmosphere: env.atmosphere,
    micro_details: env.micro_details,
    imperfections: env.imperfections,
    sound_bed: env.sound_bed,
    stability: {
      micro_variation_allowed: env.micro_variation_allowed,
      forbidden_variation: env.forbidden_variation,
    },
  };
}

/**
 * One-line-per-archetype catalog injected into the storyboard SYSTEM prompt so
 * the model can pick an `environment_ref` per segment.
 */
export function environmentCatalogForPrompt(): string {
  return Object.values(environmentArchetypes)
    .map(
      (a) =>
        `· ${a.archetype_id} — ${a.display_name}${a.element ? ` (hành ${a.element})` : ""}: ${a.atmosphere.time_of_day}, key ${a.lighting.key_kelvin}K / ~${a.lighting.ambient_lux} lux`
    )
    .join("\n");
}
