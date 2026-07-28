// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 10 — SEMANTIC VALIDATION GATE
//
// The 10-layer Context-Locked DNA system (src/lib/laws/contextDna.ts) demands a
// "VALIDATION GATE" that checks every scene against the locked world before
// output. Until now that gate lived only as prose inside the system prompt — the
// only runtime check (`validateOutput` in ai-engine.ts) verifies JSON *shape*,
// never *meaning*. So a breakdown that flips day↔night, jumps location, ships a
// character with no gender lock, or drops the spatial map still passes.
//
// This module is that missing gate: pure, side-effect free, and framed around
// the error taxonomy from the 2026-07-26 diagnosis (ENV-001/003, SPAT-001,
// CHAR-001, CAST-001). It operates on the model's raw StoryboardGenerationOutput
// — the single source every downstream step (buildVeoJson, buildNanoFlowManifest)
// consumes — so one violation caught here prevents the same drift in both the
// Veo prompt and the Nano Flow keyframe.
//
// STEP 1 SCOPE (this file): five high-signal, breakdown-level checks in
// REPORT-ONLY mode (nothing is blocked yet). Enforcement (fail-closed) and the
// derived-clip checks (ENV-002 background/action separation, SPAT-002 start/end
// contradiction, SYNC-001 Veo↔nanoflow) come in a later increment once we have
// validated this against real packages.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CharacterLock,
  StoryboardGenerationOutput,
} from "@/types";

export type SemanticSeverity = "critical" | "high" | "medium";

export interface SemanticFinding {
  /** Taxonomy code from the diagnosis, e.g. "ENV-003". */
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

// ── Small text helpers ──────────────────────────────────────────────────────
function norm(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function lc(v: unknown): string {
  return norm(v).toLowerCase();
}
/** First N chars of the setting portion — enough to read the opening clause. */
function head(text: string, n = 160): string {
  return text.slice(0, n);
}

// ── Time-of-day vocab (ENV-003) ─────────────────────────────────────────────
// Word-boundaried and specific so common words ("day", "Monday", "tonight") do
// not false-trigger. "tonight" is NOT matched by \bnight\b (preceded by "o").
const DAY_TOKENS =
  /\b(daylight|midday|noon|high noon|sunlit|sunny|sunshine|broad daylight|daytime|afternoon sun|morning sun|bright sun)\b/i;
const NIGHT_TOKENS =
  /\b(night|nighttime|midnight|moonlit|moonlight|starlit|starry|after dark|by moon)\b/i;

// ── Location category vocab (ENV-001) ───────────────────────────────────────
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

// ── Wardrobe corruption vocab (CHAR-001) ────────────────────────────────────
// A stray trailing number ("...crystal drop earrings. 2") or a leaked sentinel
// is transformation garbage, not appearance — the model should never guess it.
const WARDROBE_TRAILING_NUMBER = /[.,;:]?\s*\d{1,3}\s*$/;
const IDENTITY_SENTINEL = /reference_image/i;

// ── Individual checks ───────────────────────────────────────────────────────

/** ENV-003 — a single scene carries contradictory time-of-day signals, or a
 * segment contradicts the locked world_context.time_period. Root cause of the
 * "night becomes day" drift. */
function checkDayNightConflict(
  out: StoryboardGenerationOutput,
  push: (f: SemanticFinding) => void
): void {
  const worldTod = lc(out.world_context?.time_period);
  const worldIsNight = /night|midnight|evening|dusk/.test(worldTod);
  const worldIsDay = /day|noon|midday|morning|afternoon|dawn/.test(worldTod);

  for (const seg of out.segments ?? []) {
    const text = [
      seg.first_frame_prompt,
      seg.motion_prompt,
      seg.title,
      norm(seg.environment_ref).replace(/[_-]+/g, " "),
    ]
      .map(norm)
      .filter(Boolean)
      .join(" · ");
    if (!text) continue;

    const dayHit = text.match(DAY_TOKENS)?.[0];
    const nightHit = text.match(NIGHT_TOKENS)?.[0];

    // (a) both day AND night inside the same scene.
    if (dayHit && nightHit) {
      push({
        code: "ENV-003",
        severity: "critical",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Scene mixes conflicting time-of-day signals (day and night in one clip).",
        evidence: `day="${dayHit}" vs night="${nightHit}"`,
      });
      continue;
    }
    // (b) a segment contradicts the locked world time period.
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
  }
}

/** ENV-001 — the segment's environment_ref archetype belongs to a different
 * place-category than the location the scene text actually describes (e.g.
 * `urban_street_day` used for a restaurant or a coastal cliff). */
function checkEnvironmentMismatch(
  out: StoryboardGenerationOutput,
  push: (f: SemanticFinding) => void
): void {
  for (const seg of out.segments ?? []) {
    const envRef = norm(seg.environment_ref);
    if (!envRef || envRef === "custom") continue; // nothing to lock against
    const envCat = envCategory(envRef);
    if (!envCat) continue; // unknown archetype → cannot judge

    const sceneText = [seg.first_frame_prompt, seg.title].map(norm).filter(Boolean).join(" · ");
    const sceneCats = categoriesIn(sceneText);
    if (sceneCats.size === 0) continue; // no explicit place noun → cannot judge
    if (sceneCats.has(envCat)) continue; // archetype agrees with the scene

    push({
      code: "ENV-001",
      severity: "high",
      scope: "segment",
      segment_number: seg.segment_number,
      message: `environment_ref archetype ("${envCat}") does not match the scene's described location.`,
      evidence: `env_ref="${envRef}" (${envCat}) vs scene=[${[...sceneCats].join(", ")}]`,
    });
  }
}

/** SPAT-001 — a scene with two or more visible characters ships without a
 * spatial map, so left/right, chair and facing are unlocked (chair/side swaps). */
function checkMissingTopology(
  out: StoryboardGenerationOutput,
  push: (f: SemanticFinding) => void
): void {
  for (const seg of out.segments ?? []) {
    const visible = (seg.characters_in_scene ?? []).map(norm).filter(Boolean);
    if (visible.length < 2) continue;
    const placement = norm(seg.spatial_layout?.character_placement);
    if (placement) continue;
    push({
      code: "SPAT-001",
      severity: "high",
      scope: "segment",
      segment_number: seg.segment_number,
      message: `Multi-character scene (${visible.length} people) has no spatial_layout.character_placement — positions are unlocked.`,
      evidence: `characters_in_scene=[${visible.join(", ")}]`,
    });
  }
}

/** CHAR-001 — a character_lock is missing a hard gender lock, has an empty
 * costume, or carries wardrobe garbage (stray trailing number / leaked
 * sentinel). Root cause of gender=Unspecified and "earrings. 2". */
function checkCharacterHygiene(
  out: StoryboardGenerationOutput,
  push: (f: SemanticFinding) => void
): void {
  for (const lock of out.character_locks ?? []) {
    const name = norm(lock.name) || "(unnamed)";
    const looksHuman = !!(norm(lock.skin_tone) || norm(lock.hair) || norm(lock.eyes) || norm(lock.face_structure));

    // (a) gender not locked to male/female on a human lock.
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

    // (b) empty costume — every character must carry one context outfit.
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
      // (c) wardrobe corruption: stray trailing number or leaked identity sentinel.
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
          evidence: `costume="${head(costume, 48)}"`,
        });
      }
    }
  }
}

/** CAST-001 — a segment lists a visible character that is not in character_locks
 * (a phantom third person), or a speaker who is not on screen. */
function checkCastConsistency(
  out: StoryboardGenerationOutput,
  push: (f: SemanticFinding) => void
): void {
  const lockNames = new Set((out.character_locks ?? []).map((l) => lc(l.name)).filter(Boolean));

  for (const seg of out.segments ?? []) {
    const visible = (seg.characters_in_scene ?? []).map(norm).filter(Boolean);
    const visibleLc = new Set(visible.map((n) => n.toLowerCase()));

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

    // The named speaker (single or per-turn) must be on screen or be voiceover ("").
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
  }
}

// ── Public entry point ──────────────────────────────────────────────────────

/**
 * Run every step-1 semantic check over a finished breakdown and return a
 * report. Pure — never throws, never mutates the input. `ok` is false when any
 * critical or high finding is present so a caller can later choose to gate on it.
 */
export function validateStoryboardSemantics(
  output: StoryboardGenerationOutput
): SemanticValidationReport {
  const findings: SemanticFinding[] = [];
  const push = (f: SemanticFinding) => findings.push(f);

  checkDayNightConflict(output, push);
  checkEnvironmentMismatch(output, push);
  checkMissingTopology(output, push);
  checkCharacterHygiene(output, push);
  checkCastConsistency(output, push);

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
    ? "semantic gate: clean"
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
