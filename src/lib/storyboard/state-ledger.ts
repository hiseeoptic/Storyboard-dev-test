import type {
  SegmentEntityState,
  SegmentStateChange,
  StoryboardGenerationOutput,
} from "../../types/index.ts";

type LedgerBreakdown = Pick<
  StoryboardGenerationOutput,
  "character_locks" | "segments"
>;

export interface RelationalEntityState {
  kind: "position" | "contact" | "held";
  position?: string;
  holder?: string;
}

function clean(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function exactName(text: string, names: string[]): string | undefined {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      new RegExp(
        `(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`,
        "iu"
      ).test(text)
    ) {
      return name;
    }
  }
  return undefined;
}

/**
 * Decode values that were incorrectly written into `state`. Location,
 * transient contact and possession have their own dimensions and are not an
 * object's intrinsic physical condition.
 */
export function relationalEntityState(
  value: string | null | undefined,
  characterNames: string[] = []
): RelationalEntityState | null {
  const raw = clean(value);
  if (!raw) return null;

  const holder =
    exactName(raw, characterNames) ??
    raw
      .match(
        /^(?:held|gripped|carried|touched|contacted)\s+by\s+(.+?)(?:[.,;]|$)/iu
      )?.[1]
      ?.trim();
  if (
    /^(?:touched|being touched|contacted)\s+by\b|^(?:được\s+)?[^,.;]+\s+chạm(?:\s+vào)?\b/iu.test(
      raw
    )
  ) {
    return { kind: "contact", holder };
  }
  if (
    /^(?:held|gripped|carried)\s+by\b|^(?:được\s+)?[^,.;]+\s+(?:cầm|nắm|giữ)\b/iu.test(
      raw
    )
  ) {
    return {
      kind: "held",
      holder,
      position: holder ? `in ${holder}'s hand` : "in the declared holder's hand",
    };
  }

  const handMatch = raw.match(
    /^(?:in|inside)\s+(.+?)(?:['’]s)?\s+(?:hand|hands)\b/iu
  );
  if (handMatch) {
    const handHolder =
      exactName(handMatch[1] ?? raw, characterNames) ??
      clean(handMatch[1]);
    return {
      kind: "held",
      holder: handHolder || undefined,
      position: raw,
    };
  }
  const viHand = raw.match(/^trong\s+tay\s+(.+?)(?:[.,;]|$)/iu);
  if (viHand) {
    const handHolder =
      exactName(viHand[1] ?? raw, characterNames) ?? clean(viHand[1]);
    return {
      kind: "held",
      holder: handHolder || undefined,
      position: raw,
    };
  }

  if (
    /^(?:on|at|under|beneath|beside|next to|near|inside|outside|resting on|placed on|positioned at)\b/iu.test(
      raw
    ) ||
    /^(?:trên|tại|dưới|bên|cạnh|gần|bên trong|bên ngoài)\b/iu.test(raw)
  ) {
    return { kind: "position", position: raw };
  }
  return null;
}

export function hasVisibleCausalAction(
  value: string | null | undefined
): boolean {
  return /\b(?:reach(?:es|ed|ing)?|touch(?:es|ed|ing)?|contact(?:s|ed|ing)?|grip(?:s|ped|ping)?|grasp(?:s|ed|ing)?|hold(?:s|ing)?|lift(?:s|ed|ing)?|pick(?:s|ed|ing)?\s+up|raise(?:s|d|ing)?|lower(?:s|ed|ing)?|carry|carries|carried|carrying|place(?:s|d|ing)?|set(?:s|ting)?\s+down|put(?:s|ting)?\s+down|release(?:s|d|ing)?|pour(?:s|ed|ing)?|tilt(?:s|ed|ing)?|push(?:es|ed|ing)?|pull(?:s|ed|ing)?|slide(?:s|d|ing)?|rotate(?:s|d|ing)?|press(?:es|ed|ing)?|open(?:s|ed|ing)?|close(?:s|d|ing)?|move(?:s|d|ing)?)\b|(?:đưa\s+tay|chạm|tiếp\s+xúc|nắm|cầm|giữ|nhấc|nâng|hạ|mang|đặt|thả|rót|nghiêng|kéo|đẩy|trượt|xoay|ấn|mở|đóng|di\s+chuyển)/iu.test(
    clean(value)
  );
}

function isLiftOrHold(value: string): boolean {
  return /\b(?:grip(?:s|ped|ping)?|grasp(?:s|ed|ing)?|hold(?:s|ing)?|lift(?:s|ed|ing)?|pick(?:s|ed|ing)?\s+up|raise(?:s|d|ing)?|carr(?:y|ies|ied|ying))\b|(?:nắm|cầm|giữ|nhấc|nâng|mang)/iu.test(
    value
  );
}

function isReleaseOrPlace(value: string): boolean {
  return /\b(?:place(?:s|d|ing)?|set(?:s|ting)?\s+down|put(?:s|ting)?\s+down|release(?:s|d|ing)?|lower(?:s|ed|ing)?\s+(?:onto|to))\b|(?:đặt|thả|hạ\s+(?:xuống|lên))/iu.test(
    value
  );
}

function relationAppliedToSnapshot(
  snapshot: SegmentEntityState,
  relation: RelationalEntityState | null,
  intrinsicState: string
): SegmentEntityState {
  if (!relation) return snapshot;
  if (relation.kind === "contact") {
    return { ...snapshot, state: intrinsicState };
  }
  return {
    ...snapshot,
    state: intrinsicState,
    position:
      relation.kind === "held"
        ? relation.position || snapshot.position
        : snapshot.position || relation.position || "",
    holder:
      relation.kind === "held"
        ? relation.holder || snapshot.holder || ""
        : snapshot.holder,
  };
}

function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

/**
 * Repair the state/position/holder model locally before any validator or paid
 * critic call. This preserves creative action and dialogue; it only moves
 * relational data into the dimension designed to hold it.
 */
export function normalizeStateLedgerDimensions(
  breakdown: LedgerBreakdown
): number {
  const characterNames = (breakdown.character_locks ?? [])
    .map((lock) => clean(lock.name))
    .filter(Boolean);
  const lastIntrinsicByEntity = new Map<string, string>();
  let normalizedFields = 0;

  for (const segment of breakdown.segments ?? []) {
    const ledger = segment.state_ledger;
    if (!ledger) continue;
    const startById = new Map(
      ledger.start.map((entry) => [clean(entry.entity_id).toLowerCase(), entry])
    );
    const endById = new Map(
      ledger.end.map((entry) => [clean(entry.entity_id).toLowerCase(), entry])
    );
    const ids = new Set([
      ...ledger.start.map((entry) => clean(entry.entity_id).toLowerCase()),
      ...ledger.changes.map((entry) => clean(entry.entity_id).toLowerCase()),
      ...ledger.end.map((entry) => clean(entry.entity_id).toLowerCase()),
    ]);

    for (const entityKey of ids) {
      if (!entityKey) continue;
      const startEntry = startById.get(entityKey);
      const endEntry = endById.get(entityKey);
      const entityChanges = ledger.changes.filter(
        (change) => clean(change.entity_id).toLowerCase() === entityKey
      );
      const startRelation = relationalEntityState(
        startEntry?.state,
        characterNames
      );
      let intrinsic =
        lastIntrinsicByEntity.get(entityKey) ||
        (!startRelation && clean(startEntry?.state)
          ? clean(startEntry?.state)
          : "physical condition unchanged");

      if (startEntry) {
        const normalized = relationAppliedToSnapshot(
          startEntry,
          startRelation,
          intrinsic
        );
        if (changed(startEntry, normalized)) {
          Object.assign(startEntry, normalized);
          normalizedFields += 1;
        }
        if (!startRelation && clean(startEntry.state)) {
          intrinsic = clean(startEntry.state);
        }
      }

      let currentPosition = clean(startEntry?.position);
      let currentHolder = clean(startEntry?.holder);
      for (const change of entityChanges) {
        const before = { ...change };
        const toRelation = relationalEntityState(change.to, characterNames);
        change.from = intrinsic;
        change.from_position = clean(change.from_position) || currentPosition;
        change.from_holder = clean(change.from_holder) || currentHolder;

        const actionText = `${clean(change.caused_by)} ${clean(change.action)}`;
        let nextPosition =
          clean(change.to_position) || currentPosition;
        let nextHolder = clean(change.to_holder) || currentHolder;
        if (toRelation?.kind === "position") {
          nextPosition = toRelation.position || nextPosition;
        } else if (toRelation?.kind === "held") {
          nextHolder =
            toRelation.holder ||
            exactName(actionText, characterNames) ||
            nextHolder;
          nextPosition =
            toRelation.position ||
            (nextHolder ? `in ${nextHolder}'s hand` : nextPosition);
        } else if (isLiftOrHold(actionText)) {
          nextHolder =
            exactName(actionText, characterNames) || nextHolder;
          nextPosition =
            clean(endEntry?.position) ||
            (nextHolder ? `in ${nextHolder}'s hand` : nextPosition);
        } else if (isReleaseOrPlace(actionText)) {
          nextHolder = "";
          nextPosition = clean(endEntry?.position) || nextPosition;
        }

        if (!toRelation && clean(change.to)) {
          intrinsic = clean(change.to);
        }
        change.to = intrinsic;
        change.to_position = nextPosition;
        change.to_holder = nextHolder;
        currentPosition = nextPosition;
        currentHolder = nextHolder;
        if (changed(before, change)) normalizedFields += 1;
      }

      if (endEntry) {
        const endRelation = relationalEntityState(
          endEntry.state,
          characterNames
        );
        let normalized = relationAppliedToSnapshot(
          endEntry,
          endRelation,
          intrinsic
        );
        if (endRelation?.kind === "contact") {
          normalized = {
            ...normalized,
            position: currentPosition || normalized.position,
            holder: currentHolder,
          };
        } else if (endRelation?.kind === "held") {
          normalized = {
            ...normalized,
            position:
              endRelation.position ||
              currentPosition ||
              normalized.position,
            holder:
              endRelation.holder ||
              currentHolder ||
              normalized.holder ||
              "",
          };
        } else if (entityChanges.length > 0) {
          // The final caused change is authoritative for every dimension.
          normalized = {
            ...normalized,
            state: intrinsic,
            position: currentPosition || normalized.position,
            holder: currentHolder,
          };
        }
        if (changed(endEntry, normalized)) {
          Object.assign(endEntry, normalized);
          normalizedFields += 1;
        }
        if (!relationalEntityState(endEntry.state, characterNames)) {
          lastIntrinsicByEntity.set(entityKey, clean(endEntry.state));
        }
      } else {
        lastIntrinsicByEntity.set(entityKey, intrinsic);
      }
    }
  }

  return normalizedFields;
}

export function changeHasOnlyRelationalOrStableState(
  change: SegmentStateChange,
  characterNames: string[]
): boolean {
  const fromRelation = relationalEntityState(change.from, characterNames);
  const toRelation = relationalEntityState(change.to, characterNames);
  if (fromRelation || toRelation) return Boolean(fromRelation && toRelation);
  return clean(change.from).toLowerCase() === clean(change.to).toLowerCase();
}
