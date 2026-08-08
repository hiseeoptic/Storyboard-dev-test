import type { VideoSegment } from "@/types";
import type {
  CharacterPhysicalState,
  ContactRelation,
  LimbId,
  LimbState,
  ProductionEntitySnapshot,
  ProductionRegistryEntry,
  ProductionSnapshot,
  ShotState,
  SupportRelation,
} from "./types.ts";

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function lower(value: unknown): string {
  return clean(value).toLocaleLowerCase();
}

function emptyLimb(limbId: LimbId): LimbState {
  return {
    limb_id: limbId,
    exists: null,
    position: null,
    status: "unknown",
    held_object_ids: [],
    contact_entity_ids: [],
    activities: [],
  };
}

function inferPose(text: string): CharacterPhysicalState["pose"]["pose"] {
  if (/\b(?:sit|sits|sitting|seated)\b|\b(?:ngồi)\b/iu.test(text)) return "sitting";
  if (/\b(?:stand|stands|standing|upright)\b|\b(?:đứng)\b/iu.test(text)) return "standing";
  if (/\b(?:kneel|kneels|kneeling)\b|\b(?:quỳ)\b/iu.test(text)) return "kneeling";
  if (/\b(?:lie|lies|lying|recline|reclining)\b|\b(?:nằm)\b/iu.test(text)) return "lying";
  if (/\b(?:bend|bends|bending|stoop|stooping)\b|\b(?:cúi)\b/iu.test(text)) return "bending";
  return "unknown";
}

export function inferLimbId(text: string): LimbId | null {
  const value = lower(text);
  if (/\b(?:left hand|left palm)\b|\b(?:tay trái|bàn tay trái)\b/iu.test(value)) return "left_hand";
  if (/\b(?:right hand|right palm)\b|\b(?:tay phải|bàn tay phải)\b/iu.test(value)) return "right_hand";
  if (/\b(?:left foot)\b|\b(?:chân trái|bàn chân trái)\b/iu.test(value)) return "left_foot";
  if (/\b(?:right foot)\b|\b(?:chân phải|bàn chân phải)\b/iu.test(value)) return "right_foot";
  return null;
}

function characterPhysics(entry: ProductionEntitySnapshot): CharacterPhysicalState {
  const text = `${entry.state} ${entry.position} ${entry.orientation ?? ""}`;
  return {
    instance_count: 1,
    topology: {
      model: "unknown",
      torso_count: null,
      arm_count: null,
      hand_count: null,
      leg_count: null,
      foot_count: null,
    },
    pose: {
      pose: inferPose(text),
      weight_bearing_limb_ids: [],
      body_orientation: clean(entry.orientation) || null,
      gaze_target_entity_id: null,
      zone_id: null,
      anchor: clean(entry.position) || null,
    },
    limbs: {
      left_hand: emptyLimb("left_hand"),
      right_hand: emptyLimb("right_hand"),
      left_foot: emptyLimb("left_foot"),
      right_foot: emptyLimb("right_foot"),
    },
    unassigned_held_object_ids: [],
    occupied_volume_id: null,
  };
}

function uniquePush(values: string[], value: string): void {
  if (!values.includes(value)) values.push(value);
}

function findSupportEntity(
  position: string,
  entities: ProductionEntitySnapshot[],
  excludedId: string
): string | null {
  const text = lower(position);
  const match = entities.find(
    (candidate) =>
      candidate.entity_id !== excludedId &&
      (text.includes(lower(candidate.entity_id)) ||
        (candidate.position && text.includes(lower(candidate.position))))
  );
  return match?.entity_id ?? null;
}

function compileSnapshot(
  snapshot: ProductionSnapshot,
  visibleCharacterIds: string[]
): void {
  for (const characterId of visibleCharacterIds) {
    if (!snapshot.entities.some((entry) => entry.entity_id === characterId)) {
      snapshot.entities.push({
        entity_id: characterId,
        kind: "character",
        state: "",
        position: "",
        orientation: null,
      });
    }
  }

  for (const entry of snapshot.entities) {
    if (entry.kind === "character") {
      entry.character_physics = characterPhysics(entry);
      const pose = entry.character_physics.pose.pose;
      let support: SupportRelation | null = null;
      if (pose === "standing") {
        // A standing human is, by physics, always carried by the ground/floor —
        // even when the prose omits the word "floor/sàn". Asserting the necessary
        // support here means SUPPORT_MISSING_FOR_STANDING only fires on a
        // genuinely declared floating/unsupported STRUCTURED state, never on
        // ordinary free text such as "stands at the door".
        support = {
          supported_entity_id: entry.entity_id,
          support_entity_id: null,
          kind: "ground",
          contact_part: null,
          active: true,
        };
      } else if (pose === "sitting") {
        // Likewise a sitting human always rests on a seat/surface. Bind the seat
        // entity when the prose names one; otherwise record the support without a
        // specific entity rather than reporting a false "sitting on nothing".
        support = {
          supported_entity_id: entry.entity_id,
          support_entity_id: findSupportEntity(entry.position, snapshot.entities, entry.entity_id),
          kind: "seat",
          contact_part: "torso",
          active: true,
        };
      }
      if (support) snapshot.supports.push(support);
    } else if (entry.kind === "object" || entry.kind === "product") {
      const text = lower(`${entry.state} ${entry.position}`);
      entry.object_physics = {
        existence: /\b(?:does not exist|absent|destroyed)\b|\b(?:không tồn tại|biến mất)\b/iu.test(text)
          ? "does_not_exist"
          : text
            ? "exists"
            : "unknown",
        visibility: /\b(?:occluded|hidden behind)\b|\b(?:bị che|khuất)\b/iu.test(text)
          ? "occluded"
          : /\b(?:out of frame|off frame)\b|\b(?:ngoài khung)\b/iu.test(text)
            ? "out_of_frame"
            : text
              ? "visible"
              : "unknown",
        occupied_volume_id: null,
      };
      if (
        !entry.holder_entity_id &&
        /^(?:on|resting on|placed on)\b|^(?:trên|đặt trên)\b|\b(?:floor|ground|basin|sink|table|counter|worktop|shelf|tray|plate|chair|seat|bench)\b|\b(?:sàn|đất|bồn rửa|chậu|bàn|kệ|khay|đĩa|ghế)\b/iu.test(text)
      ) {
        const isGround = /\b(?:floor|ground)\b|\b(?:sàn|đất)\b/iu.test(text);
        snapshot.supports.push({
          supported_entity_id: entry.entity_id,
          support_entity_id: findSupportEntity(entry.position, snapshot.entities, entry.entity_id),
          kind: isGround ? "ground" : "surface",
          contact_part: "object_base",
          active: true,
        });
      }
    }
  }

  for (const object of snapshot.entities) {
    if (!object.holder_entity_id) continue;
    const holder = snapshot.entities.find((entry) => entry.entity_id === object.holder_entity_id);
    const physics = holder?.character_physics;
    if (!holder || !physics) continue;
    const limbId = inferLimbId(`${object.position} ${object.state}`);
    const relation: ContactRelation = {
      source_entity_id: holder.entity_id,
      source_limb_id: limbId && limbId.endsWith("hand") ? limbId : null,
      target_entity_id: object.entity_id,
      kind: "hold",
      active: true,
    };
    snapshot.contacts.push(relation);
    if (relation.source_limb_id) {
      const limb = physics.limbs[relation.source_limb_id];
      limb.status = "holding";
      uniquePush(limb.held_object_ids, object.entity_id);
      uniquePush(limb.contact_entity_ids, object.entity_id);
    } else {
      uniquePush(physics.unassigned_held_object_ids, object.entity_id);
    }
    snapshot.supports.push({
      supported_entity_id: object.entity_id,
      support_entity_id: holder.entity_id,
      kind: "hand",
      contact_part: relation.source_limb_id,
      active: true,
    });
  }
}

/** Enrich only the canonical copy. Legacy segment fields remain untouched. */
export function compileLegacyPhysicalShot(
  shot: ShotState,
  segment: VideoSegment,
  registry: ProductionRegistryEntry[]
): void {
  const byName = new Map<string, ProductionRegistryEntry>();
  for (const entry of registry) {
    byName.set(lower(entry.display_name), entry);
    if (entry.source_ref) byName.set(lower(entry.source_ref), entry);
    for (const alias of entry.aliases) byName.set(lower(alias), entry);
  }
  const visibleCharacterIds = (segment.characters_in_scene ?? [])
    .map((name) => byName.get(lower(name)))
    .filter((entry): entry is ProductionRegistryEntry => entry?.kind === "character")
    .map((entry) => entry.entity_id);

  compileSnapshot(shot.start_snapshot, visibleCharacterIds);
  compileSnapshot(shot.end_snapshot, visibleCharacterIds);

  for (const change of shot.changes) {
    const legacy = `${change.action} ${change.caused_by} ${change.from_position ?? ""} ${change.to_position ?? ""}`;
    const limb = inferLimbId(legacy);
    const hasContactAction = /\b(?:touch|contact|cut|grip|grasp|hold|pick|lift|place|release|push|pull)\b|\b(?:chạm|tiếp xúc|cắt|cứa|nắm|cầm|nhấc|đặt|thả|đẩy|kéo)\b/iu.test(legacy);
    change.body_part = limb;
    change.contact_entity_ids = hasContactAction ? [change.entity_id] : [];
    change.duration_s = null;
    change.physical_conditions = [];
  }
}
