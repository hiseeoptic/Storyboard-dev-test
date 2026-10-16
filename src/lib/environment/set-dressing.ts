// ============================================================
// SET DRESSING LOCK — what stands on the table (and around it) in a shot, so
// the image and video models cannot add a plate in one frame and drop it in
// the next, or rearrange the furniture between shots.
//
// The inventory comes from the Production State: the objects of this shot's
// start snapshot, plus static set items of the same location that the script
// only names later (a napkin "at Lan's place setting" was on the table from
// the start, even though shot 3 is the first to mention it), plus items the
// previous shot left in place. Everything else is forbidden on the table.
// ============================================================

interface EntityLike {
  entity_id: string;
  kind: string;
  state?: string | null;
  position?: string | null;
  holder_entity_id?: string | null;
}
interface ShotLike {
  location_id: string | null;
  start_snapshot: { entities: EntityLike[] };
  end_snapshot?: { entities: EntityLike[] };
  changes?: Array<{ entity_id: string; from?: string | null; action?: string | null }>;
}
interface RegistryLike {
  entity_id: string;
  display_name: string;
  kind: string;
}

export interface DressingItem {
  id: string;
  label: string;
  state: string;
  position: string;
  zone: "table" | "held" | "set";
}

const OBJECT_KINDS = new Set(["object", "product", "prop"]);
/** Resting ON a surface — "beside the table" is not on it. */
const ON_TABLE = /\b(?:on|atop|across)\s+(?:the\s+)?(?:[\p{L}'’-]+\s+){0,2}(?:table|counter|desk|tray)\b|\btabletop\b|\bplace setting\b/iu;
const FURNITURE = /\b(?:chair|stool|bench|sofa|couch|armchair|table|cabinet|rug|carpet|mat)\b/i;
const ARRIVES = /\b(?:absent|not (?:yet )?present|off[- ]?screen|outside|brought|arrives|delivered|served|carried in)\b/i;

/** "menu_Minh" → "Minh's menu", "rug_edge" → "rug edge", "prop_chair" → "chair". */
function itemLabel(entry: RegistryLike | undefined, id: string, characterNames: string[]): string {
  const raw = (entry?.display_name || id.replace(/^(?:obj|prop|product)_/, "")).replace(/^prop_/, "");
  const parts = raw.split(/[_\s]+/).filter(Boolean);
  const owner = parts.length > 1 ? characterNames.find((n) => n.toLowerCase() === parts[parts.length - 1]!.toLowerCase()) : undefined;
  const thing = (owner ? parts.slice(0, -1) : parts).join(" ").toLowerCase();
  return owner ? `${owner}'s ${thing}` : thing;
}

const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** The objects that must be visible, where, at the start of shot `index`. */
export function setDressingFor(shots: ShotLike[], index: number, registry: RegistryLike[]): DressingItem[] {
  const shot = shots[index];
  if (!shot) return [];
  const byId = new Map(registry.map((r) => [r.entity_id, r]));
  const characterNames = registry.filter((r) => r.kind === "character").map((r) => r.display_name);
  const isObject = (e: EntityLike) => OBJECT_KINDS.has(e.kind);
  const chosen = new Map<string, EntityLike>();
  for (const e of shot.start_snapshot.entities.filter(isObject)) chosen.set(e.entity_id, e);

  const sameLocation = (s: ShotLike) => (s.location_id ?? "") === (shot.location_id ?? "");
  // What the previous shot here left behind stays, unless the script dropped it silently.
  const previous = index > 0 ? shots[index - 1] : undefined;
  if (previous && sameLocation(previous)) {
    for (const e of (previous.end_snapshot?.entities ?? []).filter(isObject)) {
      if (!chosen.has(e.entity_id)) chosen.set(e.entity_id, e);
    }
  }
  // Static table items named only later were there all along.
  for (let j = index + 1; j < shots.length; j++) {
    const later = shots[j]!;
    if (!sameLocation(later)) break;
    for (const e of later.start_snapshot.entities.filter(isObject)) {
      if (chosen.has(e.entity_id) || e.holder_entity_id || !ON_TABLE.test(clean(e.position))) continue;
      const broughtIn = shots
        .slice(index, j + 1)
        .some((s) => (s.changes ?? []).some((c) => c.entity_id === e.entity_id && ARRIVES.test(`${c.from ?? ""} ${c.action ?? ""}`)));
      if (!broughtIn) chosen.set(e.entity_id, e);
    }
  }

  return [...chosen.values()].map((e) => {
    const position = clean(e.position);
    const holder = e.holder_entity_id ? byId.get(e.holder_entity_id) : undefined;
    const label = itemLabel(byId.get(e.entity_id), e.entity_id, characterNames);
    // Furniture stays furniture even while someone grips it; a touched napkin
    // still lies on the table.
    const zone: DressingItem["zone"] = FURNITURE.test(label)
      ? "set"
      : ON_TABLE.test(position)
        ? "table"
        : holder?.kind === "character"
          ? "held"
          : "set";
    return {
      id: e.entity_id,
      label,
      state: clean(e.state),
      position: holder?.kind === "character" && !position ? `held by ${holder.display_name}` : position.replace(/^\p{Lu}(?=\p{Ll})/u, (c) => c.toLowerCase()),
      zone,
    };
  });
}

/** Keyframe / video text for the inventory. Empty when the shot has no objects. */
export function setDressingLock(items: DressingItem[], opts: { interior?: boolean } = {}): string {
  const describe = (i: DressingItem) => `${i.label}${i.state ? ` (${i.state.toLowerCase()}` : ""}${i.position ? `${i.state ? ", " : " ("}${i.position}` : ""}${i.state || i.position ? ")" : ""}`;
  const groups = [
    ["on the table", items.filter((i) => i.zone === "table")],
    ["in the set", items.filter((i) => i.zone === "set")],
    ["held", items.filter((i) => i.zone === "held")],
  ] as const;
  const listed = groups
    .filter(([, list]) => list.length)
    .map(([where, list]) => `${where} — ${list.map(describe).join("; ")}`)
    .join(". ");
  const furniture = opts.interior !== false
    ? " The table keeps its shape, size and place, and the chairs keep the establishing image's number, positions and facing; a chair moves only when a character visibly moves it."
    : "";
  if (!listed) return furniture ? `FURNITURE LOCK:${furniture}` : "";
  return `SET DRESSING LOCK (identical through the whole clip and in every shot at this place; only a visible hand changes it): ${listed}. Nothing else stands on the table — no added plates, glasses, cutlery, candles, vases, bottles or food — and no listed item vanishes, duplicates, changes colour or jumps to another place unless the action moves it by hand.${furniture}`;
}
