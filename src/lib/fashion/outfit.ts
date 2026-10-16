// ============================================================
// FASHION OUTFITS — clothes a character wears to sell them (affiliate fashion).
//
// The user attaches garment photos to a character. A vision pass names every
// garment the photos show and which outfit slot it fills (top, bottom, dress,
// outerwear, footwear, bag, headwear, accessory). Slots the photos show are
// locked exactly as photographed; the slots needed for a complete look that
// the photos do NOT show are filled by the app with one neutral, colour-
// matched piece (the user can edit it) and stay identical in every shot.
// One outfit per character for the whole video. Garments only: a model in a
// shop photo never lends the character a face or body.
// Pure data + functions (node-testable).
// ============================================================

export const GARMENT_SLOTS = [
  "outerwear",
  "top",
  "bottom",
  "one_piece",
  "footwear",
  "bag",
  "headwear",
  "accessory",
] as const;
export type GarmentSlot = (typeof GARMENT_SLOTS)[number];

export type WearerGroup = "woman" | "man" | "girl" | "boy";
export const WEARER_GROUPS: WearerGroup[] = ["woman", "man", "girl", "boy"];

export const SLOT_LABEL: Record<GarmentSlot, { vi: string; en: string }> = {
  outerwear: { vi: "Áo khoác", en: "Outerwear" },
  top: { vi: "Áo", en: "Top" },
  bottom: { vi: "Quần / chân váy", en: "Bottom" },
  one_piece: { vi: "Đầm / bộ liền", en: "Dress / one-piece" },
  footwear: { vi: "Giày dép", en: "Footwear" },
  bag: { vi: "Túi", en: "Bag" },
  headwear: { vi: "Mũ / phụ kiện tóc", en: "Headwear" },
  accessory: { vi: "Phụ kiện", en: "Accessory" },
};

export const GROUP_LABEL: Record<WearerGroup, { vi: string; en: string }> = {
  woman: { vi: "Nữ", en: "Woman" },
  man: { vi: "Nam", en: "Man" },
  girl: { vi: "Bé gái", en: "Girl" },
  boy: { vi: "Bé trai", en: "Boy" },
};

export const isChildGroup = (group: WearerGroup | undefined) => group === "girl" || group === "boy";

export interface DetectedGarment {
  slot: GarmentSlot;
  /** Concrete English description: garment type, colour, material, pattern, cut, details. */
  description: string;
  /** 0-based index of the photo that shows it best. */
  image_index?: number;
}

export interface GarmentAnalysis {
  garments: DetectedGarment[];
  /** A person (shop model) wears the garments in at least one photo. */
  has_model_in_photo: boolean;
  /** The photos show the back of the main garment. */
  has_back_view: boolean;
  /** Who the clothes are made for, as far as the photos show. */
  audience: WearerGroup | "unisex" | "unknown";
  /** App-chosen neutral pieces for missing slots (English), keyed by slot. */
  suggested_fills: Partial<Record<GarmentSlot, string>>;
  /** One short English line about the look (style, palette). */
  style_note: string;
}

/** The outfit attached to one character. */
export interface CharacterOutfit {
  wearer: string;
  group: WearerGroup;
  /** Product name shown in captions ("Đầm hoa nhí cổ vuông"). */
  name: string;
  link?: string;
  analysis: GarmentAnalysis | null;
  /** Final pieces for the missing slots (app suggestion, possibly edited). */
  fills: Partial<Record<GarmentSlot, string>>;
  imageCount: number;
}

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Slots a complete, filmable look needs given what the photos show. */
export function requiredSlots(garments: Array<Pick<DetectedGarment, "slot">>): GarmentSlot[] {
  const has = new Set(garments.map((g) => g.slot));
  const body: GarmentSlot[] = has.has("one_piece") ? ["one_piece"] : ["top", "bottom"];
  return [...body, "footwear"];
}

/** Required slots no photo shows — the app styles these. */
export function missingSlots(garments: Array<Pick<DetectedGarment, "slot">>): GarmentSlot[] {
  const has = new Set(garments.map((g) => g.slot));
  return requiredSlots(garments).filter((slot) => !has.has(slot));
}

const NEUTRAL_FILL: Record<WearerGroup, Partial<Record<GarmentSlot, string>>> = {
  woman: {
    top: "a plain fitted top in a soft neutral tone (ivory or warm beige) with no print",
    bottom: "plain straight-leg trousers in a neutral tone that complements the selling piece, no print",
    footwear: "simple low-heeled shoes in a neutral tone matching the outfit",
  },
  man: {
    top: "a plain crew-neck T-shirt in white or a soft neutral tone, no print",
    bottom: "plain slim straight chinos in a neutral tone that complements the selling piece",
    footwear: "clean minimal sneakers in white or a neutral tone",
  },
  girl: {
    top: "a plain soft cotton T-shirt in white or a pastel tone, no print",
    bottom: "comfortable plain cotton shorts or leggings in a neutral or pastel tone",
    footwear: "comfortable children's sneakers or sandals in a neutral tone",
  },
  boy: {
    top: "a plain soft cotton T-shirt in white or a light tone, no print",
    bottom: "comfortable plain cotton shorts or trousers in a neutral tone",
    footwear: "comfortable children's sneakers in a neutral tone",
  },
};

/** Fallback piece for a missing slot when the vision pass gave none. */
export function neutralFill(slot: GarmentSlot, group: WearerGroup): string {
  return NEUTRAL_FILL[group][slot] ?? "";
}

/** The pieces the app adds: vision suggestion → user edit → neutral fallback. */
export function resolveFills(
  analysis: GarmentAnalysis | null,
  group: WearerGroup,
  edits: Partial<Record<GarmentSlot, string>> = {}
): Partial<Record<GarmentSlot, string>> {
  const out: Partial<Record<GarmentSlot, string>> = {};
  for (const slot of missingSlots(analysis?.garments ?? [])) {
    out[slot] = clean(edits[slot]) || clean(analysis?.suggested_fills?.[slot]) || neutralFill(slot, group);
  }
  return out;
}

const GROUP_EN: Record<WearerGroup, string> = { woman: "woman", man: "man", girl: "girl (child)", boy: "boy (child)" };

export function buildGarmentAnalysisPrompt(params: { name?: string; group?: WearerGroup; note?: string; imageCount: number }): string {
  return `Analyse the attached fashion product photo(s) (${params.imageCount}) and return ONE compact JSON object only.

USER INPUT
- Product name: ${clean(params.name) || "unspecified"}
- Intended wearer: ${params.group ? GROUP_EN[params.group] : "unspecified"}
- Seller note: ${clean(params.note) || "none"}

TASK
1. List EVERY garment / wearable item for sale that the photos show, each once, with its slot:
   "outerwear" (jacket, coat, blazer, cardigan worn open), "top" (shirt, blouse, T-shirt, sweater, crop top), "bottom" (trousers, jeans, shorts, skirt), "one_piece" (dress, jumpsuit, romper, full set sold as one piece), "footwear", "bag", "headwear" (hat, cap, hair clip, headband), "accessory" (belt, scarf, jewellery, socks, glasses).
   A matching two-piece set sold together = one "top" + one "bottom".
2. description: concrete English for an image model — garment type, exact colours, material/fabric look, pattern or print, cut/fit, length, neckline, sleeves, closures and visible details (buttons, pockets, embroidery, logo position). Visible facts only.
3. image_index: the 0-based photo that shows the garment best.
4. has_model_in_photo: true if a person wears the clothes in any photo. Never describe that person — the clothes only.
5. has_back_view: true if any photo shows the back of the main garment.
6. audience: who the clothes are cut for — "woman", "man", "girl", "boy", "unisex" or "unknown".
7. suggested_fills: for each slot needed for a complete look that NO photo shows — use "top"+"bottom" (or "one_piece") plus "footwear" — one simple, plain, neutral piece that colour-matches the selling garments and never competes with them (no print, no logo). Omit slots the photos show. Suit the intended wearer's age.
8. style_note: one short line on the look (style + palette), e.g. "soft feminine summer look in cream and sage".

JSON SHAPE
{"garments":[{"slot":"top","description":"...","image_index":0}],"has_model_in_photo":false,"has_back_view":false,"audience":"woman","suggested_fills":{"bottom":"...","footwear":"..."},"style_note":"..."}`;
}

const SLOT_SET = new Set<string>(GARMENT_SLOTS);

/** Normalise a model answer into a GarmentAnalysis (tolerant of loose JSON). */
export function normalizeGarmentAnalysis(raw: unknown, imageCount: number): GarmentAnalysis {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.garments) ? r.garments : [];
  const seen = new Set<string>();
  const garments: DetectedGarment[] = [];
  for (const item of list) {
    const g = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const slot = clean(g.slot).toLowerCase().replace(/[\s-]+/g, "_");
    const description = clean(g.description).slice(0, 400);
    if (!SLOT_SET.has(slot) || !description) continue;
    const key = `${slot}:${description.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const idx = Number(g.image_index);
    garments.push({
      slot: slot as GarmentSlot,
      description,
      ...(Number.isInteger(idx) && idx >= 0 && idx < imageCount ? { image_index: idx } : {}),
    });
  }
  const fillsRaw = (r.suggested_fills && typeof r.suggested_fills === "object" ? r.suggested_fills : {}) as Record<string, unknown>;
  const suggested_fills: Partial<Record<GarmentSlot, string>> = {};
  const missing = new Set(missingSlots(garments));
  for (const [key, value] of Object.entries(fillsRaw)) {
    const slot = key.toLowerCase() as GarmentSlot;
    if (missing.has(slot) && clean(value)) suggested_fills[slot] = clean(value).slice(0, 240);
  }
  const audience = clean(r.audience).toLowerCase();
  return {
    garments,
    has_model_in_photo: r.has_model_in_photo === true,
    has_back_view: r.has_back_view === true,
    audience: (["woman", "man", "girl", "boy", "unisex"].includes(audience) ? audience : "unknown") as GarmentAnalysis["audience"],
    suggested_fills,
    style_note: clean(r.style_note).slice(0, 200),
  };
}

/**
 * Short garment name from a vision description ("strapless mini dress in light
 * beige, featuring …" → "strapless mini dress"). Used as a LABEL only: when a
 * photo exists the photo, not the words, decides every detail.
 */
export function garmentLabel(description: string): string {
  const head = clean(description).split(/[,;(]|\s+(?:with|featuring|in|made of|that|and a)\s+/i)[0] ?? "";
  return head.split(/\s+/).slice(0, 7).join(" ").trim() || clean(description).split(/\s+/).slice(0, 4).join(" ");
}

/**
 * Outfit text that becomes the wearer's locked costume. With a photo the text
 * is a label pointing at the photo — a detailed description made image models
 * redraw the garment from words (a small frill became a big flounce).
 */
export function outfitCostumeText(outfit: CharacterOutfit): string {
  const garments = outfit.analysis?.garments ?? [];
  const photo = outfit.imageCount > 0;
  const labels = garments.map((g) => garmentLabel(g.description)).filter(Boolean).join(" + ");
  const selling = photo
    ? `${labels || "the outfit"} — EXACTLY the garment${garments.length > 1 ? "s" : ""} in the attached OUTFIT photo "${outfit.name}" (copied from the photo, never redrawn from words)`
    : garments.length
      ? garments.map((g) => g.description).join("; ")
      : outfit.name || "the attached outfit";
  const fills = Object.entries(outfit.fills)
    .filter(([, text]) => clean(text))
    .map(([slot, text]) => `${slot.replace("_", "-")}: ${clean(text)}`)
    .join("; ");
  return `${selling}${fills ? `; plus pieces not in the photo (app-chosen, identical in every shot): ${fills}` : ""}`;
}

/** The keyframe / video contract that binds a wearer to their outfit photo. */
export function outfitReferenceContract(refs: Array<{ wearer: string; productName: string }>): string {
  if (!refs.length) return "";
  const who = refs.map((r) => `${r.wearer} wears EXACTLY the garment(s) in the attached OUTFIT photo "${r.productName}"`).join("; ");
  return `OUTFIT REFERENCE (sold product — overrides every outfit text for these characters): ${who}. Transfer it piece for piece like a virtual try-on: the same silhouette, neckline, gathers/ruching and frills at the same size, straps or strapless, ties/sash in the same position with the same knot, the same number of layers and hem shape, length, colour, print and fabric texture. Never redesign, simplify or embellish it from words. The photo is clothing only: never copy a person, mannequin, pose or background from it. Pieces the photo does not show follow the wardrobe text.`;
}

/** Short Vietnamese summary for the cast card: "Áo ✅ ảnh · Quần ⚙️ app phối · Giày ⚙️ app phối". */
export function outfitSlotSummary(outfit: Pick<CharacterOutfit, "analysis" | "fills">, lang: "vi" | "en" = "vi"): string {
  const shown = (outfit.analysis?.garments ?? []).map((g) => `${SLOT_LABEL[g.slot][lang]} ✅`);
  const filled = Object.keys(outfit.fills).map((slot) => `${SLOT_LABEL[slot as GarmentSlot][lang]} ⚙️`);
  return [...shown, ...filled].join(" · ");
}

/**
 * Script / storyboard directive for fashion outfits: how to sell clothes on a
 * person, plus the child-safety rules when a child wears them.
 */
export function fashionDirective(outfits: CharacterOutfit[]): string {
  if (!outfits.length) return "";
  const lines = [
    "FASHION AFFILIATE CONTRACT (clothes are the product; each character wears ONE locked outfit for the whole video):",
  ];
  for (const o of outfits) {
    const garments = o.analysis?.garments ?? [];
    const labels = garments.map((g) => garmentLabel(g.description)).join(" + ");
    const selling = o.imageCount > 0
      ? `${labels || "the outfit"} exactly as in its attached photo`
      : garments.length ? garments.map((g) => g.description).join("; ") : o.name;
    const fills = Object.values(o.fills).filter(Boolean).join("; ");
    lines.push(`- ${o.wearer} (${GROUP_EN[o.group]}) wears "${o.name}": ${selling}.${fills ? ` Styled with plain, non-competing: ${fills}.` : ""}${o.analysis && !o.analysis.has_back_view ? " Only the front is known: avoid back views of the outfit." : ""}`);
  }
  lines.push(
    "- Sell the clothes on the body: 0–3 s outfit hook (the full look, or a striking detail, with a spoken hook); a close detail of fabric, stitching or a signature detail; movement that shows fit and drape (walking, turning, sitting down, reaching); the outfit in a real moment of the character's day that suits it; a final full-look hero frame with a natural mention and \"link in the description\".",
    "- Pick the format that suits the story: outfit-of-the-day walk, get-ready moment, one item worn in a real situation, mother-and-child matching moment, before/after outfit choice. Clothes stay identical in every shot; never invent prices, sizes, materials or claims that the user did not give."
  );
  if (outfits.some((o) => isChildGroup(o.group))) {
    lines.push(
      "- CHILDREN'S CLOTHING SAFETY: the child behaves and poses like a child of that age — playing, walking, laughing, at school, at a birthday, with a parent nearby; natural, modest, age-appropriate framing; no make-up, no adult poses, no posing for the body, no suggestive or fashion-model attitude, no swimwear or underwear focus."
    );
  }
  return lines.join("\n");
}
