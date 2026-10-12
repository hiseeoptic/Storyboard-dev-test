import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPENAI_TEXT_MODEL,
  createOpenAiChat,
  isModelUnavailableError,
  openAiModelFor,
  openAiTextParams,
  resetOpenAiModelFallbacks,
} from "./openai-models.ts";

test("every text stage defaults to GPT-6.1 Sol", () => {
  assert.equal(DEFAULT_OPENAI_TEXT_MODEL, "gpt-6.1-sol");
  for (const stage of ["script", "context", "storyboard", "rewrite", "critic", "repair", "writers_room"] as const) {
    assert.equal(openAiModelFor(stage, {}), "gpt-6.1-sol", stage);
  }
});

test("old per-stage env variables cannot keep a stage on an old model", () => {
  const stale = {
    OPENAI_SCRIPT_MODEL: "gpt-5.6-terra",
    OPENAI_STORYBOARD_MODEL: "gpt-4.1-mini",
    OPENAI_STORYBOARD_REWRITE_MODEL: "gpt-4.1-mini",
    OPENAI_STORYBOARD_REPAIR_MODEL: "gpt-4.1-mini",
    OPENAI_CONTEXT_MODEL: "gpt-4o-mini",
    OPENAI_STORYBOARD_CRITIC_MODEL: "gpt-4o-mini",
  };
  for (const stage of ["script", "context", "storyboard", "rewrite", "critic", "repair", "writers_room"] as const) {
    assert.equal(openAiModelFor(stage, stale), "gpt-6.1-sol", stage);
  }
  assert.equal(openAiModelFor("storyboard", { ...stale, OPENAI_TEXT_MODEL: "gpt-6-astra" }), "gpt-6-astra");
  assert.equal(openAiModelFor("context", { OPENAI_TEXT_MODEL: "  " }), "gpt-6.1-sol");
});

test("Sol gets reasoning parameters, never temperature or max_tokens", () => {
  const params = openAiTextParams("gpt-6.1-sol", { maxTokens: 14000, temperature: 0.7 });
  assert.deepEqual(params, { max_completion_tokens: 18000, reasoning_effort: "low" });
  assert.deepEqual(openAiTextParams("gpt-5.6-terra", { maxTokens: 4000, temperature: 0.85 }), {
    max_completion_tokens: 8000,
    reasoning_effort: "low",
  });
  assert.deepEqual(openAiTextParams("o3", { maxTokens: 1000 }), { max_completion_tokens: 5000 });
  assert.deepEqual(openAiTextParams("gpt-4.1-mini", { maxTokens: 14000, temperature: 0.7 }), {
    max_tokens: 14000,
    temperature: 0.7,
  });
});

test("only model problems trigger the backup model", () => {
  assert.equal(isModelUnavailableError({ status: 404, error: { code: "model_not_found" } }), true);
  assert.equal(isModelUnavailableError({ status: 400, message: "Unsupported parameter: 'temperature'" }), true);
  assert.equal(isModelUnavailableError({ status: 403, message: "Project does not have access to model gpt-6.1-sol" }), true);
  assert.equal(isModelUnavailableError({ status: 429, error: { code: "rate_limit_exceeded" } }), false);
  assert.equal(isModelUnavailableError({ status: 429, error: { code: "insufficient_quota" } }), false);
  assert.equal(isModelUnavailableError({ status: 400, error: { code: "context_length_exceeded" } }), false);
  assert.equal(isModelUnavailableError({ status: 401, error: { code: "invalid_api_key" } }), false);
  assert.equal(isModelUnavailableError(new Error("Request timed out.")), false);
});

function fakeClient(responder: (body: Record<string, unknown>) => unknown) {
  const bodies: Array<Record<string, unknown>> = [];
  const client = {
    chat: {
      completions: {
        create: async (body: never) => {
          bodies.push(body as Record<string, unknown>);
          return responder(body as Record<string, unknown>);
        },
      },
    },
  };
  return { client, bodies };
}

const ok = (content: string) => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });

test("Sol request carries the stage's response format", async () => {
  resetOpenAiModelFallbacks();
  const { client, bodies } = fakeClient(() => ok("{}"));
  const res = await createOpenAiChat(client, {
    stage: "storyboard",
    messages: [{ role: "user", content: "x" }],
    maxTokens: 14000,
    temperature: 0.7,
    responseFormat: { type: "json_object" },
  });
  assert.equal(res.model, "gpt-6.1-sol");
  assert.equal(res.content, "{}");
  assert.equal(bodies.length, 1);
  assert.deepEqual(bodies[0]!.response_format, { type: "json_object" });
  assert.equal(bodies[0]!.temperature, undefined);
  assert.equal(bodies[0]!.max_tokens, undefined);
});

test("no access to Sol → the stage's previous model, remembered afterwards", async () => {
  resetOpenAiModelFallbacks();
  const { client, bodies } = fakeClient((body) => {
    if (body.model === "gpt-6.1-sol") throw Object.assign(new Error("The model `gpt-6.1-sol` does not exist"), { status: 404, code: "model_not_found" });
    return ok("{\"ok\":true}");
  });
  const warn = console.warn;
  console.warn = () => {};
  try {
    const first = await createOpenAiChat(client, { stage: "storyboard", messages: [], maxTokens: 14000, temperature: 0.7 });
    assert.equal(first.model, "gpt-4.1-mini");
    assert.deepEqual(bodies.map((b) => b.model), ["gpt-6.1-sol", "gpt-4.1-mini"]);
    assert.equal(bodies[1]!.max_tokens, 14000);
    assert.equal(bodies[1]!.temperature, 0.7);
    const second = await createOpenAiChat(client, { stage: "storyboard", messages: [], maxTokens: 14000 });
    assert.equal(second.model, "gpt-4.1-mini");
    assert.equal(bodies.length, 3, "remembered: no second attempt on Sol");
    // Other stages still try Sol on their own.
    await createOpenAiChat(client, { stage: "context", messages: [], maxTokens: 7000 });
    assert.deepEqual(bodies.slice(3).map((b) => b.model), ["gpt-6.1-sol", "gpt-4o-mini"]);
  } finally {
    console.warn = warn;
  }
});

test("rate limits and timeouts are not hidden behind the backup model", async () => {
  resetOpenAiModelFallbacks();
  const { client, bodies } = fakeClient(() => {
    throw Object.assign(new Error("Rate limit"), { status: 429, code: "rate_limit_exceeded" });
  });
  await assert.rejects(createOpenAiChat(client, { stage: "script", messages: [], maxTokens: 4000 }), /Rate limit/);
  assert.equal(bodies.length, 1);
});
