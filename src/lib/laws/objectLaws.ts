// TẦNG 4 — OBJECT DNA (luật đồ vật: vật liệu thật, không ý chí, không biến hình).
// Objects can be held / dropped / attached — they have no will of their own.

export const objectLaws = {
  __layer: "OBJECT_DNA",
  id: "object_dna_real_materials_v1",
  laws: [
    "Every object keeps ONE solid, constant form — no morphing, melting, warping, resizing or splitting into duplicates",
    "Objects have no will: they move ONLY when a person or physical force moves them, and stay put otherwise",
    "Materials render with true physical surface behaviour: leather shows grain/creases/stitching, denim its twill weave, metal real specular reflections and wear, wood visible grain, fabric real thread and drape, ceramics/glass true weight — no plastic or toy-like surfaces",
    "Hands make real contact: fingers wrap around real surfaces, grip carries weight, nothing passes through anything",
    "Liquids and food obey gravity — pour, drip, steam and settle naturally; never float, never deform impossibly",
    "Product identity is sacred: exact shape, colours, label text and logo stay pixel-faithful in every frame",
  ],
} as const;
