// Shared TOPIC LIBRARY (numerology / health scripts, …). Pulled from the same
// Google Sheet the thansohoc app uses. Storyboard lets the user pick a topic
// and seeds the video script from that topic's content.
//
// Sheet row schema (matches thansohoc-next `SheetMeaning`):
//   { type, number, meaning, english_meaning?, detail? }
// `type` = numerology sub-topic key, `number` = variant, `meaning` = content.
//
// Each SHEET TAB is a CONTENT CATEGORY (Thần số học, Sức khoẻ, …). We read the
// sheet two ways for reliability: Google's own gviz endpoint first, then the
// opensheet.elk.sh JSON proxy as a fallback.

export interface TopicRow {
  type?: string;
  number?: string | number;
  meaning?: string;
  english_meaning?: string;
  detail?: string;
  /** Which sheet tab (content category) this row came from. */
  _tab?: string;
}

export interface TopicItem {
  id: string;
  number: string;
  label: string; // e.g. "Đường Đời — Số 7"
  content: string; // plain-text content (HTML stripped)
}

export interface TopicCategory {
  key: string; // sheet tab name
  label: string; // friendly category label, e.g. "Thần số học"
  items: TopicItem[];
}

const DEFAULT_SHEET_ID = "1-aRNnvyv70nx_dsrEOR1_nO3l6643LjOaQh6uHm6rpE";
const DEFAULT_TAB = "Sheet1";

// A whole tab = a content category. Friendly labels for known tab names.
const TAB_LABELS: Record<string, string> = {
  Sheet1: "Thần số học",
  ThanSoHoc: "Thần số học",
  thansohoc: "Thần số học",
  SucKhoe: "Sức khoẻ",
  suckhoe: "Sức khoẻ",
};

// Friendly labels for the numerology `type` sub-topics (used in item labels).
const TYPE_LABELS: Record<string, string> = {
  lifePath: "Đường Đời",
  heartDesire: "Nội Tâm (Linh Hồn)",
  soul: "Nội Tâm (Linh Hồn)",
  missionNumber: "Sứ Mệnh",
  mission: "Sứ Mệnh",
  personalityNumber: "Nhân Cách",
  personality: "Nhân Cách",
  attitudeNumber: "Thái Độ",
  maturityNumber: "Trưởng Thành",
  birthDay: "Ngày Sinh",
  intelligenceNumber: "Trí Tuệ",
  balanceNumber: "Cân Bằng",
  subconsciousSelf: "Tiềm Thức",
  personalYear: "Năm Cá Nhân",
  peakNumbers: "Đỉnh Cao",
  challengeNumbers: "Thử Thách",
};

function stripHtml(s: string): string {
  return (s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

// ─── Google gviz JSON (Google-native, reliable) ────────────────────────────
interface GvizCell {
  v?: unknown;
  f?: string;
}
interface GvizResponse {
  table?: {
    cols?: { label?: string; id?: string }[];
    rows?: { c?: (GvizCell | null)[] }[];
  };
}

function parseGviz(text: string, tab: string): TopicRow[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let json: GvizResponse;
  try {
    json = JSON.parse(text.slice(start, end + 1)) as GvizResponse;
  } catch {
    return [];
  }
  const cols = (json.table?.cols ?? []).map((c) => String(c?.label ?? "").trim());
  const out: TopicRow[] = [];
  for (const r of json.table?.rows ?? []) {
    const cells = r?.c ?? [];
    const obj: Record<string, unknown> = { _tab: tab };
    cols.forEach((label, i) => {
      if (!label) return;
      const cell = cells[i];
      obj[label] = cell?.v ?? cell?.f ?? "";
    });
    out.push(obj as TopicRow);
  }
  return out;
}

async function fetchTab(sheetId: string, tab: string): Promise<TopicRow[]> {
  // 1) Google gviz JSON (native, no third-party proxy).
  try {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(tab)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const rows = parseGviz(await res.text(), tab);
      if (rows.length) return rows;
    }
  } catch {
    /* fall through to opensheet */
  }
  // 2) opensheet.elk.sh JSON proxy (clean header-keyed array).
  try {
    const url = `https://opensheet.elk.sh/${sheetId}/${encodeURIComponent(tab)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = (await res.json()) as unknown;
      if (Array.isArray(data)) return (data as TopicRow[]).map((r) => ({ ...r, _tab: tab }));
    }
  } catch {
    /* both failed */
  }
  return [];
}

/**
 * Reads the topic sheet(s). Supports MULTIPLE tabs (one per content category)
 * via TOPICS_SHEET_TABS (comma-separated) — add tabs and set the env, no code
 * change needed.
 */
export async function fetchTopicRows(): Promise<TopicRow[]> {
  const sheetId = process.env.TOPICS_SHEET_ID || DEFAULT_SHEET_ID;
  const tabs = (process.env.TOPICS_SHEET_TABS || process.env.TOPICS_SHEET_TAB || DEFAULT_TAB)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const perTab = await Promise.all(tabs.map((tab) => fetchTab(sheetId, tab)));
  const rows = perTab.flat();
  if (rows.length === 0) {
    throw new Error("Kho chủ đề trống hoặc không đọc được (kiểm tra Sheet công khai + TOPICS_SHEET_ID/TABS).");
  }
  return rows;
}

/** Groups rows into content categories (by tab) → items for the dropdowns. */
export function buildTopicLibrary(rows: TopicRow[]): TopicCategory[] {
  const byTab = new Map<string, TopicCategory>();
  for (const r of rows) {
    const tab = String(r._tab ?? DEFAULT_TAB).trim() || DEFAULT_TAB;
    const content = stripHtml(String(r.meaning ?? ""));
    if (!content) continue;
    const type = String(r.type ?? "").trim();
    const number = String(r.number ?? "").trim();
    const typeLabel = TYPE_LABELS[type] ?? type;
    const itemLabel = number
      ? `${typeLabel ? typeLabel + " — " : ""}Số ${number}`
      : typeLabel || String(r.detail ?? "").trim() || "Mục";
    if (!byTab.has(tab)) {
      byTab.set(tab, { key: tab, label: TAB_LABELS[tab] ?? tab, items: [] });
    }
    const cat = byTab.get(tab)!;
    cat.items.push({ id: `${tab}:${type}:${number}:${cat.items.length}`, number, label: itemLabel, content });
  }
  const cats = Array.from(byTab.values());
  cats.sort((a, b) => a.label.localeCompare(b.label, "vi"));
  return cats;
}
