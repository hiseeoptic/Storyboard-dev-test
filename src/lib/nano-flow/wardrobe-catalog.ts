// wardrobe-catalog.ts — a curated outfit picker for Nano Flow characters.
//
// The user picks a concrete outfit per character instead of relying on the
// model to invent one (which drifted per clip). The chosen `value` (an English
// garment description, best for Nano Banana / Veo) is written into the
// character's `costume`, which then flows into BOTH the Veo clip's
// outfit_top/outfit_bottom AND the manifest's character.wardrobe — so the image
// keyframe, the full-body wardrobe sheet and the video prompt all match.
//
// UI language: labels are Vietnamese (shown in the picker). PROMPT language:
// values are English (fed to the image/video models) — regardless of the UI
// language. A future EN toggle only swaps the DISPLAY label; the prompt value
// stays English.
//
// Outfits are organised by AGE BRACKET × GENDER × OCCASION. Adults carry the
// full 7-occasion catalogue (10 looks each); teens/children reuse an
// age-appropriate subset mapped onto the same occasion keys.

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

// Occasion groups: stable key -> Vietnamese label. Display order below.
export const WARDROBE_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: "daily", label: "Đi chơi hằng ngày" },
  { key: "travel", label: "Đi du lịch" },
  { key: "work", label: "Đi làm" },
  { key: "party", label: "Đi tiệc" },
  { key: "gala", label: "Dạ hội" },
  { key: "sport", label: "Thể thao & gym" },
  { key: "home", label: "Ở nhà" },
];

// [label(vi), value(en)] pairs. Keep each concrete (garment + colour + footwear).
type Pair = [string, string];
type ByCategory = Record<string, Pair[]>;

const ADULT_MALE: ByCategory = {
  daily: [
    ["Áo thun trắng oversize + jeans xanh nhạt", "an oversized white cotton t-shirt, light-wash straight-leg jeans and white leather sneakers"],
    ["Polo dệt kim nâu taupe + quần navy", "a taupe knit polo shirt, navy tapered trousers, brown loafers and a slim silver watch"],
    ["Hoodie đen chữ bạc + jogger xám than", "a black cotton hoodie with small silver lettering, charcoal jogger pants and chunky white sneakers"],
    ["Sơ mi linen olive + chinos kem", "an olive-green linen button-up shirt, cream chino trousers and brown suede loafers"],
    ["Áo thun sọc đen-trắng + jeans đen", "a black-and-white striped t-shirt, black jeans and brown leather boots"],
    ["Áo khoác denim + thun xám + kaki be", "a plain grey tee under an indigo denim jacket, with beige chinos and white sneakers"],
    ["Sweatshirt xanh rêu + short đen", "a moss-green sweatshirt, black cotton shorts and sporty white sneakers"],
    ["Sơ mi trắng tay ngắn + jeans xanh đậm", "a white short-sleeve shirt, dark-blue jeans and tan leather sandals"],
    ["Áo thun cam đất + quần cargo đen", "a burnt-orange t-shirt, black cargo trousers, white sneakers and a canvas crossbody bag"],
    ["Cardigan kem + thun trắng + quần âu xám", "a cream knit cardigan over a white tee, with grey trousers and white low-top sneakers"],
  ],
  travel: [
    ["Sơ mi linen trắng + short kaki be", "a white linen short-sleeve shirt, beige khaki shorts, brown leather sandals and a straw hat"],
    ["Polo xanh pastel + chinos trắng", "a pastel-blue polo shirt, white chino trousers, white sneakers and sunglasses"],
    ["Áo thun navy + short cargo olive", "a navy cotton t-shirt, olive cargo shorts with many pockets and lightweight trekking shoes"],
    ["Sơ mi họa tiết lá nhiệt đới + short trắng", "a green tropical-leaf print short-sleeve shirt, white shorts and leather sandals"],
    ["Tank top trắng + sơ mi denim khoác ngoài", "a white tank top under an open light-denim shirt, with grey joggers and sneakers"],
    ["Áo thun oversize kem + quần linen nâu", "an oversized cream t-shirt, light-brown linen trousers and slide sandals"],
    ["Áo gió xanh rêu + thun đen + cargo đen", "a moss-green lightweight windbreaker over a black tee, with black cargo trousers and outdoor shoes"],
    ["Sơ mi chambray xanh nhạt + kaki cát", "a light chambray shirt, sand-coloured chinos and soft leather loafers"],
    ["Hoodie mỏng xám + jogger navy", "a light-grey lightweight hoodie, navy joggers and cushioned running sneakers"],
    ["Áo thun sọc trắng-xanh + short denim", "a white-and-blue striped tee, light-wash denim shorts and a baseball cap"],
  ],
  work: [
    ["Suit navy + sơ mi trắng + cà vạt burgundy", "a navy wool-blend suit, white cotton dress shirt, burgundy silk tie and brown leather Oxford shoes"],
    ["Sơ mi Oxford xanh + blazer navy + chinos be", "a light-blue oxford shirt, navy blazer, beige chinos and brown loafers"],
    ["Polo len mỏng xám than + quần tây đen", "a charcoal fine-knit polo, black slim-fit trousers and dark-brown Derby shoes"],
    ["Suit xám caro nhỏ + sơ mi hồng nhạt", "a grey micro-check suit, pale-pink dress shirt, navy tie and black leather shoes"],
    ["Blazer linen kem + áo cổ lọ đen + quần olive", "a cream linen blazer over a black turtleneck, with olive tailored trousers and suede loafers"],
    ["Sơ mi trắng sọc xanh + quần tây xám", "a white shirt with fine blue stripes, grey dress trousers, a black belt and black Oxford shoes"],
    ["Gi-lê len navy + sơ mi trắng + chinos nâu", "a navy knit waistcoat over a white shirt, with light-brown chinos and loafers"],
    ["Suit xanh rêu đậm + sơ mi kem + cà vạt nâu", "a deep forest-green suit, cream shirt, brown tie and Derby shoes"],
    ["Sơ mi đen + quần charcoal + blazer xám đậm", "a black dress shirt, charcoal trousers, a dark-grey blazer and a silver watch"],
    ["Cardigan dệt kim xám + sơ mi trắng + quần navy", "a grey knit cardigan over a white shirt, with navy trousers and clean white leather sneakers"],
  ],
  party: [
    ["Blazer nhung đỏ burgundy + sơ mi lụa đen", "a burgundy velvet blazer with black satin lapels, a black silk shirt, slim black trousers and polished black leather loafers"],
    ["Sơ mi satin navy + quần âu xám than", "a midnight-navy satin shirt, charcoal dress trousers, a black leather belt and black Chelsea boots"],
    ["Blazer đen 2 hàng nút + áo cổ lọ trắng ngà", "a black double-breasted blazer over an ivory fine-merino turtleneck, with black tailored trousers and glossy black shoes"],
    ["Sơ mi lụa trắng vẽ nét cọ + skinny đen", "a white silk-blend shirt printed with abstract black brush strokes, black skinny trousers, black suede boots and silver rings"],
    ["Blazer jacquard emerald + sơ mi đen", "an emerald-green jacquard blazer with subtle tonal floral pattern, a black shirt and black tailored trousers"],
    ["Sơ mi lụa champagne + quần nâu chocolate", "a champagne silk shirt, chocolate-brown trousers, brown leather loafers and a gold watch"],
    ["Suit beige + áo thun trắng + sneaker trắng", "a light-beige suit worn over a premium white cotton t-shirt, with white leather sneakers"],
    ["Bomber satin đen + sơ mi trắng", "a black satin bomber jacket, a white fitted shirt, straight-leg dress trousers and black Derby shoes"],
    ["Blazer caro xám + sơ mi đen + khăn túi bạc", "a grey checked blazer, a black shirt, black tailored trousers and a silver pocket square"],
    ["Sơ mi satin đen cổ mở + quần trắng ngà", "an open-collar black satin shirt, ivory trousers and black loafers"],
  ],
  gala: [
    ["Tuxedo đen ve satin + nơ lụa đen", "a black wool tuxedo with satin peak lapels, a crisp white dress shirt, a black silk bow tie and patent-leather Oxford shoes"],
    ["Tuxedo nhung navy + sơ mi xếp ly", "a navy velvet tuxedo jacket, black satin-striped trousers, a white pleated shirt and a black bow tie"],
    ["Dinner jacket trắng ngà + đai lưng satin", "an ivory dinner jacket, black satin-trimmed trousers, a black silk cummerbund and glossy loafers"],
    ["Blazer brocade emerald paisley + khuy vàng", "a deep-emerald brocade blazer with subtle paisley pattern, a black dress shirt, black trousers and gold cufflinks"],
    ["Suit 3 mảnh charcoal + cà vạt đen", "a charcoal-grey three-piece wool suit, white dress shirt, black silk tie, pocket square and black Oxford shoes"],
    ["Tuxedo burgundy + giày patent leather", "a burgundy tuxedo with black satin lapels, a white dress shirt, a black bow tie and patent-leather shoes"],
    ["Suit đen may đo + sơ mi đen + cà vạt đen", "a tailored all-black suit, black dress shirt and black silk tie with polished black shoes"],
    ["Suit midnight blue + nơ xanh đậm", "a midnight-blue tuxedo suit, white dress shirt, deep-blue bow tie and glossy black shoes"],
    ["Blazer nhung tím than + khuy măng sét bạc", "a plum-charcoal velvet dinner jacket, black trousers, a black shirt and silver cufflinks"],
    ["Suit trắng kem + sơ mi trắng + loafer đen", "an off-white cream suit, a white dress shirt and glossy black loafers"],
  ],
  sport: [
    ["Thun polyester đen + short navy + legging xám", "a black moisture-wicking polyester t-shirt, navy running shorts over charcoal compression leggings, and lightweight training shoes"],
    ["Tank top neon phản quang + short chạy đen", "a neon-green reflective running tank top, black quick-dry shorts with silver trim and cushioned running shoes"],
    ["Polo dry-fit trắng + short tennis navy", "a white dry-fit tennis polo, navy athletic shorts, white crew socks and court sneakers"],
    ["Jersey bóng rổ đỏ + short đen sọc trắng", "a red mesh basketball jersey, black athletic shorts with white side stripes and high-top sneakers"],
    ["Thun co giãn charcoal + jogger đen + hoodie zip", "a charcoal stretch training t-shirt, black tapered joggers and a grey zip-up hoodie"],
    ["Áo compression dài tay xanh + short đen", "a dark-blue long-sleeve compression top, black training shorts and training shoes"],
    ["Áo ba lỗ trắng + jogger xám + găng gym", "a white gym tank top, grey joggers and black weightlifting gloves with training shoes"],
    ["Áo gió cam đất + thun đen + quần chạy slim", "a burnt-orange lightweight windbreaker over a black tee, with slim black running trousers and trainers"],
    ["Set dry-fit xám bạc (áo + short)", "a matching silver-grey dry-fit training set of a fitted top and shorts, with white training shoes"],
    ["Hoodie không tay đen + quần training olive", "a black sleeveless hoodie, olive training trousers and thick-soled sneakers"],
  ],
  home: [
    ["Áo thun xám nhạt + short navy dây rút", "a light-grey cotton t-shirt, navy drawstring cotton shorts and house slippers"],
    ["Bộ linen be (áo cổ trụ + quần dài suông)", "a beige linen loungewear set: a short-sleeve band-collar top and loose straight trousers, barefoot"],
    ["Tank top trắng + jogger nỉ xám than + dép da", "a white tank top, charcoal fleece joggers and brown leather slippers"],
    ["Pajama satin navy viền trắng", "a navy satin pyjama set with white piping, a small chest pocket and long trousers"],
    ["Hoodie mỏng kem + quần lounge nâu nhạt", "a cream lightweight hoodie and light-brown modal-blend lounge trousers, in plain socks"],
    ["Áo thun xanh rêu + short cotton kem", "a moss-green t-shirt, cream cotton shorts and fabric house slippers"],
    ["Đồ ngủ cotton caro xanh-trắng", "a blue-and-white checked cotton pyjama set with a buttoned shirt and long trousers"],
    ["Sweatshirt xám + jogger đen + tất trắng", "a grey sweatshirt, black joggers and white socks"],
    ["Áo henley trắng ngà + quần linen xám sáng", "an ivory henley long-sleeve top and light-grey linen trousers, barefoot"],
    ["Áo thun oversize đen + short nỉ xám", "an oversized black t-shirt, grey fleece shorts and slide sandals"],
  ],
};

const ADULT_FEMALE: ByCategory = {
  daily: [
    ["Croptop hồng pastel + jeans ống rộng", "a pastel-pink ribbed cotton crop top, high-waisted light-blue wide-leg jeans, white platform sneakers and a pearl-beaded mini shoulder bag"],
    ["Blouse chiffon kem hoa nhí + short be", "a cream floral-print chiffon blouse, beige linen shorts, tan strappy sandals and gold hoop earrings"],
    ["Blazer đen oversize + tank trắng + chân váy denim", "an oversized black cotton blazer, a white fitted tank top, a faded denim mini skirt, black ankle boots and a silver chain necklace"],
    ["Cardigan xanh bạc hà + chân váy xếp ly be", "a mint-green knit cardigan over a white camisole, a pleated beige skirt and cream ballet flats"],
    ["Sweatshirt lavender + biker short xám", "a lavender cropped sweatshirt, grey cotton biker shorts, white running sneakers and a small nylon backpack"],
    ["Baby tee trắng + jeans baggy", "a fitted white baby tee, baggy blue jeans, chunky white sneakers and a small shoulder bag"],
    ["Sơ mi sọc xanh + chân váy chữ A trắng", "a blue-striped shirt, a white A-line skirt and black loafers"],
    ["Áo hai dây satin đen + quần ống rộng be", "a black satin camisole, beige wide-leg trousers and low-heel nude sandals"],
    ["Đầm cotton xanh pastel cổ vuông tay phồng", "a pastel-blue cotton dress with a square neckline and slightly puffed sleeves, with flat sandals"],
    ["Áo len gân kem + jeans ống loe + boots nâu", "a cream ribbed-knit top, flared jeans and brown ankle boots"],
  ],
  travel: [
    ["Váy maxi chiffon trắng hoa xanh + túi cói", "a white chiffon maxi dress with a blue floral print, thin-strap sandals and a woven straw bag"],
    ["Croptop linen be + quần ống rộng trắng", "a beige linen crop top, white wide-leg trousers and a straw tote bag"],
    ["Đầm hai dây vàng nhạt cotton + sandal trắng", "a pale-yellow cotton slip dress with small ruffle trim and white sandals"],
    ["Thun trắng + chân váy denim + sneaker trắng", "a white t-shirt, a blue denim skirt, white sneakers and a small backpack"],
    ["Blouse hoa nhí + short linen be + sandal nâu", "a ditsy-floral blouse, beige linen shorts and tan sandals"],
    ["Set sơ mi oversize xanh trời + short linen", "a sky-blue oversized linen shirt with matching linen shorts and flat sandals"],
    ["Tank top đen + cargo olive + boots thấp", "a black tank top, olive cargo trousers, low ankle boots and a crossbody bag"],
    ["Đầm midi cam đất cotton thô + thắt lưng mảnh", "a terracotta coarse-cotton midi dress with a thin belt and flat sandals"],
    ["Cardigan kem + váy hai dây satin xanh mint", "a cream light cardigan over a mint-green satin slip dress, with low sandals"],
    ["Jumpsuit ngắn trắng ngà thêu hoa + đế xuồng", "an ivory short jumpsuit with small floral embroidery on the chest and platform-wedge sandals"],
  ],
  work: [
    ["Blouse lụa trắng + chân váy bút chì navy + blazer xám", "a white silk blouse, a navy pencil skirt, a tailored grey blazer, nude pumps and small pearl stud earrings"],
    ["Suit be (blazer dài + quần ống rộng) + camisole ivory", "a beige wide-leg trouser suit over an ivory satin camisole, with a gold chain necklace and pointed cream heels"],
    ["Sơ mi powder blue + quần tây đen lưng cao", "a powder-blue button-up shirt, black high-waisted trousers, a slim leather belt and loafers"],
    ["Đầm midi crepe xanh rừng + blazer đen", "a forest-green crepe midi dress with a thin waist belt, a black blazer, low block heels and gold hoop earrings"],
    ["Áo len lavender + chân váy xếp ly trắng + blazer camel", "a soft lavender knit top, a white pleated midi skirt, a camel blazer and tan ankle boots"],
    ["Sơ mi trắng cổ nơ + quần ống đứng xám", "a white pussy-bow blouse, straight grey trousers and black pointed heels"],
    ["Blazer đen + áo knit kem + quần culottes be", "a black blazer over a cream knit top, with beige culottes and white loafers"],
    ["Đầm sơ mi be + thắt eo da nâu + gót vuông", "a beige shirt-dress belted with a brown leather belt and low block heels"],
    ["Áo satin navy + chân váy midi đen + blazer trắng ngà", "a navy satin blouse, a black midi skirt and an ivory blazer with pointed heels"],
    ["Suit pastel xanh nhạt + áo lụa trắng + túi da kem", "a pale-blue pastel trouser suit over a white silk top, with a cream leather bag and low heels"],
  ],
  party: [
    ["Đầm slip satin champagne + cao gót ánh kim", "a champagne satin slip dress with delicate white lace neckline trim, and metallic strappy high heels"],
    ["Đầm mini sequin đỏ ruby + clutch vàng", "a ruby-red sequined mini dress with structured shoulders, nude stiletto heels and a small gold clutch"],
    ["Đầm nhung đen cổ V + giày mũi nhọn", "a black velvet V-neck dress with a small rhinestone waist detail, sheer black tights and pointed heels"],
    ["Corset satin trắng + quần ống rộng đen", "a white satin corset top, high-waisted black wide-leg trousers, a crystal belt and black heels"],
    ["Đầm chiffon hồng dusty rose + tay bèo", "a dusty-rose chiffon midi dress with floral embroidery on the bodice, soft ruffled sleeves and silver heels"],
    ["Jumpsuit đen cổ yếm + dây lưng vàng", "a black halter-neck crepe jumpsuit with a fitted waist and a gold-metal belt, with black heels"],
    ["Đầm bodycon emerald + khuyên tai pha lê", "an emerald-green ribbed bodycon dress with crystal drop earrings and metallic heels"],
    ["Áo lệch vai satin lavender + chân váy midi đen xẻ", "a lavender one-shoulder satin top and a black side-slit midi skirt, with silver heels"],
    ["Đầm trắng ngà tay xuyên thấu + đính ngọc trai", "an ivory fitted dress with sheer long sleeves and small pearl beading, with nude heels"],
    ["Set blazer crop bạc + chân váy ngắn + boots đen", "a metallic-silver cropped blazer with a matching mini skirt and black ankle boots"],
  ],
  gala: [
    ["Đầm satin navy trễ vai đuôi cá + eo pha lê", "a deep-navy satin off-shoulder mermaid gown with crystal beadwork at the waist and silver heels"],
    ["Đầm tulle hồng blush + ren hoa nổi nhiều lớp", "a blush-pink tulle gown with floral lace appliqué, sheer sleeves and a multi-layer A-line skirt, with pearl hair accessories"],
    ["Đầm nhung đen xẻ tà cao + găng tay dài", "a black velvet gown with a high slit and sweetheart neckline, subtle sequin detailing, long gloves and black stilettos"],
    ["Đầm lụa emerald + eo thêu chỉ vàng + tay cape", "an emerald silk gown with a draped bodice, gold-embroidered waistline, cape-style sleeves and metallic-gold heels"],
    ["Đầm sequin bạc ôm dài + lưng hở + dây pha lê", "a fitted silver sequin gown with an open back, thin crystal straps, a floor-sweeping hem and chandelier earrings"],
    ["Đầm đỏ rượu vang A-line + cổ thuyền thêu hoa", "a wine-red A-line gown with a boat neckline and tonal floral embroidery, with matching heels"],
    ["Đầm trắng ngà đuôi dài + corset ngọc trai", "an ivory corset gown with pearl beading and a long train, with thin gloves and silver heels"],
    ["Đầm satin vàng gold cổ đổ + xẻ tà + clutch ánh kim", "a gold satin gown with a cowl neckline and a soft slit, with a metallic clutch and gold heels"],
    ["Đầm tím than phủ organza + đá ở ngực", "a plum organza-overlay gown with slightly puffed sleeves and crystals on the bodice, with dark heels"],
    ["Đầm đen đuôi cá vai lệch + nơ lớn", "a black mermaid gown with an asymmetric one-shoulder neckline and a large bow detail, with black heels"],
  ],
  sport: [
    ["Bra thể thao lavender + legging đen + khoác crop trắng", "a lavender seamless sports bra, high-waisted black compression leggings, a cropped white zip-up jacket and white training sneakers"],
    ["Tank coral + short chạy navy phản quang", "a coral moisture-wicking tank top, navy running shorts with reflective silver details, a lightweight visor and cushioned sneakers"],
    ["Polo xanh pastel + váy tennis trắng xếp ly", "a pastel-blue fitted tennis polo, a white pleated tennis skirt, white court shoes and a matching hairband"],
    ["Set yoga xanh sage (bra ribbed + legging)", "a sage-green ribbed yoga set of a sports bra and high-waisted leggings, with barefoot-style trainers"],
    ["Crop top đen + jogger xám khóa bạc", "a black cropped performance top, grey joggers with silver zip pockets, chunky white sneakers and a nylon belt bag"],
    ["Áo compression hồng đất + legging xám than", "a clay-pink compression top, charcoal high-waist leggings and white training shoes"],
    ["Bra trắng + biker short navy + khoác lưới", "a white sports bra, navy biker shorts and a thin mesh jacket with trainers"],
    ["Set gym nâu mocha seamless + áo zip cùng tông", "a mocha-brown seamless gym set that hugs the body, with a matching tonal zip-up jacket and trainers"],
    ["Thun oversize xám + short thể thao đen + tất cao cổ", "an oversized grey t-shirt, black athletic shorts, crew socks and running shoes"],
    ["Tank xanh mint + legging trắng ngà + giày pastel", "a mint-green tank top, ivory leggings and pastel running sneakers"],
  ],
  home: [
    ["Bộ cotton hồng phấn (áo rộng + short, thêu tim)", "a soft-pink cotton loungewear set: a relaxed top with a small white embroidered heart and elastic-waist shorts, with slippers"],
    ["Váy ngủ satin champagne hai dây + ren trắng", "a champagne satin slip nightdress with thin straps and white lace trim at the bust and hem"],
    ["Cardigan kem + áo hai dây trắng + quần cotton be", "a cream light-knit cardigan over a white camisole, with beige cotton trousers, barefoot"],
    ["Pajama lụa xanh pastel hoa nhỏ + viền trắng", "a pastel-blue silk pyjama set with a small floral print and white piping, and long straight trousers"],
    ["Croptop cotton gân lavender + jogger xám + dép bông", "a lavender ribbed cotton crop top, light-grey joggers and fluffy white house slippers"],
    ["Thun oversize trắng + short caro hồng", "an oversized white t-shirt, pink checked shorts and a soft hair clip"],
    ["Váy suông cotton xanh mint tay ngắn", "a mint-green cotton A-line house dress with short sleeves and side pockets, with flat slippers"],
    ["Set nâu sữa (áo sát nách + quần ống rộng modal)", "a milky-brown loungewear set of a sleeveless top and wide-leg modal trousers"],
    ["Hoodie xanh pastel + short nỉ trắng + tất cao cổ", "a pastel-blue hoodie, white fleece shorts and crew socks"],
    ["Pajama satin đen viền kem + cổ bẻ", "a black satin pyjama set with cream piping, a notch collar and loose long trousers"],
  ],
};

// Teens/children reuse an age-appropriate subset mapped onto the same occasion
// keys (no travel/work). Kept lighter and school-friendly.
const TEEN_FEMALE: ByCategory = {
  daily: [
    ["Áo thun + quần jeans + sneaker", "a bright graphic t-shirt, blue mom-fit jeans and colourful sneakers"],
    ["Áo croptop + chân váy jeans", "a pastel cropped top and a denim skater skirt, with white canvas shoes"],
    ["Áo sơ mi kẻ + quần short jeans", "an open plaid shirt over a white tee, denim shorts and sneakers"],
    ["Áo len + chân váy tennis", "a soft knit vest over a white shirt and a pleated tennis skirt, with sneakers"],
    ["Đầm hoa + áo khoác jeans", "a floral sundress under a cropped denim jacket, with white sneakers"],
  ],
  party: [
    ["Đầm xòe dự tiệc sinh nhật", "a pastel tulle party dress at knee length, with sparkly flats"],
    ["Áo kim sa + chân váy", "a light sequined top and a black skater skirt, with ankle boots"],
    ["Đầm satin nhẹ nhàng", "a lilac satin slip party dress and simple heeled sandals"],
  ],
  gala: [
    ["Áo sơ mi + chân váy xếp ly", "a white blouse and a navy pleated skirt, with black flats (smart formal)"],
    ["Đầm sơ mi thanh lịch", "a modest navy shirt-dress belted at the waist, with low heels"],
    ["Áo dài trắng", "a white silk áo dài (Vietnamese long dress) over white trousers"],
  ],
  sport: [
    ["Áo thun + quần short thể thao", "a bright sports t-shirt, black gym shorts and running shoes"],
    ["Áo tank + legging", "a fitted tank top, patterned leggings and trainers"],
    ["Bộ đồ thể dục trường học", "a school PE kit: coloured polo shirt, navy shorts and sports shoes"],
  ],
  home: [
    ["Áo phông rộng + quần short", "an oversized pastel t-shirt and soft cotton sleep shorts, with fuzzy slippers"],
    ["Áo hoodie + quần jogger", "a light-pink hoodie and grey joggers, in cute cotton socks"],
    ["Áo thun + quần pyjama", "a white printed tee and checked cotton pyjama trousers, with slippers"],
  ],
};

const TEEN_MALE: ByCategory = {
  daily: [
    ["Áo thun + quần jeans + sneaker", "an oversized graphic t-shirt, black skinny jeans and colourful high-top sneakers"],
    ["Áo sơ mi kẻ + quần short", "an open checked shirt over a tee, cargo shorts and trainers"],
    ["Áo polo + quần kaki", "a navy polo, khaki chinos and clean white sneakers"],
    ["Áo hoodie + quần cargo", "a black hoodie, beige cargo trousers and chunky sneakers"],
    ["Áo bóng rổ + quần short", "a loose basketball jersey over a tee, mesh shorts and high-tops"],
  ],
  party: [
    ["Sơ mi + quần chinos", "a fitted patterned shirt, dark chinos and clean sneakers"],
    ["Áo polo cao cấp + quần jeans", "a smart charcoal polo, dark jeans and loafers"],
    ["Áo thun + blazer trẻ trung", "a plain tee under a slim navy blazer, with dark jeans and boots"],
  ],
  gala: [
    ["Sơ mi trắng + quần âu", "a white dress shirt, dark trousers and black shoes (smart formal)"],
    ["Áo sơ mi + gi-lê", "a light shirt with a grey waistcoat, navy trousers and loafers"],
    ["Vest xanh navy trẻ", "a slim navy suit, white shirt, thin tie and dress shoes"],
  ],
  sport: [
    ["Áo thun + quần short thể thao", "a sports t-shirt, black gym shorts and running shoes"],
    ["Bộ đồ bóng đá", "a football jersey, matching shorts and studded boots"],
    ["Áo khoác gió + quần jogger", "a windbreaker over a tee and track trousers, with trainers"],
  ],
  home: [
    ["Áo phông + quần short", "a plain graphic t-shirt and cotton basketball shorts, with slides"],
    ["Áo hoodie + quần jogger", "a grey hoodie and black joggers, in white socks"],
    ["Áo ba lỗ + quần thể thao", "a white tank top and navy sweatpants, barefoot"],
  ],
};

// Bé gái (child female) — age-appropriate, gender-specific.
const CHILD_FEMALE: ByCategory = {
  daily: [
    ["Váy thun in hình + legging + sneaker", "a bright printed t-shirt dress over leggings and small Velcro sneakers"],
    ["Áo phông + chân váy jeans", "a cheerful printed tee, a little denim skirt and canvas shoes"],
    ["Áo len + legging hoa", "a soft knit top, floral leggings and light sneakers"],
    ["Áo phông + yếm jeans", "a striped tee under a denim pinafore dress and small sneakers"],
  ],
  travel: [
    ["Váy hoa + mũ rộng vành", "a floral sundress, a wide-brim sun hat and comfy sandals"],
    ["Áo phông + short + balo nhỏ", "a bright t-shirt, comfy shorts, a small backpack and sneakers"],
    ["Áo chống nắng + legging", "a light long-sleeve sun shirt, leggings and trainers"],
  ],
  party: [
    ["Đầm công chúa xòe + nơ", "a puffy pastel party dress with a bow and shiny flat shoes"],
    ["Đầm ren + kẹp nơ tóc", "a lace party dress with a hair bow and Mary-Jane shoes"],
    ["Váy kim tuyến + bờm", "a sparkly tulle dress with a headband and glitter flats"],
  ],
  gala: [
    ["Đầm nhung cổ trắng thắt nơ", "a velvet dress with a white collar and a bow, with little dress shoes"],
    ["Áo dài nhỏ truyền thống", "a small traditional Vietnamese áo dài in a soft colour"],
    ["Đầm satin thắt eo nơ", "a satin dress with a sash bow and flat shoes"],
  ],
  sport: [
    ["Áo thun + short thể thao", "a bright sports t-shirt, small gym shorts and light running shoes"],
    ["Áo tank + legging + băng đô", "a tank top, patterned leggings, a hairband and trainers"],
    ["Đồ thể dục trường", "a school PE kit: coloured polo, shorts and sports shoes"],
  ],
  home: [
    ["Bộ ngủ in hình dễ thương", "a soft two-piece pyjama set with a playful print and cotton socks"],
    ["Áo hoodie + jogger + dép bông", "a small bright hoodie, cotton joggers and fuzzy slippers"],
    ["Váy thun mặc nhà", "a comfy cotton house dress with a cartoon print and slippers"],
  ],
};

// Bé trai (child male) — age-appropriate, gender-specific.
const CHILD_MALE: ByCategory = {
  daily: [
    ["Áo phông + quần jeans + sneaker", "a bright t-shirt, small blue jeans and Velcro sneakers"],
    ["Áo sơ mi kẻ + short kaki", "a checked short-sleeve shirt, khaki shorts and canvas shoes"],
    ["Áo thun in hình + jogger", "a cartoon-print tee, cotton joggers and light sneakers"],
    ["Áo khoác gió + quần thể thao", "a colourful light jacket over a tee, with sport trousers and trainers"],
  ],
  travel: [
    ["Áo phông + short + mũ lưỡi trai", "a bright t-shirt, comfy shorts, a baseball cap and sneakers"],
    ["Áo chống nắng + quần dài nhẹ", "a light long-sleeve sun shirt, thin trousers and trainers"],
    ["Áo sơ mi + short + balo nhỏ", "a short-sleeve shirt, shorts, a small backpack and sandals"],
  ],
  party: [
    ["Sơ mi + quần âu + nơ nhỏ", "a little white shirt, a small bow tie, dark shorts and dress shoes"],
    ["Áo gile + sơ mi", "a small waistcoat over a shirt, with neat trousers and loafers"],
    ["Áo thun in hình + blazer nhí", "a printed tee under a little blazer, with clean shorts and sneakers"],
  ],
  gala: [
    ["Vest nhí + nơ", "a small suit with a bow tie, a white shirt and dress shoes"],
    ["Sơ mi + quần âu chỉnh tề", "a neat white shirt, navy trousers and small dress shoes"],
    ["Áo dài nhỏ truyền thống (bé trai)", "a small traditional Vietnamese áo dài (boy's version) in a soft colour"],
  ],
  sport: [
    ["Áo thun + short thể thao", "a bright sports t-shirt, small gym shorts and light running shoes"],
    ["Bộ đồ bóng đá nhí", "a small football kit: jersey, shorts and little sports shoes"],
    ["Áo ba lỗ + jogger", "a cotton tank top, soft joggers and trainers"],
  ],
  home: [
    ["Bộ đồ ngủ in hình", "a soft two-piece pyjama set with a playful print and cotton socks"],
    ["Áo hoodie nhỏ + jogger", "a small bright hoodie, cotton joggers and slippers"],
    ["Áo thun + short mặc nhà", "a comfy cartoon-print t-shirt and cotton shorts, with soft slippers"],
  ],
};

// bracket -> gender -> categories. Bé gái / bé trai now have their OWN sets.
const CATALOG: Record<WardrobeAgeBracket, Record<WardrobeGender, ByCategory>> = {
  child: { male: CHILD_MALE, female: CHILD_FEMALE },
  teen: { male: TEEN_MALE, female: TEEN_FEMALE },
  adult: { male: ADULT_MALE, female: ADULT_FEMALE },
  senior: { male: ADULT_MALE, female: ADULT_FEMALE },
};

/** The character group (Vietnamese) whose wardrobe is being shown — surfaced in
 * the UI so the user can see the picker adapts by age + gender:
 * Bé gái / Bé trai / Thiếu niên (nữ|nam) / Nữ | Nam. */
export function wardrobeGroupLabel(gender?: string, ageText?: string, isChild?: boolean): string {
  const bracket = ageBracketOf(ageText, isChild);
  const female = String(gender ?? "").toLowerCase().startsWith("f") || String(gender).toLowerCase() === "female";
  if (bracket === "child") return female ? "Bé gái" : "Bé trai";
  if (bracket === "teen") return female ? "Thiếu niên (nữ)" : "Thiếu niên (nam)";
  if (bracket === "senior") return female ? "Nữ (lớn tuổi)" : "Nam (lớn tuổi)";
  return female ? "Nữ" : "Nam";
}

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
 * prefixed with its occasion (Vietnamese); the value is the English garment
 * description written into the character's costume and later into the prompts.
 * Categories are emitted in WARDROBE_CATEGORIES order; only groups present for
 * the chosen bracket appear (teens/children skip travel/work).
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
