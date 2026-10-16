import assert from "node:assert/strict";
import test from "node:test";
import { buildSetMap, cameraSideLock, landmarkList, setMapBrief } from "./set-map.ts";
import { ALL_SET_STYLES, SET_STYLE_GROUPS, composeSettingRequest, findSetStyle, suggestedSetStyles } from "./set-styles.ts";

const restaurant = {
  setting: "Small warm evening restaurant with honey-oak table, cream wall, woven pendant light, tiled floor, plate and napkin.",
  scenery:
    "Designed small contemporary neighborhood restaurant. Landmarks: honey-oak dining table, tiled floor with the visible chair-catching gap, cream wall with restrained abstract artwork, leafy potted plant, woven pendant shades and a small table-side practical.",
};

test("landmarks come from the scenery's Landmarks list, else the setting's with-list", () => {
  assert.deepEqual(landmarkList("Landmarks: a sofa, a bookshelf and a floor lamp."), ["sofa", "bookshelf", "floor lamp"]);
  assert.deepEqual(landmarkList("", "Kitchen with a stove, a window and a fridge"), ["stove", "window", "fridge"]);
});

test("an interior map anchors every landmark to the main furniture, one place each", () => {
  const map = buildSetMap(restaurant)!;
  assert.equal(map.exterior, false);
  assert.equal(map.anchor, "the honey-oak dining table");
  const where = Object.fromEntries(map.placements.map((p) => [p.item, p.position]));
  assert.equal(where["leafy potted plant"], "back-left corner, standing on the floor");
  assert.equal(where["cream wall with restrained abstract artwork"], "back wall, centred behind the dining table");
  assert.equal(where["woven pendant shades"], "hanging above the dining table");
  assert.equal(where["small table-side practical"], "right end of the dining table");
  assert.match(map.text, /never moved, mirrored, duplicated, removed or added/);
  assert.match(cameraSideLock(map), /left part of the view behind them \(leafy potted plant\)/);
  assert.match(setMapBrief(map), /^Set map: .*leafy potted plant back-left corner/);
});

test("a street keeps its route as the anchor; a café facing the street stays an interior", () => {
  const street = buildSetMap({
    setting: "Hang Bong street in Hanoi's Old Quarter at dusk",
    scenery: "Landmarks: narrow tube houses with yellow facades, wrought-iron balconies with bougainvillea, a street vendor's bamboo carrying pole, tangled overhead power lines.",
  })!;
  assert.equal(street.exterior, true);
  assert.equal(street.anchor, "the Hang Bong street");
  assert.match(street.text, /tangled overhead power lines — strung overhead across the street/);
  assert.match(street.text, /street vendor's bamboo carrying pole — left side, further along the street/);
  const cafe = buildSetMap({ setting: "Small café facing the street with booths, a counter and hanging lanterns", scenery: "" })!;
  assert.equal(cafe.exterior, false);
  assert.equal(cafe.anchor, "the counter");
});

test("too few landmarks → no map, but the camera side lock still applies", () => {
  assert.equal(buildSetMap({ setting: "Living room", scenery: "A cosy room." }), null);
  assert.match(cameraSideLock(null), /CAMERA SIDE LOCK/);
  assert.equal(setMapBrief(null), "");
});

test("set styles: unique ids, look-only briefs, genre suggestions", () => {
  const ids = ALL_SET_STYLES.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ALL_SET_STYLES.length >= 30);
  assert.ok(SET_STYLE_GROUPS.some((g) => g.id === "vietnam" && g.styles.length >= 8));
  for (const style of ALL_SET_STYLES) {
    assert.ok(style.prompt_en.length > 80, style.id);
    assert.ok(style.label_vi && style.label_en, style.id);
    // The story decides the time of day, not the set style.
    if (style.id !== "modern_rooftop") assert.doesNotMatch(style.prompt_en, /\b(daylight|morning|evening|night|dawn|dusk)\b/i, style.id);
  }
  assert.ok(suggestedSetStyles("historical").some((s) => s.id === "vn_hue_royal"));
  assert.ok(suggestedSetStyles("romance").length > 0);
});

test("the set request and style travel as labelled authority in the project setting", () => {
  const value = composeSettingRequest({ request: "một con phố Hàng Bông, Hà Nội", styleId: "vn_hanoi_old_quarter", place: "a busy urban street" });
  assert.match(value, /^USER SET REQUEST \(authority for where the story takes place\): một con phố Hàng Bông, Hà Nội \(place type: a busy urban street\)\./);
  assert.match(value, /SET STYLE \(authority for the look of every location without an uploaded photo\): Hanoi Old Quarter — /);
  assert.match(value, /recognisable real character/);
  // Only the old dropdown: unchanged short value.
  assert.equal(composeSettingRequest({ place: "a cozy cafe" }), "a cozy cafe");
  assert.equal(composeSettingRequest({}), "");
  assert.equal(findSetStyle("nope"), undefined);
});

test("a scenery without a Landmarks label still yields a set map", () => {
  const scenery = "Contemporary upscale Vietnamese restaurant interior: walnut dining table with visible grain, plank logic, and restrained satin finish; deep red-brown lacquered wall with real reflections; warm silk-shaded pendant lamps; a restrained Vietnamese-inspired artwork; small leafy plant in the background. Palette,,,,.";
  assert.deepEqual(landmarkList(scenery), [
    "walnut dining table",
    "deep red-brown lacquered wall",
    "warm silk-shaded pendant lamps",
    "restrained Vietnamese-inspired artwork",
    "small leafy plant",
  ]);
  const map = buildSetMap({ setting: "At the same upscale Vietnamese restaurant table in the evening", scenery })!;
  assert.equal(map.anchor, "the walnut dining table");
  assert.match(map.text, /small leafy plant — back-left corner/);
});
