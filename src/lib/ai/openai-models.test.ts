import assert from "node:assert/strict";
import test from "node:test";
import {
  GPT_LUNA,
  GPT_SOL,
  STAGE_PLAN,
  activeOpenAiModel,
  createOpenAiChat,
  isModelUnavailableError,
  isTimeoutError,
  openAiModelFor,
  openAiTextParams,
  resetOpenAiModelFallbacks,
} from "./openai-models.ts";

test("Sol writes, Luna builds the long JSON stages", () => {
  assert.equal(GPT_SOL, "gpt-6.1-sol");
  assert.equal(GPT_LUNA, "gpt-6-luna");
  assert.equal(openAiModelFor("script", {}), GPT_SOL);
  assert.equal(openAiModelFor("writers_room", {}), GPT_SOL);
  for (const stage of ["context", "storyboard", "rewrite", "repair", "critic"] as const) {
    assert.equal(openAiModelFor(stage, {}), GPT_LUNA, stage);
  }
  assert.equal(STAGE_PLAN.storyboard.effort, "low");
  assert.equal(STAGE_PLAN.context.effort, "low");
  assert.equal(STAGE_PLAN.rewrite.effort, "none");
  assert.equal(STAGE_PLAN.script.onTimeout?.model, GPT_LUNA);
});

test("old per-stage env variables cannot keep a stage on an old model", () => {
  const stale = {
    OPENAI_SCRIPT_MODEL: "gpt-5.6-terra",
    OPENAI_STORYBOARD_MODEL: "gpt-4.1-mini",
    OPENAI_CONTEXT_MODEL: "gpt-4o-mini",
    OPENAI_STORYBOARD_CRITIC_MODEL: "gpt-4o-mini",
  };
  assert.equal(openAiModelFor("script", stale), GPT_SOL);
  assert.equal(openAiModelFor("storyboard", stale), GPT_LUNA);
  assert.equal(openAiModelFor("storyboard", { ...stale, OPENAI_TEXT_MODEL: "gpt-6-astra" }), "gpt-6-astra");
  assert.equal(openAiModelFor("context", { OPENAI_TEXT_MODEL: "  " }), GPT_LUNA);
});

test("reasoning parameters per model family", () => {
  assert.deepEqual(openAiTextParams(GPT_SOL, { maxTokens: 4000, temperature: 0.8, effort: "low" }), {
    max_completion_tokens: 8000,
    reasoning_effort: "low",
  });
  // Sol and Astra have no "none": it becomes "low".
  assert.equal(openAiTextParams(GPT_SOL, { maxTokens: 1000, effort: "none" }).reasoning_effort, "low");
  assert.equal(openAiTextParams("gpt-6-astra", { maxTokens: 1000, effort: "none" }).reasoning_effort, "low");
  assert.deepEqual(openAiTextParams(GPT_LUNA, { maxTokens: 14000, temperature: 0.7, effort: "none" }), {
    max_completion_tokens: 14000,
    reasoning_effort: "none",
  });
  assert.deepEqual(openAiTextParams("gpt-5.6-terra", { maxTokens: 4000, effort: "none" }), {
    max_completion_tokens: 8000,
    reasoning_effort: "low",
  });
  assert.deepEqual(openAiTextParams("o3", { maxTokens: 1000 }), { max_completion_tokens: 5000 });
  assert.deepEqual(openAiTextParams("gpt-4.1-mini", { maxTokens: 14000, temperature: 0.7 }), {
    max_tokens: 14000,
    temperature: 0.7,
  });
});

test("only model problems trigger the backup model; timeouts are told apart", () => {
  assert.equal(isModelUnavailableError({ status: 404, error: { code: "model_not_found" } }), true);
  assert.equal(isModelUnavailableError({ status: 400, message: "Unsupported value: 'none'" }), true);
  assert.equal(isModelUnavailableError({ status: 429, error: { code: "rate_limit_exceeded" } }), false);
  assert.equal(isModelUnavailableError({ status: 429, error: { code: "insufficient_quota" } }), false);
  assert.equal(isModelUnavailableError({ status: 400, error: { code: "context_length_exceeded" } }), false);
  assert.equal(isModelUnavailableError({ status: 401, error: { code: "invalid_api_key" } }), false);
  assert.equal(isTimeoutError(new Error("Request timed out.")), true);
  assert.equal(isTimeoutError({ status: 504, message: "Gateway timeout" }), false);
});

function fakeClient(responder: (body: Record<string, unknown>, timeout?: number) => unknown) {
  const calls: Array<{ body: Record<string, unknown>; timeout?: number }> = [];
  const client = {
    chat: {
      completions: {
        create: async (body: never, options?: { timeout?: number }) => {
          calls.push({ body: body as Record<string, unknown>, timeout: options?.timeout });
          return responder(body as Record<string, unknown>, options?.timeout);
        },
      },
    },
  };
  return { client, calls };
}

const ok = (content: string) => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
const quiet = async <T>(fn: () => Promise<T>) => {
  const warn = console.warn;
  console.warn = () => {};
  try { return await fn(); } finally { console.warn = warn; }
};

test("storyboard JSON goes to Luna, reasons, and keeps its response format", async () => {
  resetOpenAiModelFallbacks();
  const { client, calls } = fakeClient(() => ok("{}"));
  const res = await createOpenAiChat(client, {
    stage: "storyboard",
    messages: [{ role: "user", content: "x" }],
    maxTokens: 14000,
    temperature: 0.7,
    responseFormat: { type: "json_object" },
    timeoutMs: 200_000,
  });
  assert.equal(res.model, GPT_LUNA);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.body.reasoning_effort, "low");
  assert.equal(calls[0]!.body.max_completion_tokens, 18000);
  assert.deepEqual(calls[0]!.body.response_format, { type: "json_object" });
  // A short video asks for more thought, with room for it.
  await createOpenAiChat(client, { stage: "storyboard", messages: [], maxTokens: 14000, effort: "medium" });
  assert.equal(calls[1]!.body.reasoning_effort, "medium");
  assert.equal(calls[1]!.body.max_completion_tokens, 22000);
  assert.equal(calls[0]!.body.temperature, undefined);
  assert.equal(calls[0]!.timeout, 200_000);
});

test("a slow Sol hands the script to Luna inside the same budget, and stays skipped for a while", async () => {
  resetOpenAiModelFallbacks();
  const { client, calls } = fakeClient((body) => {
    if (body.model === GPT_SOL) throw new Error("Request timed out.");
    return ok("KỊCH BẢN");
  });
  const first = await quiet(() => createOpenAiChat(client, { stage: "script", messages: [], maxTokens: 4000, timeoutMs: 160_000 }));
  assert.equal(first.model, GPT_LUNA);
  assert.deepEqual(calls.map((c) => [c.body.model, c.timeout]), [[GPT_SOL, 115_000], [GPT_LUNA, 45_000]]);
  assert.equal(calls[1]!.body.reasoning_effort, "low");
  assert.equal(activeOpenAiModel("script", {}), GPT_LUNA);
  const second = await createOpenAiChat(client, { stage: "script", messages: [], maxTokens: 4000, timeoutMs: 160_000 });
  assert.equal(second.model, GPT_LUNA);
  assert.equal(calls.length, 3, "no second wait on Sol");
  // Other writer stages still try Sol on their own.
  assert.equal(activeOpenAiModel("writers_room", {}), GPT_SOL);
});

test("no access to the planned model → the stage's proven backup, remembered", async () => {
  resetOpenAiModelFallbacks();
  const { client, calls } = fakeClient((body) => {
    if (body.model === GPT_LUNA) throw Object.assign(new Error("The model `gpt-6-luna` does not exist"), { status: 404, code: "model_not_found" });
    return ok("{\"ok\":true}");
  });
  const first = await quiet(() => createOpenAiChat(client, { stage: "storyboard", messages: [], maxTokens: 14000, temperature: 0.7 }));
  assert.equal(first.model, "gpt-4.1-mini");
  assert.equal(calls[1]!.body.max_tokens, 14000);
  assert.equal(calls[1]!.body.temperature, 0.7);
  await createOpenAiChat(client, { stage: "storyboard", messages: [], maxTokens: 14000 });
  assert.equal(calls.length, 3, "remembered: no second attempt on Luna");
});

test("rate limits are not hidden behind another model", async () => {
  resetOpenAiModelFallbacks();
  const { client, calls } = fakeClient(() => {
    throw Object.assign(new Error("Rate limit"), { status: 429, code: "rate_limit_exceeded" });
  });
  await assert.rejects(createOpenAiChat(client, { stage: "script", messages: [], maxTokens: 4000, timeoutMs: 160_000 }), /Rate limit/);
  assert.equal(calls.length, 1);
});
