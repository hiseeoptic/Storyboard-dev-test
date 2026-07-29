import type { AIProvider, StoryboardGenerationInput } from "../../types";

/**
 * Small in-memory LRU used by the generate screen.
 *
 * It deliberately lives in a client-owned ref (not a server/module singleton),
 * so one user's storyboard data can never leak into another request. The cache
 * only avoids duplicate paid plan calls while the current browser page is open.
 */
export class StoryboardPlanCache<T> {
  private readonly entries = new Map<string, T>();
  private readonly maxEntries: number;

  constructor(maxEntries = 3) {
    this.maxEntries = maxEntries;
  }

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > Math.max(1, this.maxEntries)) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/**
 * Deterministic, browser-safe fingerprint without serialising a second giant
 * base64 payload. Object keys are sorted, so equivalent inputs hash identically
 * even if their construction order differs.
 */
export function fingerprintStoryboardPlan(
  input: StoryboardGenerationInput,
  provider: AIProvider
): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  let length = 0;

  const feed = (text: string): void => {
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      hashA ^= code;
      hashA = Math.imul(hashA, 0x01000193);
      hashB ^= code + 0x9e3779b9 + (hashB << 6) + (hashB >>> 2);
      hashB = Math.imul(hashB, 0x85ebca6b);
      length++;
    }
  };

  const visit = (value: unknown): void => {
    if (value === null) {
      feed("null;");
      return;
    }
    if (Array.isArray(value)) {
      feed("[");
      for (const item of value) visit(item);
      feed("];");
      return;
    }
    if (typeof value === "object") {
      feed("{");
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record).sort()) {
        feed(`${key}:`);
        visit(record[key]);
      }
      feed("};");
      return;
    }
    feed(`${typeof value}:${String(value)};`);
  };

  visit({ provider, input });
  return [
    (hashA >>> 0).toString(16).padStart(8, "0"),
    (hashB >>> 0).toString(16).padStart(8, "0"),
    length.toString(16),
  ].join("-");
}
