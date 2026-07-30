import assert from "node:assert/strict";
import test from "node:test";
import {
  aiErrorCode,
  aiErrorStatus,
  isAiBillingError,
  shouldAbortAiPipeline,
  shouldRetryAiError,
} from "./retry-policy.ts";
import { estimateTextTokens } from "./usage.ts";

test("billing 429 fails fast and aborts the paid pipeline", () => {
  const error = {
    status: 429,
    error: {
      type: "insufficient_quota",
      code: "project_spend_limit_exceeded",
      message: "You exceeded your current quota, please check your plan and billing details.",
    },
  };

  assert.equal(aiErrorStatus(error), 429);
  assert.equal(aiErrorCode(error), "project_spend_limit_exceeded");
  assert.equal(isAiBillingError(error), true);
  assert.equal(shouldRetryAiError(error), false);
  assert.equal(shouldAbortAiPipeline(error), true);
});

test("message-only quota errors are still non-retryable", () => {
  const error = new Error(
    "429 You exceeded your current quota, please check your plan and billing details."
  );
  assert.equal(isAiBillingError(error), true);
  assert.equal(shouldRetryAiError(error), false);
});

test("real rate limiting and server failures remain retryable", () => {
  assert.equal(
    shouldRetryAiError({
      status: 429,
      code: "rate_limit_exceeded",
      message: "Rate limit reached for requests",
    }),
    true
  );
  assert.equal(shouldRetryAiError({ status: 503 }), true);
});

test("auth and invalid requests are not retried", () => {
  assert.equal(shouldRetryAiError({ status: 401 }), false);
  assert.equal(shouldRetryAiError({ status: 400 }), false);
});

test("text token estimate stays conservative and deterministic", () => {
  assert.equal(estimateTextTokens("1234", "5678"), 2);
  assert.equal(estimateTextTokens("12345"), 2);
  assert.equal(estimateTextTokens(undefined, null), 0);
});
