import assert from "node:assert/strict";
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
