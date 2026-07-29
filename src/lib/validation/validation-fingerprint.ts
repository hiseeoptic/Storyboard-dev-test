import type { StoryboardGenerationOutput } from "@/types";

const EXCLUDED_KEYS = new Set([
  "validation_cache",
  "first_frame_url",
  "keyframe_url",
  "full_prompt",
]);

/** Stable browser/server-safe digest of only the storyboard data a critic sees. */
export function fingerprintStoryboardValidation(
  breakdown: StoryboardGenerationOutput
): string {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  let length = 0;
  const feed = (value: string) => {
    for (let index = 0; index < value.length; index++) {
      const code = value.charCodeAt(index);
      hashA ^= code;
      hashA = Math.imul(hashA, 0x01000193);
      hashB ^= code + 0x9e3779b9 + (hashB << 6) + (hashB >>> 2);
      hashB = Math.imul(hashB, 0x85ebca6b);
      length++;
    }
  };
  const visit = (value: unknown): void => {
    if (value === null) return feed("null;");
    if (Array.isArray(value)) {
      feed("[");
      value.forEach(visit);
      return feed("];");
    }
    if (typeof value === "object") {
      feed("{");
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record).sort()) {
        if (EXCLUDED_KEYS.has(key)) continue;
        feed(`${key}:`);
        visit(record[key]);
      }
      return feed("};");
    }
    feed(`${typeof value}:${String(value)};`);
  };
  visit(breakdown);
  return `${(hashA >>> 0).toString(16).padStart(8, "0")}-${(hashB >>> 0)
    .toString(16)
    .padStart(8, "0")}-${length.toString(16)}`;
}

export function hasCurrentValidationCache(
  breakdown: StoryboardGenerationOutput
): boolean {
  return (
    breakdown.validation_cache?.version === "1.0" &&
    breakdown.validation_cache.fingerprint ===
      fingerprintStoryboardValidation(breakdown)
  );
}

export function stampValidationCache(
  breakdown: StoryboardGenerationOutput
): void {
  breakdown.validation_cache = {
    version: "1.0",
    fingerprint: fingerprintStoryboardValidation(breakdown),
    validated_at: new Date().toISOString(),
  };
}
