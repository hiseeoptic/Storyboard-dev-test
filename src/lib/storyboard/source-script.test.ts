import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { approvedScriptFromStoryIdea } from "./source-script.ts";

test("uses a long labelled screenplay directly", () => {
  const script = `
Kịch bản:
Tiếng cửa mở. Người vợ đặt ly nước lên bàn và chờ chồng.

Vợ:
"Anh về rồi à? Uống miếng nước đi."

Chồng:
"Ừ, để đó anh uống sau."

Một lúc sau, anh quay lại và nhận ra ly nước đã nguội.
`.repeat(4);

  assert.equal(approvedScriptFromStoryIdea(script), script.trim());
});

test("does not mistake a long creative brief for an approved screenplay", () => {
  const brief = (
    "Hãy tạo một phim gia đình chân thực về sự quan tâm bị bỏ lỡ. " +
    "Bối cảnh trong nhà, ánh sáng vàng, nhịp cảm xúc chậm. "
  ).repeat(12);
  assert.equal(approvedScriptFromStoryIdea(brief), null);
});

test("does not bypass writing for a short dialogue idea", () => {
  assert.equal(
    approvedScriptFromStoryIdea('Vợ: "Anh về rồi à?"\nChồng: "Ừ, anh về rồi."'),
    null
  );
});

test("all speech menu modes reach both script and storyboard prompts", () => {
  const promptSource = readFileSync(
    new URL("../../prompts/storyboard-breakdown.ts", import.meta.url),
    "utf8"
  );
  assert.match(promptSource, /resolveSpeechMode/);
  assert.match(promptSource, /SPEECH MODE — MIXED/);
  assert.match(promptSource, /SPEECH MODE — VOICE-OVER ONLY/);
  assert.match(promptSource, /SPEECH MODE — CHARACTER DIALOGUE ONLY/);
  assert.match(promptSource, /SPEECH MODE — WORDLESS/);
  assert.match(promptSource, /ANONYMOUS CHARACTER AUTHORITY/);
  assert.match(promptSource, /speaker=\"\", delivery=\"voiceover\"/);
});

test("creative writing has no fixed word quota while delivery remains timed", () => {
  const promptSource = readFileSync(
    new URL("../../prompts/storyboard-breakdown.ts", import.meta.url),
    "utf8"
  );
  assert.match(promptSource, /do NOT count words or force every clip/i);
  assert.match(promptSource, /BALANCE SPEECH BY DELIVERY TIME, NOT WORD COUNT/);
  assert.match(promptSource, /dialogue clock and WPM validator decide whether delivery fits/i);
  assert.doesNotMatch(promptSource, /AT MOST 18 TOTAL spoken words/i);
});

test("the OpenAI script writer defaults to balanced Terra at low reasoning", () => {
  const engineSource = readFileSync(
    new URL("../../services/ai-engine.ts", import.meta.url),
    "utf8"
  );
  assert.match(engineSource, /OPENAI_SCRIPT_MODEL \|\| "gpt-5\.6-terra"/);
  assert.match(engineSource, /reasoning_effort: "low"/);
});
