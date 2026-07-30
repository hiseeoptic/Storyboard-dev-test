interface CompletionUsageLike {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  } | null;
}

export function estimateTextTokens(...parts: Array<string | null | undefined>): number {
  const characters = parts.reduce((total, part) => total + (part?.length ?? 0), 0);
  return Math.ceil(characters / 4);
}

/**
 * Production-safe usage telemetry. It logs counts and model/stage names only;
 * prompts, uploaded images, API keys, and user content are never logged.
 */
export function logOpenAiUsage(params: {
  stage: string;
  model: string;
  attempt?: number;
  usage?: CompletionUsageLike | null;
  promptParts?: Array<string | null | undefined>;
  imageCount?: number;
}): void {
  const promptTokens = params.usage?.prompt_tokens;
  const completionTokens = params.usage?.completion_tokens;
  const totalTokens = params.usage?.total_tokens;
  const cachedTokens = params.usage?.prompt_tokens_details?.cached_tokens;
  const estimatedPromptTokens =
    promptTokens === undefined
      ? estimateTextTokens(...(params.promptParts ?? []))
      : undefined;

  console.info(
    "[AI Usage]",
    JSON.stringify({
      stage: params.stage,
      model: params.model,
      attempt: params.attempt ?? 1,
      prompt_tokens: promptTokens,
      cached_prompt_tokens: cachedTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_prompt_tokens: estimatedPromptTokens,
      image_count: params.imageCount ?? 0,
    })
  );
}
