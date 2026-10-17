import assert from "node:assert/strict";
import test from "node:test";
import {
  addGroup,
  addRoom,
  emptyLibrary,
  findRoom,
  normalizeLibrary,
  placeForSegment,
  placeName,
  removeRoom,
  renameGroup,
  roomCount,
  setSegmentPhotos,
  shareWithEmptySegments,
  syncPresetPlaces,
  toggleRoomOnSegment,
  updateRoom,
  type LocationRoom,
  type SegmentPlace,
} from "./location-preset.ts";

type Img = { id: string; base64: string };
const toImages = (room: LocationRoom): Img[] => room.images.map((p) => ({ id: p.id, base64: p.base64 }));
const photo = (id: string) => ({ id, base64: `data:image/jpeg;base64,${id}`, fileName: `${id}.jpg` });

function homeLibrary() {
  const { library: a, groupId } = addGroup(emptyLibrary(), "Nhà tôi");
  const { library: b, roomId: kitchen } = addRoom(a, groupId, "Phòng bếp");
  const { library: c, roomId: bedroom } = addRoom(b, groupId, "Phòng ngủ");
  const lib = updateRoom(updateRoom(c, kitchen, { images: [photo("k1"), photo("k2")] }), bedroom, { images: [photo("b1")] });
  return { lib, groupId, kitchen, bedroom };
}

test("a set holds rooms with photos; names stay unique and previews come from the bytes", () => {
  const { lib, groupId, kitchen } = homeLibrary();
  const found = findRoom(lib, kitchen)!;
  assert.equal(placeName(found.group, found.room), "Phòng bếp (Nhà tôi)");
  assert.equal(found.room.images[0]!.base64, "k1", "data-URL prefix stripped");
  assert.equal(found.room.images[0]!.preview, "data:image/jpeg;base64,k1");
  assert.equal(addRoom(lib, groupId, "Phòng bếp").library.groups[0]!.rooms[2]!.name, "Phòng bếp 2");
  assert.equal(addGroup(lib, "Nhà tôi").library.groups[1]!.name, "Nhà tôi 2");
  assert.equal(renameGroup(lib, groupId, "  Nhà bà ngoại ").groups[0]!.name, "Nhà bà ngoại");
  assert.equal(roomCount(lib), 2);
  // At most five photos per room.
  const many = updateRoom(lib, kitchen, { images: ["1", "2", "3", "4", "5", "6"].map(photo) });
  assert.equal(findRoom(many, kitchen)!.room.images.length, 5);
});

test("stored libraries are cleaned on load", () => {
  const lib = normalizeLibrary({ groups: [{ name: "Nhà", rooms: [{ name: "Bếp", images: [{ base64: "" }, { base64: "abc" }] }] }, null] });
  assert.equal(lib.groups.length, 2);
  assert.equal(lib.groups[0]!.rooms[0]!.images.length, 1);
  assert.ok(lib.groups[0]!.rooms[0]!.id);
  assert.deepEqual(normalizeLibrary("junk"), emptyLibrary());
});

test("one room serves several segments and its photos travel once", () => {
  const { lib, kitchen, bedroom } = homeLibrary();
  const k = findRoom(lib, kitchen)!;
  const room = { id: kitchen, name: placeName(k.group, k.room), images: toImages(k.room) };
  let places: SegmentPlace<Img>[] = [];
  places = toggleRoomOnSegment(places, 1, room);
  places = toggleRoomOnSegment(places, 3, room);
  assert.equal(places.length, 1);
  assert.deepEqual(places[0]!.sceneIndices, [1, 3]);
  assert.equal(places[0]!.name, "Phòng bếp (Nhà tôi)");
  // Another room replaces the kitchen in segment 3 only.
  const b = findRoom(lib, bedroom)!;
  places = toggleRoomOnSegment(places, 3, { id: bedroom, name: placeName(b.group, b.room), images: toImages(b.room) });
  assert.deepEqual(placeForSegment(places, 1)?.presetRoomId, kitchen);
  assert.deepEqual(placeForSegment(places, 3)?.presetRoomId, bedroom);
  // Clicking the same room again takes it out.
  places = toggleRoomOnSegment(places, 1, room);
  assert.equal(placeForSegment(places, 1), undefined);
  assert.equal(places.length, 1);
});

test("photos uploaded into a segment detach it; sharing fills only empty segments", () => {
  const { lib, kitchen } = homeLibrary();
  const k = findRoom(lib, kitchen)!;
  let places = toggleRoomOnSegment<Img>([], 1, { id: kitchen, name: "Phòng bếp (Nhà tôi)", images: toImages(k.room) });
  places = shareWithEmptySegments(places, 1, 4);
  assert.deepEqual(places[0]!.sceneIndices, [1, 2, 3, 4]);
  places = setSegmentPhotos(places, 2, [{ id: "x", base64: "x" }]);
  assert.deepEqual(placeForSegment(places, 1)?.sceneIndices, [1, 3, 4]);
  assert.equal(placeForSegment(places, 2)?.name, "Đoạn 2");
  assert.equal(placeForSegment(places, 2)?.presetRoomId, undefined);
  places = setSegmentPhotos(places, 2, []);
  assert.equal(placeForSegment(places, 2), undefined);
});

test("pushed rooms follow the library: new photos and names, deleted rooms leave", () => {
  const { lib, kitchen, bedroom } = homeLibrary();
  const k = findRoom(lib, kitchen)!;
  const b = findRoom(lib, bedroom)!;
  let places = toggleRoomOnSegment<Img>([], 1, { id: kitchen, name: placeName(k.group, k.room), images: toImages(k.room) });
  places = toggleRoomOnSegment(places, 2, { id: bedroom, name: placeName(b.group, b.room), images: toImages(b.room) });
  places = setSegmentPhotos(places, 3, [{ id: "own", base64: "own" }]);
  const edited = removeRoom(updateRoom(lib, kitchen, { name: "Bếp mới", images: [photo("k3")] }), bedroom);
  const synced = syncPresetPlaces(places, edited, toImages);
  assert.equal(synced.length, 2);
  assert.equal(placeForSegment(synced, 1)?.name, "Bếp mới (Nhà tôi)");
  assert.deepEqual(placeForSegment(synced, 1)?.images.map((i) => i.id), ["k3"]);
  assert.equal(placeForSegment(synced, 2), undefined);
  assert.equal(placeForSegment(synced, 3)?.name, "Đoạn 3", "own uploads are untouched");
  // Nothing changed → the same objects come back.
  const same = syncPresetPlaces(synced, edited, toImages);
  assert.equal(same[0], synced[0]);
});
