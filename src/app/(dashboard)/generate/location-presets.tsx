"use client";

// ============================================================
// 🏠 Saved locations — the user's own places, reused like the cast preset.
// Sets ("Nhà tôi", "Văn phòng"…) hold rooms; photos uploaded into a room are
// saved at once, and the segment chips on each room push it into those
// 10-second segments.
// ============================================================
import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageUploader, type UploadedImage } from "@/components/ui/image-uploader";
import { cn } from "@/lib/utils";
import {
  GROUP_SUGGESTIONS,
  MAX_ROOM_PHOTOS,
  ROOM_SUGGESTIONS,
  addGroup,
  addRoom,
  removeGroup,
  removeRoom,
  renameGroup,
  updateRoom,
  type LocationLibrary,
  type LocationRoom,
} from "@/lib/location-preset";

type Lang = "vi" | "en";

/** A saved room as uploader images (same ids, so sync can tell when photos change). */
export const roomImages = (room: LocationRoom): UploadedImage[] =>
  room.images.map((p) => ({ id: p.id, base64: p.base64, fileName: p.fileName, preview: p.preview || `data:image/jpeg;base64,${p.base64}` }));

export function LocationPresetPanel(props: {
  lang: Lang;
  library: LocationLibrary;
  /** Applied to the latest library (two quick uploads never overwrite each other). */
  onChange: (update: (library: LocationLibrary) => LocationLibrary) => void;
  segmentCount: number;
  /** The saved room pushed into segment n, if any. */
  roomOnSegment: (n: number) => string | undefined;
  onToggleSegment: (roomId: string, n: number) => void;
  /** Photos to save as a new room (from a segment's own upload). */
  seed?: { key: number; images: UploadedImage[] } | null;
}) {
  const { lang, library, onChange, segmentCount, roomOnSegment, onToggleSegment, seed } = props;
  const vi = lang === "vi";
  const [groupId, setGroupId] = useState<string>("");
  const [roomName, setRoomName] = useState("");
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const group = library.groups.find((g) => g.id === groupId) ?? library.groups[0];

  useEffect(() => {
    if (!group && groupId) setGroupId("");
  }, [group, groupId]);

  // "Save this segment's photos as a room": a new room in the open set, with those photos.
  useEffect(() => {
    if (!seed?.images.length) return;
    const wanted = group?.id;
    onChange((lib) => {
      let gid = wanted && lib.groups.some((g) => g.id === wanted) ? wanted : lib.groups[0]?.id;
      if (!gid) {
        const made = addGroup(lib, GROUP_SUGGESTIONS[0]!);
        lib = made.library;
        gid = made.groupId;
      }
      setGroupId(gid);
      const { library: withRoom, roomId } = addRoom(lib, gid, vi ? "Bối cảnh mới" : "New place");
      return updateRoom(withRoom, roomId, { images: seed.images });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed?.key]);

  const createGroup = (name: string) => {
    onChange((lib) => {
      const { library: next, groupId: id } = addGroup(lib, name);
      setGroupId(id);
      return next;
    });
    setNewGroup(null);
  };
  const createRoom = (name: string) => {
    const wanted = group?.id;
    onChange((lib) => {
      let gid = wanted && lib.groups.some((g) => g.id === wanted) ? wanted : lib.groups[0]?.id;
      if (!gid) {
        const made = addGroup(lib, GROUP_SUGGESTIONS[0]!);
        lib = made.library;
        gid = made.groupId;
        setGroupId(gid);
      }
      return addRoom(lib, gid, name).library;
    });
    setRoomName("");
  };

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.04] p-3">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">🏠 {vi ? "Bối cảnh đã lưu (preset)" : "Saved locations (preset)"}</p>
        <p className="text-xs text-muted-foreground">
          {vi
            ? "Tạo bộ bối cảnh (VD: Nhà tôi) gồm các phòng — bếp, phòng khách, phòng ngủ… Tải ảnh vào phòng là tự lưu trong trình duyệt, dùng lại cho mọi dự án. Bấm Đ1, Đ2… trên phòng để đẩy thẳng phòng đó vào đoạn tương ứng."
            : "Make a set (e.g. My home) with rooms. Photos uploaded into a room are saved in this browser for every project. Tap S1, S2… on a room to push it into that segment."}
        </p>
      </div>

      {/* Sets */}
      <div className="flex flex-wrap items-center gap-1.5">
        {library.groups.map((g) =>
          renaming === g.id ? (
            <Input
              key={g.id}
              autoFocus
              defaultValue={g.name}
              className="h-8 w-40 text-xs"
              onBlur={(e) => { const name = e.target.value; onChange((lib) => renameGroup(lib, g.id, name)); setRenaming(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }}
            />
          ) : (
            <button
              key={g.id}
              type="button"
              onClick={() => setGroupId(g.id)}
              onDoubleClick={() => setRenaming(g.id)}
              aria-pressed={group?.id === g.id}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                group?.id === g.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-border bg-background hover:border-emerald-500/60"
              )}
            >
              {g.name} · {g.rooms.filter((r) => r.images.length).length}
            </button>
          )
        )}
        {newGroup === null ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setNewGroup("")}>
            <Plus className="h-3.5 w-3.5" />
            {vi ? "Bộ mới" : "New set"}
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              autoFocus
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && newGroup.trim()) createGroup(newGroup); if (e.key === "Escape") setNewGroup(null); }}
              placeholder={vi ? "Tên bộ, VD: Nhà ông bà" : "Set name"}
              className="h-8 w-44 text-xs"
            />
            {GROUP_SUGGESTIONS.filter((s) => !library.groups.some((g) => g.name === s)).slice(0, 3).map((s) => (
              <button key={s} type="button" onClick={() => createGroup(s)} className="rounded-full border border-dashed px-2.5 py-0.5 text-[11px] hover:border-emerald-500/60">
                {s}
              </button>
            ))}
            <Button type="button" size="sm" disabled={!newGroup.trim()} onClick={() => createGroup(newGroup)}>{vi ? "Tạo" : "Create"}</Button>
          </div>
        )}
        {group && (
          <>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(group.id)} title={vi ? "Đổi tên bộ" : "Rename set"}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              title={vi ? "Xoá cả bộ" : "Delete set"}
              onClick={() => { if (window.confirm(vi ? `Xoá bộ "${group.name}" và toàn bộ ảnh?` : `Delete "${group.name}" and its photos?`)) onChange((lib) => removeGroup(lib, group.id)); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Add a room */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && roomName.trim()) createRoom(roomName); }}
          placeholder={vi ? `Thêm phòng vào "${group?.name ?? GROUP_SUGGESTIONS[0]}"…` : "Add a room…"}
          className="h-8 w-52 text-xs"
        />
        <Button type="button" size="sm" variant="outline" disabled={!roomName.trim()} onClick={() => createRoom(roomName)}>
          <Plus className="h-3.5 w-3.5" />
          {vi ? "Thêm" : "Add"}
        </Button>
        {ROOM_SUGGESTIONS.filter((s) => !group?.rooms.some((r) => r.name === s)).slice(0, 6).map((s) => (
          <button key={s} type="button" onClick={() => createRoom(s)} className="rounded-full border border-dashed px-2.5 py-0.5 text-[11px] hover:border-emerald-500/60">
            + {s}
          </button>
        ))}
      </div>

      {/* Rooms */}
      {group && group.rooms.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {group.rooms.map((room) => (
            <div key={room.id} className="space-y-2 rounded-md border bg-background p-2">
              <div className="flex items-center gap-1.5">
                <Input
                  defaultValue={room.name}
                  key={`${room.id}-${room.name}`}
                  onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== room.name) onChange((lib) => updateRoom(lib, room.id, { name })); }}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  className="h-8 text-xs font-medium"
                  aria-label={vi ? "Tên phòng" : "Room name"}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  title={vi ? "Xoá phòng" : "Delete room"}
                  onClick={() => { if (!room.images.length || window.confirm(vi ? `Xoá "${room.name}"?` : `Delete "${room.name}"?`)) onChange((lib) => removeRoom(lib, room.id)); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <ImageUploader
                images={roomImages(room)}
                onChange={(images) => onChange((lib) => updateRoom(lib, room.id, { images }))}
                maxImages={MAX_ROOM_PHOTOS}
                hint={vi ? `${room.images.length}/${MAX_ROOM_PHOTOS} ảnh · cùng một nơi, nhiều góc` : `${room.images.length}/${MAX_ROOM_PHOTOS} photos · same place, several angles`}
              />
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-muted-foreground">{vi ? "Dùng cho đoạn:" : "Use in:"}</span>
                {Array.from({ length: segmentCount }, (_, i) => i + 1).map((n) => {
                  const active = roomOnSegment(n) === room.id;
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={!room.images.length}
                      onClick={() => onToggleSegment(room.id, n)}
                      aria-pressed={active}
                      title={vi ? `Đoạn ${n}` : `Segment ${n}`}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        active ? "border-emerald-600 bg-emerald-600 text-white" : "border-border hover:border-emerald-500/60"
                      )}
                    >
                      {vi ? `Đ${n}` : `S${n}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {(!group || group.rooms.length === 0) && (
        <p className="text-xs text-muted-foreground">
          {vi ? "Chưa có phòng nào — bấm một gợi ý (+ Phòng khách, + Phòng bếp…) rồi tải ảnh vào." : "No rooms yet — tap a suggestion, then upload photos."}
        </p>
      )}
    </div>
  );
}
