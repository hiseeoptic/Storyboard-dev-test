import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeCharacterReferences,
  normalizeCharacterPreset,
} from "./character-preset.ts";

test("loaded presets rebuild expired blob previews from persisted base64", () => {
  const [character] = normalizeCharacterPreset([{
    name: "Lan",
    role: "Wife",
    images: [{
      id: "lan-front",
      preview: "blob:https://storyboard.example/expired",
      base64: "QUJDRA==",
      fileName: "lan.jpg",
    }],
  }]);

  assert.equal(character?.images?.length, 1);
  assert.equal(character?.images?.[0]?.base64, "QUJDRA==");
  assert.equal(character?.images?.[0]?.preview, "data:image/jpeg;base64,QUJDRA==");
});

test("legacy presets keep only one frontal character photo", () => {
  const [character] = normalizeCharacterPreset([{
    name: "Minh",
    images: [
      { base64: "RlJPTlQ=", preview: "blob:front" },
      { base64: "U0lERQ==", preview: "blob:side" },
    ],
  }]);

  assert.deepEqual(character?.images?.map((image) => image.base64), ["RlJPTlQ="]);
});

test("manifest reference merge preserves a draft character and prefers full resolution", () => {
  const merged = mergeCharacterReferences(
    [{ name: "Lan", images: ["FULL_LAN"] }],
    [
      { name: "Lan", images: ["SMALL_LAN"] },
      { name: "Minh", images: ["DRAFT_MINH"] },
    ],
  );

  assert.deepEqual(merged, [
    { name: "Lan", images: ["FULL_LAN"] },
    { name: "Minh", images: ["DRAFT_MINH"] },
  ]);
});
