// ============================================================
// SET STYLES + SET REQUEST — what the user can ask the set to look like.
//
// A set style is a production-design brief (architecture, furniture,
// materials, palette, practical light, dressing) applied to every location
// the script needs; a set request is the user's own words for the place
// ("phố Hàng Bông, Hà Nội, chiều muộn"). Both travel in the project's
// `setting` field, which already reaches the script, the Context IR and the
// storyboard prompts, under explicit authority labels so the models treat
// them as decisions, not suggestions.
// ============================================================

export interface SetStyle {
  id: string;
  label_vi: string;
  label_en: string;
  /**
   * Production-design brief in English (the production prompt language). It
   * describes the look only — no time of day, which the story decides.
   */
  prompt_en: string;
  /** Genres this style is suggested for first. */
  genres?: string[];
}

export interface SetStyleGroup {
  id: string;
  label_vi: string;
  label_en: string;
  styles: SetStyle[];
}

export const SET_STYLE_GROUPS: SetStyleGroup[] = [
  {
    id: "vietnam",
    label_vi: "Việt Nam",
    label_en: "Vietnam",
    styles: [
      { id: "vn_hanoi_old_quarter", label_vi: "Phố cổ Hà Nội", label_en: "Hanoi Old Quarter", genres: ["romance", "drama", "travel", "lifestyle", "documentary", "sitcom"],
        prompt_en: "Hanoi Old Quarter: narrow tube houses with weathered ochre-yellow French-colonial facades, green wooden louvred shutters, wrought-iron balconies spilling bougainvillea, tangled overhead power lines, street vendors' low plastic stools and bamboo carrying poles, parked motorbikes, warm shopfront glow; real worn plaster, moss and patina." },
      { id: "vn_indochine", label_vi: "Đông Dương (Indochine)", label_en: "Indochine colonial", genres: ["romance", "historical", "drama", "luxury", "brand_film"],
        prompt_en: "Indochine colonial interior: high ceilings with slow ceiling fans, encaustic cement-tile floors, cream lime-plaster walls, tall dark-wood louvred doors, rattan and teak furniture, brass table lamps, potted palms, arched windows with sheer curtains; elegant, warm and timeless." },
      { id: "vn_saigon_retro", label_vi: "Sài Gòn xưa (chung cư cũ)", label_en: "Old Saigon apartment", genres: ["drama", "sitcom", "romance", "music_video"],
        prompt_en: "1970s Saigon apartment block: breeze-block (gạch bông gió) walls casting patterned light, patterned cement tiles, mint-green and terracotta paint, wooden furniture with tapered legs, potted plants along the corridor, a ceiling fan and a glowing transistor radio; lived-in, nostalgic." },
      { id: "vn_bao_cap", label_vi: "Hà Nội thời bao cấp (1980s)", label_en: "1980s subsidy-era Hanoi", genres: ["drama", "historical", "sitcom", "documentary"],
        prompt_en: "1980s Hanoi subsidy-era home: lime-washed walls with faded patches, wooden cabinet with glass doors holding enamel cups and a flower-pattern thermos, a wall calendar, folding wooden chairs, a single fluorescent tube light, an old radio and a bicycle by the door; humble, authentic period detail." },
      { id: "vn_village_north", label_vi: "Làng quê Bắc Bộ", label_en: "Northern Vietnamese village", genres: ["drama", "kids", "life_wisdom", "cooking", "nature", "historical"],
        prompt_en: "Northern Vietnamese village: brick courtyard (sân gạch) in front of a tiled-roof house, areca palms, a large clay water jar, bamboo hedge, haystack, chickens, lotus pond and rice fields beyond; soft natural light, earthy greens and terracotta." },
      { id: "vn_hue_royal", label_vi: "Cung đình Huế / cổ trang Việt", label_en: "Hue imperial court", genres: ["historical", "mythology", "fantasy", "luxury"],
        prompt_en: "Hue imperial court: red-and-gold lacquered ironwood columns, carved dragon and cloud motifs, glazed yellow roof tiles, silk lanterns, folding lacquer screens, stone courtyard with bonsai in glazed pots; regal, symmetrical, warm lantern light." },
      { id: "vn_nha_ruong", label_vi: "Nhà rường / nhà gỗ cổ", label_en: "Traditional wooden house", genres: ["historical", "drama", "life_wisdom", "romance"],
        prompt_en: "Traditional Vietnamese wooden house: dark carved jackfruit-wood frame and beams, ancestral altar with incense smoke, lacquered parallel boards with calligraphy, mother-of-pearl inlaid furniture, a tea set on a low table, terracotta floor; dim, warm, reverent." },
      { id: "vn_mekong", label_vi: "Miền Tây sông nước", label_en: "Mekong Delta", genres: ["drama", "travel", "cooking", "romance", "kids"],
        prompt_en: "Mekong Delta riverside: wooden stilt house over brown water, coconut palms, sampan boats, hammocks under a tin roof, water hyacinth, a floating market in the distance; humid golden light and lush greens." },
      { id: "vn_tay_bac", label_vi: "Bản làng Tây Bắc", label_en: "Northwest highland village", genres: ["travel", "drama", "documentary", "nature", "romance"],
        prompt_en: "Northwest Vietnam highland village: wooden stilt houses, terraced rice fields, misty mountains, peach blossoms, hand-woven brocade textiles drying, a wood-fire kitchen with smoke; crisp mountain light." },
      { id: "vn_modern_cafe", label_vi: "Quán cà phê Việt hiện đại", label_en: "Modern Vietnamese café", genres: ["romance", "lifestyle", "sitcom", "advertising", "drama"],
        prompt_en: "Modern Vietnamese café: exposed brick and lime plaster, rattan chairs, cascading plants, warm Edison bulbs, a wooden counter with a phin coffee set, a window onto a leafy street; cosy, photogenic, warm." },
      { id: "vn_street_food", label_vi: "Quán ăn vỉa hè", label_en: "Sidewalk eatery", genres: ["cooking", "comedy", "sitcom", "travel", "lifestyle"],
        prompt_en: "Vietnamese sidewalk eatery: low plastic stools and tables, steaming broth pots, a glass food cart, string lights, scooters passing, a tree trunk painted white at the base; lively, warm glow." },
    ],
  },
  {
    id: "modern",
    label_vi: "Hiện đại",
    label_en: "Modern",
    styles: [
      { id: "modern_minimal", label_vi: "Căn hộ hiện đại tối giản", label_en: "Minimal modern apartment", genres: ["romance", "drama", "lifestyle", "psychology", "advertising"],
        prompt_en: "Minimal modern apartment: light oak floors, warm white textured walls, a linen sofa, a sculptural floor lamp, large windows with sheer curtains, a few curated plants and ceramics, warm cove lighting; calm, airy, premium." },
      { id: "modern_cozy_home", label_vi: "Nhà ấm cúng gia đình", label_en: "Cosy family home", genres: ["sitcom", "drama", "kids", "comedy", "cooking", "life_wisdom"],
        prompt_en: "Cosy family home: warm wood, a sofa with throw blankets and cushions, framed photos (soft, unreadable), bookshelves, table lamps, a dining table with a runner, plants by the window; lived-in, warm and inviting." },
      { id: "modern_luxury_penthouse", label_vi: "Penthouse sang trọng", label_en: "Luxury penthouse", genres: ["luxury", "drama", "thriller", "romance", "brand_film"],
        prompt_en: "Luxury penthouse: floor-to-ceiling windows on a city skyline, marble and walnut surfaces, designer furniture, brass accents, a sculptural chandelier, moody layered lighting; rich, refined, cinematic." },
      { id: "modern_japandi", label_vi: "Japandi ấm áp", label_en: "Warm Japandi", genres: ["lifestyle", "psychology", "romance", "health"],
        prompt_en: "Warm Japandi interior: muted earth tones, low light-wood furniture, paper pendant lamps, linen textiles, handmade ceramics, a single branch arrangement, soft diffused light; serene and tactile." },
      { id: "modern_loft", label_vi: "Loft công nghiệp", label_en: "Industrial loft", genres: ["drama", "music_video", "thriller", "tech", "action"],
        prompt_en: "Industrial loft: exposed brick, black steel-framed windows, polished concrete floor, a worn leather sofa, metal pendant lamps, open shelving with records and books; moody, textured, urban." },
      { id: "modern_office", label_vi: "Văn phòng hiện đại", label_en: "Modern office", genres: ["drama", "comedy", "finance", "tech", "education", "advertising"],
        prompt_en: "Modern office: glass-walled meeting room, light wood desks, ergonomic chairs, indoor plants, large windows, abstract wall graphics without readable text; clean and professional." },
      { id: "modern_fine_dining", label_vi: "Nhà hàng sang trọng", label_en: "Fine-dining restaurant", genres: ["romance", "luxury", "drama", "cooking"],
        prompt_en: "Fine-dining restaurant: white tablecloths, candlelight, crystal glasses, upholstered banquettes, warm chandeliers, dark wood panelling, fresh flower arrangements; intimate and elegant." },
      { id: "modern_school", label_vi: "Trường học / học đường", label_en: "School campus", genres: ["kids", "education", "romance", "comedy", "drama"],
        prompt_en: "School campus: classroom with wooden desks and a green chalkboard (no readable writing), corridor with windows onto a leafy schoolyard, flame trees, lockers; bright and nostalgic." },
      { id: "modern_hospital", label_vi: "Bệnh viện hiện đại", label_en: "Modern hospital", genres: ["drama", "health", "thriller"],
        prompt_en: "Modern hospital: clean ward with adjustable beds, soft curtains, monitors with abstract readouts, pale green and white palette, a window, a potted plant; calm and credible." },
      { id: "modern_rooftop", label_vi: "Sân thượng hoàng hôn", label_en: "Sunset rooftop", genres: ["romance", "music_video", "drama", "lifestyle"],
        prompt_en: "City rooftop at golden hour: string lights, potted plants, a wooden bench, the skyline glowing behind, warm sunset rim light; romantic and open." },
    ],
  },
  {
    id: "east_period",
    label_vi: "Cổ trang & phương Đông",
    label_en: "Period & East Asian",
    styles: [
      { id: "east_chinese_palace", label_vi: "Cung điện cổ trang Trung Hoa", label_en: "Chinese imperial palace", genres: ["historical", "fantasy", "mythology", "drama"],
        prompt_en: "Chinese imperial palace hall: red lacquer pillars, carved gilded beams, silk curtains, bronze incense burners, lattice screens, a raised throne platform, rows of lanterns; grand and dramatic." },
      { id: "east_mansion", label_vi: "Phủ đệ cổ trang", label_en: "Period mansion", genres: ["historical", "romance", "drama", "fantasy"],
        prompt_en: "Period mansion: courtyard with a moon gate, rockery and koi pond, covered wooden corridors, paper-lattice windows, a study with scrolls and brushes, plum blossoms; refined and poetic." },
      { id: "east_wuxia_inn", label_vi: "Quán trọ giang hồ", label_en: "Wuxia inn", genres: ["action", "historical", "fantasy", "comedy"],
        prompt_en: "Wuxia roadside inn: rustic timber hall, long benches and square tables, stacked wine jars, hanging paper lanterns, a balcony gallery above, dust in shafts of light; rough and atmospheric." },
      { id: "east_japanese", label_vi: "Nhà Nhật truyền thống", label_en: "Traditional Japanese house", genres: ["romance", "drama", "lifestyle", "fantasy"],
        prompt_en: "Traditional Japanese house: tatami floors, shoji sliding doors, a tokonoma alcove with ikebana, an engawa veranda facing a raked zen garden, paper lanterns; quiet, balanced, soft light." },
      { id: "east_hanok", label_vi: "Hanok Hàn Quốc", label_en: "Korean hanok", genres: ["romance", "drama", "historical"],
        prompt_en: "Korean hanok: exposed wooden beams, warm ondol floor, paper-screen windows, low tables, a courtyard with earthen walls and a persimmon tree; warm and gentle." },
    ],
  },
  {
    id: "western_vintage",
    label_vi: "Phương Tây & vintage",
    label_en: "Western & vintage",
    styles: [
      { id: "west_european_classic", label_vi: "Cổ điển châu Âu", label_en: "Classic European", genres: ["luxury", "romance", "historical", "drama"],
        prompt_en: "Classic European salon: ornate plaster mouldings, crystal chandelier, velvet armchairs, gilded mirrors, herringbone parquet, tall windows with heavy drapes; opulent and graceful." },
      { id: "west_victorian", label_vi: "Victorian u buồn", label_en: "Victorian gothic", genres: ["horror", "thriller", "historical", "mythology"],
        prompt_en: "Victorian interior: dark wood panelling, patterned wallpaper, oil lamps and candelabra, heavy drapes, a fireplace with a mantel clock, antique furniture; brooding, low-key light." },
      { id: "west_retro_70s", label_vi: "Retro thập niên 70", label_en: "1970s retro", genres: ["comedy", "music_video", "sitcom", "drama"],
        prompt_en: "1970s retro living room: orange, brown and mustard palette, wood panelling, a shag rug, a record player with vinyl, globe lamps, plants in macramé hangers; warm and playful." },
      { id: "west_art_deco", label_vi: "Art Deco", label_en: "Art Deco", genres: ["luxury", "thriller", "music_video", "brand_film"],
        prompt_en: "Art Deco lounge: geometric brass inlays, black lacquer and gold, fan motifs, mirrored panels, velvet booths, glowing sconces; glamorous and sharp." },
      { id: "west_paris_cafe", label_vi: "Café Paris", label_en: "Parisian café", genres: ["romance", "lifestyle", "travel"],
        prompt_en: "Parisian café: bistro chairs and marble tables, a zinc counter, a striped awning, Haussmann façades across the street, wrought-iron details; charming and romantic." },
    ],
  },
  {
    id: "genre",
    label_vi: "Thể loại đặc biệt",
    label_en: "Genre worlds",
    styles: [
      { id: "genre_cyberpunk", label_vi: "Neon cyberpunk", label_en: "Neon cyberpunk", genres: ["sci-fi", "action", "thriller", "music_video", "tech"],
        prompt_en: "Neon cyberpunk city: rain-slick streets, neon signs with unreadable glyphs, holographic billboards, steam vents, dense cables, magenta and cyan light against deep shadow; futuristic and gritty." },
      { id: "genre_horror", label_vi: "Kinh dị u tối", label_en: "Dark horror", genres: ["horror", "thriller", "mythology"],
        prompt_en: "Horror set: decaying old house, peeling wallpaper, dust sheets over furniture, a single flickering bulb, long corridor into darkness, fog at the windows; cold, oppressive low-key light." },
      { id: "genre_fairytale", label_vi: "Cổ tích / fantasy", label_en: "Fairytale fantasy", genres: ["fantasy", "kids", "mythology", "animation"],
        prompt_en: "Fairytale fantasy world: an enchanted forest with ancient mossy trees, glowing mushrooms, a stone cottage with a thatched roof, fireflies and soft magical haze; whimsical and luminous." },
      { id: "genre_spaceship", label_vi: "Tàu vũ trụ / tương lai", label_en: "Spaceship interior", genres: ["sci-fi", "action", "tech"],
        prompt_en: "Spaceship interior: curved white panels, recessed LED strips, a wide viewport onto stars, holographic consoles with abstract readouts, brushed metal; sleek and believable." },
    ],
  },
];

export const ALL_SET_STYLES: SetStyle[] = SET_STYLE_GROUPS.flatMap((group) => group.styles);

export function findSetStyle(id: string | undefined | null): SetStyle | undefined {
  return id ? ALL_SET_STYLES.find((style) => style.id === id) : undefined;
}

/** Styles suggested for a genre, in catalogue order (empty when none fit). */
export function suggestedSetStyles(genre: string, limit = 6): SetStyle[] {
  return ALL_SET_STYLES.filter((style) => style.genres?.includes(genre)).slice(0, limit);
}

export const REAL_PLACE_FIDELITY =
  "Render every location as a real, photographed place: true-to-life architecture, materials, wear, vegetation, street furniture and light for that place, culture and era. A named real place (a street, district, landmark or city) keeps its recognisable real character — its building types, façades, scale, density and typical details — never a generic template. No readable signage, brand names or logos.";

/**
 * The value sent as the project's `setting`: the user's own request (or the
 * picked place type) plus the chosen set style, each under its authority label.
 */
export function composeSettingRequest(params: { place?: string; request?: string; styleId?: string }): string {
  const request = (params.request ?? "").trim();
  const place = (params.place ?? "").trim();
  const style = findSetStyle(params.styleId);
  const parts: string[] = [];
  if (request) parts.push(`USER SET REQUEST (authority for where the story takes place): ${request}${place ? ` (place type: ${place})` : ""}.`);
  else if (place) parts.push(place);
  if (style) parts.push(`SET STYLE (authority for the look of every location without an uploaded photo): ${style.label_en} — ${style.prompt_en}`);
  if (request || style) parts.push(REAL_PLACE_FIDELITY);
  return parts.join(" ");
}
