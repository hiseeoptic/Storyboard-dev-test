// ============================================================
// SET MAP — one fixed floor plan per location, written into the establishing
// image AND every keyframe/video of that location.
//
// Without it each keyframe re-imagined the room for its own camera angle: a
// vertical close-up "across the table" put the potted plant on another side
// than the establishing image, so the set seemed to rearrange itself between
// shots. The map gives every landmark ONE position relative to the main
// furniture, as seen from the MASTER side (the side the establishing image is
// taken from), and the camera-side lock keeps every shot looking at that same
// dressed view: closer framings only crop it.
// ============================================================

export interface SetMapPlacement {
  item: string;
  position: string;
}

export interface SetMap {
  /** Main furniture / route the other landmarks are placed around. */
  anchor: string;
  exterior: boolean;
  placements: SetMapPlacement[];
  /** Full map for image prompts. */
  text: string;
  /** Which part of the dressed view sits behind a subject on each side. */
  sides: string;
}

const ANCHOR = /\b(?:dining\s+)?(?:table|desk|counter|bar|bed|sofa|couch|stall|altar|bench|kitchen\s+island|island|booth|reception)\b/i;
const OVERHEAD = /\b(?:overhead|pendants?|pendant\s+(?:lights?|lamps?|shades?)|chandeliers?|hanging|ceiling|string\s+lights?|fairy\s+lights?|lanterns?\s+(?:hang|overhead))\b/i;
const UNDERFOOT = /\b(?:floor|rug|carpet|tiles?|tiled|parquet|flooring|mat)\b/i;
const TABLETOP = /\b(?:table[- ]side|tabletop|candles?|teapot|tea\s+set|vase\s+of|flowers?\s+in|bud\s+vase|desk\s+lamp|practical(?!\s+floor))\b/i;
const WALL = /\b(?:wall|artwork|art\b|paintings?|pictures?|prints?|frames?|mirrors?|shelf|shelves|windows?|clock|calligraphy|scrolls?|posters?|curtains?|drapes?|doors?|doorway|screen\s+door|altar\s+shelf)\b/i;
const FLOOR_PIECE = /\b(?:plants?|trees?|palms?|ferns?|bonsai|monstera|cabinet|sideboard|bookcase|bookshelf|cupboard|wardrobe|folding\s+screen|room\s+divider|floor\s+lamp|statue|pillar|column|piano|stool|armchair|chest|urns?|jars?|planters?|pots?)\b/i;
const HAS_POSITION = /\b(?:by|beside|near|behind|next\s+to|against|above|below|under|in\s+the\s+corner|left|right|opposite|facing|along|at\s+the\s+(?:end|back|front))\b/i;
const EXTERIOR = /\b(?:street|alley|lane|road|sidewalk|pavement|market|park|beach|garden|courtyard|square|riverside|river|lake|field|rooftop|terrace|exterior|outdoors?|old\s+quarter|village|harbou?r|bridge)\b/i;
// Letter lookarounds, not \b: "café" ends in a non-ASCII letter.
const INTERIOR = /(?<!\p{L})(?:room|kitchen|restaurant|bistro|caf[eé]|coffee\s+shop|tea\s*house|office|apartment|flat|bedroom|bathroom|hall|lobby|studio|classroom|library|shop|store|boutique|salon|clinic|hospital|ward|corridor|hallway|interior|indoors?|inside|lounge|bar|pub|chamber|house|home|mansion|palace|temple|pagoda|cabin)(?!\p{L})/iu;
const ROUTE_WORDS = "street|alley|lane|road|sidewalk|pavement|path|walkway|bridge|promenade";
const ROUTE = new RegExp(`\\b(?:${ROUTE_WORDS})\\b`, "i");
/** A landmark that IS the route ("old cobbled lane"), not a thing beside it ("street vendor's cart"). */
const ROUTE_ITEM = new RegExp(`^(?:[\\p{L}'’-]+\\s+){0,3}(?:${ROUTE_WORDS})$`, "iu");
const ROUTE_IN_SETTING = new RegExp(`((?:[\\p{L}'’-]+\\s+){0,2})(${ROUTE_WORDS})\\b`, "iu");

/** "Landmarks: a, b and c." → ["a", "b", "c"]; falls back to the "with a, b, c" list of the setting line. */
export function landmarkList(scenery: string, setting = ""): string[] {
  const fromLabel = /landmarks?\s*:\s*([^.]+)/i.exec(scenery)?.[1];
  const fromWith = /\bwith\s+([^.]+)/i.exec(setting)?.[1];
  const raw = fromLabel || fromWith || "";
  return raw
    .split(/\s*(?:,|;|\band\b)\s*/i)
    .map((part) => part.replace(/^(?:a|an|the)\s+/i, "").trim())
    .filter((part) => part.length > 2 && part.split(/\s+/).length <= 12);
}

const stripArticle = (s: string) => s.replace(/^(?:a|an|the)\s+/i, "");

/**
 * Build the fixed map for one location from its scenery/setting text. Returns
 * null when the text names fewer than two landmarks (nothing to keep in place).
 */
export function buildSetMap(params: { setting: string; scenery: string }): SetMap | null {
  const items = landmarkList(params.scenery, params.setting);
  if (items.length < 2) return null;
  // The setting's head ("Small warm restaurant with …") decides inside/outside;
  // a "street-facing window" in the scenery does not make a café an exterior.
  const head = params.setting.split(/\bwith\b|[,.;:—]/i)[0] ?? "";
  // Whichever kind of place the head names first wins ("courtyard of an old
  // house" is outside, "restaurant facing the street" is inside).
  const at = (re: RegExp, text: string) => text.search(re);
  const ext = at(EXTERIOR, head);
  const int = at(INTERIOR, head);
  const exterior = ext >= 0
    ? int < 0 || ext < int
    : int < 0 && !INTERIOR.test(params.setting) && EXTERIOR.test(params.scenery);

  // Outdoors the route the setting names ("Hang Bong street") is the anchor;
  // indoors it is the first main piece of furniture in the landmark list.
  const routeInSetting = exterior ? ROUTE_IN_SETTING.exec(params.setting) : null;
  const anchorItem = exterior
    ? items.find((item) => ROUTE_ITEM.test(item))
    : items.find((item) => ANCHOR.test(item) && !OVERHEAD.test(item));
  const placeWord = (EXTERIOR.exec(head)?.[0] ?? "place").toLowerCase();
  const anchor = routeInSetting
    ? `the ${routeInSetting[0].trim()}`
    : anchorItem ? `the ${stripArticle(anchorItem)}` : exterior ? `the ${placeWord}` : "the main furniture";
  const anchorNoun = routeInSetting
    ? routeInSetting[2]!.toLowerCase()
    : anchorItem
      ? (anchorItem.match(exterior ? ROUTE : ANCHOR)?.[0] ?? "furniture").toLowerCase()
      : exterior ? placeWord : "furniture";

  const placements: SetMapPlacement[] = [];
  if (exterior) {
    const slots = [
      `left side of the ${anchorNoun}, foreground`,
      `right side of the ${anchorNoun}, foreground`,
      `left side, further along the ${anchorNoun}`,
      `right side, further along the ${anchorNoun}`,
      `far end of the ${anchorNoun}, centred in the background`,
    ];
    let next = 0;
    for (const item of items) {
      if (item === anchorItem) continue;
      if (HAS_POSITION.test(item)) placements.push({ item, position: "as described" });
      else if (OVERHEAD.test(item)) placements.push({ item, position: `strung overhead across the ${anchorNoun}` });
      else if (UNDERFOOT.test(item)) placements.push({ item, position: "underfoot" });
      else placements.push({ item, position: slots[Math.min(next++, slots.length - 1)]! });
    }
  } else {
    const wallSlots = [
      `back wall, centred behind the ${anchorNoun}`,
      `back wall, right of centre`,
      `left side wall`,
      `back wall, left of centre`,
    ];
    const floorSlots = [
      "back-left corner, standing on the floor",
      "back-right corner, standing on the floor",
      "left edge of the room, mid-ground",
      "right edge of the room, mid-ground",
    ];
    const topSlots = [`right end of the ${anchorNoun}`, `left end of the ${anchorNoun}`];
    let wall = 0;
    let floor = 0;
    let top = 0;
    for (const item of items) {
      if (item === anchorItem) continue;
      if (HAS_POSITION.test(item)) placements.push({ item, position: "as described" });
      else if (OVERHEAD.test(item)) placements.push({ item, position: `hanging above the ${anchorNoun}` });
      else if (TABLETOP.test(item)) placements.push({ item, position: topSlots[Math.min(top++, topSlots.length - 1)]! });
      else if (FLOOR_PIECE.test(item) && !/\bwall\b/i.test(item)) placements.push({ item, position: floorSlots[Math.min(floor++, floorSlots.length - 1)]! });
      else if (UNDERFOOT.test(item) && !WALL.test(item)) placements.push({ item, position: "underfoot across the room" });
      else if (WALL.test(item)) placements.push({ item, position: wallSlots[Math.min(wall++, wallSlots.length - 1)]! });
      else placements.push({ item, position: floorSlots[Math.min(floor++, floorSlots.length - 1)]! });
    }
  }
  if (placements.length === 0) return null;

  const layout = exterior
    ? ROUTE.test(anchorNoun)
      ? `${cap(anchor)} runs from the camera into the background.`
      : `${cap(anchor)} opens out in front of the camera.`
    : `${cap(anchor)} stands in the middle ground${/table|desk|counter|bar|bench|sofa|couch|bed/.test(anchorNoun) ? `, its long side parallel to the back wall` : ""}.`;
  const list = placements
    .map((p) => (p.position === "as described" ? p.item : `${p.item} — ${p.position}`))
    .join("; ");
  const text =
    `SET MAP (fixed; identical in the establishing image and in every shot, described from the master camera side): ${layout} Landmarks: ${list}. ` +
    "Every landmark keeps exactly this position, size and count in every shot — never moved, mirrored, duplicated, removed or added to fill a vertical frame.";

  const leftItems = placements.filter((p) => /\bleft\b/.test(p.position)).map((p) => p.item);
  const rightItems = placements.filter((p) => /\bright\b/.test(p.position)).map((p) => p.item);
  const centreItems = placements.filter((p) => /\bcentre|centred\b/.test(p.position)).map((p) => p.item);
  const sides = [
    leftItems.length ? `a subject on the left of ${anchor} has the left part of the view behind them (${leftItems.join(", ")})` : "",
    rightItems.length ? `a subject on the right has the right part behind them (${rightItems.join(", ")})` : "",
    centreItems.length ? `${centreItems.join(", ")} stays centred behind ${anchor}` : "",
  ].filter(Boolean).join("; ");

  return { anchor, exterior, placements, text, sides };
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);

/** The camera-side rule that keeps every shot on the establishing image's side of the set. */
export function cameraSideLock(map: SetMap | null): string {
  const base =
    "CAMERA SIDE LOCK: every shot is filmed from the master side — the same side of the set as the establishing image — looking toward the same dressed background, so the landmarks keep the establishing image's left-to-right order. A closer or vertical framing only CROPS that view: show the part of it that is really behind the subject. Never turn the room around, invent an unseen reverse wall, mirror the set or rearrange landmarks to fill the frame.";
  return map?.sides ? `${base} Background by position: ${map.sides}.` : base;
}

/** Short form for a video prompt / opening frame. */
export function setMapBrief(map: SetMap | null, max = 360): string {
  if (!map) return "";
  const list = map.placements
    .filter((p) => p.position !== "as described")
    .map((p) => `${p.item} ${p.position}`)
    .join("; ");
  if (!list) return "";
  const out = `Set map: ${list}`;
  if (out.length <= max) return out;
  const cut = out.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(";"), 0)) || cut;
}
