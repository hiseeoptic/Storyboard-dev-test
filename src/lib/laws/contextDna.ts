// ═══════════════════════════════════════════════════════════════════════════
// TẦNG 0 — CONTEXT-LOCKED VIDEO DNA SYSTEM (hiến pháp bối cảnh, đứng trên 9 tầng)
//
// Kiến trúc "Mở trước — Khóa sau" (Open during design. Locked during generation):
//   · Trạng thái 1: Abstract Rule — luật trừu tượng, chưa khóa vào bối cảnh nào.
//   · Trạng thái 2: Context-Locked Rule — luật đã khóa theo bối cảnh video cụ thể.
// Trước khi chốt video, rule phải MỞ (không giả định quốc gia/văn hóa/thời đại/
// phong cách). Sau khi chốt, rule phải KHÓA: mọi thực thể trong mọi cảnh phải
// thuộc về thế giới đã khóa. Mở để sáng tạo. Khóa để nhất quán.
//
// KHÔNG hard-code văn hóa nào ("gia đình Việt Nam hiện đại") — mọi luật viết
// dạng BIẾN ("the locked world context") và được resolve khi người dùng chốt
// brief. Đây là điểm khác nhau giữa "prompt linh hoạt" và "hệ thống sản xuất
// video chuyên nghiệp".
// ═══════════════════════════════════════════════════════════════════════════

import type { WorldContext } from "@/types";

/** Câu thần chú của hệ thống. */
export const CONTEXT_MANTRA =
  "Open during design. Locked during generation. Flexible before context. Strict after context. Creative in concept. Disciplined in execution.";

/** RULE LÕI (xương sống) — bản trung lập thay cho mọi rule hard-code văn hóa. */
export const CORE_CONTEXT_RULE = `The system must never assume a fixed culture, country, time period, environment, visual style, or genre before the world context is locked.
Before context lock, all rules remain abstract and adaptable.
After context lock, every generated scene must obey the locked world context across ontology, time, environment, character, object, motion, action continuity, scene intent, visual language, audio, and validation.
The locked world context controls what kinds of people, architecture, objects, clothing, technology, language, symbols, food, behavior, sound, lighting, camera style, and visual motifs are allowed to appear.
Any element outside the locked context is treated as a continuity or ontology violation unless explicitly defined as intentional contrast, dream, memory, parody, fantasy insertion, product metaphor, or narrative disruption.`;

/** 6 mức hiện thực (Reality Levels) — mỗi video phải khóa đúng MỘT mức. */
export const REALITY_LEVELS = [
  "Level 1 — Documentary Reality: very real, minimal staging, natural light, everyday behavior, slight roughness allowed",
  "Level 2 — Cinematic Reality: real but more beautiful than life — intentional composition, lighting and camera",
  "Level 3 — Commercial Reality: real but clean and polished — product-perfect, controlled light, people slightly better than everyday",
  "Level 4 — Stylized Reality: real-world logic kept, but color, composition and movement carry clear artistic intent",
  "Level 5 — Symbolic / Surreal Reality: may be non-real, but must follow its OWN declared symbolic rules",
  "Level 6 — Fantasy / Sci-fi Internal Reality: unlike our world, but internally consistent within its own declared laws",
] as const;

/**
 * 10 TẦNG DNA (bản tối ưu, không hard-code) — mỗi tầng: định nghĩa trừu tượng
 * + biến cần chốt + rule sau khóa + ví dụ phát hiện vi phạm.
 * Project Intent đứng đầu: trước khi hỏi thế giới là gì, phải hỏi video này
 * sinh ra để làm gì.
 */
export const CONTEXT_DNA_LAYERS: readonly {
  id: string;
  name: string;
  rule: string;
  variables: string;
  violations: string;
}[] = [
  {
    id: "project_intent_dna",
    name: "1 · PROJECT INTENT DNA — video này sinh ra để làm gì",
    rule: "All creative decisions must serve the locked project intent (sell / tell a story / educate / build emotion / build brand / entertain / metaphor / consult / review / build trust / transform a character). A scene that does not serve the intent is dead weight.",
    variables: "purpose, target audience, platform, duration, aspect ratio, output style",
    violations:
      "a sales video where every scene philosophizes but never reaches the product = wrong intent; an emotional video with a crude hard-sell CTA jammed in = wrong intent",
  },
  {
    id: "world_context_dna",
    name: "2 · WORLD CONTEXT DNA — định danh thế giới",
    rule: "The video must consistently follow the selected world type (realistic / cinematic realistic / stylized / fantasy / sci-fi / historical / mythological / surreal / commercial / documentary / animation / hybrid) and its locked reality level. No visual, cultural, technological, architectural, behavioral, or physical element may contradict the locked world type unless explicitly introduced as intentional contrast. Once the world boundary is locked (geography, era, technology, culture, genre, ethics, aesthetics, physics), no element from outside may appear unless justified by the story.",
    variables:
      "world type, reality level (1-6), genre, geography, culture, time period, technology level, social class, style boundary",
    violations:
      "a family drama where a robot serves bubble tea with no story reason = world-type break; documentary reality with a 360° drone orbit inside a kitchen = reality-level break; fantasy so mundane it has no world identity = missing identity",
  },
  {
    id: "ontology_dna",
    name: "3 · ONTOLOGY DNA — những gì được phép tồn tại",
    rule: "Only entities that belong to the locked world context may appear — across all 12 entity groups: humans (type, demographics, era-true grooming), animals/creatures, architecture (period, culture, class, materials), objects (function, design, material, age, tech level, cultural meaning), clothing (era, culture, occupation, class, season, activity, formality, condition), technology (level must never exceed or undercut the world's boundary), language/text (visible signs, labels and scripts match the locked language; avoid readable text unless explicitly specified — use abstract or blurred background signage when accuracy is not required), food/material culture (dishes, tableware, serving style), social behavior (greetings, distance, emotional display, etiquette, hierarchy), sound (ambience, foley, music must belong to the world), symbolic motifs (only if they serve the locked theme — no random 'artistic' butterflies/hourglasses), and a FORBIDDEN-entities list (anything outside era/culture/technology/genre/class/space/mood/story). Any entity outside this ontology is forbidden unless explicitly introduced as contrast, memory, dream, fantasy insertion, advertisement metaphor, or story device.",
    variables:
      "allowed humans / creatures / architecture / objects / clothing / technology / language-text / symbols / food / behavior / sounds / motifs; forbidden entities; exception rules",
    violations:
      "period drama + smartphone = ontology error; modern Vietnam + unexplained Japanese signage = culture error; medieval fantasy + a car = technology error; sci-fi + unexplained 18th-century costume = timeline/ontology error",
  },
  {
    id: "temporal_dna",
    name: "4 · TEMPORAL DNA — luật thời gian",
    rule: "All objects, clothing, architecture, technology, language, behavior, and sound must match the locked time period. The timeline structure (linear / time-jump / flashback / parallel / loop / memory / dream / montage / before-after) must be defined before scene generation; every scene must continue, jump, mirror, contrast, or resolve a previous time state according to it. No temporal element (time of day, season, weather, character age, wardrobe state) may change unless caused by a defined time jump, montage, memory shift, dream shift, or scene transition.",
    variables:
      "time period, timeline type, story duration vs video duration, scene gaps, time of day, season, weather, temporal change rules",
    violations:
      "a story spanning 5 minutes where the character changes hairstyle/outfit/weather = temporal break; a story spanning 5 years with zero signs of ageing or era change = missing time signals; day suddenly becomes starry night inside one clip = hard violation",
  },
  {
    id: "environment_dna",
    name: "5 · ENVIRONMENT DNA — không gian và địa điểm",
    rule: "The environment must match the locked environment category, world context, culture, time period, social class, and genre — and must feel AUTHENTIC to its locked context, not generic. Once spatial layout is established (entrances/exits, main zones, large objects, light sources, camera anchors), all scenes must preserve the same spatial relationships unless the scene explicitly moves to a new location.",
    variables:
      "environment category, specific location, geography, culture, period, class, function, spatial layout, entry/exit, light source, fixed vs movable elements, background detail, environmental state",
    violations:
      "a 'hospital' with no medical layout/props = authenticity failure; furniture silently rearranging between scenes = spatial break; a generic 'pretty' room with no cultural or lived-in identity = generic-world failure",
  },
  {
    id: "character_dna",
    name: "6 · CHARACTER DNA — nhân vật",
    rule: "Character design must match the locked character type, world context, genre, culture, time period, and narrative role. Every recurring character keeps a stable identity system (role, age, class, occupation, personality, motivation, fear, relationships) and a locked appearance (face, hair, body, outfit, accessories, stylization level). Behavior, posture, gestures, expression, speech rhythm, emotional response and social interaction must match the locked identity and culture. No drift unless a transformation arc is explicitly defined.",
    variables:
      "character ID, type/species, name, age range, gender, cultural fit, era fit, social role, occupation, personality, emotional baseline, motivation, fear/flaw, relationship map, face/body/hair/outfit/accessory/behavior/voice DNA, transformation arc, forbidden drift",
    violations:
      "a CEO behaving like a child (outside comedy) = role break; a 5-year-old speaking like a philosophy professor (unintended) = identity break; an ancient warrior checking a smartphone = ontology+character break; documentary character over-acting = reality-level break",
  },
  {
    id: "object_prop_dna",
    name: "7 · OBJECT / PROP DNA — vật thể và đạo cụ",
    rule: "Every important object has a defined ROLE (hero / story / symbolic / functional / background / cultural / time-period / emotional / transition prop) — objects without narrative, environmental, cultural, functional, or emotional purpose should not dominate the frame. All objects must match the locked world in design, material, technology level, age, function, and cultural meaning, and must preserve STATE continuity (position, orientation, open/closed, clean/dirty, intact/broken, full/empty, on/off, wet/dry, held/placed, owner) across scenes unless a visible action changes the state.",
    variables:
      "object ID, role, world fit, era fit, shape, material, color, texture, scale, default position, orientation, owner, interaction rule, state per scene, sound when used, symbolic meaning, forbidden drift",
    violations:
      "a smartphone in 1990 = era error; a pristine countertop that was cluttered one scene ago with nobody cleaning it = state break; a random prop stealing the frame with no job = role violation",
  },
  {
    id: "motion_action_dna",
    name: "8 · MOTION & ACTION CONTINUITY DNA — chuyển động và nối hành động",
    rule: "Motion and physics must follow the locked physics mode (real-world / commercial-polished / stylized-animation / fantasy / sci-fi / dream / symbolic / comedy-exaggeration / horror-uncanny) — any deviation must be intentional, consistent, and motivated by genre or story. Movement must match the character's body, age, emotional state, physical ability, object weight, environment and genre. The continuity mode (strict / soft / montage / symbolic / parallel / dream / commercial) must be defined before generation, and every scene transition must follow it through at least ONE declared continuity anchor (body / object / eye-line / motion / emotion / sound / light / symbol / dialogue / location).",
    variables:
      "physics mode, movement realism, weight/contact rule, start state, main action, end state, next anchor, continuity mode, allowed discontinuity, forbidden continuity breaks",
    violations:
      "people flying in an everyday-reality video = physics-mode break; a one-shot video with an unexplained action jump = strict-continuity break; a montage with no connecting idea/motif = anchor failure",
  },
  {
    id: "visual_language_dna",
    name: "9 · VISUAL LANGUAGE DNA — ngôn ngữ hình ảnh",
    rule: "All camera, lighting, color, composition, lens behavior, and visual effects must match the locked visual style mode (cinematic realism / documentary handheld / luxury commercial / clean product demo / sitcom / horror / romantic drama / anime-inspired / 3D stylized / vintage film / camcorder / vertical social / fashion editorial / corporate / educational explainer / mythic epic / cyberpunk neon / minimalist monochrome / warm family drama / fast-paced ad). Camera grammar supports the scene intent, genre, emotional tone, and continuity mode. Lighting must match the locked world, time, environment, genre, mood and style. The color palette stays consistent with the locked visual identity and may shift ONLY when motivated by emotional transition, time change, location change, or narrative transformation.",
    variables:
      "visual style mode, aspect ratio, camera grammar (shot size, angle, lens feel, movement, speed, distance, composition, 180° axis, focus, shake, stylization), lighting grammar (source type per mood), color grammar, texture/grain, VFX rule, text overlay rule, forbidden visual drift",
    violations:
      "documentary style with impossible crane-orbit moves = grammar break; luxury commercial with messy set and ugly light = brand-quality error; palette silently shifting between clips = visual drift",
  },
  {
    id: "audio_validation_dna",
    name: "10 · AUDIO & VALIDATION DNA — âm thanh và hậu kiểm",
    rule: "All ambience, foley, dialogue, music, silence, and sound design must match the locked world context, genre, environment, time period, and emotional intent. The dialogue system (none / voice-over / natural dialogue / monologue / narration / expert / banter / poetic / pitch / educational / inner voice) must match the character identity, culture, genre, platform, duration and audience. VALIDATION GATE: validate every scene against the locked world context, time, environment, character, object, motion, continuity, scene intent, visual language, and audio system — any element that contradicts the locked context must be removed, corrected, or explicitly justified before output.",
    variables:
      "audio world, ambience, foley, dialogue mode, voice identity, language, accent, music style, silence rule, AV sync, validation checklist per layer, forbidden audio drift",
    violations:
      "motorbike noise inside a fairy-tale forest = audio-world break; a luxury spa scene with cluttered loud sound = mood break; a scene that fails the ontology/timeline check but ships anyway = validation failure",
  },
] as const;

/**
 * Digest tiêm vào SYSTEM PROMPT của bước dựng storyboard: 10 tầng trừu tượng +
 * quy trình khóa. Model phải (1) RESOLVE context từ brief, (2) xuất
 * "world_context" trong JSON, (3) mọi field sau đó tuân theo context đã khóa.
 */
export function contextDnaSystemDigest(): string {
  const layers = CONTEXT_DNA_LAYERS.map(
    (l) => `▸ ${l.name}\n  · RULE: ${l.rule}\n  · LOCK THESE VARIABLES: ${l.variables}\n  · VIOLATION EXAMPLES: ${l.violations}`
  ).join("\n");
  return `TẦNG 0 · CONTEXT-LOCKED VIDEO DNA SYSTEM (the constitution ABOVE all other laws — "${CONTEXT_MANTRA}"):
${CORE_CONTEXT_RULE}

HOW TO APPLY (mandatory workflow):
1. READ the user's brief/idea/genre/setting and RESOLVE the context variables below (never assume a default country, culture, era or style — infer them from the brief, or choose the most natural fit and STATE it).
2. LOCK the resolution into the "world_context" object of your JSON output (world_type, reality_level, genre, geography, culture, time_period, technology_level, social_class, environment_category, visual_style, audio_style, allowed_language_text, forbidden_entities, intentional_exceptions).
3. From that moment, EVERY segment, character_lock, first_frame_prompt, motion_prompt, dialogue, environment_ref, camera note and sound choice MUST belong to the locked context. Treat every out-of-context entity as a bug: wrong-era technology, off-culture signage/architecture/food, off-class props, off-genre behavior, off-style camera/lighting.
4. Fill "forbidden_entities" with the concrete list for THIS world (e.g. for a period piece: phones, sneakers, LED lights, modern signage). Exceptions exist ONLY when declared in "intentional_exceptions" (contrast / memory / dream / parody / product metaphor / narrative disruption).

REALITY LEVELS (pick exactly one for "reality_level" and honour it in acting, light, camera and set):
${REALITY_LEVELS.map((r) => `  · ${r}`).join("\n")}

THE 10 DNA LAYERS:
${layers}`;
}

/**
 * Khối "LOCKED WORLD CONTEXT" resolve từ world_context đã chốt — tiêm vào MỌI
 * prompt Veo/keyframe để thế giới không bao giờ trôi khỏi bối cảnh đã khóa.
 */
export function worldContextLockBlock(wc?: WorldContext | null): string {
  if (!wc || !(wc.world_type || wc.geography || wc.culture)) return "";
  const parts = [
    wc.world_type && `world type: ${wc.world_type}`,
    wc.reality_level && `reality level: ${wc.reality_level}`,
    wc.genre && `genre: ${wc.genre}`,
    wc.geography && `geography: ${wc.geography}`,
    wc.culture && `culture: ${wc.culture}`,
    wc.time_period && `time period: ${wc.time_period}`,
    wc.technology_level && `technology level: ${wc.technology_level}`,
    wc.social_class && `social class: ${wc.social_class}`,
    wc.environment_category && `environment: ${wc.environment_category}`,
    wc.visual_style && `visual style: ${wc.visual_style}`,
    wc.audio_style && `audio style: ${wc.audio_style}`,
  ]
    .filter(Boolean)
    .join("; ");
  const forbidden =
    wc.forbidden_entities && wc.forbidden_entities.length > 0
      ? ` FORBIDDEN in this world (must never appear): ${wc.forbidden_entities.join(", ")}.`
      : "";
  const exceptions =
    wc.intentional_exceptions && wc.intentional_exceptions.length > 0
      ? ` Declared intentional exceptions: ${wc.intentional_exceptions.join(", ")}.`
      : "";
  const textPolicy = (wc.allowed_language_text ?? "").trim();
  const textPermitted = !!textPolicy && !/(none|forbid|zero|avoid readable|blur all|no text)/i.test(textPolicy);
  const text = textPermitted
    ? ` Visible text/signage policy: ${textPolicy}. Only explicitly requested text may be readable; never invent additional signs, captions or labels.`
    : " Avoid readable text unless explicitly specified; use abstract or blurred background signage otherwise.";
  return ` LOCKED WORLD CONTEXT (${parts}). Therefore ALL objects, architecture, clothing, technology, language, cultural details, social behavior, food, environmental details, sounds and visual motifs in this clip must belong to this locked world — any element outside it is an ontology violation unless declared as intentional contrast, memory, dream, parody, fantasy insertion, or product metaphor.${forbidden}${exceptions}${text}`;
}
