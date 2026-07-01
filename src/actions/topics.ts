"use server";

import {
  buildTopicLibrary,
  fetchTopicRows,
  type TopicCategory,
} from "@/services/topics";
import type { ActionResult } from "@/types";

// Small in-memory cache so the dropdown loads instantly and we don't hit the
// sheet proxy on every page view. Refreshes every 5 minutes.
let cache: { at: number; data: TopicCategory[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function getTopicLibrary(): Promise<
  ActionResult<{ categories: TopicCategory[] }>
> {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return { success: true, data: { categories: cache.data } };
    }
    const categories = buildTopicLibrary(await fetchTopicRows());
    cache = { at: Date.now(), data: categories };
    return { success: true, data: { categories } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Không tải được kho chủ đề",
    };
  }
}
