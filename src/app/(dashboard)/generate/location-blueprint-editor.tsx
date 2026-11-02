"use client";

// Phòng biên tập — review / edit the structured blueprint of every place before
// the storyboard is built. The world key, set map, fixed-set locks and the
// script supervisor all read this structure, so fixing a place here fixes it in
// every image and video of that place.

import { useState } from "react";
import { MapPin, Plus, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  editorBlueprint,
  editorLocations,
  joinFrameZone,
  ledgerPropNames,
  seedBlueprint,
  splitFrameZone,
  upsertBlueprint,
  type FrameDepth,
  type FrameX,
} from "@/lib/continuity/blueprint";
import type { BlueprintElement, BlueprintKind, LocationBlueprint } from "@/lib/continuity/types";
import type { StoryboardGenerationOutput } from "@/types";

type Lang = "vi" | "en";

const KIND_OPTIONS = (vi: boolean): { value: BlueprintKind; label: string }[] => [
  { value: "interior", label: vi ? "Trong nhà" : "Interior" },
  { value: "exterior", label: vi ? "Ngoài trời" : "Exterior" },
  { value: "vehicle", label: vi ? "Trong xe / phương tiện" : "Vehicle" },
  { value: "other", label: vi ? "Khác (sân khấu, studio…)" : "Other" },
];
const X_OPTIONS = (vi: boolean): { value: FrameX; label: string }[] => [
  { value: "", label: vi ? "— ngang —" : "— side —" },
  { value: "left", label: vi ? "Trái" : "Left" },
  { value: "centre", label: vi ? "Giữa" : "Centre" },
  { value: "right", label: vi ? "Phải" : "Right" },
];
const DEPTH_OPTIONS = (vi: boolean): { value: FrameDepth; label: string }[] => [
  { value: "", label: vi ? "— sâu —" : "— depth —" },
  { value: "foreground", label: vi ? "Tiền cảnh" : "Foreground" },
  { value: "midground", label: vi ? "Trung cảnh" : "Midground" },
  { value: "background", label: vi ? "Hậu cảnh" : "Background" },
];

function headOf(name: string): string {
  const word = name.toLocaleLowerCase().trim().split(/\s+/).pop() ?? "";
  return word.replace(/(?:x|ch|sh|ss)es$/, (m) => m.slice(0, -2)).replace(/([^s])s$/, "$1");
}

function PlaceEditor({
  blueprint,
  propHeads,
  lang,
  onChange,
}: {
  blueprint: LocationBlueprint;
  propHeads: Set<string>;
  lang: Lang;
  onChange: (next: LocationBlueprint) => void;
}) {
  const vi = lang === "vi";
  const set = (patch: Partial<LocationBlueprint>) => onChange({ ...blueprint, ...patch });
  const setElement = (index: number, patch: Partial<BlueprintElement>) =>
    set({ fixed_elements: blueprint.fixed_elements.map((e, i) => (i === index ? { ...e, ...patch } : e)) });
  const elements = blueprint.fixed_elements;
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">{vi ? "Tên bối cảnh (ngắn, không phải câu)" : "Place name"}</span>
          <Input value={blueprint.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="space-y-1 text-xs">
          <span className="font-medium text-muted-foreground">{vi ? "Loại bối cảnh" : "Kind"}</span>
          <Select value={blueprint.kind} options={KIND_OPTIONS(vi)} onChange={(e) => set({ kind: e.target.value as BlueprintKind })} />
        </label>
      </div>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-muted-foreground">{vi ? "Máy chính đứng ở đâu, nhìn về đâu" : "Master view"}</span>
        <Input value={blueprint.master_view} onChange={(e) => set({ master_view: e.target.value })} />
      </label>
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          {vi
            ? "Đồ cố định (không ai di chuyển) — dòng đầu là vật làm mốc. Vị trí tính theo khung của máy chính."
            : "Fixed elements (nobody moves them) — the first row is the anchor. Zones are in the master view."}
        </p>
        {elements.map((element, index) => {
          const zone = splitFrameZone(element.frame_zone);
          const isProp = propHeads.has(headOf(element.name));
          return (
            <div key={index} className="space-y-1 rounded border border-dashed p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 text-[11px] font-semibold text-muted-foreground">{index === 0 ? (vi ? "MỐC" : "ANCHOR") : `#${index + 1}`}</span>
                <Input className="h-8 min-w-[10rem] flex-1" value={element.name} onChange={(e) => setElement(index, { name: e.target.value })} />
                <Select className="h-8 w-28" value={zone.x} options={X_OPTIONS(vi)} onChange={(e) => setElement(index, { frame_zone: joinFrameZone(e.target.value as FrameX, zone.depth) })} />
                <Select className="h-8 w-32" value={zone.depth} options={DEPTH_OPTIONS(vi)} onChange={(e) => setElement(index, { frame_zone: joinFrameZone(zone.x, e.target.value as FrameDepth) })} />
                {index > 0 ? (
                  <Button variant="outline" size="sm" className="h-8" onClick={() => set({ fixed_elements: [element, ...elements.filter((_, i) => i !== index)] })}>
                    {vi ? "Làm mốc" : "Anchor"}
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="h-8" onClick={() => set({ fixed_elements: elements.filter((_, i) => i !== index) })} aria-label={vi ? "Xoá" : "Remove"}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <Input
                className="h-8"
                placeholder={vi ? "Vị trí so với vật mốc (vd: sát tường sau, sau lưng quầy)" : "Relation to the anchor (e.g. against the back wall)"}
                value={element.relation}
                onChange={(e) => setElement(index, { relation: e.target.value })}
              />
              {isProp ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  {vi ? "⚠️ Vật này có tay di chuyển trong kịch bản (là đạo cụ) — khi xuất sẽ không bị khóa cố định." : "⚠️ A hand moves this in the script (a prop) — it is not locked as fixed."}
                </p>
              ) : null}
            </div>
          );
        })}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => set({ fixed_elements: [...elements, { name: "", frame_zone: "", relation: "" }] })}
        >
          <Plus className="h-3.5 w-3.5" /> {vi ? "Thêm đồ cố định" : "Add fixed element"}
        </Button>
        {elements.filter((e) => e.name.trim()).length < 2 ? (
          <p className="text-[11px] text-red-700 dark:text-red-300">
            {vi ? "Cần ít nhất 2 đồ cố định có vị trí — thiếu thì thư ký trường quay sẽ khóa xuất (CONT-001)." : "At least 2 fixed elements are needed (CONT-001)."}
          </p>
        ) : null}
      </div>
      <label className="block space-y-1 text-xs">
        <span className="font-medium text-muted-foreground">{vi ? "Ánh sáng: nguồn và hướng (theo máy chính)" : "Light: source and direction"}</span>
        <Input value={blueprint.light} onChange={(e) => set({ light: e.target.value })} />
      </label>
    </div>
  );
}

export function LocationBlueprintEditor({
  draft,
  lang,
  onChange,
}: {
  draft: StoryboardGenerationOutput;
  lang: Lang;
  onChange: (blueprints: LocationBlueprint[]) => void;
}) {
  const vi = lang === "vi";
  const locations = editorLocations(draft);
  const [open, setOpen] = useState(true);
  if (locations.length === 0) return null;
  const propHeads = new Set(ledgerPropNames(draft).map(headOf).filter((h) => h.length >= 3));
  const save = (blueprint: LocationBlueprint) => onChange(upsertBlueprint(draft.location_blueprints, blueprint));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4" /> {vi ? "Bản thiết kế bối cảnh" : "Location blueprints"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? (vi ? "Thu gọn" : "Collapse") : (vi ? "Mở" : "Open")}
          </Button>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {vi
            ? "Mỗi bối cảnh có một bản thiết kế: World Key, bản đồ, khóa đồ cố định và bộ soát đều đọc từ đây — sửa ở đây là sửa cho mọi ảnh và video của bối cảnh đó."
            : "Each place has one blueprint; the world key, set map, fixed-set locks and the supervisor all read it."}
        </p>
      </CardHeader>
      {open ? (
        <CardContent className="space-y-4">
          {locations.map((locationId) => {
            const blueprint = editorBlueprint(draft, locationId);
            const shots = (draft.segments ?? [])
              .filter((s) => ((s.location_id ?? s.environment_ref ?? "").trim() === locationId))
              .map((s) => s.segment_number);
            return (
              <div key={locationId} className="space-y-2">
                <p className="text-xs font-semibold">
                  {locationId} · {vi ? "cảnh" : "scenes"} {shots.join(", ")}
                  {blueprint ? "" : vi ? " · chưa có bản thiết kế" : " · no blueprint yet"}
                </p>
                {blueprint ? (
                  <PlaceEditor blueprint={blueprint} propHeads={propHeads} lang={lang} onChange={save} />
                ) : (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => save(seedBlueprint(draft, locationId))}>
                    <Wand2 className="h-3.5 w-3.5" />
                    {vi ? "Tạo bản thiết kế từ mô tả kịch bản rồi sửa" : "Draft it from the script, then edit"}
                  </Button>
                )}
              </div>
            );
          })}
        </CardContent>
      ) : null}
    </Card>
  );
}
