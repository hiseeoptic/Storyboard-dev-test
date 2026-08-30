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

test("script treatment provenance reaches technical planning", () => {
  const promptSource = readFileSync(new URL("../../prompts/storyboard-breakdown.ts", import.meta.url), "utf8");
  const actionSource = readFileSync(new URL("../../actions/storyboard.ts", import.meta.url), "utf8");
  assert.match(promptSource, /CREATIVE POLISH SELECTED IN MENU/);
  assert.match(actionSource, /"editorial_revision"/);
  assert.match(actionSource, /source_script_revision: sourceScriptRevision/);
});

test("camera selections cannot alter the Stage-1 dialogue-writing prompt", () => {
  const promptSource = readFileSync(new URL("../../prompts/storyboard-breakdown.ts", import.meta.url), "utf8");
  const routingSource = readFileSync(new URL("../creative-routing/compiler.ts", import.meta.url), "utf8");
  assert.match(promptSource, /const creativeRouteDirective = renderCreativeScriptRouteDirective\(input\)/);
  const isolatedRoute = routingSource.match(
    /export function renderCreativeScriptRouteDirective[\s\S]*?(?=export function renderCreativeVisualDirective)/
  )?.[0] ?? "";
  assert.match(isolatedRoute, /CREATIVE SCRIPT ROUTE — CAMERA-ISOLATED/);
  assert.match(isolatedRoute, /Camera\/directing profiles are intentionally absent/i);
  assert.doesNotMatch(isolatedRoute, /DIRECTING_LAWS|REAL_WORLD_MATERIAL_LAWS|directing_profiles/);
});

test("camera may hold a silent listener without transferring lip-sync", () => {
  const promptSource = readFileSync(new URL("../../prompts/storyboard-breakdown.ts", import.meta.url), "utf8");
  assert.match(promptSource, /Never pan to the speaker merely because they talk/);
  assert.match(promptSource, /visible listener keeps their mouth naturally closed/);
  assert.match(promptSource, /delivery=off_screen or voiceover, NO visible mouth moves/);
  assert.doesNotMatch(promptSource, /camera settles and holds on whoever is speaking/i);
});

test("creative writing has no fixed word quota while delivery remains timed", () => {
  const promptSource = readFileSync(
    new URL("../../prompts/storyboard-breakdown.ts", import.meta.url),
    "utf8"
  );
  // A soft delivery-rate cap (words that fit a natural ~150 wpm) replaces the old
  // "do NOT count words" stance so dialogue is never compressed past 190 wpm.
  assert.match(promptSource, /DELIVERY CAP/);
  assert.match(promptSource, /150 words per minute/i);
  assert.match(promptSource, /BALANCE SPEECH BY DELIVERY TIME, NOT WORD COUNT/);
  assert.match(promptSource, /dialogue clock and WPM validator decide whether delivery fits/i);
  assert.doesNotMatch(promptSource, /AT MOST 18 TOTAL spoken words/i);
});

test("stick-figure life-wisdom narration is one causal story rather than quote cards", () => {
  const promptSource = readFileSync(
    new URL("../../prompts/storyboard-breakdown.ts", import.meta.url),
    "utf8"
  );
  assert.match(promptSource, /STICK-FIGURE LIFE-WISDOM NARRATION/);
  assert.match(promptSource, /ONE continuous narrated story/);
  assert.match(promptSource, /not separate slogans, captions, list items/);
  assert.match(promptSource, /visible stick figures never speak, converse or lip-sync/);
  assert.match(promptSource, /8\.5-9\.5 seconds of purposeful narration/);
  assert.match(promptSource, /instead of leaving dead air/);
});

test("ten-second storyboard action is capacity-limited and sequential", () => {
  const promptSource = readFileSync(
    new URL("../../prompts/storyboard-breakdown.ts", import.meta.url),
    "utf8"
  );
  assert.match(promptSource, /10-SECOND ACTION CAPACITY CONTRACT/);
  assert.match(promptSource, /at most THREE production-changing atomic transitions/);
  assert.match(promptSource, /Complete each transition before beginning the next/);
  assert.match(promptSource, /ACTION CAPACITY REPAIR/);
});

test("the OpenAI script writer defaults to balanced Terra at low reasoning", () => {
  const engineSource = readFileSync(
    new URL("../../services/ai-engine.ts", import.meta.url),
    "utf8"
  );
  assert.match(engineSource, /OPENAI_SCRIPT_MODEL \|\| "gpt-5\.6-terra"/);
  assert.match(engineSource, /reasoning_effort: "low"/);
});
