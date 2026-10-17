// ============================================================
// CHILD-SAFE WORDING — video models (Veo / Flow) refuse a prompt when words
// about bodies, lips, kisses or nudity sit next to a child, even when the
// scene is an innocent family moment ("lips pouting", "arms around Mẹ's
// waist", "forearm under her thighs", "a natural nude lip"). The writer is
// told to avoid them, and this deterministic pass rewrites what slips
// through in every project that has a child in the cast.
// ============================================================

export const CHILD_SAFE_WORDING_RULE =
  "CHILD-SAFE WORDING (video-model policy — a prompt with a child is refused otherwise): describe a child only through the face (eyes, eyebrows, cheeks, a smile or a sulky frown), hands, gestures and actions, and name no other body part of a child. A carried child is simply \"held securely in Bố's arms\" or \"on Bố's side\". Adults show affection only with a side hug or holding hands. A baby is always in an adult's arms or lap, or right beside an adult who visibly attends to it. Clothing is only ever ordinary everyday clothes.";

type Rule = [RegExp, string | ((...m: string[]) => string)];

const POSSESSIVE = "(\\p{L}+(?:'s|’s)|her|his|their)";

const RULES: Rule[] = [
  // Words a family-video prompt never needs ("no nudity" / "no kissing" go whole).
  [/\b(?:no|never|without|avoid)\s+(?:any\s+)?(?:nudity|naked\w*|undress\w*|kiss(?:es|ing)?)\b/giu, ""],
  [/\bnude\b/giu, "natural"],
  [/\b(?:naked|nudity|undress(?:ed|es|ing)?|bathtub|bath(?:ing)?|swimsuits?|swimwear|bikinis?|underwear|diapers?|shirtless|topless)\b/giu, ""],
  // Expressions: a sulky frown instead of lips.
  [/\b(?:lips? pouting|pouting lips?|pouty lips?|pursed lips?|trembling lower lip|lower lip trembling)\b/giu, "a sulky frown"],
  [/\bpouting\b/giu, "sulking"],
  [/\bpouts\b/giu, "sulks"],
  [/\bpouted\b/giu, "sulked"],
  [/\bpouty\b/giu, "sulky"],
  [/\bpout\b/giu, "sulky frown"],
  // Affection: a side hug, never a waist hold or a kiss.
  [new RegExp(`\\b(arms?|hands?)((?: wrapped| resting| placed)?) around ${POSSESSIVE} waists?\\b`, "giu"), "$1$2 around $3 shoulders"],
  [new RegExp(`\\b${POSSESSIVE} waists?\\b`, "giu"), "$1 shoulders"],
  [/\ba (?:quick |little |small |gentle |soft |light )?kiss on (?:the |her |his |\p{L}+(?:'s|’s) )?(?:cheek|forehead|head)\b/giu, "a gentle side hug"],
  [/\b(kiss(?:es|ed|ing)?) (\p{L}+) on (?:the |her |his )?(?:cheek|forehead|head)\b/giu, (_m: string, verb: string, who: string) => `${hugFor(verb)} ${who}`],
  [/\bkiss(?:es|ed|ing)?\b/giu, (verb: string) => hugFor(verb)],
  // Carrying a child: no thighs or hips.
  [new RegExp(`\\b${POSSESSIVE} thighs\\b`, "giu"), "$1 legs"],
  [/\bthighs\b/giu, "legs"],
  [/\bthigh\b/giu, "leg"],
  [new RegExp(`\\b(at|on|against) ${POSSESSIVE} (left |right )?hip\\b`, "giu"), "$1 $2 $3side"],
  [new RegExp(`\\bhands on ${POSSESSIVE} hips\\b`, "giu"), "fists at $1 sides"],
  // State-ledger shorthand ("held at waist by Bố", "supporting Na at left hip").
  [/\b(held|holding|holds?|hugged|hugging)((?: \p{L}+)?) at (?:the )?waist\b(?![- ]?(?:height|level))/giu, "$1$2 in a side hug"],
  [/\bat (?:the )?(left |right )?hip\b(?![- ]?(?:height|level))/giu, "at the $1side"],
];

function hugFor(verb: string): string {
  const lower = verb.toLowerCase();
  const out = lower === "kisses" ? "hugs" : lower === "kissed" ? "hugged" : lower === "kissing" ? "hugging" : "hug";
  return verb[0] === verb[0]!.toUpperCase() ? out[0]!.toUpperCase() + out.slice(1) : out;
}

/** One text, rewritten for a scene with a child. */
export function childSafeText(text: string): string {
  // Image data (data URLs, long base64 runs) is never text to rewrite.
  if (text.startsWith("data:") || (text.length > 200 && !/\s/.test(text))) return text;
  let out = text;
  for (const [re, to] of RULES) out = out.replace(re, to as string);
  if (out === text) return text;
  return out
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1");
}

/** Every string inside a value (object, array, JSON text) rewritten; untouched parts keep their identity. */
export function childSafeDeep<T>(value: T): T {
  if (typeof value === "string") return childSafeText(value) as T;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((v) => {
      const w = childSafeDeep(v);
      if (w !== v) changed = true;
      return w;
    });
    return (changed ? next : value) as T;
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const w = childSafeDeep(v);
      if (w !== v) changed = true;
      next[k] = w;
    }
    return (changed ? next : value) as T;
  }
  return value;
}

/** True when the cast has a child (or the project is a cute-kids reel). */
export function castHasChild(locks: Array<{ is_child?: boolean | null }> | undefined | null, cuteKids?: unknown): boolean {
  return Boolean(cuteKids) || (locks ?? []).some((l) => l?.is_child === true);
}
