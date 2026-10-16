// ============================================================
// PRODUCT PLACEMENT — products, outfits and props the user attaches to ANY video
// (sitcom, everyday life, drama, ads…), each optionally with a shop link
// (Shopee / Amazon / Lazada / TikTok Shop…) and reference photos.
//   · outfit  → the named character wears EXACTLY that outfit (photo = wardrobe
//               authority) in every scene they appear in;
//   · product / prop → woven into the story: "natural" = used in-world without a
//               hard sell; "featured" = one clear hero moment + a voice-over /
//               dialogue mention + CTA pointing to the link.
// Links never appear on screen; they go into the exported social captions and
// the manifest so the creator can post them.
// Pure data + functions (node-testable).
// ============================================================

import {
  GARMENT_SLOTS,
  WEARER_GROUPS,
  fashionDirective,
  normalizeGarmentAnalysis,
  outfitCostumeText,
  type CharacterOutfit,
  type GarmentSlot,
  type WearerGroup,
} from "./fashion/outfit.ts";

export type PlacementKind = "product" | "outfit" | "prop";
export type PlacementMode = "natural" | "featured";

export interface ProductPlacement {
  name: string;
  description?: string;
  /** Shop link (Shopee, Amazon, Lazada, TikTok Shop…). Never rendered on screen. */
  link?: string;
  kind: PlacementKind;
  /** Character (menu name) who wears the outfit. Outfits only. */
  worn_by?: string;
  placement: PlacementMode;
  /** True when reference photos were uploaded for this item. */
  has_images?: boolean;
  /** Fashion outfit attached to a character: garment slots + app-styled pieces. Outfits only. */
  fashion?: CharacterOutfit;
}

const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Accept only http(s) links; strip tracking whitespace. */
export function normalizeShopLink(raw: unknown): string {
  const s = clean(raw);
  if (!s) return "";
  const withScheme = /^https?:\/\//i.test(s) ? s : /^[\w.-]+\.[a-z]{2,}\//i.test(s) ? `https://${s}` : "";
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export function shopName(link: string): string {
  const host = (() => { try { return new URL(link).hostname.toLowerCase(); } catch { return ""; } })();
  if (/shopee/.test(host)) return "Shopee";
  if (/amazon|amzn/.test(host)) return "Amazon";
  if (/lazada/.test(host)) return "Lazada";
  if (/tiktok/.test(host)) return "TikTok Shop";
  if (/tiki/.test(host)) return "Tiki";
  return host.replace(/^www\./, "") || "link";
}

/** Normalized, de-duplicated placements from the request. */
export function placementItems(list: unknown): ProductPlacement[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: ProductPlacement[] = [];
  for (const raw of list) {
    const r = (raw ?? {}) as Record<string, unknown>;
    const name = clean(r.name);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const kind: PlacementKind = r.kind === "outfit" || r.kind === "prop" ? r.kind : "product";
    const wornBy = kind === "outfit" ? clean(r.worn_by) : "";
    const fashion = kind === "outfit" ? normalizeFashion(r.fashion, wornBy, name) : undefined;
    out.push({
      name,
      ...(fashion ? { fashion } : {}),
      ...(clean(r.description) ? { description: clean(r.description).slice(0, 400) } : {}),
      ...(normalizeShopLink(r.link) ? { link: normalizeShopLink(r.link) } : {}),
      kind,
      ...(wornBy ? { worn_by: wornBy } : {}),
      placement: r.placement === "featured" ? "featured" : "natural",
      ...(r.has_images ? { has_images: true } : {}),
    });
  }
  return out;
}

function normalizeFashion(raw: unknown, wearer: string, name: string): CharacterOutfit | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const group = (WEARER_GROUPS as string[]).includes(String(r.group)) ? (r.group as WearerGroup) : "woman";
  const imageCount = Math.max(0, Math.min(8, Number(r.imageCount) || 0));
  const analysis = r.analysis ? normalizeGarmentAnalysis(r.analysis, imageCount || 8) : null;
  const fillsRaw = (r.fills && typeof r.fills === "object" ? r.fills : {}) as Record<string, unknown>;
  const fills: Partial<Record<GarmentSlot, string>> = {};
  for (const slot of GARMENT_SLOTS) if (clean(fillsRaw[slot])) fills[slot] = clean(fillsRaw[slot]).slice(0, 240);
  return {
    wearer: wearer || clean(r.wearer),
    group,
    name: clean(r.name) || name,
    ...(normalizeShopLink(r.link) ? { link: normalizeShopLink(r.link) } : {}),
    analysis,
    fills,
    imageCount,
  };
}

/** Fashion outfits attached to characters, in request order. */
export function fashionOutfits(list: unknown): CharacterOutfit[] {
  return placementItems(list).flatMap((item) => (item.fashion ? [item.fashion] : []));
}

/** Text that becomes character_locks.costume for an outfit placement. */
export function outfitCostume(item: ProductPlacement): string {
  if (item.fashion) return outfitCostumeText(item.fashion);
  return `${item.name}${item.description ? ` — ${item.description}` : ""}${item.has_images ? " (exactly as in its attached outfit reference photo: same garments, colours, fabric, cut and details)" : ""}`;
}

/** Hard directive for the script / storyboard LLM. Empty when nothing is attached. */
export function productPlacementDirective(list: unknown, opts: { adGenre?: boolean } = {}): string {
  const items = placementItems(list);
  if (!items.length) return "";
  const lines = [
    "PRODUCT PLACEMENT CONTRACT (HARD — the user attached these items to sell through this video; keep the story/genre the user chose):",
  ];
  for (const it of items) {
    const ref = it.has_images ? " Its attached reference photo(s) are the exact visual authority (shape, colour, material, label)." : "";
    if (it.kind === "outfit") {
      lines.push(it.worn_by
        ? `- OUTFIT "${it.name}"${it.description ? ` (${it.description})` : ""}: ${it.worn_by} wears EXACTLY this outfit in every scene ${it.worn_by} appears in. Set character_locks.costume for ${it.worn_by} to this outfit and never restyle, replace or swap it.${ref}`
        : `- OUTFIT "${it.name}"${it.description ? ` (${it.description})` : ""}: the main character wears EXACTLY this outfit in every scene; set that character's costume to it.${ref}`);
      if (it.placement === "featured") lines.push(`  · Give the outfit one flattering moment (fabric, fit or detail clearly visible) and mention it once naturally.`);
      continue;
    }
    const what = it.kind === "prop" ? "PROP" : "PRODUCT";
    lines.push(it.placement === "featured"
      ? `- ${what} "${it.name}"${it.description ? ` (${it.description})` : ""}: FEATURED — appears in at least two segments, used by a character in a real, readable action, with one clear hero moment (product clearly visible, label facing camera) and one natural spoken or voice-over mention of its benefit; the last segment points viewers to "link in the description".${ref}`
      : `- ${what} "${it.name}"${it.description ? ` (${it.description})` : ""}: NATURAL PLACEMENT — lives inside the story world and is used by a character as part of the real action in at least one segment; visible and recognisable but never a sales pitch, no direct-to-camera selling${opts.adGenre ? " unless the ad script calls for it" : ""}.${ref}`);
  }
  lines.push("- Shop links are NEVER shown or read on screen; never invent prices, discounts or claims about these items.");
  const fashion = fashionDirective(items.flatMap((item) => (item.fashion ? [item.fashion] : [])));
  return fashion ? `${lines.join("\n")}\n${fashion}` : lines.join("\n");
}

interface LockLike { name: string; costume?: string; wardrobe_materials?: string }
interface BreakdownLike {
  character_locks?: LockLike[];
  social_posts?: {
    tiktok?: { caption?: string };
    youtube_shorts?: { description?: string };
    facebook_reel?: { caption?: string };
  };
}

const sameName = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/**
 * Deterministic post-model guard: outfit placements override whatever costume
 * the model wrote for their wearer, and shop links are appended to the social
 * captions. Returns human-readable notes (Vietnamese) for the warnings panel.
 */
export function enforceProductPlacements(list: unknown, breakdown: BreakdownLike): string[] {
  const items = placementItems(list);
  const notes: string[] = [];
  if (!items.length) return notes;
  const locks = Array.isArray(breakdown.character_locks) ? breakdown.character_locks : [];
  for (const it of items.filter((x) => x.kind === "outfit")) {
    const target = it.worn_by ? locks.find((l) => sameName(l.name, it.worn_by!)) : locks[0];
    if (!target) {
      notes.push(`Không tìm thấy nhân vật "${it.worn_by || "chính"}" để mặc trang phục "${it.name}".`);
      continue;
    }
    target.costume = outfitCostume(it);
    target.wardrobe_materials = it.description || target.wardrobe_materials;
  }
  const linked = items.filter((x) => x.link);
  if (linked.length && breakdown.social_posts) {
    const block = linked.map((x) => `🛒 ${x.name} (${shopName(x.link!)}): ${x.link}`).join("\n");
    const add = (s: string | undefined) => (s && s.includes(linked[0]!.link!) ? s : [s?.trim(), block].filter(Boolean).join("\n\n"));
    const sp = breakdown.social_posts;
    if (sp.tiktok) sp.tiktok.caption = add(sp.tiktok.caption);
    if (sp.youtube_shorts) sp.youtube_shorts.description = add(sp.youtube_shorts.description);
    if (sp.facebook_reel) sp.facebook_reel.caption = add(sp.facebook_reel.caption);
  }
  return notes;
}

/** Shots (by index) that should carry an item's reference images. */
export function shotsForPlacement(
  item: ProductPlacement,
  segments: Array<{ characters_in_scene?: string[]; first_frame_prompt?: string; motion_prompt?: string; beats?: Array<{ beat?: string }> }>,
  fallbackWearer?: string,
): number[] {
  if (item.kind === "outfit") {
    const wearer = item.worn_by || fallbackWearer || "";
    return segments.map((s, i) => ((s.characters_in_scene ?? []).some((n) => sameName(n, wearer)) ? i : -1)).filter((i) => i >= 0);
  }
  const words = item.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const mentioned = segments.map((s, i) => {
    const text = [s.first_frame_prompt, s.motion_prompt, ...(s.beats ?? []).map((b) => b.beat)].join(" ").toLowerCase();
    return text.includes(item.name.toLowerCase()) || (words.length > 0 && words.filter((w) => text.includes(w)).length >= Math.min(2, words.length)) ? i : -1;
  }).filter((i) => i >= 0);
  return mentioned.length ? mentioned : segments.map((_, i) => i);
}
