// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 10 — SEMANTIC VALIDATION GATE (deterministic, comprehensive)
//
// The 10-layer Context-Locked DNA system (src/lib/laws/contextDna.ts) demands a
// "VALIDATION GATE" that checks every scene against the locked world before
// output. Until now that gate lived only as prose inside the system prompt — the
// only runtime check (`validateOutput` in ai-engine.ts) verifies JSON *shape*,
// never *meaning*.
//
// This module is that missing gate. It is 100% DETERMINISTIC (regex + structural
// checks, no LLM), so — unlike an LLM "critic" — it is reliable, repeatable and
// unit-tested. It is the FIRST, hardest line of defence; a soft LLM critic and a
// regenerate loop are layered ON TOP later (Lớp C), never instead of this.
//
// COVERAGE — organised by the 10 DNA layers. Every check that materially affects
// the generated 10s video and can be judged reliably from the breakdown alone is
// here. Checks that need the *derived* prompt (ENV-002 background/action split,
// SYNC-001 image↔video) belong to the prompt-level gate (Lớp B); checks that need
// semantic judgement (subtle SPAT-002, prop-teleport) belong to the LLM critic.
//
// NO SCENE, CHARACTER OR VIDEO IS HARDCODED AS A DEFAULT. Every name is read
// dynamically from the breakdown; only unit-test fixtures use example names.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CharacterLock,
  StoryboardGenerationOutput,
} from "@/types";

export type SemanticSeverity = "critical" | "high" | "medium";

export interface SemanticFinding {
  /** Taxonomy code, e.g. "ENV-003". Prefix marks the DNA layer it guards. */
  code: string;
  severity: SemanticSeverity;
  scope: "project" | "segment" | "character";
  /** 1-based segment number when scope === "segment". */
  segment_number?: number;
  /** Character name when scope === "character". */
  character?: string;
  /** One-line human-readable statement of the defect. */
  message: string;
  /** The concrete tokens/values that triggered the finding. */
  evidence?: string;
}

export interface SemanticValidationReport {
  /** True when no critical or high finding survived (medium is advisory). */
  ok: boolean;
  findings: SemanticFinding[];
  counts: { critical: number; high: number; medium: number; total: number };
  /** Compact one-line digest for logs. */
  summary: string;
}

type Push = (f: SemanticFinding) => void;

// ── Small text helpers ──────────────────────────────────────────────────────
function norm(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function lc(v: unknown): string {
  return norm(v).toLowerCase();
}
function head(text: string, n = 48): string {
  return text.slice(0, n);
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

// ── Time-of-day vocab (Tầng 4) ──────────────────────────────────────────────
// Word-boundaried and specific so common words ("day", "Monday", "tonight") do
// not false-trigger. "tonight" is NOT matched by \bnight\b (preceded by "o").
const DAY_TOKENS =
  /\b(daylight|midday|noon|high noon|sunlit|sunny|sunshine|broad daylight|daytime|afternoon sun|morning sun|bright sun)\b/i;
const NIGHT_TOKENS =
  /\b(night|nighttime|midnight|moonlit|moonlight|starlit|starry|after dark|by moon)\b/i;

// ── Location category vocab (Tầng 5) ────────────────────────────────────────
// Coarse categories keep archetype flexibility (a street-food stall on an
// "urban_street" set is fine) while still catching a street set used for a
// restaurant, an office, or a coastal cliff.
interface LocationCategory {
  id: string;
  re: RegExp;
}
const LOCATION_CATEGORIES: readonly LocationCategory[] = [
  { id: "outdoor_street", re: /\b(street|road|sidewalk|alley|avenue|boulevard|market|stall|vendor|street[- ]food|curb|pavement)\b/i },
  { id: "indoor_dining", re: /\b(restaurant|diner|eatery|bistro|cafe|café|coffee shop|canteen|food court)\b/i },
  { id: "indoor_home", re: /\b(kitchen|living room|bedroom|apartment|house interior|home interior|dining room|sofa|couch|hallway|balcony)\b/i },
  { id: "indoor_office", re: /\b(office|workplace|meeting room|boardroom|cubicle|classroom|lecture hall|studio desk)\b/i },
  { id: "retail", re: /\b(shop|store|mall|boutique|supermarket|showroom|market hall)\b/i },
  { id: "nature", re: /\b(beach|cliff|coast|coastal|seaside|sea|ocean|forest|jungle|mountain|ridge|river|lake|waterfall|field|meadow|desert|park|garden|cave)\b/i },
  { id: "transit", re: /\b(car interior|inside a car|bus|train|subway|metro|airport|platform|station|taxi)\b/i },
];
function categoriesIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const c of LOCATION_CATEGORIES) if (c.re.test(text)) out.add(c.id);
  return out;
}
/** Derive the location category an environment_ref id belongs to. */
function envCategory(envRef: string): string | null {
  const words = envRef.replace(/[_-]+/g, " ");
  for (const c of LOCATION_CATEGORIES) if (c.re.test(words)) return c.id;
  return null;
}

// ── Wardrobe corruption vocab (Tầng 6) ──────────────────────────────────────
const WARDROBE_TRAILING_NUMBER = /[.,;:]?\s*\d{1,3}\s*$/;
const IDENTITY_SENTINEL = /reference_image/i;

// Combined per-segment text used by several checks.
function segmentText(seg: {
  first_frame_prompt?: string;
  motion_prompt?: string;
  title?: string;
  environment_ref?: string | null;
}): string {
  return [
    seg.first_frame_prompt,
    seg.motion_prompt,
    seg.title,
    norm(seg.environment_ref).replace(/[_-]+/g, " "),
  ]
    .map(norm)
    .filter(Boolean)
    .join(" · ");
}

// ═══════════════════════════════════════════════════════════════════════════
// STRUCTURE & DATA INTEGRITY — the payload must be complete before anything
// downstream (buildVeoJson, manifest) can render a faithful clip.
// ═══════════════════════════════════════════════════════════════════════════
function checkStructure(out: StoryboardGenerationOutput, push: Push): void {
  const segs = out.segments ?? [];

  // STRUCT-001 — a stub segment (empty start-frame or motion) renders nothing.
  for (const seg of segs) {
    if (!norm(seg.first_frame_prompt) || !norm(seg.motion_prompt)) {
      push({
        code: "STRUCT-001",
        severity: "critical",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Stub segment — first_frame_prompt or motion_prompt is empty (nothing to render).",
        evidence: `first_frame=${norm(seg.first_frame_prompt) ? "ok" : "EMPTY"}, motion=${norm(seg.motion_prompt) ? "ok" : "EMPTY"}`,
      });
    }
  }

  // STRUCT-002 — segment numbers must be a unique 1..N run (drives ordering).
  const nums = segs.map((s) => s.segment_number);
  const dupes = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dupes.length) {
    push({
      code: "STRUCT-002",
      severity: "medium",
      scope: "project",
      message: "Duplicate or non-sequential segment_number values.",
      evidence: `numbers=[${nums.join(", ")}]`,
    });
  }

  // STRUCT-003 — duration sanity + total consistency (DATA-001).
  let sum = 0;
  for (const seg of segs) {
    const d = seg.duration_seconds;
    if (isNum(d)) {
      sum += d;
      if (d < 3 || d > 20) {
        push({
          code: "STRUCT-003",
          severity: "medium",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Unusual clip duration (${d}s) — a Veo/Flow clip is ~8-10s.`,
        });
      }
    }
  }
  const total = out.total_duration_seconds;
  if (isNum(total) && sum > 0 && Math.abs(total - sum) > 1) {
    push({
      code: "STRUCT-003",
      severity: "medium",
      scope: "project",
      message: "total_duration_seconds does not match the sum of segment durations.",
      evidence: `total=${total} vs sum=${sum}`,
    });
  }

  // STRUCT-004 — beats sanity: an overloaded shot (>6 beats) forces the camera
  // to cram many framings into one take (root of CAM-001); zero beats loses the
  // action breakdown.
  for (const seg of segs) {
    const n = (seg.beats ?? []).length;
    if (norm(seg.first_frame_prompt) && n === 0) {
      push({
        code: "STRUCT-004",
        severity: "medium",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Segment has no beats — the 10s action breakdown is missing.",
      });
    } else if (n > 6) {
      push({
        code: "STRUCT-004",
        severity: "medium",
        scope: "segment",
        segment_number: seg.segment_number,
        message: `Overloaded shot: ${n} beats in one 10s clip (>6) — camera will cram too many framings.`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 1-2 — PROJECT INTENT & WORLD CONTEXT — the locked world every scene obeys.
// ═══════════════════════════════════════════════════════════════════════════
function checkWorldContext(out: StoryboardGenerationOutput, push: Push): void {
  const wc = out.world_context;
  const missing = [
    !norm(wc?.world_type) && "world_type",
    !norm(wc?.time_period) && "time_period",
    !norm(wc?.environment_category) && "environment_category",
  ].filter(Boolean);
  if (missing.length) {
    push({
      code: "WORLD-001",
      severity: "medium",
      scope: "project",
      message: "Locked world_context is missing key fields — later scenes have nothing to obey.",
      evidence: `missing: ${missing.join(", ")}`,
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 4 — TEMPORAL — time must stay locked unless a change is motivated.
// ═══════════════════════════════════════════════════════════════════════════
function checkTemporal(out: StoryboardGenerationOutput, push: Push): void {
  const worldTod = lc(out.world_context?.time_period);
  const worldIsNight = /night|midnight|evening|dusk/.test(worldTod);
  const worldIsDay = /day|noon|midday|morning|afternoon|dawn/.test(worldTod);

  const segs = out.segments ?? [];
  const perSeg: (("day" | "night" | null))[] = [];

  for (const seg of segs) {
    const text = segmentText(seg);
    const dayHit = text.match(DAY_TOKENS)?.[0];
    const nightHit = text.match(NIGHT_TOKENS)?.[0];

    // ENV-003(a) — both day AND night inside the SAME clip (physically impossible).
    if (dayHit && nightHit) {
      push({
        code: "ENV-003",
        severity: "critical",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Scene mixes conflicting time-of-day signals (day and night in one clip).",
        evidence: `day="${dayHit}" vs night="${nightHit}"`,
      });
      perSeg.push(null);
      continue;
    }
    // ENV-003(b) — a segment contradicts the locked world time period.
    if (worldIsNight && dayHit && !worldIsDay) {
      push({
        code: "ENV-003",
        severity: "critical",
        scope: "segment",
        segment_number: seg.segment_number,
        message: `Segment shows daylight but the locked world is night ("${worldTod}").`,
        evidence: `world="${worldTod}" vs scene="${dayHit}"`,
      });
    } else if (worldIsDay && nightHit && !worldIsNight) {
      push({
        code: "ENV-003",
        severity: "critical",
        scope: "segment",
        segment_number: seg.segment_number,
        message: `Segment shows night but the locked world is daytime ("${worldTod}").`,
        evidence: `world="${worldTod}" vs scene="${nightHit}"`,
      });
    }
    perSeg.push(dayHit ? "day" : nightHit ? "night" : null);
  }

  // TEMP-001 — an unexplained day↔night flip between ADJACENT clips. In 10s
  // short-form this is almost always the "night becomes day" drift, not an
  // intentional montage.
  for (let i = 1; i < segs.length; i++) {
    const a = perSeg[i - 1];
    const b = perSeg[i];
    if (a && b && a !== b) {
      push({
        code: "TEMP-001",
        severity: "high",
        scope: "segment",
        segment_number: segs[i]!.segment_number,
        message: `Time-of-day flips ${a}→${b} from the previous clip with no motivated time jump.`,
        evidence: `seg ${segs[i - 1]!.segment_number}=${a} → seg ${segs[i]!.segment_number}=${b}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 5 — ENVIRONMENT — the place must match its lock and stay put.
// ═══════════════════════════════════════════════════════════════════════════
function checkEnvironment(out: StoryboardGenerationOutput, push: Push): void {
  const segs = out.segments ?? [];
  const primaryCat: (string | null)[] = [];

  for (const seg of segs) {
    const envRef = norm(seg.environment_ref);
    const sceneText = [seg.first_frame_prompt, seg.title].map(norm).filter(Boolean).join(" · ");
    const sceneCats = categoriesIn(sceneText);
    const envCat = envRef && envRef !== "custom" ? envCategory(envRef) : null;

    // ENV-001 — the archetype belongs to a different place-category than the
    // scene text describes (e.g. urban_street_day used for a restaurant / cliff).
    if (envCat && sceneCats.size > 0 && !sceneCats.has(envCat)) {
      push({
        code: "ENV-001",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: `environment_ref archetype ("${envCat}") does not match the scene's described location.`,
        evidence: `env_ref="${envRef}" (${envCat}) vs scene=[${[...sceneCats].join(", ")}]`,
      });
    }
    primaryCat.push(envCat ?? [...sceneCats][0] ?? null);
  }

  // LOC-001 — the place changes between adjacent clips. Location changes CAN be
  // intentional, so this is advisory (medium): verify it is a real scene change,
  // not an unmotivated jump (restaurant → coastal cliff mid-conversation).
  for (let i = 1; i < segs.length; i++) {
    const a = primaryCat[i - 1];
    const b = primaryCat[i];
    if (a && b && a !== b) {
      push({
        code: "LOC-001",
        severity: "medium",
        scope: "segment",
        segment_number: segs[i]!.segment_number,
        message: `Location changes ${a}→${b} from the previous clip — verify this is an intentional scene change.`,
        evidence: `seg ${segs[i - 1]!.segment_number}=${a} → seg ${segs[i]!.segment_number}=${b}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 6 — CHARACTER & CAST — stable identity, wardrobe, and no phantoms.
// ═══════════════════════════════════════════════════════════════════════════
function checkCharacter(out: StoryboardGenerationOutput, push: Push): void {
  const locks = out.character_locks ?? [];

  // CHAR-002 — duplicate lock names (two locks for one identity → drift).
  const seen = new Map<string, number>();
  for (const l of locks) {
    const key = lc(l.name);
    if (!key) continue;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  for (const [key, n] of seen) {
    if (n > 1) {
      push({
        code: "CHAR-002",
        severity: "high",
        scope: "character",
        character: key,
        message: `Duplicate character_lock (${n} locks share this name) — identity will drift.`,
      });
    }
  }

  for (const lock of locks) {
    const name = norm(lock.name) || "(unnamed)";
    const looksHuman = !!(norm(lock.skin_tone) || norm(lock.hair) || norm(lock.eyes) || norm(lock.face_structure));

    // CHAR-001(a) — a human lock with no hard gender lock (male/female).
    if (looksHuman && lock.gender !== "male" && lock.gender !== "female") {
      push({
        code: "CHAR-001",
        severity: "high",
        scope: "character",
        character: name,
        message: "Human character has no hard gender lock (male/female).",
        evidence: `gender=${JSON.stringify((lock as CharacterLock).gender ?? null)}`,
      });
    }

    // CHAR-001(b) — empty costume: no wardrobe to keep consistent across shots.
    const costume = norm(lock.costume);
    if (!costume) {
      push({
        code: "CHAR-001",
        severity: "high",
        scope: "character",
        character: name,
        message: "character_lock.costume is empty — no wardrobe to keep consistent across shots.",
      });
    } else {
      // CHAR-001(c) — wardrobe corruption: stray trailing number / leaked sentinel.
      if (WARDROBE_TRAILING_NUMBER.test(costume)) {
        push({
          code: "CHAR-001",
          severity: "high",
          scope: "character",
          character: name,
          message: "Wardrobe text ends in a stray number token (transformation garbage).",
          evidence: `costume="…${costume.slice(-32)}"`,
        });
      }
      if (IDENTITY_SENTINEL.test(costume)) {
        push({
          code: "CHAR-001",
          severity: "high",
          scope: "character",
          character: name,
          message: "The REFERENCE_IMAGE sentinel leaked into the costume (costume must be a real outfit).",
          evidence: `costume="${head(costume)}"`,
        });
      }
    }

    // CHAR-003 — a human lock with no voice profile (Tầng 9 audio identity).
    if (looksHuman && !norm(lock.voice)) {
      push({
        code: "CHAR-003",
        severity: "medium",
        scope: "character",
        character: name,
        message: "Human character has no locked voice profile (voice will drift per clip).",
      });
    }
  }
}

function checkCast(out: StoryboardGenerationOutput, push: Push): void {
  const locks = out.character_locks ?? [];
  const lockNames = new Set(locks.map((l) => lc(l.name)).filter(Boolean));
  const everUsed = new Set<string>();

  for (const seg of out.segments ?? []) {
    const visible = (seg.characters_in_scene ?? []).map(norm).filter(Boolean);
    const visibleLc = new Set(visible.map((n) => n.toLowerCase()));
    for (const n of visibleLc) everUsed.add(n);

    // CAST-001(a) — a visible name with no lock (phantom third person).
    for (const n of visible) {
      if (!lockNames.has(n.toLowerCase())) {
        push({
          code: "CAST-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `characters_in_scene names "${n}", who has no character_lock (phantom third person risk).`,
          evidence: `known cast=[${[...lockNames].join(", ")}]`,
        });
      }
    }

    // CAST-001(b) — a named speaker who is not on screen (voiceover = "").
    const speakers = new Set<string>();
    if (norm(seg.speaker)) speakers.add(norm(seg.speaker));
    for (const turn of seg.dialogue_lines ?? []) if (norm(turn.speaker)) speakers.add(norm(turn.speaker));
    for (const sp of speakers) {
      if (!visibleLc.has(sp.toLowerCase())) {
        push({
          code: "CAST-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Speaker "${sp}" is not listed in characters_in_scene (speaker not on screen).`,
          evidence: `characters_in_scene=[${visible.join(", ")}]`,
        });
      }
    }

    // WARD-001 — a wardrobe change targets someone not visible in this segment.
    for (const w of seg.wardrobe_state ?? []) {
      const who = norm(w?.character);
      if (who && !visibleLc.has(who.toLowerCase())) {
        push({
          code: "WARD-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `wardrobe_state changes "${who}" who is not in this segment's cast.`,
          evidence: `characters_in_scene=[${visible.join(", ")}]`,
        });
      }
    }
  }

  // CAST-002 — a locked character that never appears in any scene (a declared
  // extra the model may inject as a phantom).
  for (const l of locks) {
    const key = lc(l.name);
    if (key && !everUsed.has(key)) {
      push({
        code: "CAST-002",
        severity: "medium",
        scope: "character",
        character: norm(l.name),
        message: "Character is locked but never appears in any characters_in_scene (unused declared cast).",
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 8 — MOTION & CONTINUITY — positions locked; clips chain seamlessly.
// ═══════════════════════════════════════════════════════════════════════════
function checkContinuity(out: StoryboardGenerationOutput, push: Push): void {
  const segs = out.segments ?? [];
  segs.forEach((seg, i) => {
    // SPAT-001 — a multi-character scene without a spatial map (chair/side swaps).
    const visible = (seg.characters_in_scene ?? []).map(norm).filter(Boolean);
    if (visible.length >= 2 && !norm(seg.spatial_layout?.character_placement)) {
      push({
        code: "SPAT-001",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: `Multi-character scene (${visible.length} people) has no spatial_layout.character_placement — positions are unlocked.`,
        evidence: `characters_in_scene=[${visible.join(", ")}]`,
      });
    }
    // CONT-001 — a chained clip (not the first) with no continuity note has no
    // declared seam to the previous clip.
    if (i > 0 && !norm(seg.continuity_note)) {
      push({
        code: "CONT-001",
        severity: "medium",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Chained clip has no continuity_note linking it to the previous clip's end state.",
      });
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 10 — AUDIO / DIALOGUE — spoken turns must fit and sync inside the clip.
// ═══════════════════════════════════════════════════════════════════════════
function checkDialogue(out: StoryboardGenerationOutput, push: Push): void {
  for (const seg of out.segments ?? []) {
    const turns = seg.dialogue_lines ?? [];
    if (turns.length === 0) continue;
    const dur = isNum(seg.duration_seconds) ? seg.duration_seconds : 10;
    let prevEnd = -Infinity;
    turns.forEach((t, idx) => {
      const s = t.start_s;
      const e = t.end_s;
      if (!isNum(s) || !isNum(e)) return; // timing optional on some turns
      const problems: string[] = [];
      if (s < 0 || e > dur + 0.01) problems.push(`outside 0-${dur}s`);
      if (s >= e) problems.push("start ≥ end");
      if (s < prevEnd - 0.01) problems.push("overlaps the previous turn");
      if (problems.length) {
        push({
          code: "DLG-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Dialogue turn ${idx + 1} has invalid timing (${problems.join("; ")}).`,
          evidence: `start_s=${s}, end_s=${e}, clip=${dur}s`,
        });
      }
      prevEnd = Math.max(prevEnd, e);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run every deterministic semantic check over a finished breakdown and return a
 * report. Pure — never throws, never mutates the input. `ok` is false when any
 * critical or high finding is present so a caller can later gate on it.
 */
export function validateStoryboardSemantics(
  output: StoryboardGenerationOutput
): SemanticValidationReport {
  const findings: SemanticFinding[] = [];
  const push: Push = (f) => findings.push(f);

  checkStructure(output, push);
  checkWorldContext(output, push);
  checkTemporal(output, push);
  checkEnvironment(output, push);
  checkCharacter(output, push);
  checkCast(output, push);
  checkContinuity(output, push);
  checkDialogue(output, push);

  // Stable ordering: severity first, then segment number, then code.
  const rank: Record<SemanticSeverity, number> = { critical: 0, high: 1, medium: 2 };
  findings.sort(
    (a, b) =>
      rank[a.severity] - rank[b.severity] ||
      (a.segment_number ?? 0) - (b.segment_number ?? 0) ||
      a.code.localeCompare(b.code)
  );

  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    total: findings.length,
  };
  const ok = counts.critical === 0 && counts.high === 0;
  const summary = ok
    ? findings.length
      ? `semantic gate: clean (no critical/high; ${counts.medium} advisory)`
      : "semantic gate: clean"
    : `semantic gate: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium`;

  return { ok, findings, counts, summary };
}

/** Render a report as compact log lines (one per finding). */
export function formatSemanticReport(report: SemanticValidationReport): string {
  if (report.findings.length === 0) return "✅ semantic gate: no issues found";
  const lines = report.findings.map((f) => {
    const where =
      f.scope === "segment"
        ? ` [seg ${f.segment_number}]`
        : f.scope === "character"
          ? ` [${f.character}]`
          : "";
    const ev = f.evidence ? ` — ${f.evidence}` : "";
    return `  ${f.severity.toUpperCase().padEnd(8)} ${f.code}${where}: ${f.message}${ev}`;
  });
  return `⚠️ ${report.summary}\n${lines.join("\n")}`;
}
