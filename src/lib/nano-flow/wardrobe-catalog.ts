// wardrobe-catalog.ts — a curated outfit picker for Nano Flow characters.
//
// The user picks a concrete outfit per character instead of relying on the
// model to invent one (which drifted per clip). The chosen `value` (an English
// garment description, best for Nano Banana / Veo) is written into the
// character's `costume`, which then flows into BOTH the Veo clip's
// outfit_top/outfit_bottom AND the manifest's character.wardrobe — so the image
// keyframe, the full-body wardrobe sheet and the video prompt all match.
//
// Outfits are organised by AGE BRACKET × GENDER × OCCASION and are age- and
// occasion-appropriate. Children have their own bracket. Labels are Vietnamese
// (shown in the UI); values are English (fed to the image/video models).

export type WardrobeAgeBracket = "child" | "teen" | "adult" | "senior";
export type WardrobeGender = "male" | "female";

export interface WardrobeOption {
  /** Vietnamese label shown in the picker. */
  label: string;
  /** English garment description written into the character costume. */
  value: string;
  /** Occasion group (for the grouped label). */
  category: string;
}

// Occasion groups, in display order. Vietnamese label + stable key.
export const WARDROBE_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "home", label: "Ở nhà" },
  { key: "street", label: "Đi dạo phố" },
  { key: "hangout", label: "Đi chơi / cà phê" },
  { key: "party", label: "Đi tiệc" },
  { key: "formal", label: "Sự kiện trang trọng" },
  { key: "sport", label: "Thể thao / vận động" },
];

// [label(vi), value(en)] pairs. Keep each concrete (garment + colour + footwear).
type Pair = [string, string];
type ByCategory = Record<string, Pair[]>;

const ADULT_FEMALE: ByCategory = {
  home: [
    ["Áo phông + quần short cotton", "a soft heather-grey cotton t-shirt and relaxed navy cotton shorts, with plain house slippers"],
    ["Áo len mỏng + quần jogger", "a cream lightweight knit sweater and soft taupe jogger trousers, barefoot or in cotton socks"],
    ["Áo hai dây + quần lụa mặc nhà", "a white ribbed tank top and loose black satin lounge trousers, with flat house slippers"],
    ["Đầm suông cotton mặc nhà", "a plain sage-green cotton A-line house dress, with simple flat slippers"],
    ["Áo sơ mi oversize + legging", "an oversized pale-blue cotton shirt worn loose over black leggings, with cotton socks"],
  ],
  street: [
    ["Áo phông trắng + quần jeans", "a fitted white cotton t-shirt, blue high-waist straight-leg jeans and white leather sneakers"],
    ["Áo sơ mi + chân váy chữ A", "a light chambray button-up shirt tucked into a beige A-line midi skirt, with tan loafers"],
    ["Áo thun + chân váy jeans", "a striped navy-and-white short-sleeve top and a denim knee-length skirt, with white canvas shoes"],
    ["Áo blouse + quần vải ống rộng", "a soft blush blouse and wide-leg cream trousers, with nude low-heel mules"],
    ["Đầm midi hoa nhí", "a small-floral short-sleeve midi dress and simple flat sandals"],
  ],
  hangout: [
    ["Áo croptop + quần jeans ống rộng", "a fitted black cropped top, light-wash wide-leg jeans and chunky white sneakers"],
    ["Áo len tăm + chân váy xếp ly", "a fitted rust ribbed knit top and a pleated tan midi skirt, with ankle boots"],
    ["Áo sơ mi lụa + quần âu", "a satin ivory shirt loosely tucked into tailored black trousers, with pointed flats"],
    ["Áo thun + yếm jeans", "a plain white tee under a blue denim pinafore dress, with white sneakers"],
    ["Đầm len ôm nhẹ", "a soft camel fine-knit bodycon midi dress and tall brown boots"],
  ],
  party: [
    ["Đầm cocktail đen", "a sleeveless little black cocktail dress at knee length, with strappy heels and delicate jewellery"],
    ["Đầm đỏ ôm", "a deep-red satin bodycon party dress with thin straps and matching heels"],
    ["Áo hai dây kim sa + chân váy", "a champagne sequined camisole and a black satin midi skirt, with metallic heels"],
    ["Đầm xanh navy dập ly", "a navy pleated chiffon party dress and silver strappy sandals"],
    ["Jumpsuit lụa", "a sleek black wide-leg satin jumpsuit with a fitted waist and gold accessories"],
  ],
  formal: [
    ["Áo blazer + quần âu", "a tailored charcoal blazer over a white silk blouse with matching trousers and black pumps"],
    ["Đầm sơ mi công sở", "a structured navy shirt-dress belted at the waist, with nude court heels"],
    ["Áo dài lụa truyền thống", "an elegant emerald silk áo dài (Vietnamese long dress) over white silk trousers"],
    ["Đầm bút chì + áo khoác", "a black pencil dress under a light-grey tailored blazer, with pointed heels"],
    ["Bộ vest nữ xám", "a two-piece light-grey trouser suit over a pale blouse, with minimalist heels"],
  ],
  sport: [
    ["Áo tank + legging thể thao", "a moisture-wicking black sports tank top, high-waist charcoal leggings and running shoes"],
    ["Áo croptop gym + quần biker", "a fitted teal cropped sports top and black biker shorts, with training shoes"],
    ["Áo khoác gió + quần jogger", "a lightweight pastel windbreaker over a grey tee and black joggers, with white trainers"],
    ["Đồ yoga liền", "a seamless mauve yoga set (fitted top and leggings), barefoot or in grip socks"],
    ["Áo thun + quần short chạy bộ", "a loose white running t-shirt and navy sports shorts, with cushioned running shoes"],
  ],
};

const ADULT_MALE: ByCategory = {
  home: [
    ["Áo phông + quần short", "a plain grey cotton t-shirt and relaxed navy cotton shorts, with house slippers"],
    ["Áo ba lỗ + quần jogger", "a white ribbed tank top and soft charcoal jogger trousers, in cotton socks"],
    ["Áo thun dài tay + quần nỉ", "a heather-grey long-sleeve cotton tee and dark grey sweatpants, barefoot"],
    ["Áo polo + quần short kaki", "a navy polo shirt and beige cotton chino shorts, with slip-on sandals"],
    ["Áo hoodie mỏng + quần jogger", "a light-grey lightweight hoodie and black joggers, in plain socks"],
  ],
  street: [
    ["Áo phông trắng + quần jeans", "a fitted white cotton t-shirt, dark-blue straight-leg jeans and white leather sneakers"],
    ["Áo sơ mi + quần chinos", "a light-blue oxford button-up shirt, beige chino trousers and brown loafers"],
    ["Áo polo + quần kaki", "a forest-green polo shirt, navy chinos and clean white sneakers"],
    ["Áo thun + áo khoác jeans", "a plain grey tee under an indigo denim jacket, with black jeans and canvas shoes"],
    ["Áo sơ mi kẻ + quần jeans", "a rolled-sleeve checked flannel shirt, dark jeans and tan boots"],
  ],
  hangout: [
    ["Áo thun + quần jeans rách", "a black graphic t-shirt, light-wash ripped jeans and chunky sneakers"],
    ["Áo sơ mi linen + quần short", "an off-white linen short-sleeve shirt, khaki chino shorts and leather sandals"],
    ["Áo polo + quần jogger", "a striped navy polo, tapered grey joggers and white trainers"],
    ["Áo khoác bomber + quần jeans", "a plain tee under an olive bomber jacket, with slim dark jeans and sneakers"],
    ["Áo len cổ tròn + quần chinos", "a burgundy crew-neck knit over a collared shirt, with beige chinos and loafers"],
  ],
  party: [
    ["Sơ mi đen + quần âu", "a crisp black dress shirt with sleeves rolled, fitted black trousers and leather derby shoes"],
    ["Áo sơ mi lụa + blazer", "a deep-burgundy silk shirt under a slim black blazer, with dark trousers and Chelsea boots"],
    ["Áo thun cao cấp + blazer", "a fine black t-shirt under a tailored midnight-blue blazer, with dark jeans and loafers"],
    ["Sơ mi hoa + quần âu", "a subtly patterned dark shirt, black tailored trousers and polished shoes"],
    ["Áo polo cao cấp + quần âu", "a fitted charcoal knit polo, black trousers and suede loafers"],
  ],
  formal: [
    ["Vest xanh navy", "a well-tailored navy two-piece suit, white dress shirt, burgundy tie and black oxford shoes"],
    ["Vest xám + cà vạt", "a charcoal-grey suit, pale-blue shirt, patterned tie and brown brogues"],
    ["Áo sơ mi + quần âu + gi-lê", "a white shirt with a grey waistcoat, dark trousers and black leather shoes"],
    ["Blazer + quần âu (business casual)", "a navy blazer over a white shirt (no tie), grey trousers and loafers"],
    ["Vest đen dự tiệc trang trọng", "a classic black tuxedo, white dress shirt and black bow tie"],
  ],
  sport: [
    ["Áo thun thể thao + quần short", "a moisture-wicking navy sports t-shirt, black training shorts and running shoes"],
    ["Áo ba lỗ gym + quần jogger", "a grey gym tank top and tapered black joggers, with training shoes"],
    ["Áo khoác gió + quần dài thể thao", "a black lightweight windbreaker over a tee and navy track trousers, with trainers"],
    ["Bộ đồ bóng đá", "a red-and-white football jersey, matching shorts and studded boots"],
    ["Áo compression + quần short chạy", "a fitted charcoal compression top and blue running shorts, with cushioned running shoes"],
  ],
};

const TEEN_FEMALE: ByCategory = {
  home: [
    ["Áo phông rộng + quần short", "an oversized pastel t-shirt and soft cotton sleep shorts, with fuzzy slippers"],
    ["Áo hoodie + quần jogger", "a light-pink hoodie and grey joggers, in cute cotton socks"],
    ["Áo thun + quần pyjama", "a white printed tee and checked cotton pyjama trousers, with slippers"],
  ],
  street: [
    ["Áo thun + quần jeans + sneaker", "a bright graphic t-shirt, blue mom-fit jeans and colourful sneakers"],
    ["Áo croptop + chân váy jeans", "a pastel cropped top and a denim skater skirt, with white canvas shoes"],
    ["Áo sơ mi kẻ + quần short jeans", "an open plaid shirt over a white tee, denim shorts and sneakers"],
  ],
  hangout: [
    ["Áo len + chân váy tennis", "a soft knit vest over a white shirt and a pleated tennis skirt, with sneakers"],
    ["Áo phông band + quần cargo", "a black band t-shirt, beige cargo trousers and chunky trainers"],
    ["Đầm hoa + áo khoác jeans", "a floral sundress under a cropped denim jacket, with white sneakers"],
  ],
  party: [
    ["Đầm xòe dự tiệc sinh nhật", "a pastel tulle party dress at knee length, with sparkly flats"],
    ["Áo kim sa + chân váy", "a light sequined top and a black skater skirt, with ankle boots"],
    ["Đầm satin nhẹ nhàng", "a lilac satin slip party dress and simple heeled sandals"],
  ],
  formal: [
    ["Áo sơ mi + chân váy xếp ly", "a white blouse and a navy pleated skirt, with black flats (smart school-formal)"],
    ["Đầm sơ mi thanh lịch", "a modest navy shirt-dress belted at the waist, with low heels"],
    ["Áo dài học sinh trắng", "a white silk áo dài (Vietnamese long dress) over white trousers"],
  ],
  sport: [
    ["Áo thun + quần short thể thao", "a bright sports t-shirt, black gym shorts and running shoes"],
    ["Áo tank + legging", "a fitted tank top, patterned leggings and trainers"],
    ["Bộ đồ thể dục trường học", "a school PE kit: coloured polo shirt, navy shorts and sports shoes"],
  ],
};

const TEEN_MALE: ByCategory = {
  home: [
    ["Áo phông + quần short", "a plain graphic t-shirt and cotton basketball shorts, with slides"],
    ["Áo hoodie + quần jogger", "a grey hoodie and black joggers, in white socks"],
    ["Áo ba lỗ + quần thể thao", "a white tank top and navy sweatpants, barefoot"],
  ],
  street: [
    ["Áo thun + quần jeans + sneaker", "an oversized graphic t-shirt, black skinny jeans and colourful high-top sneakers"],
    ["Áo sơ mi kẻ + quần short", "an open checked shirt over a tee, cargo shorts and trainers"],
    ["Áo polo + quần kaki", "a navy polo, khaki chinos and clean white sneakers"],
  ],
  hangout: [
    ["Áo hoodie + quần cargo", "a black hoodie, beige cargo trousers and chunky sneakers"],
    ["Áo bóng rổ + quần short", "a loose basketball jersey over a tee, mesh shorts and high-tops"],
    ["Áo phông band + áo khoác bomber", "a band t-shirt under an olive bomber jacket, with slim jeans and trainers"],
  ],
  party: [
    ["Sơ mi + quần chinos", "a fitted patterned shirt, dark chinos and clean sneakers"],
    ["Áo polo cao cấp + quần jeans", "a smart charcoal polo, dark jeans and loafers"],
    ["Áo thun + blazer trẻ trung", "a plain tee under a slim navy blazer, with dark jeans and boots"],
  ],
  formal: [
    ["Sơ mi trắng + quần âu", "a white dress shirt, dark trousers and black shoes (smart school-formal)"],
    ["Áo sơ mi + gi-lê", "a light shirt with a grey waistcoat, navy trousers and loafers"],
    ["Vest xanh navy trẻ", "a slim navy suit, white shirt, thin tie and dress shoes"],
  ],
  sport: [
    ["Áo thun + quần short thể thao", "a sports t-shirt, black gym shorts and running shoes"],
    ["Bộ đồ bóng đá", "a football jersey, matching shorts and studded boots"],
    ["Áo khoác gió + quần jogger", "a windbreaker over a tee and track trousers, with trainers"],
  ],
};

const CHILD_UNISEX: ByCategory = {
  home: [
    ["Áo phông + quần short", "a colourful cartoon-print cotton t-shirt and comfy cotton shorts, with soft slippers"],
    ["Bộ đồ ngủ dễ thương", "a soft two-piece pyjama set with a playful print, in cotton socks"],
    ["Áo hoodie nhỏ + quần jogger", "a small bright hoodie and cotton joggers, barefoot"],
  ],
  street: [
    ["Áo thun + quần jeans + sneaker", "a bright t-shirt, small blue jeans and Velcro sneakers"],
    ["Áo sơ mi + quần short kaki", "a checked short-sleeve shirt, khaki shorts and canvas shoes"],
    ["Đầm/áo phông + chân váy (bé gái)", "a cheerful printed top with a little denim skirt and sandals (for a girl)"],
  ],
  hangout: [
    ["Áo phông + yếm jeans", "a striped tee under a denim dungaree (overalls) and small sneakers"],
    ["Áo khoác gió + quần jogger", "a colourful light jacket over a tee, with joggers and trainers"],
    ["Bộ đồ thun in hình", "a matching printed t-shirt and shorts set with cartoon characters, and sandals"],
  ],
  party: [
    ["Đầm công chúa (bé gái)", "a puffy pastel party dress with a bow, and shiny flat shoes (for a girl)"],
    ["Sơ mi + quần âu nhỏ (bé trai)", "a little white shirt, small bow tie, dark shorts and dress shoes (for a boy)"],
    ["Bộ đồ dự tiệc in hình", "a smart printed shirt and clean shorts with loafers"],
  ],
  formal: [
    ["Sơ mi + quần âu (bé trai)", "a neat white shirt, navy trousers and small dress shoes (for a boy)"],
    ["Đầm thắt nơ (bé gái)", "a modest navy dress with a white collar and a bow, with flat shoes (for a girl)"],
    ["Áo dài nhỏ truyền thống", "a small traditional Vietnamese áo dài in a soft colour"],
  ],
  sport: [
    ["Áo thun + quần short thể thao", "a bright sports t-shirt, small gym shorts and light running shoes"],
    ["Bộ đồ bóng đá nhí", "a small football kit: jersey, shorts and little sports shoes"],
    ["Áo tank + quần jogger", "a cotton tank top and soft joggers, with trainers"],
  ],
};

// bracket -> gender -> categories. Children share one unisex set (with a few
// gendered items flagged in the label).
const CATALOG: Record<WardrobeAgeBracket, Record<WardrobeGender, ByCategory>> = {
  child: { male: CHILD_UNISEX, female: CHILD_UNISEX },
  teen: { male: TEEN_MALE, female: TEEN_FEMALE },
  adult: { male: ADULT_MALE, female: ADULT_FEMALE },
  senior: { male: ADULT_MALE, female: ADULT_FEMALE },
};

/** Parse a free-text age ("male, ~32", "8 tuổi", "30") into an age bracket. */
export function ageBracketOf(ageText?: string, isChild?: boolean): WardrobeAgeBracket {
  if (isChild) return "child";
  const n = parseInt(String(ageText ?? "").replace(/[^\d]/g, ""), 10);
  if (!Number.isNaN(n)) {
    if (n <= 12) return "child";
    if (n <= 19) return "teen";
    if (n >= 60) return "senior";
    return "adult";
  }
  const t = String(ageText ?? "").toLowerCase();
  if (/child|kid|trẻ em|bé|nhỏ/.test(t)) return "child";
  if (/teen|thiếu niên|học sinh/.test(t)) return "teen";
  if (/senior|elder|già|lớn tuổi|cao tuổi/.test(t)) return "senior";
  return "adult";
}

/**
 * Flat, occasion-grouped outfit options for a character. Each option's label is
 * prefixed with its occasion; the value is the English garment description to
 * write into the character's costume.
 */
export function wardrobeOptions(
  gender?: string,
  ageText?: string,
  isChild?: boolean
): WardrobeOption[] {
  const bracket = ageBracketOf(ageText, isChild);
  const g: WardrobeGender = String(gender ?? "").toLowerCase().startsWith("f") || String(gender).toLowerCase() === "female"
    ? "female"
    : "male";
  const byCat = CATALOG[bracket][g];
  const out: WardrobeOption[] = [];
  for (const { key, label } of WARDROBE_CATEGORIES) {
    for (const [vi, en] of byCat[key] ?? []) {
      out.push({ category: label, label: `${label} — ${vi}`, value: en });
    }
  }
  return out;
}
