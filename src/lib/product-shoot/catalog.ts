// ============================================================
// PRODUCT SHOOT CATALOG — how a product ad is shot.
//
// Three presence modes decide who is on screen:
//   · product_only    — the product is the protagonist; no person, no body part.
//   · hands_only      — hands / wrist / forearm only, never a face or full body.
//   · with_characters — people perform an affiliate problem → solution story.
//
// Each shot style is a CONCRETE camera + lighting + set contract with an ordered
// beat plan (hook → reveal → detail → proof → hero). The style the user picks is
// compiled verbatim into the script prompt, every shot's beats and the exported
// video/storyboard prompts — it is never a "soft lens" the model may swap.
//
// Product categories carry what is worth showing for that kind of product
// (hero details, proof moments, foley, geometry locks) and which styles suit it.
// Pure data + functions so node tests can exercise them directly.
// ============================================================

export type PresenceMode = "product_only" | "hands_only" | "with_characters";

export type ProductShotStyleId =
  | "dark_reveal"
  | "light_sweep"
  | "macro_detail"
  | "turntable_360"
  | "motion_control"
  | "levitation_exploded"
  | "elements_texture"
  | "pour_texture"
  | "inner_mechanism"
  | "concept_metaphor"
  | "tabletop_flatlay"
  | "color_pop_studio"
  | "lifestyle_still"
  | "stop_motion"
  | "unboxing_reveal"
  | "hand_demo";

export type ProductCategoryId =
  | "watch"
  | "jewelry_eyewear"
  | "fragrance"
  | "skincare"
  | "makeup"
  | "personal_care"
  | "fashion_apparel"
  | "footwear"
  | "bags_leather"
  | "phone_gadget"
  | "audio"
  | "computer_accessory"
  | "home_appliance"
  | "kitchenware"
  | "food"
  | "beverage"
  | "supplement"
  | "home_decor"
  | "baby_toys"
  | "sports_outdoor"
  | "auto_tools"
  | "pet"
  | "general";

export type BeatRole = "hook" | "reveal" | "detail" | "proof" | "hero";

export interface ShootOption<T extends string> {
  value: T;
  label_vi: string;
  label_en: string;
  description_vi: string;
  description_en: string;
}

export interface StyleBeat {
  role: BeatRole;
  /** Exact camera instruction (framing + angle + move) for this beat. */
  camera: string;
  /** What the product / light / hands do during the beat. */
  action: string;
}

export interface ProductShotStyle extends ShootOption<ProductShotStyleId> {
  presence: PresenceMode[];
  lighting: string;
  set: string;
  lens: string;
  /** Camera vocabulary this style is allowed to use — nothing else. */
  camera_moves: string[];
  product_motion: string;
  pacing: string;
  beats: StyleBeat[];
  /** How the still keyframe (first frame) must look for this style. */
  keyframe_rule: string;
  sound: string;
  negative: string[];
}

export interface ProductCategory extends ShootOption<ProductCategoryId> {
  keywords: string[];
  materials: string;
  hero_details: string[];
  proof_moments: string[];
  foley: string;
  geometry_lock: string;
  /** Hands-only action that suits the product (wear, open, press, apply…). */
  hand_action: string;
  /** A real everyday problem the product solves — for the with_characters story. */
  problem_hint: string;
  recommended_styles: ProductShotStyleId[];
}

export const PRESENCE_OPTIONS: ShootOption<PresenceMode>[] = [
  {
    value: "product_only",
    label_vi: "Chỉ quay sản phẩm",
    label_en: "Product only",
    description_vi: "Không có người, không tay. Sản phẩm là nhân vật chính: ánh sáng, chất liệu, chuyển động máy quay kể chuyện.",
    description_en: "No people, no hands. The product is the protagonist; light, material and camera movement tell the story.",
  },
  {
    value: "hands_only",
    label_vi: "Chỉ tay / cổ tay (không lộ mặt)",
    label_en: "Hands only (no face)",
    description_vi: "Chỉ thấy bàn tay, cổ tay, cẳng tay thao tác hoặc đeo sản phẩm — không bao giờ lộ mặt hay toàn thân.",
    description_en: "Only hands, wrist or forearm operate or wear the product — never a face or a full body.",
  },
  {
    value: "with_characters",
    label_vi: "Có người diễn (affiliate vấn đề → giải pháp)",
    label_en: "With people (affiliate problem → solution)",
    description_vi: "Người thật gặp một vấn đề quen thuộc, sản phẩm xuất hiện như giải pháp, chứng minh kết quả rồi kêu gọi mua.",
    description_en: "A real person meets a familiar problem, the product arrives as the solution, the result is proven, then one CTA.",
  },
];

const NO_FACE = ["face", "head", "full body", "torso shot", "mirror reflection showing a person", "eyes"];

export const PRODUCT_SHOT_STYLES: ProductShotStyle[] = [
  {
    value: "dark_reveal",
    label_vi: "Hiện ra từ bóng tối",
    label_en: "Reveal from darkness",
    description_vi: "Nền đen tuyệt đối; một vệt sáng hẹp quét qua làm lộ dần từng mép, từng chi tiết rồi chìm lại vào bóng tối.",
    description_en: "Pure black set; a narrow moving light slice reveals one edge and detail at a time, then lets it sink back into darkness.",
    presence: ["product_only", "hands_only"],
    lighting: "low-key chiaroscuro: a single hard-edged strip light or narrow beam on a slow track, 85–95% of the frame stays near-black, crisp specular edge highlights, faint atmospheric haze catching the beam",
    set: "infinite matte-black void (black velvet / flag-black seamless), the product on an invisible or black-glass support with a faint mirrored reflection",
    lens: "100mm macro and 50mm prime, f/2.8–f/5.6, shallow but readable depth of field",
    camera_moves: ["slow push-in", "slow lateral slide", "slow arc of 15–30°", "locked-off hold while the light moves", "rack focus between two details"],
    product_motion: "the product is still or turns a few degrees on a hidden turntable; the LIGHT does the revealing",
    pacing: "slow and deliberate — one camera move per 4–6 seconds; the light slice crosses the product in 2–3 seconds",
    beats: [
      { role: "hook", camera: "EXTREME CLOSE-UP, low angle, locked-off; most of the frame in darkness", action: "a thin blade of light ignites one edge of the product — a glint in the void, the lit edge already clearly readable" },
      { role: "reveal", camera: "CLOSE-UP, slow lateral slide left-to-right", action: "the light slice travels across the product, revealing its silhouette and main face section by section" },
      { role: "detail", camera: "MACRO, slow push-in with rack focus", action: "one signature detail emerges from shadow, catches a specular highlight, then falls back into darkness" },
      { role: "proof", camera: "MACRO, slow arc of 20°", action: "a second detail or the product's key feature is lit and shown working (e.g. moving part, glow, texture)" },
      { role: "hero", camera: "MEDIUM CLOSE hero frame, slight low angle, slow push-in then hold", action: "the full product is finally rim-lit against black, centred with negative space for the CTA text" },
    ],
    keyframe_rule: "the keyframe is the HALF-LIT moment — the product clearly readable on at least 30% of its surface with a crisp edge highlight; never a pure black frame",
    sound: "deep low sub-bass swell, a soft whoosh synced to each light pass, delicate product foley (click, tick, metal ring), minimal piano or ambient pad",
    negative: ["bright high-key background", "flat front lighting", "busy props", "visible light stand", "pure black frame with no product"],
  },
  {
    value: "light_sweep",
    label_vi: "Vệt sáng lướt",
    label_en: "Light sweep",
    description_vi: "Đèn dải chạy dọc sản phẩm; ánh phản chiếu trượt trên bề mặt bóng, kim loại, kính — khoe độ hoàn thiện.",
    description_en: "A strip softbox glides along the product; reflections slide across polished metal, glass and gloss to show the finish.",
    presence: ["product_only", "hands_only"],
    lighting: "dark-to-mid grey gradient background, a long strip softbox moving across the product so a clean specular line glides over every curved surface, controlled black flags for contrast",
    set: "seamless graduated grey or deep navy studio sweep, glossy acrylic floor with a soft reflection",
    lens: "85mm and 100mm macro, f/4–f/8 for edge-to-edge sharpness on the product",
    camera_moves: ["slow orbit 20–40°", "slow push-in", "locked-off hold while reflections move", "slow tilt up"],
    product_motion: "still product or a slow hidden turntable rotation (≤ 30° per beat) so reflections travel",
    pacing: "smooth and luxurious; each reflection pass lasts 2–4 seconds",
    beats: [
      { role: "hook", camera: "CLOSE-UP, slow push-in", action: "a bright specular line enters frame and slides along the product's main curve" },
      { role: "reveal", camera: "MEDIUM CLOSE, slow orbit 30°", action: "the product turns into its three-quarter hero angle as the reflection sweeps the full length" },
      { role: "detail", camera: "MACRO, locked-off", action: "the reflection crosses a finishing detail (bevel, logo, seam, button) making it gleam" },
      { role: "proof", camera: "CLOSE-UP, slow tilt up", action: "the key feature is shown cleanly and sharply, reflection settling" },
      { role: "hero", camera: "MEDIUM hero frame, eye-level, hold", action: "clean final pose with one soft highlight line, negative space for CTA" },
    ],
    keyframe_rule: "keyframe shows the product sharp in three-quarter view with one clean specular line across it",
    sound: "airy whoosh per sweep, soft metallic shimmer, elegant minimal beat",
    negative: ["cluttered background", "fingerprints or dust", "blown-out reflections that hide the shape", "warped reflections"],
  },
  {
    value: "macro_detail",
    label_vi: "Cận cảnh siêu chi tiết",
    label_en: "Macro detail tour",
    description_vi: "Ống kính macro đi qua từng chi tiết: vân bề mặt, đường may, khía, giọt, kết cấu — lấy nét chuyển dần.",
    description_en: "A macro lens tours the details — surface grain, stitching, knurling, droplets, texture — with deliberate focus pulls.",
    presence: ["product_only", "hands_only"],
    lighting: "soft directional key raking across the surface to reveal texture, small specular kicks on edges, gentle fill",
    set: "neutral background that falls out of focus; tiny depth-of-field slices",
    lens: "100mm macro / probe lens, f/2.8–f/4, razor-thin depth of field, focus pulls between details",
    camera_moves: ["slow macro slide", "rack focus", "slow probe-lens glide", "micro push-in"],
    product_motion: "still product; only focus and the camera glide move",
    pacing: "calm, 3–5 seconds per detail",
    beats: [
      { role: "hook", camera: "EXTREME MACRO, rack focus from blur to sharp", action: "an abstract texture snaps into focus and is revealed to be the product surface" },
      { role: "reveal", camera: "MACRO, slow slide along the product", action: "the glide follows a contour to show how the product is built" },
      { role: "detail", camera: "MACRO, rack focus between two details", action: "focus passes from one signature detail to the next" },
      { role: "proof", camera: "MACRO, micro push-in", action: "a working detail is shown in motion (moving part, liquid bead, glow, switch)" },
      { role: "hero", camera: "CLOSE-UP pull-back to hero frame", action: "pull back to reveal the whole product, sharp and clean" },
    ],
    keyframe_rule: "keyframe is a sharp macro of one signature detail with the rest softly out of focus but recognisable",
    sound: "close-mic product foley (texture, click, tick), soft room tone, subtle music",
    negative: ["invented text or logos", "noisy or dirty surfaces", "focus on background instead of product"],
  },
  {
    value: "turntable_360",
    label_vi: "Xoay 360° trên bệ",
    label_en: "360° turntable",
    description_vi: "Sản phẩm trên bệ xoay chậm, máy quay vòng quanh hoặc đứng yên — thấy mọi mặt, rất sạch, dễ lặp vòng.",
    description_en: "The product rotates on a plinth while the camera holds or circles — every side shown, clean and loopable.",
    presence: ["product_only", "hands_only"],
    lighting: "clean three-point studio light, soft key, rim lights to separate the silhouette, even exposure on every face",
    set: "minimal plinth / round podium in a seamless studio colour that suits the brand",
    lens: "50mm–85mm, f/5.6–f/8 for full-product sharpness",
    camera_moves: ["locked-off hold", "slow orbit", "slow crane down", "slow push-in"],
    product_motion: "constant slow rotation on the turntable (about 30–45° per second at most)",
    pacing: "steady and even; the rotation never jumps",
    beats: [
      { role: "hook", camera: "MEDIUM, slow crane down onto the podium", action: "the product is discovered on its podium, already turning" },
      { role: "reveal", camera: "MEDIUM CLOSE, locked-off", action: "the rotation shows front, side and back" },
      { role: "detail", camera: "CLOSE-UP, slow push-in", action: "as a key side faces camera, the push-in lands on its detail" },
      { role: "proof", camera: "CLOSE-UP, locked-off", action: "the product stops at its best angle; one function or feature is shown" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "final front three-quarter pose, perfectly centred, CTA space" },
    ],
    keyframe_rule: "keyframe shows the whole product on the podium in its front three-quarter angle, fully sharp",
    sound: "smooth rotating hum, clean modern beat, a soft click when it stops",
    negative: ["wobbling rotation", "shape changing as it turns", "cropped product edges"],
  },
  {
    value: "motion_control",
    label_vi: "Máy quay tốc độ cao (tay robot)",
    label_en: "Motion-control / robotic camera",
    description_vi: "Lia nhanh, dừng gắt, tăng giảm tốc độ đúng khoảnh khắc — năng động, hợp video ngắn bắt trend.",
    description_en: "Fast whip moves that stop dead, speed ramps on the key moment — energetic, made for short-form.",
    presence: ["product_only", "hands_only"],
    lighting: "punchy high-contrast studio light, saturated accent gels, crisp shadows",
    set: "bold coloured seamless or graphic set with simple geometric props",
    lens: "24mm–50mm for dynamic perspective, f/4–f/8",
    camera_moves: ["fast whip-pan into a hard stop", "fast push-in with speed ramp", "fast orbit with snap stop", "snap zoom", "top-down drop"],
    product_motion: "product drops, spins or slides into frame and lands precisely on the beat",
    pacing: "fast — 1–2 seconds per move, each move ends in a crisp hold; speed ramps from real-time to slow motion on the hero moment",
    beats: [
      { role: "hook", camera: "fast push-in with speed ramp, ending in a hard stop CLOSE-UP", action: "the product slams into frame and lands exactly on the beat" },
      { role: "reveal", camera: "fast orbit 90° with snap stop", action: "the camera whips around to the hero angle and freezes" },
      { role: "detail", camera: "snap zoom to MACRO", action: "punch-in on one signature detail" },
      { role: "proof", camera: "top-down drop, slow-motion ramp", action: "the key feature is triggered in slow motion (splash, pop, click, spin)" },
      { role: "hero", camera: "fast pull-back to MEDIUM, hard stop", action: "final hero pose on the last beat, CTA space" },
    ],
    keyframe_rule: "keyframe is the crisp frozen hero moment with the product perfectly sharp — no motion blur on the product",
    sound: "punchy beat with whoosh and impact hits synced to every stop, snappy foley",
    negative: ["motion blur that hides the product", "shaky handheld feel", "product shape distortion during fast moves"],
  },
  {
    value: "levitation_exploded",
    label_vi: "Lơ lửng / tách lớp",
    label_en: "Levitation / exploded view",
    description_vi: "Sản phẩm trôi lơ lửng, các lớp hoặc thành phần tách ra rồi ghép lại — cho thấy cấu tạo, thành phần.",
    description_en: "The product floats; layers or ingredients separate and reassemble to show how it is made.",
    presence: ["product_only"],
    lighting: "soft gradient studio light with clean rim light, gentle glow behind the product",
    set: "clean gradient background, weightless space",
    lens: "50mm–85mm, f/5.6, everything in the floating group sharp",
    camera_moves: ["slow orbit", "slow push-in", "slow vertical rise", "locked-off hold"],
    product_motion: "the product floats and slowly rotates; parts/layers/ingredients separate along clean axes and later snap back together",
    pacing: "smooth and satisfying; separation 2–3 s, reassembly 1–2 s",
    beats: [
      { role: "hook", camera: "MEDIUM, slow vertical rise", action: "the product rises and floats weightlessly" },
      { role: "reveal", camera: "MEDIUM CLOSE, slow orbit", action: "it rotates to show its hero face" },
      { role: "detail", camera: "MEDIUM, locked-off", action: "layers / components / ingredients separate into an exploded view" },
      { role: "proof", camera: "CLOSE-UP, slow push-in on one component", action: "the key component or ingredient glows or is highlighted" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "everything snaps back together into the finished product" },
    ],
    keyframe_rule: "keyframe shows the complete assembled product floating, sharp, before any separation",
    sound: "airy rising tone, soft magnetic clicks on reassembly, modern ambient beat",
    negative: ["parts that do not exist in the real product", "melting or morphing shapes", "messy chaotic explosion"],
  },
  {
    value: "elements_texture",
    label_vi: "Chơi với chất liệu (nước, đá, khói, lụa)",
    label_en: "Elements & textures",
    description_vi: "Giọt nước đọng, nước bắn, đá lạnh, khói, cát, tấm lụa trượt xuống để lộ sản phẩm.",
    description_en: "Water beads, splashes, ice, smoke, sand or a silk sheet sliding off to reveal the product.",
    presence: ["product_only", "hands_only"],
    lighting: "backlight and rim light to make water, smoke and fabric glow; controlled speculars on droplets",
    set: "wet black stone, ice bed, sand dune, flowing silk or smoky void — ONE element chosen to match the product story",
    lens: "100mm macro and 50mm, high-speed slow motion feel, f/2.8–f/5.6",
    camera_moves: ["slow push-in", "locked-off slow-motion hold", "slow slide", "slow tilt down"],
    product_motion: "the element acts on the product (water splashes over it, silk slides off, smoke clears, ice cracks) while the product stays intact",
    pacing: "slow motion moments of 2–4 s, then a calm hold",
    beats: [
      { role: "hook", camera: "MACRO, locked-off slow motion", action: "a single droplet / wisp / fabric fold moves across the frame" },
      { role: "reveal", camera: "CLOSE-UP, slow tilt down", action: "the element parts (silk slides away, smoke clears, water sheets off) to reveal the product" },
      { role: "detail", camera: "MACRO, slow slide", action: "beads of water or particles sit on the product surface catching light" },
      { role: "proof", camera: "CLOSE-UP, slow-motion hold", action: "the product proves its quality in the element (waterproof, cool, fresh, smooth)" },
      { role: "hero", camera: "MEDIUM hero frame, slow push-in then hold", action: "the product rests in the element, perfectly lit, CTA space" },
    ],
    keyframe_rule: "keyframe shows the product clearly with the element around it — the element never covers more than a third of the product",
    sound: "detailed element foley (water, ice crack, fabric whisper, smoke hiss) over a minimal score",
    negative: ["element hiding the product", "product damaged or deformed by the element", "unrealistic physics"],
  },
  {
    value: "pour_texture",
    label_vi: "Rót / kết cấu sản phẩm",
    label_en: "Pour & texture",
    description_vi: "Rót đồ uống, kem quệt thành vệt, serum nhỏ giọt, sốt chảy — khoe kết cấu thật của sản phẩm.",
    description_en: "Pours, cream swatches, serum drops, sauce drizzles — the real texture of the product is the star.",
    presence: ["product_only", "hands_only"],
    lighting: "backlit and side-lit to make liquids translucent and creams glossy, clean highlights",
    set: "clean surface (glass, marble, coloured acrylic) matching the product palette",
    lens: "100mm macro, high-frame-rate slow motion, f/4",
    camera_moves: ["locked-off slow-motion hold", "slow push-in", "slow top-down glide", "slow arc"],
    product_motion: "the product's content flows: pour, drip, swirl, swatch, bubble — then settles",
    pacing: "slow motion pour 2–4 s, settle and hold",
    beats: [
      { role: "hook", camera: "MACRO, locked-off slow motion", action: "the first drop / stream of the product falls in slow motion" },
      { role: "reveal", camera: "CLOSE-UP, slow push-in", action: "the container is revealed as the source of the pour / swatch" },
      { role: "detail", camera: "MACRO, slow top-down glide", action: "the texture spreads, swirls or bubbles, showing consistency and colour" },
      { role: "proof", camera: "CLOSE-UP, slow arc", action: "the result of the texture (glass filled, swatch absorbed, dish coated) is shown" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "container and result side by side, clean, CTA space" },
    ],
    keyframe_rule: "keyframe shows the container sharp with the first stream / drop of its content",
    sound: "rich liquid / cream foley, fizz or bubble pops, light upbeat music",
    negative: ["wrong colour or consistency of the product", "spills that look dirty", "container label changing"],
  },
  {
    value: "inner_mechanism",
    label_vi: "Bên trong / cơ chế hoạt động",
    label_en: "Inner mechanism",
    description_vi: "Lật mở thấy bên trong: bánh răng, động cơ, lưỡi dao, lớp đệm, mạch — cho thấy vì sao sản phẩm tốt.",
    description_en: "Open it up: gears, motor, blades, cushioning, circuitry — show why the product works.",
    presence: ["product_only", "hands_only"],
    lighting: "precise technical lighting, cool key with warm accents on moving parts, clean shadows",
    set: "dark technical studio or clean cutaway view background",
    lens: "100mm macro / probe lens, f/4–f/8",
    camera_moves: ["slow probe-lens glide", "slow push-in through an opening", "locked-off hold on moving parts", "slow orbit"],
    product_motion: "the case opens or a clean cutaway reveals the inside; internal parts move as in real operation",
    pacing: "measured, 3–5 s per mechanism move",
    beats: [
      { role: "hook", camera: "MACRO, locked-off", action: "a tiny moving part ticks / spins in close-up" },
      { role: "reveal", camera: "CLOSE-UP, slow push-in through an opening", action: "the camera travels from the outside into the product's interior" },
      { role: "detail", camera: "MACRO, slow probe glide", action: "the core mechanism works in real motion" },
      { role: "proof", camera: "CLOSE-UP, slow orbit", action: "the mechanism's effect is shown on the outside (performance, precision, power)" },
      { role: "hero", camera: "MEDIUM hero frame, slow pull-back then hold", action: "closed, complete product in hero pose" },
    ],
    keyframe_rule: "keyframe shows the real product exterior with one opening / cutaway revealing a believable mechanism",
    sound: "precise mechanical foley (gears, motor whirr, click), technical minimal score",
    negative: ["invented internals that contradict the real product", "messy wires", "melting mechanisms"],
  },
  {
    value: "concept_metaphor",
    label_vi: "Ý niệm / ẩn dụ",
    label_en: "Concept metaphor",
    description_vi: "Một ẩn dụ hình ảnh gắn với giá trị sản phẩm: thời gian (đồng hồ), sự tươi mát (đồ uống), sự êm (giày)…",
    description_en: "One visual metaphor for the product value: time (watch), freshness (drink), softness (shoes)…",
    presence: ["product_only", "hands_only"],
    lighting: "motivated by the metaphor (sun moving, day to night, morning glow) and always flattering the product",
    set: "a symbolic, uncluttered set built around ONE metaphor that relates to the product",
    lens: "35mm–85mm, f/2.8–f/5.6",
    camera_moves: ["slow push-in", "slow time-lapse hold", "slow crane", "slow orbit"],
    product_motion: "the product stays the anchor while the metaphor changes around it (light, shadow, season, time)",
    pacing: "poetic and calm, one idea per beat",
    beats: [
      { role: "hook", camera: "WIDE, slow push-in", action: "the metaphor is introduced (moving shadow, sunrise, falling petal) with the product small in frame" },
      { role: "reveal", camera: "MEDIUM, slow crane down", action: "the product becomes the centre of the metaphor" },
      { role: "detail", camera: "CLOSE-UP, time-lapse hold", action: "the metaphor transforms around a product detail (light passes, shadow sweeps)" },
      { role: "proof", camera: "CLOSE-UP, slow orbit", action: "the product visibly delivers the value the metaphor promised" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "metaphor resolves, product hero, CTA space" },
    ],
    keyframe_rule: "keyframe shows the product sharp and recognisable inside the metaphor set",
    sound: "atmospheric score that follows the metaphor, a few precise product sounds",
    negative: ["metaphor overpowering the product", "multiple unrelated metaphors", "abstract scene with no product"],
  },
  {
    value: "tabletop_flatlay",
    label_vi: "Bàn sắp đặt / flat lay",
    label_en: "Tabletop / flat lay",
    description_vi: "Sản phẩm trên mặt bàn gỗ, da, đá cùng phụ kiện hợp tông; quay từ trên xuống, trượt nhẹ.",
    description_en: "The product on wood, leather or stone with matching accessories; top-down and gentle slides.",
    presence: ["product_only", "hands_only"],
    lighting: "soft window-like daylight from one side, gentle shadows, natural colour",
    set: "styled tabletop (wood, leather, marble, linen) with 2–4 complementary props that never compete with the product",
    lens: "35mm–50mm top-down, 85mm for details, f/4–f/8",
    camera_moves: ["slow top-down slide", "slow top-down push-in", "slow tilt from table level", "locked-off hold"],
    product_motion: "still product; props may shift slightly, light may drift",
    pacing: "relaxed, 4–6 s per move",
    beats: [
      { role: "hook", camera: "TOP-DOWN WIDE, slow slide", action: "the styled table is revealed with the product as the focal point" },
      { role: "reveal", camera: "TOP-DOWN MEDIUM, slow push-in", action: "the product fills the frame among its props" },
      { role: "detail", camera: "CLOSE-UP from table level, slow tilt", action: "the camera tilts to show a material / design detail" },
      { role: "proof", camera: "CLOSE-UP, locked-off", action: "a feature or usage cue is shown (open, unfold, light on, texture)" },
      { role: "hero", camera: "TOP-DOWN MEDIUM hero frame, hold", action: "balanced final composition, CTA space" },
    ],
    keyframe_rule: "keyframe is a balanced top-down composition with the product as the clear focal point",
    sound: "soft acoustic music, light ambient room tone, gentle product foley",
    negative: ["too many props", "props hiding the product", "harsh direct flash"],
  },
  {
    value: "color_pop_studio",
    label_vi: "Studio màu nổi (kiểu TikTok Shop)",
    label_en: "Colour-pop studio",
    description_vi: "Nền màu rực, khối hình học, nhịp nhanh, sản phẩm nảy vào khung — bắt mắt cho video bán hàng ngắn.",
    description_en: "Bold coloured set, geometric blocks, quick rhythm, the product pops into frame — scroll-stopping for shop videos.",
    presence: ["product_only", "hands_only"],
    lighting: "bright high-key light with hard graphic shadows and saturated colour",
    set: "bold single-colour or two-tone seamless, geometric podiums and shapes matching the product palette",
    lens: "35mm–50mm, f/5.6–f/8",
    camera_moves: ["quick push-in", "quick slide", "snap zoom", "locked-off hold", "quick top-down"],
    product_motion: "product pops, bounces or slides into place on the beat; colour props move rhythmically",
    pacing: "quick — 1–3 s per beat, every move ends on the beat",
    beats: [
      { role: "hook", camera: "MEDIUM, quick push-in", action: "the product pops into frame on a bright colour block" },
      { role: "reveal", camera: "MEDIUM CLOSE, quick slide", action: "the camera slides to its hero side" },
      { role: "detail", camera: "snap zoom to CLOSE-UP", action: "punch-in on the key feature" },
      { role: "proof", camera: "quick top-down", action: "the feature or result is shown clearly in one beat" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "product centred on its podium with space for price / CTA" },
    ],
    keyframe_rule: "keyframe is a bright, clean product shot on its colour podium",
    sound: "upbeat trendy beat, pop / swoosh effects on each move",
    negative: ["dull muted colours", "dark moody light", "cluttered set"],
  },
  {
    value: "lifestyle_still",
    label_vi: "Không gian sống (không người)",
    label_en: "Lifestyle setting (no people)",
    description_vi: "Sản phẩm trong bối cảnh thật — bàn làm việc, căn bếp buổi sáng, phòng khách — như vừa có người dùng.",
    description_en: "The product in its real setting — desk, morning kitchen, living room — as if someone just used it.",
    presence: ["product_only", "hands_only"],
    lighting: "natural motivated light (morning sun, window light, warm lamp) with real atmosphere",
    set: "a believable real room where the product is used, tidy, premium, uncluttered",
    lens: "35mm for space, 85mm for product, f/2.8–f/4",
    camera_moves: ["slow dolly in", "slow slide past foreground objects", "slow rack focus from foreground", "locked-off hold"],
    product_motion: "still product, environment alive (steam, curtains, light moving)",
    pacing: "calm, 4–6 s per move",
    beats: [
      { role: "hook", camera: "WIDE, slow dolly in", action: "the room is established with the product placed naturally" },
      { role: "reveal", camera: "MEDIUM, slow slide past a foreground object", action: "the product comes into clear view" },
      { role: "detail", camera: "CLOSE-UP, slow rack focus", action: "focus moves from the environment to a product detail" },
      { role: "proof", camera: "CLOSE-UP, locked-off", action: "the product is shown in use by itself (light on, steam, display, motion)" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "product in its setting, CTA space" },
    ],
    keyframe_rule: "keyframe shows the product clearly in its believable setting with natural light",
    sound: "room ambience matching the setting, light warm music, product foley",
    negative: ["people", "messy room", "product too small to read"],
  },
  {
    value: "stop_motion",
    label_vi: "Stop-motion vui nhộn",
    label_en: "Playful stop-motion",
    description_vi: "Sản phẩm và phụ kiện tự di chuyển từng nấc, tự xếp, tự mở — vui, hợp đồ nhỏ, bánh kẹo, đồ chơi.",
    description_en: "The product and props move frame by frame, assemble and open themselves — playful, great for small items.",
    presence: ["product_only"],
    lighting: "even bright studio light, consistent between frames",
    set: "flat colourful top-down board or tabletop",
    lens: "35mm–50mm top-down or front, f/8",
    camera_moves: ["locked-off top-down", "locked-off front", "stepwise push-in"],
    product_motion: "objects jump between positions in stop-motion steps (8–12 fps feel), assembling into a pattern or opening",
    pacing: "rhythmic steps synced to music",
    beats: [
      { role: "hook", camera: "TOP-DOWN, locked-off", action: "the product hops into the empty board" },
      { role: "reveal", camera: "TOP-DOWN, locked-off", action: "props and variants arrange themselves around it" },
      { role: "detail", camera: "FRONT CLOSE-UP, stepwise push-in", action: "the product opens / unfolds step by step" },
      { role: "proof", camera: "TOP-DOWN, locked-off", action: "contents or features form a clear pattern" },
      { role: "hero", camera: "FRONT MEDIUM, locked-off", action: "everything snaps into a tidy hero layout with CTA space" },
    ],
    keyframe_rule: "keyframe is the clean top-down board with the product sharp in its first position",
    sound: "playful staccato music with tick / pop on each step",
    negative: ["smooth continuous motion", "product shape changing between frames"],
  },
  {
    value: "unboxing_reveal",
    label_vi: "Mở hộp lộ diện",
    label_en: "Unboxing reveal",
    description_vi: "Hộp tự mở (hoặc tay mở), lớp giấy lụa tách ra, sản phẩm lộ diện như món quà.",
    description_en: "The box opens (by itself or by hands), tissue parts and the product is revealed like a gift.",
    presence: ["product_only", "hands_only"],
    lighting: "soft premium light with a warm glow coming from inside the box",
    set: "clean tabletop with the branded box, tissue paper and inserts",
    lens: "50mm and 100mm macro, f/4",
    camera_moves: ["slow push-in", "slow top-down", "slow tilt into the box", "locked-off hold"],
    product_motion: "lid lifts, tissue unfolds, the product rises or is lifted out",
    pacing: "anticipation then reveal, 3–5 s per beat",
    beats: [
      { role: "hook", camera: "CLOSE-UP, slow push-in on the closed box", action: "the box lid begins to lift, light leaking out" },
      { role: "reveal", camera: "TOP-DOWN, slow push-in", action: "tissue parts to reveal the product nestled inside" },
      { role: "detail", camera: "MACRO, slow tilt", action: "packaging and product details are shown" },
      { role: "proof", camera: "CLOSE-UP, slow arc", action: "the product is lifted / rises out and shown working or worn" },
      { role: "hero", camera: "MEDIUM hero frame, hold", action: "product beside its open box, CTA space" },
    ],
    keyframe_rule: "keyframe shows the box opening with the product partially visible and recognisable",
    sound: "paper rustle, soft lid slide, gentle reveal chime, warm music",
    negative: ["generic box replacing the real packaging", "torn messy packaging"],
  },
  {
    value: "hand_demo",
    label_vi: "Tay thao tác chứng minh",
    label_en: "Hands-on demo",
    description_vi: "Bàn tay sạch đẹp thao tác đúng cách dùng: đeo, bấm, vặn, thoa, mở — thấy rõ kết quả, không lộ mặt.",
    description_en: "Clean hands use the product the real way — wear, press, twist, apply, open — the result is visible, never a face.",
    presence: ["hands_only"],
    lighting: "soft clean key, flattering skin and product, controlled reflections",
    set: "simple surface or the product's real usage spot, cropped tightly so only hands and product are in frame",
    lens: "50mm–100mm macro, f/2.8–f/5.6",
    camera_moves: ["slow push-in", "locked-off hold", "slow follow of the hand", "slow arc"],
    product_motion: "the hands perform the real operation with precise, unhurried movements",
    pacing: "real human speed, one operation per beat",
    beats: [
      { role: "hook", camera: "CLOSE-UP, locked-off", action: "a hand reaches into frame toward the product" },
      { role: "reveal", camera: "CLOSE-UP, slow follow of the hand", action: "the hand picks up / puts on the product, showing its scale" },
      { role: "detail", camera: "MACRO, slow push-in", action: "fingers operate the key control or detail" },
      { role: "proof", camera: "CLOSE-UP, locked-off", action: "the visible result of the operation" },
      { role: "hero", camera: "MEDIUM CLOSE, slow arc then hold", action: "the product held / worn in its best angle, CTA space" },
    ],
    keyframe_rule: "keyframe shows only hands and the product, cropped above the wrist/forearm, no face",
    sound: "clean tactile foley of the operation, light music",
    negative: [...NO_FACE, "awkward finger anatomy", "extra fingers"],
  },
];

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  {
    value: "watch", label_vi: "Đồng hồ", label_en: "Watch",
    description_vi: "Đồng hồ cơ, quartz, đồng hồ thông minh.", description_en: "Mechanical, quartz and smart watches.",
    keywords: ["đồng hồ", "dong ho", "watch", "smartwatch", "chronograph", "automatic", "rolex", "casio", "seiko", "citizen", "orient", "tissot", "omega", "garmin", "apple watch"],
    materials: "polished and brushed steel, sapphire crystal, leather or metal strap, luminous indices",
    hero_details: ["bezel edge catching light", "dial texture (sunburst / guilloché)", "crown knurling", "second hand sweeping", "luminous hands glowing", "clasp and strap links", "caseback engraving"],
    proof_moments: ["water beading on the crystal (water resistance)", "lume glowing as the light fades", "second hand sweep in macro (precision)", "balance wheel oscillating (mechanical movement)"],
    foley: "precise ticking, crown winding clicks, clasp snap, metal links",
    geometry_lock: "hands set at 10:10, dial text, logo, indices and case proportions copied exactly from the product reference; never invent extra complications",
    hand_action: "a wrist turns to catch the light, fingers fasten the clasp or wind the crown",
    problem_hint: "being late or looking under-dressed at an important meeting because of a cheap or broken watch",
    recommended_styles: ["dark_reveal", "light_sweep", "macro_detail", "inner_mechanism", "concept_metaphor", "elements_texture", "turntable_360", "hand_demo"],
  },
  {
    value: "jewelry_eyewear", label_vi: "Trang sức / kính mắt", label_en: "Jewellery / eyewear",
    description_vi: "Nhẫn, dây chuyền, bông tai, vòng, kính mắt.", description_en: "Rings, necklaces, earrings, bracelets, glasses.",
    keywords: ["nhẫn", "dây chuyền", "bông tai", "vòng tay", "lắc", "trang sức", "kim cương", "vàng", "bạc", "ring", "necklace", "earring", "bracelet", "jewelry", "jewellery", "diamond", "kính mắt", "kính râm", "glasses", "sunglasses", "eyewear"],
    materials: "precious metal, gemstones with facets, acetate or metal frames, lenses",
    hero_details: ["gem facets sparkling", "metal polish and setting prongs", "clasp mechanism", "engraving", "frame hinge and temple tip", "lens reflections"],
    proof_moments: ["sparkle as light moves across the facets", "chain flowing smoothly", "lens clarity / UV tint seen against light"],
    foley: "delicate chime, chain slither, hinge click",
    geometry_lock: "exact stone count, cut and setting, metal colour and frame shape from the reference",
    hand_action: "fingers place the ring, fasten a necklace or unfold the glasses",
    problem_hint: "an outfit that feels incomplete for a special occasion",
    recommended_styles: ["dark_reveal", "light_sweep", "macro_detail", "elements_texture", "turntable_360", "tabletop_flatlay", "unboxing_reveal"],
  },
  {
    value: "fragrance", label_vi: "Nước hoa", label_en: "Fragrance",
    description_vi: "Nước hoa, tinh dầu, xịt thơm.", description_en: "Perfume, essential oils, body mist.",
    keywords: ["nước hoa", "nuoc hoa", "perfume", "parfum", "eau de", "cologne", "tinh dầu", "xịt thơm", "body mist", "fragrance"],
    materials: "heavy glass bottle, metal cap, liquid with colour, label",
    hero_details: ["bottle facets refracting light", "liquid colour glowing", "cap weight and finish", "atomiser mist"],
    proof_moments: ["fine mist spray in backlight", "notes visualised as ingredients (flowers, wood, citrus) around the bottle"],
    foley: "glass clink, cap click, soft spray hiss",
    geometry_lock: "exact bottle silhouette, cap, label text and liquid colour from the reference",
    hand_action: "fingers lift the cap and press the atomiser toward the wrist",
    problem_hint: "wanting to leave a memorable impression on a date or at work",
    recommended_styles: ["dark_reveal", "light_sweep", "elements_texture", "levitation_exploded", "concept_metaphor", "macro_detail"],
  },
  {
    value: "skincare", label_vi: "Chăm sóc da", label_en: "Skincare",
    description_vi: "Serum, kem dưỡng, sữa rửa mặt, kem chống nắng, mặt nạ.", description_en: "Serums, creams, cleansers, sunscreen, masks.",
    keywords: ["serum", "kem dưỡng", "kem chống nắng", "sữa rửa mặt", "toner", "mặt nạ", "skincare", "moisturizer", "cleanser", "sunscreen", "spf", "dưỡng da", "dưỡng ẩm", "dưỡng trắng", "sáng da", "trắng da", "da mặt", "mụn", "tẩy trang", "essence", "lotion", "kem mắt", "retinol", "niacinamide"],
    materials: "glass dropper bottles, pumps, jars, tubes; gels, creams and fluids",
    hero_details: ["dropper with a golden drop", "cream peak and glossy swirl", "packaging finish and label", "pump nozzle"],
    proof_moments: ["texture swatch spreading and absorbing", "water droplets showing hydration", "ingredients (leaf, fruit, water) around the product"],
    foley: "pump click, glass dropper tap, cream squish, water drops",
    geometry_lock: "exact container shape, label text and product colour/texture from the reference",
    hand_action: "fingertips take a drop or swatch and spread it on the back of the hand",
    problem_hint: "dull, dry or oily skin before an important day",
    recommended_styles: ["pour_texture", "elements_texture", "levitation_exploded", "light_sweep", "macro_detail", "color_pop_studio", "hand_demo"],
  },
  {
    value: "makeup", label_vi: "Trang điểm", label_en: "Makeup",
    description_vi: "Son, phấn, mascara, cushion, bảng mắt.", description_en: "Lipstick, powder, mascara, cushion, palettes.",
    keywords: ["son", "lipstick", "phấn", "cushion", "mascara", "kẻ mắt", "eyeliner", "phấn mắt", "eyeshadow", "palette", "makeup", "trang điểm", "má hồng", "blush", "kem nền", "foundation"],
    materials: "lipstick bullets, pressed powders, compacts, brushes",
    hero_details: ["lipstick bullet twisting up", "pressed powder pattern", "compact mirror", "colour swatches"],
    proof_moments: ["swatch showing pigment", "powder crumbling into a soft cloud", "cushion puff pressing"],
    foley: "compact snap, cap click, powder puff",
    geometry_lock: "exact shade, case design and embossing from the reference",
    hand_action: "fingers twist up the lipstick and swatch it on the back of the hand",
    problem_hint: "makeup that fades or looks cakey by midday",
    recommended_styles: ["pour_texture", "color_pop_studio", "macro_detail", "levitation_exploded", "light_sweep", "hand_demo"],
  },
  {
    value: "personal_care", label_vi: "Chăm sóc cá nhân", label_en: "Personal care",
    description_vi: "Bàn chải điện, máy cạo râu, máy sấy, dầu gội, sữa tắm.", description_en: "Electric toothbrushes, shavers, dryers, shampoo, body wash.",
    keywords: ["bàn chải", "toothbrush", "máy cạo", "shaver", "razor", "máy sấy tóc", "hair dryer", "dầu gội", "shampoo", "sữa tắm", "body wash", "máy tăm nước", "kem đánh răng"],
    materials: "glossy plastics, metal blades, bottles with liquids",
    hero_details: ["bristles / blades in macro", "buttons and indicator lights", "ergonomic grip", "foam texture"],
    proof_moments: ["foam bubbles forming", "water splash on a waterproof device", "blade / bristle motion in slow motion"],
    foley: "motor buzz, water splash, foam, click",
    geometry_lock: "exact device shape, colours, buttons and label from the reference",
    hand_action: "a hand switches the device on or pumps the bottle into the palm",
    problem_hint: "rushed mornings with a routine that does not feel clean or effective",
    recommended_styles: ["light_sweep", "elements_texture", "inner_mechanism", "pour_texture", "turntable_360", "hand_demo"],
  },
  {
    value: "fashion_apparel", label_vi: "Quần áo thời trang", label_en: "Fashion apparel",
    description_vi: "Áo, quần, váy, áo khoác.", description_en: "Shirts, trousers, dresses, jackets.",
    keywords: ["áo", "quần", "váy", "đầm", "áo khoác", "hoodie", "sơ mi", "thun", "jean", "shirt", "t-shirt", "dress", "jacket", "pants", "trousers", "skirt", "thời trang"],
    materials: "woven and knitted fabrics, buttons, zips, stitching",
    hero_details: ["fabric weave in macro", "stitching and seams", "buttons / zip pulls", "label and print"],
    proof_moments: ["fabric stretching and recovering", "water beading on a water-repellent fabric", "garment flowing in a gentle breeze"],
    foley: "fabric rustle, zip, button snap",
    geometry_lock: "exact cut, colour, print and logo placement from the reference",
    hand_action: "hands fold, stretch or button the garment",
    problem_hint: "having nothing comfortable yet smart to wear for the day",
    recommended_styles: ["tabletop_flatlay", "macro_detail", "elements_texture", "stop_motion", "color_pop_studio", "lifestyle_still", "hand_demo"],
  },
  {
    value: "footwear", label_vi: "Giày dép", label_en: "Footwear",
    description_vi: "Giày thể thao, giày da, sandal, dép.", description_en: "Sneakers, leather shoes, sandals, slides.",
    keywords: ["giày", "dép", "sandal", "sneaker", "shoe", "shoes", "boot", "bốt", "giày thể thao", "giày da", "slipper"],
    materials: "mesh, leather, rubber soles, foam midsoles, laces",
    hero_details: ["sole tread pattern", "midsole cushioning", "stitching and leather grain", "laces and eyelets", "logo panel"],
    proof_moments: ["sole flexing and bouncing back", "water / mud splash test", "exploded layers of the sole showing cushioning"],
    foley: "sole squeak, lace pull, soft bounce thud",
    geometry_lock: "exact silhouette, colourway, sole pattern and logo from the reference",
    hand_action: "hands lace up or flex the shoe",
    problem_hint: "sore feet after a long day of walking",
    recommended_styles: ["turntable_360", "motion_control", "levitation_exploded", "elements_texture", "dark_reveal", "macro_detail"],
  },
  {
    value: "bags_leather", label_vi: "Túi, ví, đồ da", label_en: "Bags & leather goods",
    description_vi: "Túi xách, balo, ví, thắt lưng.", description_en: "Handbags, backpacks, wallets, belts.",
    keywords: ["túi", "ví", "balo", "ba lô", "thắt lưng", "bag", "handbag", "wallet", "backpack", "belt", "đồ da", "leather"],
    materials: "leather grain, canvas, metal hardware, zips",
    hero_details: ["leather grain and edge paint", "stitching", "metal hardware and logo plate", "interior compartments"],
    proof_moments: ["compartments opening to show organisation", "water beading on the material", "strap strength"],
    foley: "leather creak, zip, magnetic clasp snap",
    geometry_lock: "exact shape, colour, hardware and logo from the reference",
    hand_action: "hands open the clasp and show the compartments",
    problem_hint: "a messy bag where nothing can be found quickly",
    recommended_styles: ["light_sweep", "macro_detail", "turntable_360", "tabletop_flatlay", "dark_reveal", "unboxing_reveal"],
  },
  {
    value: "phone_gadget", label_vi: "Điện thoại / thiết bị số", label_en: "Phone & gadgets",
    description_vi: "Điện thoại, máy tính bảng, sạc, pin dự phòng, camera.", description_en: "Phones, tablets, chargers, power banks, cameras.",
    keywords: ["điện thoại", "phone", "iphone", "samsung", "máy tính bảng", "tablet", "ipad", "sạc", "charger", "pin dự phòng", "power bank", "camera", "gadget", "ốp lưng"],
    materials: "glass and aluminium, screens, ports, LEDs",
    hero_details: ["edge chamfer catching light", "camera module", "ports and buttons", "screen glow", "LED indicators"],
    proof_moments: ["screen lighting up", "fast-charge indicator filling", "water splash on a waterproof device", "exploded internal layers"],
    foley: "digital chime, click, magnetic snap, soft whoosh",
    geometry_lock: "exact device shape, camera layout, ports and logo from the reference; screens show generic UI only",
    hand_action: "a hand picks up the device and taps the screen",
    problem_hint: "a phone that dies or lags at the worst moment",
    recommended_styles: ["light_sweep", "dark_reveal", "levitation_exploded", "motion_control", "inner_mechanism", "turntable_360", "hand_demo"],
  },
  {
    value: "audio", label_vi: "Tai nghe / loa", label_en: "Headphones & speakers",
    description_vi: "Tai nghe, loa bluetooth, micro.", description_en: "Headphones, earbuds, speakers, microphones.",
    keywords: ["tai nghe", "headphone", "earbud", "airpods", "loa", "speaker", "bluetooth", "micro", "microphone", "soundbar"],
    materials: "matte plastics, metal grilles, cushions, charging cases",
    hero_details: ["speaker grille texture", "ear cushion softness", "charging case hinge", "LED ring"],
    proof_moments: ["sound waves visualised as ripples on water or fabric", "bass vibrating sand / droplets", "case opening and earbuds rising"],
    foley: "case snap, deep bass pulse, click",
    geometry_lock: "exact shape, colour, grille pattern and logo from the reference",
    hand_action: "a hand opens the case and lifts the earbuds",
    problem_hint: "noisy commute that drowns out music and calls",
    recommended_styles: ["dark_reveal", "elements_texture", "levitation_exploded", "light_sweep", "motion_control", "unboxing_reveal"],
  },
  {
    value: "computer_accessory", label_vi: "Máy tính / phụ kiện", label_en: "Computer & accessories",
    description_vi: "Laptop, bàn phím, chuột, màn hình, ổ cứng.", description_en: "Laptops, keyboards, mice, monitors, drives.",
    keywords: ["laptop", "máy tính", "bàn phím", "keyboard", "chuột", "mouse", "màn hình", "monitor", "ổ cứng", "ssd", "usb", "webcam"],
    materials: "aluminium, keycaps, RGB lighting, matte plastics",
    hero_details: ["keycap legends and switches", "RGB lighting wave", "aluminium edges", "ports"],
    proof_moments: ["key press in macro", "RGB wave sweeping", "laptop lid opening in one smooth motion"],
    foley: "mechanical key clicks, lid hinge, soft electronic hum",
    geometry_lock: "exact device shape, layout and logo from the reference",
    hand_action: "fingers type on the keys or glide the mouse",
    problem_hint: "a slow, uncomfortable work setup",
    recommended_styles: ["light_sweep", "dark_reveal", "macro_detail", "lifestyle_still", "motion_control", "hand_demo"],
  },
  {
    value: "home_appliance", label_vi: "Đồ gia dụng điện", label_en: "Home appliances",
    description_vi: "Nồi chiên, máy xay, máy hút bụi, quạt, máy lọc không khí.", description_en: "Air fryers, blenders, vacuums, fans, purifiers.",
    keywords: ["nồi chiên", "air fryer", "máy xay", "blender", "máy hút bụi", "vacuum", "quạt", "fan", "máy lọc", "purifier", "nồi cơm", "rice cooker", "lò vi sóng", "microwave", "máy pha cà phê", "coffee machine", "bàn là", "iron", "gia dụng"],
    materials: "brushed metal, glossy plastics, glass jars, control panels",
    hero_details: ["control panel and display", "blades / basket / filter", "handle and finish", "indicator lights"],
    proof_moments: ["food crisping or blending in real time", "dust being lifted cleanly", "steam / airflow visualised", "before/after result on the counter"],
    foley: "motor whirr, button beep, sizzle, airflow",
    geometry_lock: "exact appliance shape, controls, colour and logo from the reference",
    hand_action: "a hand presses the control and pulls out the finished result",
    problem_hint: "cooking or cleaning that takes too long after work",
    recommended_styles: ["lifestyle_still", "inner_mechanism", "light_sweep", "pour_texture", "turntable_360", "hand_demo"],
  },
  {
    value: "kitchenware", label_vi: "Dụng cụ bếp", label_en: "Kitchenware",
    description_vi: "Dao, chảo, nồi, bình giữ nhiệt, hộp đựng.", description_en: "Knives, pans, pots, tumblers, containers.",
    keywords: ["dao", "knife", "chảo", "pan", "nồi", "pot", "bình giữ nhiệt", "tumbler", "hộp đựng", "container", "thớt", "cutting board", "ly", "cốc", "cup"],
    materials: "stainless steel, non-stick coatings, ceramics, glass",
    hero_details: ["blade edge", "coating texture", "handle ergonomics", "lid seal"],
    proof_moments: ["egg sliding off a non-stick pan", "blade slicing paper-thin", "ice still intact hours later", "sealed lid tipped upside down without leaking"],
    foley: "sizzle, knife slice, lid click, ice clink",
    geometry_lock: "exact shape, finish, colour and logo from the reference",
    hand_action: "a hand slices, flips or pours with the tool",
    problem_hint: "food sticking, dull knives or drinks that go warm",
    recommended_styles: ["pour_texture", "light_sweep", "elements_texture", "lifestyle_still", "macro_detail", "hand_demo"],
  },
  {
    value: "food", label_vi: "Đồ ăn / bánh kẹo", label_en: "Food & snacks",
    description_vi: "Đồ ăn vặt, bánh, kẹo, gia vị, đồ ăn liền.", description_en: "Snacks, cakes, candy, sauces, instant food.",
    keywords: ["bánh", "kẹo", "snack", "đồ ăn", "food", "mì", "noodle", "gia vị", "sauce", "sốt", "socola", "chocolate", "hạt", "nuts", "khô gà", "ăn vặt", "chips"],
    materials: "crisp, glossy, saucy, crumbly textures; packaging",
    hero_details: ["crunchy texture breaking", "sauce glossy drizzle", "steam rising", "packaging front"],
    proof_moments: ["crunch break in slow motion", "cheese pull / chocolate melt", "ingredients falling and landing on the product"],
    foley: "crunch, sizzle, pour, wrapper crinkle",
    geometry_lock: "exact packaging design, logo and product appearance from the reference",
    hand_action: "fingers break or pick up a piece and dip it",
    problem_hint: "a hungry afternoon with nothing tasty and quick to eat",
    recommended_styles: ["motion_control", "pour_texture", "levitation_exploded", "stop_motion", "color_pop_studio", "tabletop_flatlay"],
  },
  {
    value: "beverage", label_vi: "Đồ uống", label_en: "Beverages",
    description_vi: "Cà phê, trà, nước ngọt, bia, nước ép, sữa.", description_en: "Coffee, tea, soft drinks, beer, juice, milk.",
    keywords: ["cà phê", "coffee", "trà", "tea", "nước ngọt", "soda", "bia", "beer", "nước ép", "juice", "sữa", "milk", "đồ uống", "drink", "rượu", "wine", "nước suối", "energy drink"],
    materials: "cans, bottles, glasses, liquid, ice, condensation",
    hero_details: ["condensation droplets on the can/bottle", "liquid colour against backlight", "foam / bubbles", "label"],
    proof_moments: ["slow-motion pour with bubbles", "ice cubes splashing", "cap pop / can crack with mist"],
    foley: "can crack, fizz, ice clink, pour",
    geometry_lock: "exact can/bottle shape, label and liquid colour from the reference",
    hand_action: "a hand cracks the can or pours into a glass",
    problem_hint: "a hot, tiring afternoon that needs a refreshing pick-me-up",
    recommended_styles: ["pour_texture", "elements_texture", "motion_control", "dark_reveal", "color_pop_studio", "concept_metaphor"],
  },
  {
    value: "supplement", label_vi: "Thực phẩm chức năng", label_en: "Supplements",
    description_vi: "Vitamin, collagen, whey, viên uống.", description_en: "Vitamins, collagen, protein, capsules.",
    keywords: ["vitamin", "collagen", "whey", "protein", "viên uống", "thực phẩm chức năng", "supplement", "omega", "men vi sinh", "probiotic"],
    materials: "bottles or jars, capsules, powders, sachets",
    hero_details: ["capsule translucency", "powder swirl", "label and seal"],
    proof_moments: ["natural ingredients around the bottle (only label-approved ones)", "powder dissolving cleanly in water"],
    foley: "capsule rattle, cap twist, powder pour, stir",
    geometry_lock: "exact bottle, label and capsule colour from the reference; no health claims beyond the approved copy",
    hand_action: "a hand shakes out a capsule or scoops powder into a shaker",
    problem_hint: "feeling tired and low on energy during the week",
    recommended_styles: ["levitation_exploded", "pour_texture", "light_sweep", "elements_texture", "turntable_360"],
  },
  {
    value: "home_decor", label_vi: "Trang trí / nội thất", label_en: "Home decor & furniture",
    description_vi: "Đèn, nến, gối, kệ, ghế, đồ trang trí.", description_en: "Lamps, candles, cushions, shelves, chairs, decor.",
    keywords: ["đèn", "lamp", "nến", "candle", "gối", "cushion", "kệ", "shelf", "ghế", "chair", "bàn", "table", "decor", "trang trí", "nội thất", "furniture", "thảm", "rug"],
    materials: "wood, fabric, ceramic, glass, metal",
    hero_details: ["material grain", "light glow / flame", "joinery and finish", "fabric texture"],
    proof_moments: ["room transforming as the lamp turns on", "candle flame and scent haze", "comfort shown by a cushion slowly compressing"],
    foley: "switch click, crackle of a wick, soft room tone",
    geometry_lock: "exact shape, colour and material from the reference",
    hand_action: "a hand switches on the lamp or lights the candle",
    problem_hint: "a room that feels cold and uninviting",
    recommended_styles: ["lifestyle_still", "concept_metaphor", "tabletop_flatlay", "dark_reveal", "macro_detail"],
  },
  {
    value: "baby_toys", label_vi: "Mẹ bé / đồ chơi", label_en: "Baby & toys",
    description_vi: "Bình sữa, tã, đồ chơi, đồ dùng trẻ em.", description_en: "Bottles, diapers, toys, kids' items.",
    keywords: ["bình sữa", "tã", "bỉm", "diaper", "đồ chơi", "toy", "lego", "búp bê", "doll", "xe đẩy", "stroller", "trẻ em", "kids", "baby", "em bé"],
    materials: "soft-touch plastics, fabrics, bright colours",
    hero_details: ["soft rounded edges", "safety locks", "bright colours and parts"],
    proof_moments: ["toy assembling itself", "absorbency test with blue liquid", "drop test without damage"],
    foley: "playful pops, soft squeaks, click",
    geometry_lock: "exact toy/product design and colours from the reference",
    hand_action: "small hands or a parent's hands play with or prepare the item",
    problem_hint: "a fussy child and a tired parent",
    recommended_styles: ["stop_motion", "color_pop_studio", "levitation_exploded", "tabletop_flatlay", "lifestyle_still"],
  },
  {
    value: "sports_outdoor", label_vi: "Thể thao / dã ngoại", label_en: "Sports & outdoor",
    description_vi: "Dụng cụ tập, bình nước, balo, đồ cắm trại.", description_en: "Fitness gear, bottles, backpacks, camping gear.",
    keywords: ["thể thao", "sport", "gym", "tập", "tạ", "dumbbell", "thảm yoga", "yoga", "bình nước", "bottle", "cắm trại", "camping", "lều", "tent", "xe đạp", "bike", "vợt", "racket"],
    materials: "rubber, technical fabrics, aluminium, carbon",
    hero_details: ["grip texture", "technical fabric", "buckles and straps", "logo"],
    proof_moments: ["product surviving dust/water/drop", "flex and rebound in slow motion"],
    foley: "rubber thud, strap snap, outdoor ambience",
    geometry_lock: "exact shape, colours and logo from the reference",
    hand_action: "hands grip, tighten or lift the gear",
    problem_hint: "gear that breaks or is uncomfortable mid-workout",
    recommended_styles: ["motion_control", "elements_texture", "turntable_360", "lifestyle_still", "dark_reveal"],
  },
  {
    value: "auto_tools", label_vi: "Phụ kiện xe / dụng cụ", label_en: "Car accessories & tools",
    description_vi: "Phụ kiện ô tô, xe máy, dụng cụ sửa chữa.", description_en: "Car and motorbike accessories, tools.",
    keywords: ["ô tô", "xe hơi", "car", "xe máy", "motorbike", "phụ kiện xe", "dụng cụ", "tool", "máy khoan", "drill", "cờ lê", "wrench", "camera hành trình", "dash cam"],
    materials: "metal, rubber, tough plastics, LEDs",
    hero_details: ["machined metal edges", "grip texture", "LED lights", "mechanism"],
    proof_moments: ["tool working under load", "device mounting securely", "lights cutting through darkness"],
    foley: "ratchet clicks, motor whine, metallic clank",
    geometry_lock: "exact shape, colour and logo from the reference",
    hand_action: "a gloved or bare hand operates the tool",
    problem_hint: "a breakdown or repair that wastes a whole afternoon",
    recommended_styles: ["dark_reveal", "inner_mechanism", "motion_control", "light_sweep", "hand_demo"],
  },
  {
    value: "pet", label_vi: "Đồ thú cưng", label_en: "Pet supplies",
    description_vi: "Thức ăn, đồ chơi, phụ kiện cho thú cưng.", description_en: "Pet food, toys and accessories.",
    keywords: ["thú cưng", "pet", "chó", "dog", "mèo", "cat", "hạt cho", "pet food", "cát vệ sinh", "litter", "vòng cổ", "collar"],
    materials: "kibble, packaging, rubber toys, fabrics",
    hero_details: ["kibble texture", "packaging front", "toy material"],
    proof_moments: ["kibble pouring into a bowl", "toy bouncing back"],
    foley: "kibble pour, squeak, bowl clink",
    geometry_lock: "exact packaging and product from the reference",
    hand_action: "a hand pours food into the bowl",
    problem_hint: "a picky pet that will not eat",
    recommended_styles: ["pour_texture", "color_pop_studio", "lifestyle_still", "stop_motion", "tabletop_flatlay"],
  },
  {
    value: "general", label_vi: "Sản phẩm khác", label_en: "Other product",
    description_vi: "Không thuộc nhóm trên — dùng gợi ý chung.", description_en: "Not in the groups above — generic guidance.",
    keywords: [],
    materials: "the real materials of the product as shown in the reference",
    hero_details: ["the product's main face", "its most distinctive detail", "its control / opening / logo"],
    proof_moments: ["the product doing its main job with a visible result"],
    foley: "the product's real operation sounds",
    geometry_lock: "exact shape, colours, text and logo from the reference",
    hand_action: "a hand uses the product the way it is meant to be used",
    problem_hint: "the everyday problem the product is made to solve",
    recommended_styles: ["light_sweep", "turntable_360", "macro_detail", "dark_reveal", "lifestyle_still", "hand_demo"],
  },
];

export const STYLE_BY_ID: Record<ProductShotStyleId, ProductShotStyle> = Object.fromEntries(
  PRODUCT_SHOT_STYLES.map((s) => [s.value, s]),
) as Record<ProductShotStyleId, ProductShotStyle>;
export const CATEGORY_BY_ID: Record<ProductCategoryId, ProductCategory> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.value, c]),
) as Record<ProductCategoryId, ProductCategory>;

export function isPresenceMode(v: unknown): v is PresenceMode {
  return v === "product_only" || v === "hands_only" || v === "with_characters";
}
export function isProductShotStyleId(v: unknown): v is ProductShotStyleId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(STYLE_BY_ID, v);
}
export function isProductCategoryId(v: unknown): v is ProductCategoryId {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(CATEGORY_BY_ID, v);
}

const fold = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Guess the product category from its name / description / topic (Vietnamese or English). */
export function detectProductCategory(...texts: Array<string | undefined | null>): ProductCategoryId {
  const hay = ` ${fold(texts.filter(Boolean).join(" "))} `;
  let best: ProductCategoryId = "general";
  let bestScore = 0;
  for (const c of PRODUCT_CATEGORIES) {
    let score = 0;
    for (const k of c.keywords) {
      const kw = fold(k);
      if (!kw) continue;
      // Word-boundary match so "son" does not hit "person" and "áo" does not hit "bao".
      const re = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(hay)) score += kw.length >= 6 ? 2 : 1;
    }
    if (score > bestScore) { best = c.value; bestScore = score; }
  }
  return best;
}

/** Styles that fit a category and presence mode, best first. */
export function recommendedStyles(category: ProductCategoryId, presence: PresenceMode): ProductShotStyleId[] {
  const cat = CATEGORY_BY_ID[category] || CATEGORY_BY_ID.general;
  const fits = (id: ProductShotStyleId) => STYLE_BY_ID[id].presence.includes(presence === "with_characters" ? "hands_only" : presence);
  const ordered = cat.recommended_styles.filter(fits);
  if (presence === "hands_only") {
    // Hands-only: the hands-on demo is always offered right after the category's signature style.
    const i = ordered.indexOf("hand_demo");
    if (i >= 0) ordered.splice(i, 1);
    ordered.splice(Math.min(1, ordered.length), 0, "hand_demo");
  }
  return ordered.length ? ordered : PRODUCT_SHOT_STYLES.filter((s) => fits(s.value)).map((s) => s.value);
}

/** Style actually used: the user's pick when compatible, else the best fit for the category. */
export function resolveShotStyle(styleId: unknown, category: ProductCategoryId, presence: PresenceMode): ProductShotStyleId {
  if (isProductShotStyleId(styleId)) {
    const s = STYLE_BY_ID[styleId];
    if (presence === "with_characters" || s.presence.includes(presence)) return styleId;
  }
  return recommendedStyles(category, presence)[0] || "light_sweep";
}
