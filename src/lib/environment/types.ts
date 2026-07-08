// Environment ecosystem — ported from veoflow-web's environment/* architecture
// (environmentArchetype + assetDna + constraints), adapted to storyboard-ai's
// text-prompt pipeline. Each archetype is a LOCKED, physically-grounded world
// spec: real materials (PBR behaviour), Kelvin+Lux lighting, atmosphere,
// micro-details and imperfections — the ingredients that make Veo render a
// scene as REAL filmed footage instead of a clean CGI set.

/** Physically-based lighting spec — always Kelvin + approximate Lux. */
export interface LightingProfile {
  /** Main/key light colour temperature in Kelvin (e.g. 5200). */
  key_kelvin: number;
  /** Fill / ambient sky temperature in Kelvin, when it differs from key. */
  ambient_kelvin?: number;
  /** Approximate overall scene illuminance in Lux (dawn ~800, cafe ~250…). */
  ambient_lux: number;
  /** Directional light sources, e.g. ["soft overcast eastern sky", "warm horizon rim"]. */
  sources: string[];
  /** Shadow character — always physically imperfect, never CGI-crisp. */
  shadows: string;
}

/** One surface/material with its real-world physical behaviour. */
export interface MaterialSpec {
  /** Which surface: "ground", "walls", "backdrop", "key props"… */
  surface: string;
  /** What it is made of, e.g. "weathered grey rock with dewy grass patches". */
  material: string;
  /** PBR behaviour: roughness, reflectivity, wear — what makes it read real. */
  physics: string;
}

/** Atmosphere & living-world motion baseline. */
export interface AtmosphereProfile {
  time_of_day: string;
  weather: string;
  /** Airborne matter: fog, dust motes, steam, embers, sea spray… */
  particulates: string[];
  /** What subtly moves while the set stays locked (fog drift, grass sway…). */
  ambient_motion: string;
}

/** Ngũ hành element — drives environment choice for numerology videos. */
export type NguHanhElement = "Thủy" | "Thổ" | "Mộc" | "Kim" | "Hỏa";

export type EnvironmentClass =
  | "exterior_natural"
  | "exterior_urban"
  | "interior";

/**
 * A locked environment archetype. Everything here is repeated into the Veo
 * prompt so the world has ONE fixed identity across the clip (and across
 * clips that reuse the same archetype).
 */
export interface EnvironmentArchetype {
  archetype_id: string;
  display_name: string;
  environment_class: EnvironmentClass;
  /** Ngũ hành element(s) this environment expresses (numerology mapping). */
  element?: NguHanhElement;
  /** EN + VI keywords for auto-matching against a segment's setting text. */
  keywords: string[];
  /** Human-scale + sightline note, e.g. "open cliff-edge vista, long sightlines". */
  scale: string;
  materials: MaterialSpec[];
  lighting: LightingProfile;
  atmosphere: AtmosphereProfile;
  /** 3-5 small believable details that sell the realism. */
  micro_details: string[];
  /** Wear/asymmetry to KEEP — imperfection is what kills the CGI look. */
  imperfections: string[];
  /** Constant ambient audio bed for this world (Veo generates audio). */
  sound_bed: string;
  /** Only these things may subtly vary within/between clips. */
  micro_variation_allowed: string[];
  /** These must NEVER change once the clip starts. */
  forbidden_variation: string[];
}
