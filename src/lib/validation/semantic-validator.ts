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
// unit-tested. It is the FIRST, hardest line of defence; the bounded Lớp-C
// critic/targeted-repair loop is layered ON TOP, never instead of this.
//
// COVERAGE — organised by the 10 DNA layers. Every check that materially affects
// the generated 10s video and can be judged reliably from the breakdown alone is
// here. Checks that need the *derived* prompt (ENV-002 background/action split,
// SYNC-001 image↔video) belong to the prompt-level gate (Lớp B); checks that need
// semantic judgement (subtle SPAT-002, prop-teleport) belongs to the LLM critic.
//
// NO SCENE, CHARACTER OR VIDEO IS HARDCODED AS A DEFAULT. Every name is read
// dynamically from the breakdown; only unit-test fixtures use example names.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CharacterLock,
  StoryboardGenerationOutput,
} from "@/types";
import { relationalEntityState } from "../storyboard/state-ledger.ts";

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

const TRANSITION_MODES = new Set([
  "opening",
  "continuous",
  "scene_cut",
  "location_cut",
  "time_jump",
  "parallel_intercut",
  "match_cut",
  "montage",
  "flashback",
  "dream",
  "symbolic",
]);

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
function sameState(a: unknown, b: unknown): boolean {
  return lc(a).replace(/\s+/g, " ") === lc(b).replace(/\s+/g, " ");
}

// ── Tolerant descriptor matching (STATE-003 / STATE-004 / STATE-008) ─────────
// A ledger's state/position/orientation is FREE TEXT the model writes twice —
// once as a change's to_* field, once in the end snapshot — so pure wording
// drift is normal ("facing into room" vs "facing room", "gaze lowered" vs "head
// lowered", "warm, steaming" vs "warm, slowly steaming", "sofa" vs "sofa beside
// Minh"). Exact-string equality reported all of that as a causality error and
// buried the real ones. We compare by SIGNIFICANT-TOKEN overlap instead: two
// descriptors are compatible when one merely adds detail (containment) or they
// share most core words. A genuine teleport ("doorway" → "kitchen") shares no
// tokens and is STILL flagged, so real causality breaks survive untouched.
const DESCRIPTOR_STOPWORDS = new Set([
  "a", "an", "the", "and", "of", "to", "into", "in", "on", "at", "near", "by",
  "with", "from", "her", "his", "its", "their", "him", "she", "he", "them",
  "slightly", "slowly", "gently", "softly", "carefully", "deliberately",
  "smoothly", "quietly", "calmly", "visibly", "gradually", "further", "still",
  "now", "then", "little", "bit", "very", "somewhat", "almost", "controlled",
  "measured", "steady", "steadily", "tender", "tenderly", "slight", "small",
]);
function descriptorTokens(v: unknown): Set<string> {
  return new Set(
    lc(v)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t && !DESCRIPTOR_STOPWORDS.has(t))
  );
}
/** True when two free-text descriptors mean the same place/pose modulo wording:
 * exact match, one contains the other's core tokens, or ≥50% shared core tokens. */
function compatibleDescriptor(a: unknown, b: unknown): boolean {
  if (sameState(a, b)) return true;
  const A = descriptorTokens(a);
  const B = descriptorTokens(b);
  if (A.size === 0 || B.size === 0) return true; // one side unspecified → no conflict
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  if (inter === A.size || inter === B.size) return true; // containment (one adds detail)
  return inter / Math.min(A.size, B.size) >= 0.5; // strong overlap
}
/** Holder conflicts ONLY when both name a real, DIFFERENT holder. Picking up or
 * putting down (none ↔ someone) is a natural transition prose routinely omits,
 * so it must not be reported as an end-snapshot contradiction. */
function holderConflict(expected: unknown, actual: unknown): boolean {
  const e = lc(expected);
  const a = lc(actual);
  if (!e || !a || e === "none" || a === "none") return false;
  return !compatibleDescriptor(e, a);
}
function mentionsExactName(value: unknown, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return new RegExp(
      `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
      "iu"
    ).test(norm(value));
  } catch {
    return lc(value).includes(name.toLocaleLowerCase());
  }
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
    const transition = segs[i]!.transition_in;
    const explicitlyEdited =
      transition && transition.mode !== "continuous" && transition.mode !== "opening";
    if (a && b && a !== b && !explicitlyEdited) {
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
    const transition = segs[i]!.transition_in;
    const declaredLocationChange =
      transition &&
      transition.mode !== "continuous" &&
      transition.from_location_id !== transition.to_location_id;
    if (a && b && a !== b && !declaredLocationChange) {
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
// CONTEXT IR CONTRACT — project-local locations, edit boundaries and compact
// entity state are typed authorities. New Context IR projects fail closed;
// legacy projects remain readable and are validated only when fields exist.
// ═══════════════════════════════════════════════════════════════════════════
function checkContextContracts(out: StoryboardGenerationOutput, push: Push): void {
  const context = out.context_ir;
  const segs = out.segments ?? [];
  const locations = new Set(
    context?.layers.environment.locations.map((location) => location.id) ?? []
  );
  const profile = context?.reality_profile;
  const maxTracked = profile?.salience_policy.max_high_fidelity_entities_per_clip ?? 6;
  const usesSegmentContracts = context?.segment_contract_version === "1.0";
  // Per-location memory survives intervening clips. This is essential for
  // parallel intercuts (home ↔ office ↔ home), where adjacency alone would
  // forget the last physical state at the location being revisited.
  const latestEndByLocation = new Map<
    string,
    Map<string, NonNullable<(typeof segs)[number]["state_ledger"]>["end"][number]>
  >();

  if (usesSegmentContracts) {
    if (out.schema_version !== "4.0") {
      push({
        code: "SCHEMA-001",
        severity: "high",
        scope: "project",
        message: "Context IR output must declare storyboard schema_version 4.0.",
        evidence: `schema_version=${out.schema_version ?? "missing"}`,
      });
    }
    if (profile?.fidelity !== "E_cinematic_simulation") {
      push({
        code: "REAL-001",
        severity: "high",
        scope: "project",
        message: "Final Context IR is not locked to Reality E cinematic simulation.",
        evidence: `fidelity=${profile?.fidelity ?? "missing"}`,
      });
    }
    if (maxTracked < 3 || maxTracked > 6) {
      push({
        code: "REAL-002",
        severity: "high",
        scope: "project",
        message: "High-fidelity entity budget must be between 3 and 6.",
        evidence: `max=${maxTracked}`,
      });
    }
    if (
      context?.layers.audio_validation?.post_render_policy !==
      "report_only_no_auto_regeneration"
    ) {
      push({
        code: "QA-001",
        severity: "high",
        scope: "project",
        message: "Post-render policy must report defects without automatic regeneration.",
      });
    }
  }

  segs.forEach((seg, index) => {
    const locationId = norm(seg.location_id);
    const transition = seg.transition_in;
    const continuityMode = seg.continuity_mode;
    const ledger = seg.state_ledger;
    const contractRequired = usesSegmentContracts;

    if (contractRequired && !locationId) {
      push({
        code: "LOC-002",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Context IR segment has no project-local location_id.",
      });
    } else if (locationId && locations.size > 0 && !locations.has(locationId)) {
      push({
        code: "LOC-002",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Segment location_id is not declared in Context IR.",
        evidence: `location_id=${locationId}`,
      });
    }

    if (contractRequired && !transition) {
      push({
        code: "TRANS-001",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Context IR segment has no transition_in contract.",
      });
    } else if (transition) {
      if (contractRequired && !continuityMode) {
        push({
          code: "TRANS-005",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "Schema 4.0 segment has no continuity_mode.",
        });
      } else if (continuityMode && continuityMode !== transition.mode) {
        push({
          code: "TRANS-005",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "continuity_mode disagrees with transition_in.mode.",
          evidence: `continuity_mode=${continuityMode}, transition_in.mode=${transition.mode}`,
        });
      }
      if (!TRANSITION_MODES.has(transition.mode)) {
        push({
          code: "TRANS-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "transition_in.mode is unsupported.",
          evidence: `mode=${transition.mode}`,
        });
      }
      if (index === 0 && transition.mode !== "opening") {
        push({
          code: "TRANS-002",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "The first segment must enter with transition mode opening.",
        });
      }
      if (index > 0 && transition.mode === "opening") {
        push({
          code: "TRANS-002",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "Only the first segment may use transition mode opening.",
        });
      }
      if (locationId && transition.to_location_id !== locationId) {
        push({
          code: "TRANS-003",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "transition_in.to_location_id disagrees with segment.location_id.",
          evidence: `to=${transition.to_location_id}, segment=${locationId}`,
        });
      }
      const previous = segs[index - 1];
      if (
        previous &&
        transition.from_location_id &&
        previous.location_id &&
        transition.from_location_id !== previous.location_id
      ) {
        push({
          code: "TRANS-003",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "transition_in.from_location_id disagrees with the previous segment.",
          evidence: `from=${transition.from_location_id}, previous=${previous.location_id}`,
        });
      }
      if (
        previous &&
        transition.mode === "continuous" &&
        previous.location_id &&
        locationId &&
        previous.location_id !== locationId
      ) {
        push({
          code: "TRANS-004",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "A continuous transition cannot silently change physical location.",
          evidence: `${previous.location_id} -> ${locationId}`,
        });
      }
    }

    if (contractRequired && !ledger) {
      push({
        code: "STATE-001",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "Context IR segment has no structured state_ledger.",
      });
      return;
    }
    if (!ledger) return;

    const startEntries = Array.isArray(ledger.start) ? ledger.start : [];
    const changeEntries = Array.isArray(ledger.changes) ? ledger.changes : [];
    const endEntries = Array.isArray(ledger.end) ? ledger.end : [];
    const ids = new Set([
      ...startEntries.map((entry) => entry.entity_id),
      ...changeEntries.map((entry) => entry.entity_id),
      ...endEntries.map((entry) => entry.entity_id),
    ].filter(Boolean));
    const characterIds = new Set(
      (out.character_locks ?? []).flatMap((lock) =>
        [lock.character_id, lock.display_name, lock.name].map(lc).filter(Boolean)
      )
    );
    // The high-fidelity budget concerns active story entities, not every static
    // piece of furniture copied into a compatibility ledger. Count characters,
    // changed entities and held/manipulated objects. Static doors, tables,
    // chairs and set dressing remain available in the ledger without falsely
    // consuming the 3–6 primary simulation slots.
    const activeIds = new Set<string>();
    const declaredSalience = new Set(
      [
        ...(profile?.salience_policy.hero_entities ?? []),
        ...(profile?.salience_policy.interaction_entities ?? []),
      ].map(lc).filter(Boolean)
    );
    const isDeclaredHighFidelity = (id: string) => declaredSalience.has(lc(id));
    for (const id of ids) {
      if (characterIds.has(lc(id)) || isDeclaredHighFidelity(id)) activeIds.add(id);
    }
    // Older Context IR did not declare salience ids. Preserve that compatibility
    // behaviour. New Context IR already owns this budget, so a simple graphic
    // prop remains tracked without being miscounted as another hero entity.
    if (declaredSalience.size === 0) {
      for (const change of changeEntries) activeIds.add(change.entity_id);
      for (const entry of [...startEntries, ...endEntries]) {
        if (norm(entry.holder)) activeIds.add(entry.entity_id);
      }
    }
    if (activeIds.size > maxTracked || activeIds.size > 6) {
      push({
        code: "STATE-002",
        severity: "high",
        scope: "segment",
        segment_number: seg.segment_number,
        message: "State ledger exceeds the approved 3-6 high-fidelity entity budget.",
        evidence: `active_tracked=${activeIds.size}, declared_total=${ids.size}, max=${Math.min(6, maxTracked)}`,
      });
    }

    const start = new Map(startEntries.map((entry) => [entry.entity_id, entry]));
    const end = new Map(endEntries.map((entry) => [entry.entity_id, entry]));
    const current = new Map(
      startEntries.map((entry) => [
        entry.entity_id,
        {
          state: entry.state,
          position: entry.position,
          holder: norm(entry.holder),
          orientation: norm(entry.orientation),
        },
      ])
    );
    for (const entry of [...startEntries, ...endEntries]) {
      if (relationalEntityState(entry.state)) {
        push({
          code: "STATE-007",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Tracked entity "${entry.entity_id}" puts location/contact/possession inside intrinsic state.`,
          evidence: `state=${entry.state}; use position/holder instead`,
        });
      }
    }
    for (const change of changeEntries) {
      const before = current.get(change.entity_id);
      if (!before || !compatibleDescriptor(before.state, change.from)) {
        push({
          code: "STATE-003",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `State change for "${change.entity_id}" does not start from its current state.`,
          evidence: `ledger=${before?.state ?? "missing"} vs change.from=${change.from}`,
        });
      }
      if (
        relationalEntityState(change.from) ||
        relationalEntityState(change.to)
      ) {
        push({
          code: "STATE-007",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `State change for "${change.entity_id}" mixes position/contact/holder into from/to.`,
          evidence: `${change.from} -> ${change.to}`,
        });
      }
      if (
        before &&
        ((norm(change.from_position) &&
          !compatibleDescriptor(before.position, change.from_position)) ||
          (change.from_holder !== undefined &&
            holderConflict(before.holder, change.from_holder)) ||
          (change.from_orientation !== undefined &&
            norm(change.from_orientation) &&
            !compatibleDescriptor(before.orientation, change.from_orientation)))
      ) {
        push({
          code: "STATE-008",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Relational change for "${change.entity_id}" does not start from its current position/holder.`,
          evidence: `ledger=${before.position}@${before.holder || "none"}@${before.orientation || "none"} vs change=${change.from_position ?? "missing"}@${norm(change.from_holder) || "none"}@${norm(change.from_orientation) || "none"}`,
        });
      }
      // A change is "uncaused" only when it names NEITHER an action verb NOR an
      // agent. A visible action alone (or a named cause alone) is enough — the
      // old ||-rule flagged every subtle emotional beat that omitted one field.
      if (!norm(change.caused_by) && !norm(change.action)) {
        push({
          code: "CAUSE-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `State change for "${change.entity_id}" has no visible cause/action.`,
        });
      }
      current.set(change.entity_id, {
        state: change.to,
        position: norm(change.to_position) || before?.position || "",
        holder:
          change.to_holder !== undefined
            ? norm(change.to_holder)
            : before?.holder || "",
        orientation:
          change.to_orientation !== undefined
            ? norm(change.to_orientation)
            : before?.orientation || "",
      });
    }
    for (const entityId of ids) {
      const startEntry = start.get(entityId);
      const endEntry = end.get(entityId);
      if (!startEntry || !endEntry) {
        push({
          code: "STATE-004",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Tracked entity "${entityId}" is missing from the start or end snapshot.`,
        });
        continue;
      }
      const expectedEnd = current.get(entityId);
      // Compare only the PHYSICAL causality facts — where the entity ends
      // (position), who holds it (holder) and which way it faces (orientation) —
      // each matched tolerantly. The intrinsic `state` prose ("smile fading",
      // "hand dry") is descriptive mood the model words freely and is NOT a
      // causality fact, so it no longer drives a false STATE-004.
      if (
        expectedEnd &&
        (!compatibleDescriptor(expectedEnd.position, endEntry.position) ||
          holderConflict(expectedEnd.holder, endEntry.holder) ||
          !compatibleDescriptor(expectedEnd.orientation, endEntry.orientation))
      ) {
        push({
          code: "STATE-004",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `End snapshot for "${entityId}" does not match its final caused state/position/holder change.`,
          evidence: `expected=${expectedEnd.state}@${expectedEnd.position}@${expectedEnd.holder || "none"}@${expectedEnd.orientation || "none"} vs end=${endEntry.state}@${endEntry.position}@${norm(endEntry.holder) || "none"}@${norm(endEntry.orientation) || "none"}`,
        });
      }
    }

    const previous = segs[index - 1];
    if (previous?.state_ledger && transition?.mode === "continuous") {
      const previousEnd = new Map(
        (Array.isArray(previous.state_ledger.end) ? previous.state_ledger.end : [])
          .map((entry) => [entry.entity_id, entry])
      );
      for (const entry of startEntries) {
        const prior = previousEnd.get(entry.entity_id);
        // The intrinsic `state` prose is descriptive mood the model re-words
        // freely between the previous end and this start ("folded, resting" vs
        // "folded, resting smooth") — it is NOT a causality fact, so (like
        // STATE-004) it must not drive a false continuity break. Only a real
        // change of POSITION, HOLDER or ORIENTATION is a genuine pre-action
        // change; match those tolerantly.
        if (
          prior &&
          (!compatibleDescriptor(prior.position, entry.position) ||
            holderConflict(prior.holder, entry.holder) ||
            !compatibleDescriptor(prior.orientation, entry.orientation))
        ) {
          push({
            code: "STATE-005",
            severity: "high",
            scope: "segment",
            segment_number: seg.segment_number,
            message: `Continuous transition changes "${entry.entity_id}" before any visible action.`,
            evidence: `previous=${prior.state}@${prior.position} -> start=${entry.state}@${entry.position}`,
          });
        }
      }
    }

    if (locationId && transition?.mode === "parallel_intercut") {
      const remembered = latestEndByLocation.get(locationId);
      const reset = (transition.reset ?? []).join(" ").toLowerCase();
      for (const entry of startEntries) {
        const prior = remembered?.get(entry.entity_id);
        if (!prior) continue;
        const entityReset = reset.includes(entry.entity_id.toLowerCase());
        const stateChanged =
          !sameState(prior.state, entry.state) &&
          !entityReset &&
          !/\b(?:state|condition|appearance)\b/.test(reset);
        const positionChanged =
          !sameState(prior.position, entry.position) &&
          !entityReset &&
          !/\b(?:position|pose|blocking|location)\b/.test(reset);
        const holderChanged =
          norm(prior.holder) !== norm(entry.holder) &&
          !entityReset &&
          !/\b(?:holder|possession|ownership|prop)\b/.test(reset);
        const orientationChanged =
          norm(prior.orientation) !== norm(entry.orientation) &&
          !entityReset &&
          !/\b(?:orientation|rotation|facing)\b/.test(reset);
        if (
          stateChanged ||
          positionChanged ||
          holderChanged ||
          orientationChanged
        ) {
          push({
            code: "STATE-006",
            severity: "high",
            scope: "segment",
            segment_number: seg.segment_number,
            message: `Parallel intercut forgot the last state of "${entry.entity_id}" at location "${locationId}".`,
            evidence: `remembered=${prior.state}@${prior.position} -> return=${entry.state}@${entry.position}; reset=[${transition.reset.join(", ")}]`,
          });
        }
      }
    }

    if (locationId) {
      latestEndByLocation.set(
        locationId,
        new Map(endEntries.map((entry) => [entry.entity_id, entry]))
      );
    }
  });
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

    // CAST-001(b) — on-screen speech needs that person in the camera beat.
    // Named off-screen delivery is legal and stays bound to its own voice.
    const turns =
      (seg.dialogue_lines?.length ?? 0) > 0
        ? seg.dialogue_lines!
        : norm(seg.speaker)
          ? [{ speaker: norm(seg.speaker), text: norm(seg.dialogue), delivery: "on_screen" as const }]
          : [];
    for (const turn of turns) {
      const sp = norm(turn.speaker);
      const delivery =
        turn.delivery === "off_screen" || turn.delivery === "voiceover"
          ? turn.delivery
          : sp
            ? "on_screen"
            : "voiceover";
      if (delivery === "voiceover" && sp) {
        push({
          code: "CAST-003",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Voiceover turn incorrectly names "${sp}" as an on-character speaker.`,
        });
      }
      if (delivery === "off_screen" && !sp) {
        push({
          code: "CAST-003",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: "Named off-screen delivery has no speaker identity.",
        });
      }
      if (delivery === "on_screen" && sp && !visibleLc.has(sp.toLowerCase())) {
        push({
          code: "CAST-001",
          severity: "high",
          scope: "segment",
          segment_number: seg.segment_number,
          message: `Speaker "${sp}" is not listed in characters_in_scene (speaker not on screen).`,
          evidence: `characters_in_scene=[${visible.join(", ")}]`,
        });
      }
      if (
        delivery === "on_screen" &&
        sp &&
        ((seg.dialogue_lines?.length ?? 0) > 0 || out.schema_version === "4.0")
      ) {
        const beatNumber = turn.camera_beat;
        const beat =
          typeof beatNumber === "number" && Number.isInteger(beatNumber)
            ? seg.beats?.[beatNumber - 1]
            : undefined;
        if (
          !beat ||
          !mentionsExactName(`${beat.beat ?? ""} ${beat.camera ?? ""}`, sp)
        ) {
          push({
            code: "CAST-004",
            severity: "high",
            scope: "segment",
            segment_number: seg.segment_number,
            message: `On-screen speaker "${sp}" is not bound to a camera beat that explicitly shows them.`,
            evidence: `camera_beat=${String(beatNumber ?? "missing")}`,
          });
        }
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
  const locksByName = new Map(
    (out.character_locks ?? []).map((lock) => [lc(lock.name), lock])
  );
  const validatedVoiceProfiles = new Set<string>();
  for (const seg of out.segments ?? []) {
    const turns = seg.dialogue_lines ?? [];
    if (turns.length === 0) continue;
    const dur = isNum(seg.duration_seconds) ? seg.duration_seconds : 10;
    let prevEnd = -Infinity;
    turns.forEach((t, idx) => {
      const speaker = norm(t.speaker);
      if (speaker) {
        const lock = locksByName.get(speaker.toLowerCase());
        if (!lock) {
          push({
            code: "DLG-002",
            severity: "high",
            scope: "segment",
            segment_number: seg.segment_number,
            message: `Dialogue speaker "${speaker}" has no character voice authority.`,
          });
        } else if (!validatedVoiceProfiles.has(lc(lock.name))) {
          validatedVoiceProfiles.add(lc(lock.name));
          const voice = norm(lock.voice);
          if (!voice) {
            push({
              code: "DLG-003",
              severity: "high",
              scope: "segment",
              segment_number: seg.segment_number,
              character: lock.name,
              message: `Speaking character "${lock.name}" has no locked voice profile.`,
            });
          } else {
            const hz = voice.match(
              /(\d{2,3})\s*(?:-|–|—|to)\s*(\d{2,3})\s*hz/i
            );
            const hasRate = /\b\d{2,3}\s*wpm\b/i.test(voice);
            const hasTimbre = /\b(?:timbre|voice|warm|bright|dark|breathy|clear|raspy|resonant|soft|deep|light|husky|nasal|trầm|ấm|sáng|khàn|mỏng|dày)\b/i.test(
              voice
            );
            if (!hz || !hasRate || !hasTimbre) {
              push({
                code: "DLG-004",
                severity: "high",
                scope: "character",
                character: lock.name,
                message:
                  "Voice profile must deterministically lock timbre, natural F0 range (Hz), and speaking rate (wpm).",
                evidence: voice,
              });
            } else {
              const low = Number(hz[1]);
              const high = Number(hz[2]);
              const pitchConflict =
                (lock.is_child && high < 200) ||
                (!lock.is_child && lock.gender === "male" && low >= 160) ||
                (!lock.is_child && lock.gender === "female" && high <= 160);
              if (pitchConflict || low >= high) {
                push({
                  code: "DLG-005",
                  severity: "high",
                  scope: "character",
                  character: lock.name,
                  message: "Locked F0 range conflicts with the speaker's gender/age authority.",
                  evidence: `${lock.gender ?? "unknown"}, child=${!!lock.is_child}, F0=${low}-${high}Hz`,
                });
              }
            }
          }
        }
      }
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
      const seconds = e - s;
      if (seconds > 0) {
        const words = norm(t.text).split(/\s+/).filter(Boolean).length;
        const wpm = (words / seconds) * 60;
        if (wpm > 190) {
          push({
            code: "DLG-006",
            severity: "high",
            scope: "segment",
            segment_number: seg.segment_number,
            message: `Dialogue turn ${idx + 1} is too fast for natural speech.`,
            evidence: `${words} words / ${seconds.toFixed(1)}s = ${Math.round(wpm)} wpm`,
          });
        } else if (wpm > 185) {
          // Vietnamese conversational lines run a touch faster than English; only
          // flag once a line is clearly rushed (>185 wpm), not merely brisk.
          push({
            code: "DLG-006",
            severity: "medium",
            scope: "segment",
            segment_number: seg.segment_number,
            message: `Dialogue turn ${idx + 1} is close to the natural-speech limit.`,
            evidence: `${Math.round(wpm)} wpm`,
          });
        }
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
  checkContextContracts(output, push);
  checkCharacter(output, push);
  checkCast(output, push);
  checkContinuity(output, push);
  checkDialogue(output, push);

  return buildReport(findings, "semantic gate");
}

/**
 * Sort findings (severity → segment → code), count by severity and derive the
 * `ok` flag + summary. Shared by every gate (breakdown, prompt-level, …) so they
 * all speak the same report shape. `ok` is false when any critical/high remains.
 */
export function buildReport(
  findings: SemanticFinding[],
  label = "gate"
): SemanticValidationReport {
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
      ? `${label}: clean (no critical/high; ${counts.medium} advisory)`
      : `${label}: clean`
    : `${label}: ${counts.critical} critical, ${counts.high} high, ${counts.medium} medium`;

  return { ok, findings, counts, summary };
}

/** Render a report as compact log lines (one per finding). */
export function formatSemanticReport(report: SemanticValidationReport): string {
  if (report.findings.length === 0) return "✅ no issues found";
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
