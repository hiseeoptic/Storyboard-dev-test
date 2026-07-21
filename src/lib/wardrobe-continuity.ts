export interface WardrobeStateSnapshot {
  character: string;
  outfit: string;
  outfit_materials?: string;
  hair?: string;
}

/**
 * Resolve the latest explicitly motivated wardrobe transition up to a segment.
 * A transition is declared once; later clips inherit it without requiring the
 * storyboard model to repeat wardrobe_state in every segment.
 */
export function wardrobeStateThrough<T extends { wardrobe_state?: WardrobeStateSnapshot[] }>(
  segments: readonly T[],
  throughIndex: number
): Map<string, WardrobeStateSnapshot> {
  const current = new Map<string, WardrobeStateSnapshot>();
  const lastIndex = Math.min(Math.max(throughIndex, -1), segments.length - 1);

  for (let index = 0; index <= lastIndex; index += 1) {
    for (const state of segments[index]?.wardrobe_state ?? []) {
      const name = state?.character?.trim();
      const outfit = state?.outfit?.trim();
      if (!name || !outfit) continue;
      current.set(name.toLowerCase(), {
        ...state,
        character: name,
        outfit,
      });
    }
  }

  return current;
}

/**
 * Models sometimes echo the same wardrobe_state into every later clip. Remove
 * only exact repeats; a genuinely different state remains a new transition.
 */
export function dedupeRepeatedWardrobeStates<
  T extends { wardrobe_state?: WardrobeStateSnapshot[] },
>(segments: T[]): void {
  const current = new Map<string, string>();
  const normalize = (value?: string) =>
    (value ?? "")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

  for (const segment of segments) {
    if (!Array.isArray(segment.wardrobe_state)) continue;
    const unique = segment.wardrobe_state.filter((state) => {
      const name = state?.character?.trim().toLowerCase();
      const outfit = state?.outfit?.trim();
      if (!name || !outfit) return false;
      const signature = JSON.stringify({
        outfit: normalize(outfit),
        outfit_materials: normalize(state.outfit_materials),
        hair: normalize(state.hair),
      });
      if (current.get(name) === signature) return false;
      current.set(name, signature);
      return true;
    });
    segment.wardrobe_state = unique.length > 0 ? unique : undefined;
  }
}
