import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceProductPlacements,
  normalizeShopLink,
  placementItems,
  productPlacementDirective,
  shopName,
  shotsForPlacement,
} from "./product-placement.ts";

test("shop links are normalized and named", () => {
  assert.equal(normalizeShopLink("https://shopee.vn/ao-blazer-i.1.2"), "https://shopee.vn/ao-blazer-i.1.2");
  assert.equal(normalizeShopLink("shopee.vn/ao-blazer-i.1.2"), "https://shopee.vn/ao-blazer-i.1.2");
  assert.equal(normalizeShopLink("javascript:alert(1)"), "");
  assert.equal(normalizeShopLink("not a link"), "");
  assert.equal(shopName("https://www.amazon.com/dp/B0X"), "Amazon");
  assert.equal(shopName("https://shopee.vn/x"), "Shopee");
});

test("placement items are de-duplicated and outfits keep their wearer", () => {
  const items = placementItems([
    { name: "Áo blazer kem", kind: "outfit", worn_by: "Lan", link: "shopee.vn/a", has_images: true },
    { name: "áo blazer kem", kind: "outfit" },
    { name: "Bình giữ nhiệt", kind: "product", placement: "featured", worn_by: "ignored" },
    { name: "" },
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0]!.worn_by, "Lan");
  assert.equal(items[0]!.link, "https://shopee.vn/a");
  assert.equal(items[1]!.worn_by, undefined);
  assert.equal(items[1]!.placement, "featured");
});

test("directive tells the model who wears the outfit and how products appear", () => {
  const text = productPlacementDirective([
    { name: "Áo blazer kem", kind: "outfit", worn_by: "Lan", has_images: true },
    { name: "Bình giữ nhiệt", kind: "product", placement: "featured" },
    { name: "Đèn bàn", kind: "prop" },
  ]);
  assert.match(text, /OUTFIT "Áo blazer kem".*Lan wears EXACTLY this outfit/);
  assert.match(text, /PRODUCT "Bình giữ nhiệt".*FEATURED/);
  assert.match(text, /PROP "Đèn bàn".*NATURAL PLACEMENT/);
  assert.match(text, /NEVER shown or read on screen/);
  assert.equal(productPlacementDirective([]), "");
});

test("guard puts the outfit on its wearer and the links into captions", () => {
  const breakdown = {
    character_locks: [{ name: "Minh", costume: "navy suit" }, { name: "Lan", costume: "red dress" }],
    social_posts: {
      tiktok: { caption: "Sáng thứ Hai" },
      youtube_shorts: { description: "Sitcom văn phòng" },
      facebook_reel: { caption: "Cười xỉu" },
    },
  };
  const notes = enforceProductPlacements([
    { name: "Áo blazer kem", description: "cream double-breasted blazer", kind: "outfit", worn_by: "Lan", link: "https://shopee.vn/a", has_images: true },
    { name: "Váy xanh", kind: "outfit", worn_by: "Không có" },
  ], breakdown);
  assert.match(breakdown.character_locks[1]!.costume, /^Áo blazer kem — cream double-breasted blazer \(exactly as in its attached outfit reference photo/);
  assert.equal(breakdown.character_locks[0]!.costume, "navy suit");
  assert.match(breakdown.social_posts.tiktok.caption, /🛒 Áo blazer kem \(Shopee\): https:\/\/shopee\.vn\/a/);
  assert.match(breakdown.social_posts.youtube_shorts.description, /shopee\.vn\/a/);
  assert.equal(notes.length, 1);
  // idempotent: running again does not duplicate the link
  enforceProductPlacements([{ name: "Áo blazer kem", kind: "outfit", worn_by: "Lan", link: "https://shopee.vn/a" }], breakdown);
  assert.equal(breakdown.social_posts.tiktok.caption.split("shopee.vn/a").length, 2);
});

test("outfits ride on the wearer's shots, products where the story uses them", () => {
  const segments = [
    { characters_in_scene: ["Lan"], motion_prompt: "Lan pours coffee from the thermos bottle" },
    { characters_in_scene: ["Minh"], motion_prompt: "Minh types" },
    { characters_in_scene: ["Lan", "Minh"], motion_prompt: "they laugh" },
  ];
  const [outfit, bottle, lamp] = placementItems([
    { name: "Áo blazer kem", kind: "outfit", worn_by: "Lan" },
    { name: "thermos bottle", kind: "product" },
    { name: "Đèn bàn", kind: "prop" },
  ]);
  assert.deepEqual(shotsForPlacement(outfit!, segments), [0, 2]);
  assert.deepEqual(shotsForPlacement(bottle!, segments), [0]);
  assert.deepEqual(shotsForPlacement(lamp!, segments), [0, 1, 2], "never mentioned → every shot");
});
