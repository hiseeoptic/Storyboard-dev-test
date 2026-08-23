// Colour grade / film "look" — a user-selectable visual tone applied to the
// whole video (separate axis from the visual medium and the camera grammar).
// The chosen look is turned into a strong colour directive that flows into the
// script/keyframe/Veo prompts so the footage actually carries that colour.

import type { ColorLookId, Genre } from "@/types";

export interface ColorLookOption {
  value: ColorLookId;
  label_vi: string;
  label_en: string;
  desc_vi: string;
  desc_en: string;
}

export const COLOR_LOOK_OPTIONS: ColorLookOption[] = [
  { value: "auto", label_vi: "Tự động theo thể loại", label_en: "Auto by genre", desc_vi: "Để AI chọn tông màu hợp thể loại.", desc_en: "Let the AI pick a colour that fits the genre." },
  { value: "natural", label_vi: "Tự nhiên (chân thực)", label_en: "Natural", desc_vi: "Màu thật, trung tính, tương phản cân bằng — như mắt thường.", desc_en: "True-to-life, neutral, balanced contrast." },
  { value: "cinematic", label_vi: "Điện ảnh (teal–cam)", label_en: "Cinematic", desc_vi: "Tông teal–cam điện ảnh, tương phản phim nhẹ nhàng.", desc_en: "Filmic teal-and-orange grade with gentle contrast." },
  { value: "warm_nostalgic", label_vi: "Hoài niệm ấm", label_en: "Warm nostalgic", desc_vi: "Vàng ấm hoài niệm, hơi glow — hợp phố cổ, hoàng hôn.", desc_en: "Warm amber, soft glow — old quarters, sunset." },
  { value: "vintage_film", label_vi: "Phim cổ điển (grain)", label_en: "Vintage film", desc_vi: "Phim cũ ngả sepia, có grain, vignette và halation.", desc_en: "Faded sepia-leaning film with grain and vignette." },
  { value: "bw_classic", label_vi: "Đen trắng cổ + flicker", label_en: "Classic B&W + flicker", desc_vi: "Đen trắng, có grain, bụi/xước và tia flicker ngang kiểu phim cổ.", desc_en: "Black-and-white with grain, dust and old-film flicker." },
  { value: "noir", label_vi: "Noir tương phản mạnh", label_en: "Noir", desc_vi: "Đen trắng tương phản gắt, đen sâu, bóng đổ mạnh.", desc_en: "High-contrast B&W, deep blacks, hard shadows." },
  { value: "vibrant_pop", label_vi: "Rực rỡ (social)", label_en: "Vibrant pop", desc_vi: "Rực rỡ, bão hoà cao, tương phản mạnh — bắt mắt trên mạng.", desc_en: "Saturated, punchy, social-media ready." },
  { value: "pastel_soft", label_vi: "Pastel mềm", label_en: "Soft pastel", desc_vi: "Pastel nhẹ, tương phản thấp, sáng thoáng — mềm mại.", desc_en: "Gentle pastel, low contrast, airy." },
  { value: "moody_dark", label_vi: "U tối (low-key)", label_en: "Moody / low-key", desc_vi: "U tối, bóng sâu, tông lạnh trầm, tương phản cao.", desc_en: "Low-key, crushed shadows, cool high contrast." },
  { value: "sunlit_golden", label_vi: "Nắng vàng", label_en: "Golden sunlight", desc_vi: "Nắng vàng golden-hour, sáng ấm, bóng dài mềm.", desc_en: "Golden-hour sun, warm highlights, long shadows." },
  { value: "clean_commercial", label_vi: "Sạch quảng cáo", label_en: "Clean commercial", desc_vi: "Sáng đều, trung tính, màu sản phẩm chuẩn, nét.", desc_en: "Bright, even, neutral and product-accurate." },
  { value: "neon_cyberpunk", label_vi: "Neon / cyberpunk", label_en: "Neon / cyberpunk", desc_vi: "Neon magenta–cyan, đen sâu, đèn phố đêm rực.", desc_en: "Saturated magenta-cyan neon night, deep blacks." },
  { value: "custom", label_vi: "Khác (tự nhập)", label_en: "Other (type your own)", desc_vi: "Tự mô tả tông màu bạn muốn.", desc_en: "Describe your own colour look." },
];

/** The colour instruction baked into the video look for each grade. */
export const COLOR_LOOK_DIRECTIVE: Record<Exclude<ColorLookId, "auto" | "custom">, string> = {
  natural: "natural true-to-life colour, neutral Rec.709 grade, balanced contrast and accurate skin tones; no stylised tint",
  cinematic: "cinematic teal-and-orange grade, gentle filmic contrast, controlled highlight roll-off and rich but natural skin tones",
  warm_nostalgic: "warm nostalgic grade — golden amber tones, soft glow, slightly lifted shadows and a gentle vintage warmth",
  vintage_film: "vintage film look — faded sepia-leaning colour, visible fine film grain, subtle vignette and soft halation on highlights",
  bw_classic: "classic black-and-white with visible film grain, occasional dust and scratch specks and a faint horizontal flicker like old celluloid",
  noir: "high-contrast black-and-white film-noir grade — deep crushed blacks, hard directional key light and bold shadow shapes",
  vibrant_pop: "bright vibrant social-media grade — high saturation, punchy contrast, clean whites and lively colour",
  pastel_soft: "soft pastel grade — gentle low-contrast tones, airy lifted highlights and delicate desaturated colour",
  moody_dark: "moody low-key grade — crushed shadows, cool desaturated tones, high contrast and a single motivated light source",
  sunlit_golden: "sun-drenched golden-hour grade — warm directional sunlight, glowing highlights, long soft shadows and gentle lens warmth",
  clean_commercial: "clean commercial grade — bright even exposure, neutral to slightly cool tones and crisp, product-accurate colour",
  neon_cyberpunk: "neon cyberpunk grade — saturated magenta and cyan city lights, deep blacks and glowing practical lights at night",
};

/** Per-genre default look + the looks offered for that genre (default first). */
export const GENRE_COLOR_LOOKS: Record<Genre, { default: ColorLookId; allowed: ColorLookId[] }> = {
  action: { default: "cinematic", allowed: ["cinematic", "moody_dark", "vibrant_pop", "natural"] },
  comedy: { default: "vibrant_pop", allowed: ["vibrant_pop", "natural", "pastel_soft", "warm_nostalgic"] },
  drama: { default: "cinematic", allowed: ["cinematic", "natural", "moody_dark", "warm_nostalgic", "vintage_film"] },
  horror: { default: "moody_dark", allowed: ["moody_dark", "noir", "vintage_film", "bw_classic"] },
  romance: { default: "pastel_soft", allowed: ["pastel_soft", "warm_nostalgic", "cinematic", "natural"] },
  "sci-fi": { default: "neon_cyberpunk", allowed: ["neon_cyberpunk", "cinematic", "moody_dark", "clean_commercial"] },
  thriller: { default: "moody_dark", allowed: ["moody_dark", "cinematic", "noir", "natural"] },
  animation: { default: "vibrant_pop", allowed: ["vibrant_pop", "pastel_soft", "natural"] },
  documentary: { default: "natural", allowed: ["natural", "cinematic", "warm_nostalgic", "vintage_film"] },
  fantasy: { default: "cinematic", allowed: ["cinematic", "warm_nostalgic", "moody_dark", "vibrant_pop"] },
  historical: { default: "vintage_film", allowed: ["vintage_film", "warm_nostalgic", "bw_classic", "cinematic"] },
  mythology: { default: "cinematic", allowed: ["cinematic", "moody_dark", "warm_nostalgic", "vintage_film"] },
  sitcom: { default: "natural", allowed: ["natural", "vibrant_pop", "warm_nostalgic"] },
  mockumentary: { default: "natural", allowed: ["natural", "vintage_film", "warm_nostalgic"] },
  music_video: { default: "vibrant_pop", allowed: ["vibrant_pop", "cinematic", "neon_cyberpunk", "moody_dark", "pastel_soft"] },
  kids: { default: "vibrant_pop", allowed: ["vibrant_pop", "pastel_soft", "natural"] },
  advertising: { default: "clean_commercial", allowed: ["clean_commercial", "vibrant_pop", "cinematic", "natural"] },
  product_demo: { default: "clean_commercial", allowed: ["clean_commercial", "natural", "cinematic"] },
  brand_film: { default: "cinematic", allowed: ["cinematic", "warm_nostalgic", "clean_commercial", "moody_dark"] },
  promo: { default: "vibrant_pop", allowed: ["vibrant_pop", "clean_commercial", "natural"] },
  unboxing: { default: "clean_commercial", allowed: ["clean_commercial", "natural", "vibrant_pop"] },
  luxury: { default: "cinematic", allowed: ["cinematic", "moody_dark", "clean_commercial", "bw_classic"] },
  numerology: { default: "cinematic", allowed: ["cinematic", "moody_dark", "warm_nostalgic", "pastel_soft"] },
  health: { default: "clean_commercial", allowed: ["clean_commercial", "natural", "pastel_soft"] },
  psychology: { default: "moody_dark", allowed: ["moody_dark", "cinematic", "pastel_soft", "natural"] },
  life_wisdom: { default: "warm_nostalgic", allowed: ["warm_nostalgic", "natural", "cinematic", "pastel_soft"] },
  education: { default: "clean_commercial", allowed: ["clean_commercial", "natural", "vibrant_pop"] },
  finance: { default: "clean_commercial", allowed: ["clean_commercial", "cinematic", "natural"] },
  tech: { default: "clean_commercial", allowed: ["clean_commercial", "neon_cyberpunk", "cinematic", "natural"] },
  cooking: { default: "natural", allowed: ["natural", "warm_nostalgic", "vibrant_pop", "clean_commercial"] },
  fitness: { default: "vibrant_pop", allowed: ["vibrant_pop", "cinematic", "natural", "clean_commercial"] },
  lifestyle: { default: "natural", allowed: ["natural", "warm_nostalgic", "pastel_soft", "vibrant_pop"] },
  travel: { default: "sunlit_golden", allowed: ["sunlit_golden", "cinematic", "vibrant_pop", "warm_nostalgic", "natural"] },
  nature: { default: "natural", allowed: ["natural", "cinematic", "sunlit_golden", "moody_dark"] },
  sports: { default: "vibrant_pop", allowed: ["vibrant_pop", "cinematic", "clean_commercial", "moody_dark"] },
  other: {
    default: "natural",
    allowed: [
      "natural", "cinematic", "warm_nostalgic", "vintage_film", "bw_classic", "noir",
      "vibrant_pop", "pastel_soft", "moody_dark", "sunlit_golden", "clean_commercial", "neon_cyberpunk",
    ],
  },
};

/** Build the strong colour-look directive for a chosen look, or "" for auto. */
export function colorLookDirective(look: ColorLookId | undefined, custom?: string): string {
  if (!look || look === "auto") return "";
  if (look === "custom") {
    const c = (custom ?? "").trim();
    return c ? `COLOR / LOOK LOCK — grade the ENTIRE video with this exact colour look, consistent across every shot: ${c}.` : "";
  }
  const directive = COLOR_LOOK_DIRECTIVE[look];
  return directive
    ? `COLOR / LOOK LOCK — grade the ENTIRE video with this exact colour look, consistent across every shot: ${directive}.`
    : "";
}

/** The looks offered for a genre (default first), always including auto + custom. */
export function colorLooksForGenre(genre: Genre): ColorLookId[] {
  const g = GENRE_COLOR_LOOKS[genre] ?? GENRE_COLOR_LOOKS.other;
  return Array.from(new Set<ColorLookId>(["auto", ...g.allowed, "custom"]));
}
