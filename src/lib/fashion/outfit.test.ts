import assert from "node:assert/strict";
import test from "node:test";
import {
  fashionDirective,
  garmentLabel,
  outfitReferenceContract,
  missingSlots,
  normalizeGarmentAnalysis,
  outfitCostumeText,
  outfitSlotSummary,
  resolveFills,
  type CharacterOutfit,
} from "./outfit.ts";
import { enforceProductPlacements, fashionOutfits, placementItems, productPlacementDirective } from "../product-placement.ts";

test("a photo of only a top leaves the bottom and shoes to the app", () => {
  assert.deepEqual(missingSlots([{ slot: "top" }]), ["bottom", "footwear"]);
  assert.deepEqual(missingSlots([{ slot: "one_piece" }]), ["footwear"]);
  assert.deepEqual(missingSlots([{ slot: "top" }, { slot: "bottom" }, { slot: "footwear" }]), []);
  // A jacket alone still needs a top, a bottom and shoes.
  assert.deepEqual(missingSlots([{ slot: "outerwear" }]), ["top", "bottom", "footwear"]);
});

test("the vision answer is cleaned: unknown slots dropped, fills only for missing slots", () => {
  const a = normalizeGarmentAnalysis(
    {
      garments: [
        { slot: "top", description: "cream linen blouse with puff sleeves and wooden buttons", image_index: 0 },
        { slot: "hat-thing", description: "x" },
        { slot: "Top", description: "cream linen blouse with puff sleeves and wooden buttons" },
        { slot: "footwear", description: "white canvas sneakers", image_index: 9 },
      ],
      has_model_in_photo: true,
      audience: "woman",
      suggested_fills: { bottom: "high-waist sage wide-leg trousers", footwear: "should be dropped", top: "dropped" },
      style_note: "soft summer look",
    },
    2
  );
  assert.deepEqual(a.garments.map((g) => g.slot), ["top", "footwear"]);
  assert.equal(a.garments[1]!.image_index, undefined);
  assert.equal(a.has_model_in_photo, true);
  assert.equal(a.has_back_view, false);
  assert.deepEqual(a.suggested_fills, { bottom: "high-waist sage wide-leg trousers" });
  assert.equal(normalizeGarmentAnalysis(null, 1).audience, "unknown");
});

test("fills: user edit wins, then the vision suggestion, then a neutral piece for the age group", () => {
  const analysis = normalizeGarmentAnalysis({ garments: [{ slot: "top", description: "pink tee" }], suggested_fills: { bottom: "denim shorts" } }, 1);
  assert.deepEqual(resolveFills(analysis, "girl"), {
    bottom: "denim shorts",
    footwear: "comfortable children's sneakers or sandals in a neutral tone",
  });
  assert.equal(resolveFills(analysis, "girl", { bottom: "váy xếp ly trắng" }).bottom, "váy xếp ly trắng");
});

const outfit: CharacterOutfit = {
  wearer: "Mai",
  group: "girl",
  name: "Áo thun hồng thỏ",
  analysis: normalizeGarmentAnalysis({ garments: [{ slot: "top", description: "pink cotton T-shirt with a bunny print" }] }, 1),
  fills: { bottom: "white cotton shorts", footwear: "white sneakers" },
  imageCount: 1,
};

test("with a photo the costume is a label pointing at the photo, plus the app-styled pieces", () => {
  const text = outfitCostumeText(outfit);
  assert.equal(
    text,
    'pink cotton T-shirt — EXACTLY the garment in the attached OUTFIT photo "Áo thun hồng thỏ" (copied from the photo, never redrawn from words); plus pieces not in the photo (app-chosen, identical in every shot): bottom: white cotton shorts; footwear: white sneakers'
  );
  // The detail words that misled the image model stay out of the costume.
  assert.doesNotMatch(text, /bunny print/);
  // Without a photo the description is all there is.
  assert.match(outfitCostumeText({ ...outfit, imageCount: 0 }), /^pink cotton T-shirt with a bunny print; plus/);
  assert.equal(garmentLabel("strapless mini dress in light beige with a subtle textured fabric, featuring a ruffled top edge"), "strapless mini dress");
  assert.match(outfitReferenceContract([{ wearer: "Lan", productName: "Đầm beige" }]), /Lan wears EXACTLY the garment\(s\) in the attached OUTFIT photo "Đầm beige".*never copy a person/);
  assert.equal(outfitReferenceContract([]), "");
  assert.equal(outfitSlotSummary(outfit), "Áo ✅ · Quần / chân váy ⚙️ · Giày dép ⚙️");
});

test("fashion directive: selling arc, front-only note and child safety", () => {
  const d = fashionDirective([outfit]);
  assert.match(d, /Mai \(girl \(child\)\) wears "Áo thun hồng thỏ"/);
  assert.match(d, /avoid back views/);
  assert.match(d, /CHILDREN'S CLOTHING SAFETY/);
  assert.doesNotMatch(fashionDirective([{ ...outfit, group: "woman" }]), /CHILDREN'S CLOTHING SAFETY/);
  assert.equal(fashionDirective([]), "");
});

test("an outfit placement carries its fashion data to the directive and the costume lock", () => {
  const list = [{ name: "Áo thun hồng thỏ", kind: "outfit", worn_by: "Mai", placement: "featured", has_images: true, fashion: { ...outfit, wearer: "" } }];
  const items = placementItems(list);
  assert.equal(items[0]!.fashion?.wearer, "Mai");
  assert.equal(fashionOutfits(list).length, 1);
  assert.match(productPlacementDirective(list), /FASHION AFFILIATE CONTRACT/);
  const breakdown = { character_locks: [{ name: "Mai", costume: "random dress" }] };
  enforceProductPlacements(list, breakdown);
  assert.match(breakdown.character_locks[0]!.costume, /pink cotton T-shirt — EXACTLY the garment in the attached OUTFIT photo.*white cotton shorts/);
  // A product without fashion data keeps the old directive.
  assert.doesNotMatch(productPlacementDirective([{ name: "Chảo", kind: "product" }]), /FASHION/);
});
