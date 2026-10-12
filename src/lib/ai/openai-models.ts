// ============================================================
// OPENAI TEXT MODELS — one place that decides which model each text stage
// uses and which request parameters that model family accepts.
//
// Every text stage runs on GPT-6.1 Sol at the lowest reasoning effort it
// supports ("low"; Sol rejects "none"/"minimal"). Reasoning models take
// `max_completion_tokens` (reasoning tokens count against it) and refuse
// `temperature`/`max_tokens`, so the parameters are built per model.
//
// Each stage keeps the model it used before Sol as an automatic backup: when
// the account cannot use Sol (no access, a parameter it rejects), the call is
// repeated once on the backup instead of failing the user's generation. The
// switch is remembered for the life of the server instance.
//
// The model is decided here in code. The old per-stage variables
// (OPENAI_SCRIPT_MODEL, OPENAI_STORYBOARD_MODEL, OPENAI_CONTEXT_MODEL, …) are
// deliberately ignored so a value left in the deployment cannot keep a stage
// on an old model. OPENAI_TEXT_MODEL (new, unset by default) is the only
// override and changes every stage at once.
// ============================================================
import { aiErrorCode, aiErrorMessage, aiErrorStatus } from "./retry-policy.ts";

export const DEFAULT_OPENAI_TEXT_MODEL = "gpt-6.1-sol";

export type OpenAiTextStage =
  | "script"
  | "context"
  | "storyboard"
  | "rewrite"
  | "critic"
  | "repair"
  | "writers_room";

/** What each stage ran on before GPT-6.1 Sol — the automatic backup. */
export const LEGACY_OPENAI_MODEL: Record<OpenAiTextStage, string> = {
  script: "gpt-5.6-terra",
  context: "gpt-4o-mini",
  storyboard: "gpt-4.1-mini",
  rewrite: "gpt-4.1-mini",
  critic: "gpt-4o-mini",
  repair: "gpt-4.1-mini",
  writers_room: "gpt-5.6-terra",
};

type Env = Record<string, string | undefined>;

// `stage` is kept so a future stage-specific choice stays a one-line change.
export function openAiModelFor(_stage: OpenAiTextStage, env: Env = process.env): string {
  return env.OPENAI_TEXT_MODEL?.trim() || DEFAULT_OPENAI_TEXT_MODEL;
}

/** GPT-5/6 and o-series are reasoning models (no temperature, no max_tokens). */
export const isReasoningModel = (model: string) => /^(gpt-5|gpt-6|o\d)/i.test(model.trim());

/** Room for the hidden reasoning tokens on top of the visible answer. */
const REASONING_HEADROOM_TOKENS = 4000;

export interface OpenAiTextParams {
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  reasoning_effort?: "low";
}

/**
 * Token and sampling parameters for `model`. `maxTokens` is the size of the
 * visible answer the stage needs; reasoning models get extra headroom.
 */
export function openAiTextParams(
  model: string,
  opts: { maxTokens: number; temperature?: number }
): OpenAiTextParams {
  if (!isReasoningModel(model)) {
    return {
      max_tokens: opts.maxTokens,
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    };
  }
  // GPT-5.6 / GPT-6.x accept an explicit effort; "low" is the fastest level
  // GPT-6.x supports and keeps the pipeline inside the Vercel time budget.
  const effort = /^(gpt-5\.6|gpt-6)/i.test(model.trim()) ? { reasoning_effort: "low" as const } : {};
  return { max_completion_tokens: opts.maxTokens + REASONING_HEADROOM_TOKENS, ...effort };
}

const BILLING_OR_AUTH = /insufficient_quota|billing|spend_limit|usage_limit|invalid_api_key|incorrect api key/i;

/**
 * True when the model itself is the problem (not available to this account,
 * or a parameter it rejects) — retrying on the backup model can succeed.
 * Billing, auth, rate limits, timeouts and server errors are NOT model problems.
 */
export function isModelUnavailableError(error: unknown): boolean {
  const status = aiErrorStatus(error);
  if (status !== 400 && status !== 403 && status !== 404) return false;
  const text = `${aiErrorCode(error) ?? ""} ${aiErrorMessage(error)}`;
  if (BILLING_OR_AUTH.test(text)) return false;
  // A prompt that is simply too long fails the same way on the backup.
  if (/context_length|maximum context length|too many tokens/i.test(text)) return false;
  return true;
}

const unavailable = new Set<string>();

/** The model to call now: the configured one, or its backup once it has failed. */
export function activeOpenAiModel(stage: OpenAiTextStage, env: Env = process.env): string {
  const model = openAiModelFor(stage, env);
  return unavailable.has(`${stage}:${model}`) ? LEGACY_OPENAI_MODEL[stage] : model;
}

interface ChatClient {
  chat: {
    completions: {
      create: (body: never, options?: { timeout?: number }) => Promise<unknown>;
    };
  };
}

interface ChatCompletionLike {
  choices?: Array<{ message?: { content?: string | null } | null }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number } | null;
  } | null;
}

/**
 * One chat completion for a text stage, on the stage's model with the right
 * parameters, falling back once to the stage's previous model when the
 * account cannot use the new one.
 */
export async function createOpenAiChat(
  client: ChatClient,
  params: {
    stage: OpenAiTextStage;
    messages: unknown[];
    maxTokens: number;
    temperature?: number;
    responseFormat?: unknown;
    timeoutMs?: number;
  }
): Promise<{ content: string | null; model: string; usage: ChatCompletionLike["usage"] }> {
  const call = async (model: string) => {
    const body = {
      model,
      messages: params.messages,
      ...openAiTextParams(model, { maxTokens: params.maxTokens, temperature: params.temperature }),
      ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
    };
    const completion = (await client.chat.completions.create(
      body as never,
      params.timeoutMs ? { timeout: params.timeoutMs } : undefined
    )) as ChatCompletionLike;
    return { content: completion.choices?.[0]?.message?.content ?? null, model, usage: completion.usage };
  };

  const model = activeOpenAiModel(params.stage);
  const backup = LEGACY_OPENAI_MODEL[params.stage];
  try {
    return await call(model);
  } catch (error) {
    if (model === backup || !isModelUnavailableError(error)) throw error;
    unavailable.add(`${params.stage}:${model}`);
    console.warn(
      `[OpenAI] ${model} unavailable for stage "${params.stage}" (${aiErrorStatus(error)}: ${aiErrorMessage(error)}); using ${backup} instead.`
    );
    return call(backup);
  }
}

/** Test hook: forget remembered fallbacks. */
export function resetOpenAiModelFallbacks(): void {
  unavailable.clear();
}
