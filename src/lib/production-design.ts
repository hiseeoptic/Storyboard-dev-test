// ============================================================
// PRODUCTION DESIGN — what makes a frame look like a polished channel video
// instead of an empty room. Décor, palette, materials and practical lights are
// design decisions, not facts that can be "unspecified": the evidence-first
// rules elsewhere protect story facts (who, what, where, when), not the look.
// Shared by the Context IR stage, the script/storyboard prompts and the Nano
// Flow manifest.
// ============================================================

export const PRODUCTION_DESIGN_DOCTRINE =
  "PRODUCTION DESIGN — CHANNEL-QUALITY SETS: décor, colour palette, materials and practical lights are design decisions, never facts to leave \"unspecified\". Unless the user uploaded a location photo, give every location a deliberate, attractive look that fits the genre, mood, culture and the characters' world: (1) a named look (e.g. \"warm modern Vietnamese bistro with rattan pendant lamps\", \"sunlit Hanoi apartment kitchen\"); (2) a 3–4 colour palette that flatters skin and complements the costumes; (3) 3–5 concrete set-dressing landmarks — furniture style and materials, practical lamps, plants, wall texture or art — arranged in foreground, midground and background for depth; (4) motivated practical light sources visible in frame, soft and flattering. Tasteful, cinematic and uncluttered: every frame should look like a well-produced short drama on a successful channel. Keep every prop and piece of geometry the story needs exactly; no readable brands or signage. Never describe a set as bare, generic, \"no décor\", \"restrained background\" or \"geographically unspecified\".";

export const COSTUME_DOCTRINE =
  "COSTUME: practical for the story AND camera-ready — flattering, contemporary, well fitted and colour-coordinated with the set palette, with one clear colour accent per lead that keeps the characters distinct; avoid drab, muddy or grey-on-grey outfits unless the story calls for them.";

/** Added to a generated location image or keyframe when no location photo was uploaded. */
export const SET_QUALITY_NOTE =
  "Production design: a beautiful, cinematic, channel-quality set — layered depth, tasteful décor and furniture that suit the story and genre, warm motivated practical lights and a harmonious palette that flatters skin. Never a bare, empty, flat-lit or cheap-looking room.";

export const SET_QUALITY_NEGATIVE =
  "bare or empty room, blank walls, flat or harsh overhead lighting, cheap-looking or mismatched décor, clutter";

/**
 * Clauses that tell the image model to build an empty set ("no added
 * distinctive decor", "geographically unspecified", "no newly featured light
 * fixtures"…). They come from the evidence-first context stage and make every
 * location look bare; removing them lets the production design show.
 */
const BLAND_CLAUSES: RegExp[] = [
  /,?\s*(?:and\s+)?(?:with\s+)?no\s+(?:added|extra|additional|new)?\s*(?:distinctive\s+)?(?:decor|décor|decoration|set dressing)(?:\s+or\s+readable\s+signage)?/giu,
  /,?\s*(?:and\s+)?no\s+newly\s+featured\s+light\s+fixtures?/giu,
  /;?\s*source\s+fixture\s+unspecified/giu,
  /;?\s*exact\s+(?:ambient\s+sources|room\s+acoustics)\s+(?:are|is)\s+unspecified/giu,
  /,?\s*\bgeographically\s+unspecified\b/giu,
  /\s*Keep\s+surfaces\s+and\s+background\s+details\s+restrained[^.;]*[.;]?/giu,
  /\s*Keep\s+(?:the\s+)?background\s+(?:details\s+)?(?:minimal|restrained|plain)[^.;]*[.;]?/giu,
];

export function stripBlandSetClauses(text: string): string {
  let out = String(text ?? "");
  for (const re of BLAND_CLAUSES) out = out.replace(re, "");
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;:])\s*([.;])/g, "$2")
    .replace(/,\s*$/, "")
    .replace(/(\.\s+)(\p{Ll})/gu, (_m, gap: string, ch: string) => gap + ch.toUpperCase())
    .trim();
}
