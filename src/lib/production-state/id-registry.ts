import type {
  ProductionEntityKind,
  ProductionRegistryEntry,
} from "./types.ts";

const PREFIX: Record<ProductionEntityKind, string> = {
  character: "char",
  object: "obj",
  product: "prod",
  location: "loc",
  unknown: "entity",
};

export function stableIdSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

function identityKey(kind: ProductionEntityKind, displayName: string): string {
  return `${kind}:${displayName.trim().toLocaleLowerCase()}`;
}

function validPreferredId(value: string | null | undefined): string | null {
  const id = (value ?? "").trim();
  return /^[a-z][a-z0-9_]*$/i.test(id) ? id : null;
}

/** Deterministic per-project registry. Display names may change; persisted IDs win. */
export class ProductionIdRegistry {
  private readonly entries: ProductionRegistryEntry[] = [];
  private readonly byIdentity = new Map<string, ProductionRegistryEntry>();
  private readonly usedIds = new Set<string>();

  register(params: {
    kind: ProductionEntityKind;
    displayName: string;
    preferredId?: string | null;
    sourceRef?: string;
  }): ProductionRegistryEntry {
    const displayName = params.displayName.trim() || "Unnamed entity";
    const key = identityKey(params.kind, displayName);
    const existing = this.byIdentity.get(key);
    if (existing) return existing;

    const preferred = validPreferredId(params.preferredId);
    const base =
      preferred ??
      `${PREFIX[params.kind]}_${stableIdSlug(displayName) || String(this.entries.length + 1).padStart(3, "0")}`;
    let entityId = base;
    let suffix = 2;
    while (this.usedIds.has(entityId)) {
      entityId = `${base}_${suffix}`;
      suffix += 1;
    }

    const entry: ProductionRegistryEntry = {
      entity_id: entityId,
      display_name: displayName,
      kind: params.kind,
      aliases: [],
      ...(params.sourceRef ? { source_ref: params.sourceRef } : {}),
    };
    this.entries.push(entry);
    this.byIdentity.set(key, entry);
    this.usedIds.add(entityId);
    return entry;
  }

  find(kind: ProductionEntityKind, displayName: string): ProductionRegistryEntry | undefined {
    return this.byIdentity.get(identityKey(kind, displayName));
  }

  list(): ProductionRegistryEntry[] {
    return this.entries.map((entry) => ({ ...entry, aliases: [...entry.aliases] }));
  }
}
