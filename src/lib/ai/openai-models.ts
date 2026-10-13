// ============================================================
// OPENAI TEXT MODELS — one place that decides which model each text stage
// uses and which request parameters that model family accepts.
//
// Every stage has to finish inside Vercel's 300 s request limit, so models
// are chosen by what the stage writes:
//   · script / writers' room — GPT-6.1 Sol (strongest writer; decides every
//     line and action). Sol is often slow (minutes before the first token
//     have been reported), so it gets a hard time cap and the call moves to
//     GPT-6 Luna when Sol does not answer in time.
//   · context IR / storyboard JSON / rewrite / repair / critic — long,
//     rule-bound JSON that keeps the approved script's lines verbatim:
//     GPT-6 Luna (~120 tok/s), reasoning "none" (critic: "low").
//
// Reasoning models take `max_completion_tokens` (reasoning tokens count
// against it) and refuse `temperature`/`max_tokens`; GPT-6.1 Sol / GPT-6
// Astra reject reasoning "none", so it becomes "low" for them.
//
// Each stage also keeps a proven older model as a backup: when the account
// cannot use the planned model (no access, a parameter it rejects) the call
// is repeated once on the backup and the switch is remembered.
//
// The model is decided here in code. The old per-stage variables
// (OPENAI_SCRIPT_MODEL, OPENAI_STORYBOARD_MODEL, OPENAI_CONTEXT_MODEL, …) are
// deliberately ignored so a value left in the deployment cannot keep a stage
// on an old model. OPENAI_TEXT_MODEL (unset by default) is the only override
// and replaces the planned model of every stage at once.
// ============================================================
import { aiErrorCode, aiErrorMessage, aiErrorStatus } from "./retry-policy.ts";

export const GPT_SOL = "gpt-6.1-sol";
export const GPT_LUNA = "gpt-6-luna";
/** The writer model (script, writers' room). */
export const DEFAULT_OPENAI_TEXT_MODEL = GPT_SOL;

export type OpenAiTextStage =
  | "script"
  | "context"
  | "storyboard"
  | "rewrite"
  | "critic"
  | "repair"
  | "writers_room";

export type ReasoningEffort = "none" | "low";

interface StagePlan {
  model: string;
  effort: ReasoningEffort;
  /** When the planned model times out: retry on this model inside the same call. */
  onTimeout?: { model: string; effort: ReasoningEffort; reserveMs: number };
  /** Proven older model for when the account cannot use the planned one. */
  legacy: string;
}

const SOL_WITH_LUNA_RESCUE = { model: GPT_LUNA, effort: "low" as const, reserveMs: 45_000 };

export const STAGE_PLAN: Record<OpenAiTextStage, StagePlan> = {
  script: { model: GPT_SOL, effort: "low", onTimeout: SOL_WITH_LUNA_RESCUE, legacy: "gpt-5.6-terra" },
  writers_room: { model: GPT_SOL, effort: "low", onTimeout: SOL_WITH_LUNA_RESCUE, legacy: "gpt-5.6-terra" },
  context: { model: GPT_LUNA, effort: "none", legacy: "gpt-4.1-mini" },
  storyboard: { model: GPT_LUNA, effort: "none", legacy: "gpt-4.1-mini" },
  rewrite: { model: GPT_LUNA, effort: "none", legacy: "gpt-4.1-mini" },
  repair: { model: GPT_LUNA, effort: "none", legacy: "gpt-4.1-mini" },
  critic: { model: GPT_LUNA, effort: "low", legacy: "gpt-4o-mini" },
};

/** Backup model per stage (kept for callers and tests). */
export const LEGACY_OPENAI_MODEL: Record<OpenAiTextStage, string> = Object.fromEntries(
  Object.entries(STAGE_PLAN).map(([stage, plan]) => [stage, plan.legacy])
) as Record<OpenAiTextStage, string>;

type Env = Record<string, string | undefined>;

export function openAiModelFor(stage: OpenAiTextStage, env: Env = process.env): string {
  return env.OPENAI_TEXT_MODEL?.trim() || STAGE_PLAN[stage].model;
}

/** GPT-5/6 and o-series are reasoning models (no temperature, no max_tokens). */
export const isReasoningModel = (model: string) => /^(gpt-5|gpt-6|o\d)/i.test(model.trim());

/** Room for the hidden reasoning tokens on top of the visible answer. */
const REASONING_HEADROOM_TOKENS = 4000;

export interface OpenAiTextParams {
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  reasoning_effort?: ReasoningEffort;
}

/**
 * Token and sampling parameters for `model`. `maxTokens` is the size of the
 * visible answer the stage needs; reasoning models get extra headroom unless
 * they do not reason at all.
 */
export function openAiTextParams(
  model: string,
  opts: { maxTokens: number; temperature?: number; effort?: ReasoningEffort }
): OpenAiTextParams {
  if (!isReasoningModel(model)) {
    return {
      max_tokens: opts.maxTokens,
      ...(typeof opts.temperature === "number" ? { temperature: opts.temperature } : {}),
    };
  }
  const m = model.trim().toLowerCase();
  // Only GPT-5.6 / GPT-6.x take an explicit effort; Sol and Astra have no "none".
  if (!/^(gpt-5\.6|gpt-6)/.test(m)) {
    return { max_completion_tokens: opts.maxTokens + REASONING_HEADROOM_TOKENS };
  }
  const noNone = /^gpt-6(\.\d+)?-(sol|astra)/.test(m) || m.startsWith("gpt-5.6");
  const effort: ReasoningEffort = opts.effort === "none" && !noNone ? "none" : "low";
  return {
    max_completion_tokens: opts.maxTokens + (effort === "none" ? 0 : REASONING_HEADROOM_TOKENS),
    reasoning_effort: effort,
  };
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

/** The request ran out of time (client-side timeout, no HTTP status). */
export function isTimeoutError(error: unknown): boolean {
  if (aiErrorStatus(error) !== undefined) return false;
  const name = error instanceof Error ? error.name : "";
  return /timeout/i.test(name) || /timed out|timeout|aborted/i.test(aiErrorMessage(error));
}

const unavailable = new Set<string>();
/** stage → until when the planned model counts as too slow (ms epoch). */
const slowUntil = new Map<OpenAiTextStage, number>();
const SLOW_MEMORY_MS = 10 * 60_000;

/** The model to call now: the planned one, its backup once it has failed, or the fast rescue while it is slow. */
export function activeOpenAiModel(stage: OpenAiTextStage, env: Env = process.env): string {
  const model = openAiModelFor(stage, env);
  if (unavailable.has(`${stage}:${model}`)) return STAGE_PLAN[stage].legacy;
  const rescue = STAGE_PLAN[stage].onTimeout;
  if (rescue && (slowUntil.get(stage) ?? 0) > Date.now()) return rescue.model;
  return model;
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
 * parameters. A slow writer model hands over to the fast rescue model inside
 * the same time budget; a model the account cannot use is replaced by the
 * stage's backup.
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
  const plan = STAGE_PLAN[params.stage];
  const effortFor = (model: string) =>
    model === plan.onTimeout?.model && model !== plan.model ? plan.onTimeout.effort : plan.effort;
  const call = async (model: string, timeoutMs?: number) => {
    const body = {
      model,
      messages: params.messages,
      ...openAiTextParams(model, { maxTokens: params.maxTokens, temperature: params.temperature, effort: effortFor(model) }),
      ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
    };
    const completion = (await client.chat.completions.create(
      body as never,
      timeoutMs ? { timeout: timeoutMs } : undefined
    )) as ChatCompletionLike;
    return { content: completion.choices?.[0]?.message?.content ?? null, model, usage: completion.usage };
  };

  const model = activeOpenAiModel(params.stage);
  const rescue = plan.onTimeout && model !== plan.onTimeout.model ? plan.onTimeout : undefined;
  // Keep part of the budget for the rescue model when the planned one is slow.
  const canRescue = !!rescue && !!params.timeoutMs && params.timeoutMs > rescue.reserveMs + 20_000;
  const firstTimeout = canRescue ? params.timeoutMs! - rescue!.reserveMs : params.timeoutMs;
  try {
    return await call(model, firstTimeout);
  } catch (error) {
    if (canRescue && isTimeoutError(error)) {
      slowUntil.set(params.stage, Date.now() + SLOW_MEMORY_MS);
      console.warn(
        `[OpenAI] ${model} did not answer stage "${params.stage}" within ${Math.round(firstTimeout! / 1000)}s; using ${rescue!.model} for the next ${SLOW_MEMORY_MS / 60_000} min.`
      );
      try {
        return await call(rescue!.model, rescue!.reserveMs);
      } catch (rescueError) {
        if (!isModelUnavailableError(rescueError)) throw rescueError;
        return call(plan.legacy, rescue!.reserveMs);
      }
    }
    if (model === plan.legacy || !isModelUnavailableError(error)) throw error;
    unavailable.add(`${params.stage}:${model}`);
    console.warn(
      `[OpenAI] ${model} unavailable for stage "${params.stage}" (${aiErrorStatus(error)}: ${aiErrorMessage(error)}); using ${plan.legacy} instead.`
    );
    return call(plan.legacy, params.timeoutMs);
  }
}

/** Test hook: forget remembered fallbacks. */
export function resetOpenAiModelFallbacks(): void {
  unavailable.clear();
  slowUntil.clear();
}
