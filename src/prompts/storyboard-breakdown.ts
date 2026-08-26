import type {
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  VideoGoal,
  SceneBible,
  AspectRatio,
  SpatialLayout,
  CharacterRepresentation,
  SegmentTransitionContract,
  SegmentStateLedger,
} from "@/types";
import {
  resolveEnvironment,
  renderEnvironmentBlock,
  environmentCatalogForPrompt,
} from "@/lib/environment";
import {
  lawsSystemDigest,
  defaultVoiceFor,
  worldContextLockBlock,
} from "@/lib/laws";
import { ensureDialogueClock, stripProductionTimecodes } from "@/lib/timeline-contract";
import { lockedNarratorVoiceProfile } from "@/lib/audio/narrator-voice";
import { contextFrameworkSystemDigest } from "@/lib/video-context";
import {
  renderSceneIntentDirective,
  selectedSceneIntentRulesDigest,
  type SceneIntentIR,
} from "@/lib/scene-intent";
import {
  buildRealityDirective,
  realityUsesRealWorldPhysics,
  type RealityProfile,
} from "@/lib/reality";
import type { WorldContext } from "@/types";
import { isStylizedCharacterRepresentation } from "@/lib/creative-routing";
import { compileCookingRecipeDigest } from "@/lib/cooking";
import { compileProductIRDigest } from "@/lib/product-ir";
import { resolveSpeechMode } from "@/lib/storyboard/anonymous-narration";
import {
  inferRevolvingDoorOperation,
  resolveSpatialLayout,
  renderSpatialTopologyLock,
  SPATIAL_TOPOLOGY_INVARIANTS,
} from "@/lib/spatial-topology";
import { renderCreativeRouteDirective } from "@/lib/creative-routing";
import {
  compactGenreScriptDirective,
  compactGenreStoryboardDirective,
} from "@/lib/genre-production-profiles";
import {
  HUMAN_FACE_REALISM_LOCK,
  HUMAN_FACE_REALISM_NEGATIVE,
  REFERENCE_CHARACTER_ANTI_PLASTIC,
  REFERENCE_CHARACTER_APPEARANCE_LOCK,
  stripUploadedCharacterAppearance,
} from "@/lib/character-realism";

// Forbidden in every generated image/clip (the brief's negative list).
// Phrased as plain descriptors (no instructive "no/don't") — Veo/Kling read the
// negative list as nouns/adjectives to avoid, and "no X" phrasing can backfire.
const SHARED_NEGATIVE =
  "NEGATIVE (avoid — plain descriptors): resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual, warped or altered label/logo text, logo change, brand-colour change, extra products, duplicated or doubled objects (e.g. two pans / two of the same item), floating or levitating objects, objects passing through solid surfaces, physically impossible actions (e.g. lifting/holding a pan with a spatula), sudden appearing or disappearing objects, teleporting, morphing, warping, melting, distorting, deforming, object/container morphing, inconsistent physics, railing or wall crossing a doorway or walking route, perimeter barrier in the middle of a floor, blocked threshold, person or camera beyond a railing or inside a wall, contradictory zone order, unnatural motion, jittery or stuttering movement, frame skipping, mid-clip jump cuts, extra people, changed hair/wardrobe/accessories, identity drift, face morphing, changing facial features, age shifting, extra or missing limbs, extra or fused fingers, mutated or malformed hands, human hands when the action does not require them, limbs bending or passing through objects, deformed liquid, floating ingredients, melted food, warping plate, liquid flowing upward, on-screen text overlays, captions, subtitles, burned-in dialogue text, title cards, karaoke/lyric text, camera or lens spec overlay (e.g. '50mm', 'f/2.8', '4300K', 'lux'), technical readout, HUD, info card pinned in a corner, timecode or timestamp text, watermark, duplicate subject, plastic/CGI skin.";

const REFERENCE_CHARACTER_SCENE_NEGATIVE =
  `NEGATIVE (avoid): duplicated or extra people, duplicated objects, floating objects, objects passing through solid surfaces, impossible physics, teleporting, morphing, warping, jitter, frame skipping, mid-clip jump cuts, on-screen text, captions, subtitles, title cards, HUD, technical readout, watermark, ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`;

/** One compact speech contract shared by script and storyboard prompts. */
function speechModeDirective(
  input: StoryboardGenerationInput,
  language: string
): string {
  const speech = resolveSpeechMode(input);
  const names = speech.anonymous_characters
    ? "Audience-facing prose and all speech use stable functional role labels only; personal names may remain only as hidden asset-binding keys."
    : "Keep the approved character names/role labels exactly.";
  const narratorStyle = (input.narrator_voice_style ?? "").trim();
  // New payloads carry dialogue style here. Legacy `tone` remains one separate
  // project-tone line below, so the same long descriptor is not duplicated.
  const dialogueStyle = (input.character_dialogue_style ?? "").trim();
  const audio = `music=${input.music_enabled === false ? "off" : "on"}, ambience=${input.ambience_enabled === false ? "off" : "on"}, foley=${input.foley_enabled === false ? "off" : "on"}`;

  if (speech.mode === "wordless") {
    return `SPEECH MODE — WORDLESS: no narrator, character speech, quoted thoughts or lip-sync. Dialogue fields stay empty; tell the story through visible action. ${names} Sound channels: ${audio}.`;
  }
  if (speech.mode === "voice_over_only") {
    return `SPEECH MODE — VOICE-OVER ONLY: every spoken row uses speaker="", delivery="voiceover", no camera_beat; visible mouths remain closed. ${names} Narration is ${language}${narratorStyle ? `; performance: ${narratorStyle}` : ""}. Narration adds context/meaning without reading visible action or repeating itself.`;
  }
  if (speech.mode === "character_dialogue_only") {
    return `SPEECH MODE — CHARACTER DIALOGUE ONLY: no narrator/VO. ${names} Character speech is ${language}${dialogueStyle ? `; style: ${dialogueStyle}` : ""}. Use sequential turns, exact speaker ownership and lip-sync; dialogue carries relationship/conflict without narrating visible action.`;
  }
  return `SPEECH MODE — MIXED: allow narrator VO and character dialogue, each only when it adds different information. ${names} Narrator performance${narratorStyle ? `: ${narratorStyle}` : " follows genre"}; character dialogue${dialogueStyle ? `: ${dialogueStyle}` : " follows genre"}. Never let VO repeat a character line or visible action; never overlap VO and dialogue; lock narrator and each character to separate recurring voices. Spoken language: ${language}.`;
}

// Positive realism directive — reproduced in every motion/video prompt. Models
// respond better to explicit positive physics cues than to negatives alone, so
// we state what the clip MUST do, not only what to avoid.
// Concise anti-artifact tail for IMAGE-LED Veo prompts. When a clean keyframe
// is attached as the start frame it already carries the identity, wardrobe,
// setting, lens and colour — so the prompt must NOT re-describe them (that
// bloat is exactly what makes Veo drift/morph). We keep only the motion plus a
// short physics + negative cue.
// ── PHOTOREAL SPINE (ported from veoflow-web) ───────────────────────────────
// veoflow-web's clips read as *really filmed* because it never relies on the
// model to remember realism — it repeats a positive "Layer-1 Visual Reality"
// directive (forensic skin_texture + physically-based materials) in every clip.
// We bring that same spine here so EVERY character and EVERY object (leather
// boots, denim, metal, wood, fabric, skin) renders true-to-life, not CGI/plastic.
// One constant, reused in the motion tail, the keyframe and the Veo JSON.
const PHOTOREAL_REALISM =
  "REAL FILMED FOOTAGE: natural skin texture, individual hair strands, true material grain and weight, physically plausible light and imperfect shadows, subtle optical depth of field and organic sensor texture — never CGI, waxy or toy-like.";

const PHOTOREAL_MATERIAL_REALISM =
  "REAL MATERIALS: leather shows grain, creases, worn scuffs and stitching; denim shows twill weave; metal has physically plausible reflections and wear; wood has varied grain; fabric has real thread, nap, folds and weight. Physically accurate light, soft imperfect shadow edges, natural optical depth of field and fine organic sensor/film texture — no plastic, toy-like or CGI surfaces.";

// Concise anti-artifact tail. Product-related negatives are included ONLY when
// the clip actually has a product, so a person-only clip never mentions products.
// The physics/camera/audio clauses are RENDERED FROM the frozen PRODUCTION_LAWS
// manifest (src/lib/laws) — single source of truth, per the 9-layer canon.
function veoConciseTail(
  hasProduct: boolean,
  realityProfile?: RealityProfile | null,
  renderMedium?: CharacterRepresentation,
  hasCharacterReference = false,
): string {
  const productNeg = hasProduct
    ? "warped or altered label/logo text, brand-colour change, extra or duplicated products, "
    : "";
  const stylizedMedium = isStylizedCharacterRepresentation(renderMedium);
  const realWorld = !stylizedMedium && realityUsesRealWorldPhysics(realityProfile);
  const realityDirective = hasCharacterReference
    ? `CHARACTER REFERENCE LOCK: ${REFERENCE_CHARACTER_APPEARANCE_LOCK} Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`
    : stylizedMedium
    ? `STYLIZED RENDER LOCK: remain ${renderMedium} in every frame with one stable shape/line/material language; never drift into live action or a different animation medium.`
    : realityProfile
      ? buildRealityDirective(realityProfile)
      : PHOTOREAL_REALISM;
  const motionLaw = realWorld
    ? "REAL PHYSICS: contact and visible force precede every object change; weight, gravity, balance and result-state persistence remain natural."
    : "Motion and causality stay consistent with the locked reality profile.";
  const renderNeg = hasCharacterReference
    ? REFERENCE_CHARACTER_ANTI_PLASTIC
    : realWorld
    ? `${HUMAN_FACE_REALISM_NEGATIVE}, toy-like or 3D-render materials`
    : "unmotivated photoreal/stylized switching, accidental world-physics drift";
  const textLaw = "ZERO VISIBLE TEXT/GRAPHICS; dialogue is audio only.";
  const propCausality = "PROPS/DOORS: already present in the start state; visible contact and continuous movement cause every change; nothing opens, appears or moves by itself.";
  const characterArtifacts = hasCharacterReference
    ? renderNeg
    : `extra or fused fingers, malformed hands, a third hand, an extra pair of hands, a disembodied hand entering the frame, the face changing, ${renderNeg}`;
  return `${realityDirective} ${motionLaw} ${propCausality} ${textLaw} Avoid: ${productNeg}storyboard layouts, morphing, teleporting, floating or duplicated objects, deformed food/liquid, ${characterArtifacts}.`;
}

/** One-line "Scene Bible" style tokens. Keeps lens/lighting/grade constant so
 * the clips feel like one film, while the LOCATION can still change per scene
 * (the "Setting style" is a guide, not a lock — vital for narrative/numerology
 * videos where every beat is a different metaphor location). */
function sceneBibleTokens(sb?: SceneBible): string {
  if (!sb) return "";
  // film_grain is an optional realism fingerprint (grain/texture/acquisition) —
  // repeated verbatim like the other tokens so the "really filmed" look is
  // constant across every clip (ported from veoflow-web's scene_bible_tokens).
  const grain = sb.film_grain ? `; ${sb.film_grain}` : "";
  return `STYLE TOKENS (keep the SAME lens, lighting mood and colour grade across every clip): ${sb.lens}; ${sb.lighting}; ${sb.color_grade}${grain}. Setting style: ${sb.backdrop}.`;
}

/** A live-action scene bible must never overpower a selected illustrated
 * medium. Keep the script-derived place, but translate all photographic camera,
 * material and grain language into one stable graphic-world instruction. */
function stylizedSceneBibleTokens(
  sb: SceneBible | undefined,
  renderMedium: CharacterRepresentation | undefined
): string {
  const backdrop = (sb?.backdrop ?? "the complete script-derived setting").trim();
  return `STYLIZED STYLE TOKENS: render ${backdrop} only inside the locked ${renderMedium ?? "illustrated"} medium, with its native palette, line/shape language, simplified lighting and texture. Use a virtual camera with stable perspective; no live-action lens look, photographic material detail, realistic skin, sensor texture or film grain.`;
}

function stylizedHandLock(renderMedium: CharacterRepresentation | undefined): string {
  if (renderMedium === "whiteboard_stick_figure" || renderMedium === "stick_figure") {
    return "Hands remain tiny black-line endpoints or minimal mitten marks in the exact stick-figure design; every prop contact is line-to-prop contact only; never render a live-action or photoreal human hand, skin, palm, fingernail, knuckle, realistic wrist or detached hand entering the frame";
  }
  return "Hands use only the simplified anatomy and material native to the locked stylized medium, remain attached to the correct character and contact only named props; never insert a live-action or photoreal human hand, skin, palm, fingernail, knuckle, realistic wrist or detached hand";
}

// ─── Marketing templates ────────────────────────────────────────────────────

const GOAL_GUIDANCE: Record<VideoGoal, string> = {
  marketing_general:
    "General marketing short. Strong 3-second hook, build desire, end with a clear CTA.",
  product_ad:
    "Product advertisement. Show the product in use, highlight 2-3 key benefits, demonstrate the result, end with a buy/visit CTA.",
  storytelling:
    "Narrative story. Relatable character, a tension/conflict, a turning point, an emotional payoff, subtle CTA.",
  review:
    "Honest review/testimonial. Hook with the verdict, show pros, show one con, give recommendation CTA.",
  educational:
    "Educational/how-to. Hook with the problem/promise, deliver clear steps, recap, follow-for-more CTA.",
  brand_story:
    "Brand story. Open on the brand's mission/origin emotion, connect to the viewer's values, show the brand in real life, close with a brand-line CTA.",
  social_short:
    "Native social short (TikTok/Reels). Pattern-interrupt hook in 1-2s, fast punchy beats, trend-aware energy, on-screen-friendly, follow/like CTA.",
  testimonial:
    "Customer testimonial. A real person talks to camera: their before-pain, the turning point with the product, the after-result, a sincere recommendation CTA.",
  promo_sale:
    "Promo / sale push. Bold offer hook (discount/deadline), show the value, create urgency (limited time/stock), end with a strong shop-now CTA.",
  numerology:
    "Numerology / self-development insight short. ONE relatable character embodying the number(s). 5-beat emotional arc: Hook (call out the viewer) → Pain (the misunderstood struggle) → Insight (reframe: 'not X, but Y') → Payoff (the mission/gift) → CTA (loop-friendly, comment prompt). Warm, cinematic, inspiring — never a hard product sell.",
  psychology:
    "Psychology / behavior insight short. ONE relatable character living a specific psychological pattern (anxiety loop, people-pleasing, procrastination, attachment style...). 5-beat arc: Hook (name the exact behavior the viewer secretly does) → Pattern (show it playing out in a real moment) → Mechanism (the simple psychology behind it — one concept, plain words, no jargon lecture) → Reframe (the healthier move, shown not preached) → CTA (save/share 'gửi cho người cần'). Empathetic, non-judgmental, precise — never clinical diagnosis, never shame.",
  documentary_story:
    "Documentary-style short. Real-feeling, observational: natural light, honest frames, real textures, minimal staging (Reality Level 1-2). Structure: a compelling opening fact/moment → context that raises a question → observed process/details → a human beat → a quiet, earned takeaway. Narration calm and factual; no hard sell, CTA is a soft follow/learn-more.",
  health:
    "Health / wellness education short. ONE relatable character living the health problem. 5-beat arc: Hook (name the symptom/fear) → Problem (how it disrupts daily life) → Insight (the real root cause, explained simply) → Solution (the habit/remedy/product that helps) → CTA (save/follow/try). Trustworthy, empathetic, clear — evidence-based, not alarmist.",
  cooking:
    "Recipe / food short. THE FOOD IS THE STAR. Open on an irresistible finished-dish 'money shot', then show the make in clean steps, end on the reveal + a save-worthy CTA. Appetising, sensory (sizzle, steam, texture), fast and satisfying.",
  fitness:
    "Fitness / workout short. Call out the goal (fat loss, abs, glutes) or a common mistake, demonstrate the movement/tip with correct form, show the payoff, end with a save/tag CTA. Motivating, clear coaching cues, safe — never a hard sell or unsafe claim.",
};

// Per-number archetype reference — ALIGNED VERBATIM with the thần số học app
// (hiseeoptic/thansohoc-next, src/utils/deepNumberKnowledge.ts + numerologyAnalysis.ts):
// archetype name, ruling planet, ngũ hành and core message are the repo's own.
// This is a CHARACTERISATION aid — the live TOPIC CONTENT from the shared Google
// Sheet is the source of truth for the detailed meaning; this table guarantees
// the model always has the number's identity, element, shadow and mission.
const NUMEROLOGY_ARCHETYPES = `
NUMBER ARCHETYPE REFERENCE (số · archetype · hành tinh · ngũ hành · thông điệp lõi · SHADOW/bóng tối):
1 · Thủ Lĩnh · Mặt Trời · Thủy · "sinh ra để dẫn dắt và khai phá con đường mới" · độc đoán, kiêu ngạo, cô độc, sợ thất bại
2 · Yêu Thương · Mặt Trăng · Thổ · "sinh ra để kết nối, yêu thương và mang lại hòa hợp" · phụ thuộc, cả nể, thụ động, lo âu
3 · Người Truyền Cảm Hứng · Sao Mộc · Mộc · "sinh ra để truyền cảm hứng, sáng tạo và lan tỏa năng lượng tích cực" · hời hợt, phân tán, drama, nói nhiều làm ít
4 · Người Thầy · Sao Thiên Vương · Mộc · "sinh ra để xây nền tảng vững chắc, tổ chức và giữ mọi thứ vận hành" · cứng nhắc, bảo thủ, ôm việc, ngại đổi thay
5 · Phiêu Du · Sao Thủy · Thổ · "sinh ra để khám phá, trải nghiệm tự do và mang lại sự mới mẻ" · bốc đồng, thiếu kiên định, cả thèm chóng chán, sa đà
6 · Gia Đình · Sao Kim · Kim · "sinh ra để yêu thương, chăm sóc và gắn kết gia đình & cộng đồng" · kiểm soát, hy sinh quá mức, ôm đồm, phán xét
7 · Chiêm Nghiệm / Chiến Lược Gia · Sao Hải Vương · Kim · "sinh ra để chiêm nghiệm sâu sắc, phân tích và tìm chân lý nội tâm" · cô lập, hoài nghi, lạnh lùng, xa cách
8 · Kinh Doanh / Chuyên Gia · Sao Thổ · Thổ · "sinh ra để đạt thành tựu lớn, lãnh đạo và xây giá trị bền vững" · tham vọng mù quáng, cuồng việc, ám ảnh vật chất, áp chế
9 · Nhân Đạo · Sao Hỏa · Hỏa · "sinh ra để cống hiến, nhân đạo và mang giá trị cho cộng đồng" · bi lụy, ôm nỗi đau, khó buông, xa cách cảm xúc
11 · Người Khai Sáng · Mặt Trăng · Thủy · "khai sáng, chữa lành và dẫn dắt bằng trực giác mạnh mẽ" · lo âu cực độ, mất phương hướng, cực đoan cảm xúc
22 · Người Kiến Tạo · Sao Thiên Vương · Thổ · "kiến tạo những công trình lớn, kết hợp trực giác và thực thi" · áp lực khổng lồ, tự hủy hoặc lãng phí tiềm năng
33 · Người Chữa Lành · Sao Kim · Hỏa · "chữa lành, truyền yêu thương và mang lại sự cân bằng" · gánh trách nhiệm đến kiệt sức
NGŨ HÀNH — TƯƠNG SINH: Mộc→Hỏa→Thổ→Kim→Thủy→Mộc (số này nuôi số kia = hỗ trợ, đồng hành). TƯƠNG KHẮC: Mộc→Thổ→Thủy→Hỏa→Kim→Mộc (số này chế số kia = căng thẳng nhưng bù trừ). Với chủ đề nhiều số, XÁC ĐỊNH quan hệ ngũ hành giữa chúng và để nó dẫn dắt CORE MESSAGE.
NGŨ HÀNH → MÔI TRƯỜNG & MÀU (dùng để dựng bối cảnh/ánh sáng cho ĐÚNG chất số):
· Thủy (Water): sông/mưa/mặt nước phản chiếu, dòng chảy; grade xanh lam–teal mát, ẩm, chuyển động mềm.
· Thổ (Earth): núi/đất/đá, không gian vững chãi, bám rễ; tông đất ấm ochre/nâu, ổn định, tĩnh.
· Mộc (Wood): rừng/cây/mầm xanh, sự sinh trưởng; sắc xanh lá, nắng sớm, sức sống vươn lên.
· Kim (Metal): kim loại/kính/tối giản, đường nét sắc, chính xác; xám–trắng lạnh, tĩnh, sạch.
· Hỏa (Fire): hoàng hôn/lửa/nến, ánh sáng rực; đỏ–cam ấm, đam mê, quầng sáng phát ra.`;

// ─── AUTO NUMBER-PROFILE EXPANSION ──────────────────────────────────────────
// The user should only need to type "Hành trình của cô gái có Số Chủ Đạo 1,
// Sứ Mệnh 5". We detect the numbers in that one line and inject each number's
// full VIDEO profile (signature environments, prop, reactive/conscious
// gestures) plus the computed ngũ-hành relationship — so setting, environment,
// actions and dialogue are all derived automatically from stored knowledge.
const NUMBER_VIDEO_PROFILES: Record<
  number,
  { ten: string; hanh: string; moiTruong: string; prop: string; reactive: string; conscious: string }
> = {
  1: { ten: "Thủ Lĩnh", hanh: "Thủy", moiTruong: "sống núi mù sương, con đường chưa ai đi, bình minh trên đỉnh, người khác bắt đầu đi theo sau", prop: "áo khoác da sờn / la bàn", reactive: "ôm hết việc \"để tôi làm cho nhanh\", đi trước đám đông không ngoái lại, quai hàm siết khi việc chệch hướng, người cuối cùng tắt đèn", conscious: "chỉ đường rồi lùi lại cho người khác bước, đặt tay lên vai người đi sau, dấu chân đầu tiên in trên lối mới" },
  2: { ten: "Yêu Thương", hanh: "Thổ", moiTruong: "bàn ăn gia đình, hai bàn tay đan nhau, quán cà phê ấm, khoảnh khắc hoà giải", prop: "hai tách trà / chiếc khăn choàng", reactive: "gật đầu dù không muốn, đọc lại tin nhắn ba lần trước khi gửi, nhường đến khi bùng nổ", conscious: "nắm tay hoà giải, nói \"không\" nhẹ mà chắc, hai bàn tay đan giữa bàn ăn" },
  3: { ten: "Người Truyền Cảm Hứng", hanh: "Mộc", moiTruong: "sân khấu nhỏ, xưởng vẽ đầy màu, con phố rực rỡ, đám đông bật cười", prop: "chiếc mic nhỏ / cây cọ vẽ", reactive: "cười to giữa đám đông rồi im bặt khi về nhà, mở năm dự án bỏ dở cả năm", conscious: "một câu nói trên sân khấu nhỏ khiến một người bật khóc, hoàn thành trọn vẹn một tác phẩm" },
  4: { ten: "Người Thầy", hanh: "Mộc", moiTruong: "công trường / xưởng mộc ngoài trời, xếp từng viên gạch, bản vẽ, nền móng vững", prop: "cây thước / cuộn bản vẽ", reactive: "sắp mọi thứ thẳng hàng, không rời checklist, cứng người khi kế hoạch đổi phút chót", conscious: "đặt viên gạch đầu tiên cho người khác xây tiếp, trao cuộn bản vẽ cho học trò" },
  5: { ten: "Phiêu Du", hanh: "Thổ", moiTruong: "ngã ba đường hoàng hôn, ga tàu, vách đá nhìn biển, con đường vô tận", prop: "ba lô bạc màu / tấm bản đồ gấp", reactive: "2 giờ sáng xếp đồ vào ba lô, thề \"lần này nghiêm túc\" rồi ba giây sau vớ lấy ba lô, lướt vé máy bay giữa cuộc họp", conscious: "dừng chân ở một bản làng để dạy học, mang câu chuyện từ mọi miền về cho một người ngồi nghe" },
  6: { ten: "Gia Đình", hanh: "Kim", moiTruong: "căn bếp ấm, chăm em nhỏ, khu vườn, mâm cơm sum vầy", prop: "chiếc tạp dề / khung ảnh gia đình", reactive: "nửa đêm dọn phòng cho cả nhà, hỏi \"ăn chưa\" thay vì \"buồn không\", kiểm soát từng chi tiết nhỏ", conscious: "ngồi xuống ăn cùng thay vì đứng phục vụ, để con tự vấp rồi ôm con sau đó" },
  7: { ten: "Chiêm Nghiệm", hanh: "Kim", moiTruong: "thư viện cổ, đỉnh đồi tĩnh lặng, bờ hồ sương sớm, thiền giữa rừng", prop: "cuốn sổ tay / cặp kính", reactive: "rời bữa tiệc sớm không chào ai, hai ngày sau mới trả lời tin nhắn, ánh mắt nhìn xuyên qua người đối diện", conscious: "mở một trang sổ tay chia sẻ với đúng một người, mời ai đó bước vào khoảng lặng của mình" },
  8: { ten: "Kinh Doanh", hanh: "Thổ", moiTruong: "nóc toà nhà nhìn thành phố, cái bắt tay thương vụ, sân khấu trao giải — ngoài trời, tránh bàn giấy", prop: "chiếc đồng hồ / chùm chìa khoá", reactive: "trả lời email giữa đám cưới, đo mọi thứ bằng con số, vai gồng như vác két sắt", conscious: "ký bảng lương đầu tiên cho đội của mình, tắt điện thoại đúng sáu giờ tối để về ăn cơm" },
  9: { ten: "Nhân Đạo", hanh: "Hỏa", moiTruong: "bản làng vùng cao, trao quà cho trẻ, đống lửa với người lạ, hoàng hôn bao dung", prop: "thùng quà / chiếc khăn quàng", reactive: "cho đến đồng cuối cùng rồi khóc một mình, ôm nỗi buồn của cả thế giới về nhà", conscious: "trao món quà và chịu NHẬN lại một cái ôm, ngồi bên đống lửa lắng nghe người lạ" },
  11: { ten: "Người Khai Sáng", hanh: "Thủy", moiTruong: "không gian rộng nhiều ánh sáng, căn phòng tối có một ngọn đèn, mặt nước phản chiếu bình minh", prop: "ngọn đèn dầu / cây nến", reactive: "mất ngủ vì trực giác quá tải, cảm nhận trước điều chưa xảy ra và sợ chính nó", conscious: "nói đúng một câu người kia cần nghe, thắp đèn trong căn phòng tối cho người khác bước vào" },
  22: { ten: "Người Kiến Tạo", hanh: "Thổ", moiTruong: "công trình lớn đang dựng, bản thiết kế trải trên nền đất, thành phố nhìn từ giàn giáo", prop: "mô hình kiến trúc / bản thiết kế", reactive: "gánh cả công trình trên vai, trắng đêm vì \"phải lớn hơn nữa\"", conscious: "đặt móng cho công trình trăm người sẽ ở, đứng lùi nhìn thứ mình xây sáng đèn" },
  33: { ten: "Người Chữa Lành", hanh: "Hỏa", moiTruong: "hiên nhà chiều muộn, trạm xá nhỏ, vòng tròn người quanh bếp lửa, khu vườn thuốc", prop: "tách trà nóng / chiếc chăn mỏng", reactive: "kiệt sức vì ai cũng dựa vào mình, quên mất chính mình cũng cần được hỏi han", conscious: "băng bó cho người khác xong tự cho phép mình ngồi nghỉ, dạy một người cách tự chữa lành" },
};
const SINH: Record<string, string> = { "Mộc": "Hỏa", "Hỏa": "Thổ", "Thổ": "Kim", "Kim": "Thủy", "Thủy": "Mộc" };
const KHAC: Record<string, string> = { "Mộc": "Thổ", "Thổ": "Thủy", "Thủy": "Hỏa", "Hỏa": "Kim", "Kim": "Mộc" };

function nguHanhRelation(a: number, b: number): string {
  const ha = NUMBER_VIDEO_PROFILES[a]?.hanh;
  const hb = NUMBER_VIDEO_PROFILES[b]?.hanh;
  if (!ha || !hb) return "";
  if (ha === hb) return `${ha} (${a}) cùng hành ${hb} (${b}) → AMPLIFY: cùng đẩy một hướng — siêu năng lực chung + điểm mù chung.`;
  if (SINH[ha] === hb) return `${ha} (${a}) SINH ${hb} (${b}) → tương sinh: năng lượng ${a} nuôi dưỡng con đường của ${b}.`;
  if (SINH[hb] === ha) return `${hb} (${b}) SINH ${ha} (${a}) → tương sinh: năng lượng ${b} nuôi dưỡng bản chất của ${a}.`;
  if (KHAC[ha] === hb) return `${ha} (${a}) KHẮC ${hb} (${b}) → tương khắc: căng thẳng nội tại nhưng là trục trưởng thành cao nhất — hai lực phải tích hợp.`;
  if (KHAC[hb] === ha) return `${hb} (${b}) KHẮC ${ha} (${a}) → tương khắc: căng thẳng nội tại nhưng là trục trưởng thành cao nhất — hai lực phải tích hợp.`;
  return "";
}

/** Detect numerology numbers + roles from the user's ONE-LINE idea, e.g.
 * "Hành trình của cô gái có Số Chủ Đạo 1, Sứ Mệnh 5". */
function detectNumerologyNumbers(text: string): { role: string; num: number }[] {
  const found: { role: string; num: number }[] = [];
  const seen = new Set<string>();
  const push = (role: string, raw: string) => {
    const num = parseInt(raw, 10);
    if (!NUMBER_VIDEO_PROFILES[num]) return;
    const key = `${role}:${num}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ role, num });
  };
  const patterns: [string, RegExp][] = [
    ["Số Chủ Đạo", /ch[uủ]\s*[dđ][aạ]o\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Sứ Mệnh", /s[uứ]\s*m[eệ]nh\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Nội Tâm", /n[oộ]i\s*t[aâ]m\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Linh Hồn", /linh\s*h[oồ]n\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Nhân Cách", /nh[aâ]n\s*c[aá]ch\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Thái Độ", /th[aá]i\s*[dđ][oộ]\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Trưởng Thành", /tr[uư][oở]ng\s*th[aà]nh\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Ngày Sinh", /ng[aà]y\s*sinh\s*(?:s[oố]\s*)?(\d{1,2})/gi],
    ["Đam Mê Tiềm Ẩn", /[dđ]am\s*m[eê]\s*(?:ti[eề]m\s*[aẩ]n\s*)?(?:s[oố]\s*)?(\d{1,2})/gi],
  ];
  for (const [role, re] of patterns) {
    for (const m of text.matchAll(re)) push(role, m[1]!);
  }
  // Bare "số 5" / "chỉ số 5" only when no role-tagged numbers were found.
  if (found.length === 0) {
    for (const m of text.matchAll(/(?:ch[iỉ]\s*)?s[oố]\s*(\d{1,2})/gi)) push("Chỉ số", m[1]!);
  }
  return found.slice(0, 3);
}

/** One-line idea → full auto-loaded production brief for the detected numbers. */
function numerologyAutoProfileBlock(ideaText?: string): string {
  const detected = detectNumerologyNumbers(ideaText ?? "");
  if (detected.length === 0) return "";
  const lines = detected.map(({ role, num }) => {
    const p = NUMBER_VIDEO_PROFILES[num]!;
    return `· ${role} ${num} — ${p.ten} (${p.hanh}): MÔI TRƯỜNG ĐẶC TRƯNG: ${p.moiTruong}. ĐẠO CỤ SIGNATURE: ${p.prop}. CỬ CHỈ BẢN NĂNG (dùng cho beat 1-2 / nỗi đau): ${p.reactive}. CỬ CHỈ TỈNH THỨC (dùng cho beat 3-4 / payoff): ${p.conscious}.`;
  });
  // With 3 indices, spell out every pairwise element relationship so the model
  // can pick the dominant axis and let the third number soften/tip the balance.
  const pairRelations: string[] = [];
  for (let i = 0; i < detected.length; i++) {
    for (let j = i + 1; j < detected.length; j++) {
      const rel = nguHanhRelation(detected[i]!.num, detected[j]!.num);
      if (rel) pairRelations.push(`  - ${detected[i]!.role} ${detected[i]!.num} × ${detected[j]!.role} ${detected[j]!.num}: ${rel}`);
    }
  }
  const relation =
    pairRelations.length > 0
      ? `\n· QUAN HỆ NGŨ HÀNH (tính sẵn cho từng cặp — chọn cặp căng nhất làm trục chính, chỉ số còn lại làm lực làm mềm/nghiêng cán cân):\n${pairRelations.join("\n")}`
      : "";
  return `
🎯 AUTO-LOADED NUMBER PROFILE (detected from the user's one-line idea — that line is the COMPLETE input; derive EVERYTHING else from this stored profile, do not ask for more):
${lines.join("\n")}${relation}
- YOUR JOB: from these profiles alone, design the settings (use the MÔI TRƯỜNG list), the character's wardrobe + signature prop, every physical action/gesture (reactive versions in the pain beats → conscious versions in the payoff), the lighting/colour from the number's ngũ hành, and dialogue lines that voice this exact energy. The user's idea sentence only supplies the protagonist (cô gái/chàng trai/người phụ nữ/người đàn ông...) and the numbers — never ask them to describe setting, environment or actions.`;
}

// Script tone selector for topic content. The user can keep every script both
// inspiring AND behaviorally sharp ("balanced", default), or lean fully one way.
function numerologyToneDirective(style?: string): string {
  switch (style) {
    case "inspirational":
      return `\n- TONE = TRUYỀN CẢM HỨNG (cinematic, cảm xúc): ấm áp, nâng đỡ, giàu hình ảnh ẩn dụ. Dồn vào SỨ MỆNH của con số như nguồn cảm hứng; câu thoại nên thơ mà vẫn ngắn; khiến người xem thấy MÌNH được nhìn thấy và có hy vọng. Cảm xúc quan trọng hơn cơ chế.`;
    case "analytical":
      return `\n- TONE = PHÂN TÍCH HÀNH VI SẮC BÉN (giọng app thần số học): "đọc vị" chính xác. Gọi tên HÀNH VI cụ thể + cơ chế tâm lý đằng sau (động lực tâm lý, xu hướng hành vi), đối chiếu bản PHẢN ỨNG vs bản TỈNH THỨC, cho ví dụ đời thực. Có căn cứ, thật, ít huyền bí — nhưng vẫn ấm, không khô như báo cáo.`;
    default: // "balanced"
      return `\n- TONE = KẾT HỢP (mặc định — vừa truyền cảm hứng vừa sắc bén): MỞ và ĐÓNG bằng CẢM XÚC (hook chặn-lướt đầy cảm hứng + payoff nâng đỡ), nhưng mỗi INSIGHT ở giữa là PHÂN TÍCH HÀNH VI sắc bén — một hành vi cụ thể + cơ chế của nó + cú lật phản-ứng→tỉnh-thức. Ngoài truyền cảm hứng, trong "đọc vị" chuẩn xác. Lấy điểm mạnh của cả hai.`;
  }
}

// Rich framework for topic-driven numerology / self-development shorts, modelled
// on the proven "Số Chủ Đạo" script shape. Injected into the user prompt when
// video_goal is "numerology" so the AI writes in this exact winning structure.
// Two hook modes:
//  - "situation" (DEFAULT): the hook is a visceral real-life situation with NO
//    numbers — the number enters only at beat 3 as the explanation. Reaches
//    cold viewers who don't know/care about their number yet.
//  - "number_callout": the legacy hook that names the number in line 1 — for
//    retargeting followers who already know their numbers.
function numerologyFramework(
  hookMode: "situation" | "number_callout" = "situation"
): string {
  const callout = hookMode === "number_callout";
  return `
NUMEROLOGY SCRIPT FRAMEWORK (follow this EXACTLY — it is the proven winning shape):
- SUBJECT: a numerology profile (e.g. "Số Chủ Đạo 5, Sứ Mệnh 9"). SOURCE OF TRUTH = the TOPIC CONTENT injected below (pulled from the numerology database) + the archetype reference table below; NEVER invent contradictory numerology. Read the topic content and pull out the number's real strengths, SHADOW and MISSION before writing.
${NUMEROLOGY_ARCHETYPES}
- NGŨ HÀNH (Five-Elements): map each number to its element from the table, state the relationship (tương sinh / tương khắc) between the numbers, and derive ONE clear CORE MESSAGE from it (e.g. "tự do của bạn không phải để chạy trốn — mà để mang cảm hứng đi cho đời"). Put this core message in "synopsis". Use the element's MÔI TRƯỜNG & MÀU row to choose the dominant environment + colour grade so the whole video literally LOOKS like that number's element.

- WHEN THERE ARE 2+ NUMBERS (e.g. "Số Chủ Đạo 5, Sứ Mệnh 9") — analyse the COMBINATION, never each number in isolation (this is the thần số học app's core method):
  · Build ONE energy AXIS "X ↔ Y" from the two numbers' pulls and make the whole video about resolving that tension — e.g. 4+5 = "Ổn định ↔ Tự do", 1+3 = "Dẫn dắt ↔ Kết nối". The hook names the tension, the insight reconciles it.
  · Same energy family = AMPLIFY (both push the same way → superpower + the shared blind spot). Opposite pulls = TENSION but the HIGHEST growth (the two must integrate). A third number can SOFTEN or tip the balance.
  · REACTIVE vs CONSCIOUS: every number has a "bản năng/phản ứng" version (its shadow running the show) and a "tỉnh thức/trưởng thành" version (the same energy used wisely). Beat 2 (pain) shows the reactive version; beat 3-4 (insight→payoff) shows the conscious version. This reactive→conscious turn IS the transformation viewers share.
  · GROUNDING (thần số học app voice): tie each trait to a CONCRETE behaviour / real-life example (động lực tâm lý, xu hướng hành vi), not vague cosmic clichés — keep it warm and inspiring, but specific and true, so it lands as "đúng là mình".

- CHARACTER = THE NUMBER MADE HUMAN: invent ONE persona whose name, age, wardrobe, signature prop, posture, energy AND colour tone ALL express this number's archetype, and keep this EXACT character_lock identical across every segment. Derive the look from THIS number's traits in the topic content. (Archetype→look examples: Số 1 leader/pioneer = decisive stance, worn leather jacket, cool steel-blue grade; Số 5 freedom/adventure = faded backpack, warm golden 35mm, restless eyes; Số 9 humanitarian = soft warm light, giving hands.) LOCK a signature PROP that symbolises the number (e.g. Số 5 = backpack/map) and never introduce new unrelated props. Source the pain in beats 1-2 from this number's SHADOW ("bóng tối"), and the payoff in beat 4 from its MISSION line.

- CHARACTER ↔ SETTING SYNCHRONISATION (this is what makes it feel "chuẩn" — DO NOT skip):
  · Every scene's SETTING, props, lighting, weather, camera and the character's action must SYMBOLICALLY embody the number's core trait AND the emotion of that beat. The environment is a METAPHOR for the number, never a random backdrop, and it must match the character's personality in that moment.
  · Choose ONE controlling visual metaphor for the number and vary it across the 5 beats. Examples: Số 5 (tự do) → crossroads at dusk (hook) → packing up / leaving many rooms (pain) → a cliff over the open sea (insight) → giving water among strangers round a fire (payoff) → an endless open road (CTA). Số 1 (mở đường) → walking far ahead of a crowd on a misty ridge (hook) → carrying everything alone, last light on in the office (pain) → an untrodden trail at dawn (insight) → the first footprint on a new path, sun bursting behind (payoff) → others starting to follow his steps (CTA).
  · The environment must EVOLVE with the emotion: cold / lost / cluttered at the pain beat → warm / open / "home" at the payoff — while the SAME character DNA (face, wardrobe) stays identical throughout.
  · SHOW, DON'T TELL: each scene tells its beat through ONE striking visual metaphor + the character's action, NOT a lecturing voiceover. EACH OF THE 5 BEATS MUST BE A DIFFERENT LOCATION that embodies the number's energy — cinematic, varied, mostly OUTDOOR/real-world. A plain office/desk/bedroom is BANNED as a default (only allowed as ONE deliberate metaphor beat, e.g. the "carrying it all alone" pain for Số 1/4/8) — never set the whole video in an office/room.
  · NUMBER → SETTING IDEAS (pick varied locations matching the number's energy; do NOT reuse the same place twice):
    1 Thủ Lĩnh (Thủy): sống núi mù sương, con đường chưa ai đi, bình minh trên đỉnh, người khác bắt đầu đi theo sau.
    2 Yêu Thương (Thổ): bàn ăn gia đình, hai bàn tay đan nhau, quán cà phê ấm, khoảnh khắc hoà giải.
    3 Truyền Cảm Hứng (Mộc): sân khấu nhỏ, xưởng vẽ đầy màu, con phố rực rỡ, đám đông bật cười.
    4 Người Thầy (Mộc): công trường/xưởng mộc, xếp từng viên gạch, bản vẽ, nền móng vững — vẫn nên ra ngoài trời, không kẹt bàn giấy.
    5 Phiêu Du (Thổ): ngã ba đường hoàng hôn, ga tàu, vách đá nhìn biển, con đường vô tận, ba lô lên vai.
    6 Gia Đình (Kim): căn bếp ấm, chăm em nhỏ, khu vườn, mâm cơm sum vầy.
    7 Chiêm Nghiệm (Kim): thư viện cổ, đỉnh đồi tĩnh lặng, bờ hồ sương sớm, thiền giữa rừng.
    8 Kinh Doanh (Thổ): nóc toà nhà nhìn thành phố, cái bắt tay thương vụ, sân khấu trao giải — ra ngoài, tránh bàn giấy nhàm.
    9 Nhân Đạo (Hỏa): bản làng vùng cao, trao quà cho trẻ, đống lửa với người lạ, hoàng hôn bao dung.
    11/22/33: không gian rộng mở, nhiều ánh sáng, biểu tượng khai sáng / kiến tạo / chữa lành.
  · Add ONE relatable, lightly humorous everyday detail so it feels human (e.g. a Số 5 who swears "lần này nghiêm túc" then grabs the backpack 3 seconds later; a Số 1 who directs the whole team then carries every box himself "để tao làm cho nhanh").
  · Write each segment's setting + lighting explicitly in "first_frame_prompt" (a DIFFERENT place each beat). In "scene_bible" the "backdrop" field must describe the VARIED style of locations (e.g. "varied cinematic outdoor landscapes reflecting the number's element"), NOT one fixed room — only the lens, lighting mood and colour grade stay constant so the clips still feel like one film.

${callout
  ? `- THE HOOK IS 80% OF THE VIDEO. The first 2-3 seconds decide everything. The opening SHOT + the opening LINE must both stop the scroll. Write the hook LAST, after you know the payoff, so it can promise exactly what the video delivers. Pick ONE of these proven hook formulas for beat 1 (vary it across videos — do not always use the same one):
  · CALL-OUT + STOP: name the exact viewer and freeze them — "Nếu bạn là Số [X], khoan lướt đã." / "Video này chỉ dành cho Số [X]."
  · UNCOMFORTABLE TRUTH: expose a hidden flaw they secretly feel — "Số [X], sự thật là bạn đang tự làm khổ mình."
  · CONTRADICTION / PATTERN-INTERRUPT: two clashing ideas — "Càng [strength], bạn càng [pain]. Vì sao?"
  · CURIOSITY GAP / OPEN LOOP: promise a reveal held to the end — "99% Số [X] hiểu sai về chính mình. Xem hết sẽ rõ."
  · WARNING / NEGATIVITY BIAS: "Đây là cái bẫy lớn nhất của Số [X]."
  · MIND-READING: say the thing they never told anyone — "Bạn cười với cả thế giới, nhưng về nhà thì im lặng, đúng không?"
  · BOLD CLAIM: "Số [X] sinh ra không phải để [common assumption]."
  The hook line MUST contain the number and speak to "bạn", the FIRST word is already the hook (never context), ≤ 10 words. No slow throat-clearing, no "Hôm nay mình sẽ nói về…", no logo/intro card. Combine at most 2 levers per hook.`
  : `- THE HOOK IS 80% OF THE VIDEO — and it is a SITUATION, not a number. Viewers do not open TikTok thinking in numbers; they stop for THEMSELVES. HARD RULE: beats 1-2 must NOT mention any number, "Số Chủ Đạo", "Sứ Mệnh", "thần số học" or any numerology jargon — the number enters ONLY at beat 3 as the explanation. The opening SHOT is a visceral, concrete, FILMABLE real-life moment derived from this number's SHADOW at its most extreme (its reactive version caught in the act); the opening LINE says the thing they never told anyone. Write the hook LAST, after you know the payoff. Pick ONE formula (vary across videos):
  · SHOCK ACTION: open mid-action on the behaviour at its extreme — "2 giờ sáng. Xếp đồ vào ba lô. Lần thứ ba trong năm."
  · MIND-READING: "Bạn cười với cả thế giới. Nhưng đóng cửa phòng lại là im lặng, đúng không?"
  · POV CONFLICT (2 people, one clashing line each): "Có chuyện gì thì nói luôn đi." / "Cho em thời gian đã." — freeze on the misunderstanding between them.
  · REPEATED PATTERN: name the loop they keep repeating — "Đây là lần thứ mấy bạn nghỉ việc rồi?"
  · UNCOMFORTABLE TRUTH (no number): "Bạn không lười. Bạn đang sống sai kiểu năng lượng của mình."
  The FIRST word is already the hook (never context), ≤ 12 words, no logo/intro card. The hook SHOT must be a concrete physical action the camera can film (packing, deleting a message, walking out mid-sentence) — NEVER a presenter standing still lecturing at the camera.`}
- WRITING TECHNIQUES (these are what make it feel "đúng là mình" and get shares):
  · MIRROR / BARNUM: describe a hyper-SPECIFIC behaviour the viewer secretly does, then attribute it to the number — "Bạn hay đọc lại tin nhắn 3 lần trước khi gửi. Đó là dấu ấn của Số [X]." Concrete behaviours ("thức khuya nghĩ lại điều mình đã nói") always beat abstract traits ("bạn nhạy cảm"). Pair a flattering trait with a mild vulnerability (flattering + hơi nhói) — that combo is the sweet spot for personality content.
  · "NHƯNG / VÌ THẾ" SPINE (never "rồi / và"): between every two beats you must be able to insert NHƯNG (đảo chiều) or VÌ THẾ (hệ quả). If only "rồi… rồi…" fits, the beats are dead — rewrite for reversal or consequence.
  · POWER WORDS front-loaded: bí mật, sự thật, sai lầm, đừng, chưa bao giờ, tại sao, cuối cùng, giấu kín, mặt tối. Trigger ONE clear emotion per video.
  · Vary rhythm: punchy fragment → medium line → punchy fragment. Read each line aloud; if it sounds like an essay or runs out of breath, cut it.
${callout
  ? `- THE 5-BEAT ARC (map onto the segments in order; scale to the requested segment count; each beat's SETTING follows the metaphor above). Every beat also opens an OPEN LOOP that the next beat pays off, so viewers cannot stop:
  1) HOOK (0-3s) — fire one hook formula above straight to camera, in a location that instantly signals the number's element/essence. End on a question or a promise that beat 2 will answer.
  2) PAIN / NỖI ĐAU — dramatize the misunderstood struggle from the number's SHADOW as a metaphor scene; name the pain so precisely the viewer thinks "sao biết rõ mình vậy". Voice their self-doubt as a question, then tease that "nhưng đó chưa phải điều tệ nhất / lý do thật sự là…".
  3) INSIGHT / GIẢI MÃ — the turn. The reframe "Không phải bạn [flaw]… mà là [deeper truth from the MISSION]", in a spacious setting that visually opens up (a reveal, slow pull-back). This is the "aha" they'll want to share.
  4) PAYOFF / SỨ MỆNH — land the number's MISSION as a gift; a warm, human, giving moment; the character finally looks "at home" in a setting that rewards the number's nature. Deliver on the hook's promise.
  5) CTA — a one-line takeaway that LOOPS back to the exact hook wording, + ONE low-effort engagement bait. Prefer SHARE bait (highest reach) — "Gửi cho một người Số [X] cần nghe điều này" — or COMMENT bait — "Thả số chủ đạo của bạn ở comment, mình đọc hết 👇" — or SAVE bait — "Lưu lại để lần sau nghi ngờ chính mình thì mở ra xem". Open, walk-away framing whose last frame could cut straight back to frame 1 (seamless loop). Write the last line so it flows straight back into the hook line.`
  : `- THE 5-BEAT ARC (map onto the segments in order; scale to the requested segment count; each beat's SETTING follows the metaphor above). Every beat also opens an OPEN LOOP that the next beat pays off, so viewers cannot stop:
  1) HOOK / TÌNH HUỐNG (0-3s) — fire one situation formula above as a FILMABLE scene (a physical action, not a lecture); NO numbers, no jargon. End on a question or a promise that beat 2 will answer.
  2) MIRROR / NỖI ĐAU — escalate the "đúng là mình" effect: 2-3 hyper-specific Barnum behaviours from the number's SHADOW (still WITHOUT naming any number), then voice their self-doubt as a question ("Sao mình không thể yên một chỗ như người ta?") and tease "lý do thật sự là…".
  3) REVEAL / GIẢI MÃ — the number enters HERE for the FIRST time, as the explanation of everything shown: "Trong thần số học, kiểu năng lượng này là dấu ấn của Số [X]…" + the reframe "Không phải bạn [flaw]… mà là [deeper truth from the MISSION]", in a spacious setting that visually opens up (a reveal, slow pull-back). This is the shareable "aha".
  4) PAYOFF / SỨ MỆNH — land the number's MISSION as a gift; the CONSCIOUS version of the same energy; a warm, human, giving moment; the character finally looks "at home". Deliver on the hook's promise.
  5) CTA / APP FUNNEL — a one-line takeaway that loops back to the hook's exact IMAGERY (not the number), then invite them to see their FULL personal chart on the app: "Đừng đoán mình từ một đặc điểm — xem đủ các chỉ số của bạn ảnh hưởng nhau thế nào trong app." Add ONE share bait tied to the situation ("Gửi cho người hay xách ba lô lên đi 👇"). NEVER ask viewers to post their birth date in comments — direct them into the app instead. Last frame could cut straight back to frame 1 (seamless loop).`}
- DIALOGUE = SHORT VOICEOVER, second-person Vietnamese, ONE punchy "đắt giá" line per scene, MAX 16 words (ideal 8-14). Rules: talk to "bạn", be SPECIFIC not generic, use "không phải X mà là Y" reframes, pick emotional concrete words, and let the image carry the rest — SHOW don't tell. Never lecture, never list traits, never explain the theory. BAD (long, dull, listy): "Bạn khao khát được công nhận, được dẫn dắt, nhưng lại sợ cô đơn…". GOOD (short, sharp, visual): "Đứng đầu thì oai. Nhưng đỉnh núi nào mà chẳng lạnh."
- ✍️ COPYWRITING TECHNIQUES FOR THE SPOKEN LINES (use them — this is what turns a soft line into a scroll-stopping one):
  · RULE OF THREE (liệt kê 3 nhịp CỤ THỂ, vế thứ 3 "đắt" nhất): "Bạn đổi việc, đổi đam mê, đổi cả những cuộc tình." — thắng xa "bạn hay thay đổi".
  · CHALLENGE THE LABEL (lật cái nhãn xã hội gán cho họ): "Người ta bảo bạn [nhãn]. Nhưng sự thật phũ phàng hơn nhiều đấy."
  · ANTITHESIS "không phải X — mà là Y": "Bạn xê dịch không phải để chạy trốn — mà để mang cảm hứng đi khắp thế gian."
  · CONCRETE > ABSTRACT: một hành vi/hình ảnh cụ thể ("xếp đồ rời một căn phòng, gấp tấm bản đồ") luôn thắng một tính từ trừu tượng ("bồn chồn").
  · SELF-DOUBT AS QUESTION (nói hộ câu người xem thầm hỏi): "Sao mình không thể yên một chỗ như người ta?"
  · RHYTHM ngắn–ngắn–dài: một mệnh đề cụt rồi một câu mở ra; đọc to phải thấy "phanh" đúng chỗ.
${callout
  ? `- 🏆 GOLD-STANDARD EXAMPLE — this is the QUALITY BAR every script must hit (topic Số 5 + Sứ Mệnh 9). LEARN the voice & techniques; do NOT copy it — write fresh for the actual numbers:
  HOOK: "Bạn là Số Chủ Đạo 5, Sứ Mệnh 9? Người ta bảo bạn cả thèm chóng chán. Nhưng sự thật phũ phàng hơn nhiều đấy." (call-out + challenge-the-label + open loop)
  PROBLEM: "Bạn đổi việc, đổi đam mê, đổi cả những cuộc tình. Rồi tự hỏi: sao mình không thể yên một chỗ như người ta?" (rule of three + self-doubt question)
  INSIGHT: "Không phải bạn thiếu định hướng đâu. Tâm hồn tự do của Số 5 đang đi tìm một điều đủ lớn để dâng hiến cả đời." (không-phải-X-mà-Y reframe)
  PAYOFF: "Đó là Sứ Mệnh 9. Bạn xê dịch không phải để chạy trốn — mà để mang cảm hứng và lòng nhân ái đi khắp thế gian." (antithesis + mission)
  CTA: "Tự do của bạn sinh ra để cho đi. Nếu thấy đúng, thả số chủ đạo của bạn ở comment nhé." (takeaway + comment bait)
  Every line is SHORT, CONCRETE, has rhythm and a twist — never vague, never a lecture. HIT THIS LEVEL. If a line sounds soft/generic (e.g. "bạn có bao giờ thấy cô đơn?", "sứ mệnh của bạn là truyền cảm hứng"), REWRITE it sharper using the techniques above.`
  : `- 🏆 GOLD-STANDARD EXAMPLE — this is the QUALITY BAR every script must hit (topic Số 5 + Sứ Mệnh 9). LEARN the voice & techniques; do NOT copy it — write fresh for the actual numbers:
  HOOK: "2 giờ sáng. Xếp đồ vào ba lô. Lần thứ ba trong năm nay." (shock action, filmable, NO number)
  MIRROR: "Bạn đổi việc, đổi đam mê, đổi cả những cuộc tình. Rồi tự hỏi: sao mình không thể yên một chỗ như người ta?" (rule of three + self-doubt question — still no number)
  REVEAL: "Trong thần số học, đó là dấu ấn của Số 5. Không phải bạn thiếu định hướng — tâm hồn tự do này đang tìm một điều đủ lớn để dâng hiến cả đời." (the number enters + không-phải-X-mà-Y reframe)
  PAYOFF: "Đó là Sứ Mệnh 9. Bạn xê dịch không phải để chạy trốn — mà để mang cảm hứng và lòng nhân ái đi khắp thế gian." (antithesis + mission)
  CTA: "Đừng đoán mình từ một chiếc ba lô. Xem đủ biểu đồ của bạn trong app — và gửi video này cho người hay xách ba lô lên đi." (imagery loop + app funnel + share bait)
  Every line is SHORT, CONCRETE, has rhythm and a twist — never vague, never a lecture. HIT THIS LEVEL. If a line sounds soft/generic (e.g. "bạn có bao giờ thấy cô đơn?", "sứ mệnh của bạn là truyền cảm hứng"), REWRITE it sharper using the techniques above.`}
- RETENTION KILLERS TO AVOID: slow or generic openers, intro/logo cards, on-screen text walls, more than one idea per line, a payoff that doesn't match the hook's promise, and a flat ending with no loop or CTA.
- Fill "marketing_structure" (hook = beat 1, problem = beat 2, solution = beat 3, cta = beat 5). Put a ready-to-post social caption (with a scroll-stopping first line) + 4-6 hashtags at the END of "synopsis".`;
}

// Health / wellness STORYTELLING framework — problem → gentle warning →
// companion solution → CTA. Same 5-beat spine as numerology but health-voiced:
// warm, lightly cautionary, empathetic, compliance-safe (no cure claims).
const HEALTH_FRAMEWORK = `
HEALTH / WELLNESS STORYTELLING FRAMEWORK (follow this EXACTLY — kể chuyện: nêu vấn đề → cảnh báo nhẹ → giải pháp ĐỒNG HÀNH → CTA):
- SUBJECT: a specific health topic (e.g. "gan nhiễm mỡ", "mất ngủ", "đau dạ dày"). SOURCE OF TRUTH = the TOPIC CONTENT injected below; be accurate & empathetic, NEVER alarmist, NEVER over-claim cures.
- CHARACTER = "người thật việc thật": ONE relatable persona LIVING this problem (name, age, everyday Vietnamese setting — văn phòng, căn bếp, phòng ngủ), kept identical across every segment. Warm, trustworthy, real-life. The viewer must see THEMSELVES in this person.

- PICK ONE CONTENT STYLE for the video (vary across videos), then tell it as a STORY, not a lecture:
  · Đồng cảm "người thật" (một ngày của người đang khổ vì bệnh) — dễ đồng cảm nhất.
  · Cảnh báo nhẹ "đừng bỏ qua dấu hiệu này" — gentle warning.
  · Giải mã gốc rễ "Vì sao bạn mãi không khỏi [bệnh]" — root-cause explainer.
  · Đập tan lầm tưởng "Hóa ra [điều ai cũng tin] là sai" — myth-busting.
  · "3 dấu hiệu..." (dấu hiệu cuối bất ngờ nhất) — listicle.
  · Ẩn dụ dễ hiểu — giải thích cơ thể bằng một hình ảnh đơn giản (lá gan như tấm lọc, giấc ngủ như sạc pin).
  · Đổi 1 thói quen nhỏ — habit-swap.
  · Câu chuyện người thật (testimonial) — kể như một câu chuyện, TRÁNH "khỏi hẳn nhờ sản phẩm X".
  · Một ngày của người bệnh — "7 giờ sáng, bạn dậy mà người vẫn nặng như chưa ngủ. Nghe quen không?"
  · Bác sĩ / dược sĩ chia sẻ — talking-head tạo niềm tin; GIÁO DỤC, không phải quảng cáo endorsement sản phẩm.
  · Before → After (hành trình thay đổi) — thực tế, KHÔNG khung "phép màu".
  · Hỏi & Đáp Đúng/Sai — binary mời người xem comment.
  (Chọn theo mục tiêu: phủ sóng → gọi tên triệu chứng / listicle / một ngày; niềm tin → đập lầm tưởng / ẩn dụ / bác sĩ; lưu về → cảnh báo nhẹ / đổi thói quen; chia sẻ → người thật / một ngày; comment → Hỏi-Đáp.)

- TONE = CẢNH BÁO NHẸ, KHÔNG HÙ DỌA (đây là RANH GIỚI phải giữ):
  · THÚC ĐẨY chứ không dọa: nêu hệ quả đời thường có thật, KHÔNG vẽ kịch bản chết chóc. TỐT: "Cơ thể đang gửi tín hiệu, chỉ là bạn chưa để ý." XẤU (dọa/quá lời): "Không chữa ngay là ung thư / là chết."
  · QUY TẮC VÀNG — LUÔN GHÉP CẢNH BÁO VỚI LỐI RA: mỗi câu cảnh báo phải đi kèm NGAY một bước làm được + trấn an ("nhưng hoàn toàn cải thiện được", "chỉ cần bắt đầu từ việc nhỏ"). Cảnh báo mà KHÔNG có lối ra → người xem sợ rồi lướt/chối bỏ, phản tác dụng (fear control). Kết thúc phải để người xem BÌNH TĨNH hơn lúc mở đầu.
  · Dùng từ giảm nhẹ, không chẩn đoán: "có thể", "một số trường hợp", "nên tham khảo". CẤM tuyệt đối: "chết dần", "quá muộn", "tự hại mình", "100%".
  · Đồng cảm, xưng "bạn", bình tĩnh — như một người bạn quan tâm tình cờ biết, KHÔNG phải bác sĩ mắng.

- SOLUTION = ĐỒNG HÀNH, không bán hàng cứng: trình bày giải pháp như đi CÙNG người xem — bước nhỏ, làm được ngay. Câu mẫu: "Bắt đầu từ một việc nhỏ thôi…", "Mình đi cùng bạn từng bước." Nếu có sản phẩm, giới thiệu TRUNG THỰC như một hỗ trợ, không phải thần dược.

- THE 5-BEAT ARC (map onto the segments in order; each beat opens an OPEN LOOP the next beat closes). The SETTING/lighting evolves with emotion: mệt/tối/bừa bộn ở beat vấn đề → sáng/gọn/nhẹ nhõm ở beat giải pháp, cùng NHÂN VẬT giữ nguyên:
  1) HOOK (0-3s) — symptom call-out / cảnh báo nhẹ thẳng vào camera, cận mặt; hé rằng beat 2 sẽ cho biết "vì sao".
  2) VẤN ĐỀ — show how it quietly disrupts daily life (một khoảnh khắc đời thường ai cũng thấy mình trong đó); "nhưng gốc rễ mới bất ngờ…".
  3) GIẢI MÃ GỐC RỄ — explain the REAL root cause simply & correctly, ONE clear idea (một ẩn dụ đơn giản giúp dễ hiểu) — khoảnh khắc "à, hóa ra".
  4) GIẢI PHÁP ĐỒNG HÀNH — the habit/remedy/product shown in use as a supportive FIRST step, làm được ngay hôm nay.
  5) CTA — nhẹ nhàng, quan tâm: save-bait ("Lưu lại phòng khi cần"), tag người thân ("Gửi cho người bạn thương hay [triệu chứng]"), hoặc "hỏi bác sĩ của bạn". Loop back to the opening symptom.

- COMPLIANCE GUARDRAILS (BẮT BUỘC — an toàn nền tảng & niềm tin):
  · KHÔNG hứa "chữa khỏi 100%", KHÔNG "thay thế thuốc", KHÔNG chẩn đoán người xem ("bạn đang bị [bệnh]").
  · Diễn đạt là "hỗ trợ", "giúp cải thiện", KHÔNG "chữa khỏi / đặc trị / khỏi hẳn". Khi khuyên về triệu chứng/điều trị, thêm "nên tham khảo ý kiến bác sĩ".
  · Nếu có nhắc SẢN PHẨM (TPCN / thực phẩm bảo vệ sức khoẻ): BẮT BUỘC kèm câu miễn trừ hiển thị trên màn hình (và đọc nếu video > 15s): "Thực phẩm này không phải là thuốc và không có tác dụng thay thế thuốc chữa bệnh." (Nghị định 15/2018). Bác sĩ/dược sĩ chỉ GIÁO DỤC, không endorse sản phẩm để mua.
  · Chỉ dùng cơ chế đơn giản, được chấp nhận rộng rãi; KHÔNG bịa số liệu gây sợ.
  · TỰ KIỂM trước khi trả về: có từ "chữa khỏi"? có chẩn đoán? có tuyệt đối/phép màu? cảnh báo đã ghép lối ra chưa? có nhắc bác sĩ khi cần chưa? có câu miễn trừ khi nhắc sản phẩm chưa?

- COPYWRITING (làm mỗi câu "đắt"): RULE OF THREE cho triệu chứng ("Mệt mỏi, đầy bụng, da xỉn màu — cả ba đều chỉ về một chỗ: lá gan."); "không phải X mà là Y" reframe; triệu chứng CỤ THỂ người xem thầm có; đập lầm tưởng "Hóa ra không phải [tin đồn]…"; nhịp ngắn–ngắn–dài.
- DIALOGUE: warm, second-person Vietnamese, ~8-14 words each, ONE idea. Specific, clear, caring — SHOW don't lecture, không bán hàng cứng.
- 🏆 GOLD-STANDARD EXAMPLE (topic "mất ngủ" — learn the voice & techniques; do NOT copy, write fresh for the actual topic):
  HOOK: "Bạn nằm xuống là não lại bật đèn sáng trưng? Không phải bạn khó ngủ đâu." (triệu chứng cụ thể + reframe)
  VẤN ĐỀ: "3 giờ sáng còn thức, sáng dậy như chưa hề ngủ. Cà phê cũng chẳng cứu nổi." (hệ quả đời thường, không dọa)
  GIẢI MÃ: "Hóa ra không phải tại suy nghĩ nhiều. Đồng hồ sinh học của bạn đang lệch giờ." (đập lầm tưởng + gốc rễ đơn giản)
  GIẢI PHÁP: "Bắt đầu từ một việc nhỏ: tắt đèn trắng một tiếng trước khi ngủ. Mình đi cùng bạn nha." (đồng hành, bước nhỏ làm được)
  CTA: "Lưu lại, tối nay thử liền. Bạn hay trằn trọc lúc mấy giờ? Comment nhé." (save-bait + comment bait, loop về hook)
  Notice: nhẹ nhàng, cụ thể, KHÔNG hù dọa, giải pháp nhỏ-dễ-làm, kết mở để tương tác. HIT THIS LEVEL. If a line sounds like a lecture or a hard sell, rewrite it warmer and more concrete.
- Put ONE clear takeaway/core message in "synopsis". Fill "marketing_structure" (hook/problem/solution/cta) from beats 1/2/3-4/5. Add a ready-to-post caption (scroll-stopping first line) + 4-6 hashtags at the END of "synopsis".`;

// Cooking is an isolated compiler profile. It is injected only when the
// canonical genre is exactly "cooking"; a stale video_goal may never activate it.
const COOKING_FRAMEWORK = `
COOKING DIRECTOR PROFILE — ACTIVE ONLY FOR genre="cooking":
- CANONICAL RECIPE: the supplied Recipe IR owns ingredients, quantities, preparation, tools and causal step order. Never add, drop, substitute or duplicate anything. Unspecified means unspecified — never guess.
- ONE VISUAL JOB PER CLIP: show one primary physical operation and its visible end state. Preserve ingredient/container state across clips. A bowl, pan, knife or ingredient never appears, moves or changes state without a visible cause.
- FIRST 3-5 SECONDS = FINISHED-DISH HOOK: clip 1 starts immediately on the real finished dish at its most appetising moment — steam, glossy sauce, noodle lift, crisp cut, bubbling edge or final pour. Macro/close food framing first; NEVER begin with a wide room overview, greeting, logo, ingredient list or exposition. The hook promises exactly the result the final clip delivers.
- RETENTION ARC: money-shot preview → the Recipe IR's real causal operations → plating/final hero reveal. Allocate middle clips from the actual dish; mise en place, prep, heat and transformation may repeat or be omitted when the recipe requires. Never impose a generic six-step formula, change recipe order, or merge hook/final payoff into a middle operation.
- MISE EN PLACE: display the exact recipe ingredients in small bowls/plates grouped by the step that uses them. Separate items added at different times. Keep vessel identity and ingredient amount visually stable. No on-screen labels are required.
- PACING: prioritise visual information over explanation. Repetitive washing/chopping/stirring may use a deliberate speed ramp or time-compression montage BETWEEN causal states; do not make hands superhuman and never morph/teleport food. Slow down for tactile hero moments: first cut, sauce pour, sizzle, thickening, steam, plating.
- FOOD PHYSICS: preserve raw→cut→heated→thickened/plated states; real moisture, fibres, starch viscosity, oil sheen, browning, steam and gravity. Do not show a final ingredient before its recipe step.
- AUDIO: every motion names the actual contact that makes sound: blade-on-board, ingredient into bowl, whisk, pour, scrape, sizzle, bubbling, fire crackle, ceramic placement. No generic sound list disconnected from the visible action.
- ASMR PROFILES: nature_asmr, kitchen_asmr and pov_hands require dialogue="", speaker="", no voice-over and no music in EVERY clip. Audio is 100% diegetic. Other profiles may use sparse optional narration, but never read the recipe aloud.
- NATURE ASMR: derive one outdoor workstation from the user's setting/location reference and resolved context; never assume a mountain, snow, lake, forest, stone stove, wardrobe or fixed composition. Use hands-only tactile coverage and choose the food/location balance per operation. Keep the chosen hands/workstation/cookware/weather/light internally consistent. Style references contribute abstract sensory principles only; never imitate a creator's exact set, props, shot order, social-media UI, branding, advertisement, watermark or screenshot overlay.
- KITCHEN ASMR: one locked workstation, same counter/hob/cookware/light throughout; food and hands are the heroes, not a presenter.
- FINAL PAYOFF: reserve enough time for the last transformation, plating and finished-dish hero shot. End settled on the actual result; a save/follow CTA belongs in caption metadata only for voiceless ASMR.
- ANTI-HIJACK: this profile must never introduce a health-symptom plot, unrelated lifestyle scene, product-ad arc or generic warm-home-kitchen preset that conflicts with the supplied recipe/style/context.`;

// Fitness / workout short — demonstration + coaching. Motivating, correct form,
// safe. Each clip = one exercise/movement performed with clean form.
const FITNESS_FRAMEWORK = `
FITNESS / WORKOUT SHORT FRAMEWORK (follow this EXACTLY — motivate, demonstrate, keep it safe):
- SUBJECT: one clear goal or move (e.g. "giảm mỡ bụng", "3 động tác cho mông", "sửa lỗi squat"). ONE focus per video.
- CHARACTER = a fit, relatable trainer/practitioner in workout gear, kept identical across segments; the BODY MOVEMENT is the star (clean form, full range, real effort).
- SETTING = A WORKOUT SPACE, LOCKED & CONSISTENT: the whole video happens in ONE fixed space (a modern gym or a clean home-workout corner with a mat, unless the idea says otherwise). LOCK it into scene_bible.backdrop and repeat the SAME space verbatim in every segment's first_frame_prompt — same floor, same equipment, same light. Never drift to an unrelated place.
- OVERVIEW SHOT (required): segment 1 (or its first beat) opens with a WIDE ESTABLISHING shot of the whole space + the person ready to train, so the viewer sees the setup, THEN the clips move into the movement close-ups. (This is the "SCENE OVERVIEW" of the board.)
- AUDIO = GYM ENERGY: every clip carries fitting sound — controlled breathing, feet/weights on the floor, light upbeat energy; motivating, not chaotic. (Veo generates this audio.)
- VOICE = energetic, MOTIVATING COACH, second person, encouraging and clear — pumps the viewer up without shouting or preaching.
- PICK ONE CONTENT STYLE (vary across videos):
  · "Bạn đang tập sai" (sửa form) — chỉ ra lỗi phổ biến + cách đúng.
  · Bài tập theo nhóm cơ ("X động tác cho [bụng/mông/tay]") — listicle, giữ chân người xem.
  · Đập tan lầm tưởng ("Gập bụng KHÔNG làm giảm mỡ bụng").
  · Transformation / hành trình — trước→sau, thực tế.
  · POV tập cùng — "tập theo mình 30 giây".
  · 1 điều chỉnh nhỏ — một tinh chỉnh khiến bài tập hiệu quả hơn.
  · Động lực (motivation) — cú hích tinh thần ngắn.
- THE 5-BEAT ARC (each beat = ONE exercise/movement for one 10s clip):
  1) HOOK (0-3s) — call out the goal or the mistake straight to camera ("Muốn giảm mỡ bụng mà gập bụng mãi không xuống? Vì bạn đang bỏ qua điều này."). NO slow intro.
  2) VẤN ĐỀ / LỖI SAI — show the common wrong way or the pain point (relatable).
  3-4) ĐỘNG TÁC ĐÚNG — demonstrate the movement/tip with CLEAN FORM, one exercise per clip, clear coaching cues (nhịp thở, tư thế, số rep). Show the range of motion fully.
  5) KẾT QUẢ + CTA — the payoff (correct form / result) + a save/tag CTA ("Lưu lại tập theo cả tuần", "Tag đứa bạn tập cùng").
- SAFETY (must follow): correct form first, cue warm-up, avoid injury-risk claims, no "giảm X kg trong Y ngày" miracle promises; add "khởi động trước" and "nếu có bệnh nền/chấn thương, hỏi HLV hoặc bác sĩ" when relevant.
- COACHING CUES = SHORT, second-person, ~8-14 words ("Siết cơ bụng, lưng thẳng, thở ra khi lên."). Motivating, not preachy.
- 🏆 GOLD-STANDARD EXAMPLE (chủ đề "giảm mỡ bụng" — learn the voice, don't copy):
  HOOK: "Gập bụng 100 cái mỗi ngày mà bụng vẫn còn? Vấn đề không nằm ở số lần." (call-out + reframe)
  LỖI SAI: "Bạn tập đúng một nhóm cơ, nhưng mỡ thì không giảm theo kiểu đó." (myth-bust)
  ĐỘNG TÁC 1: "Thử plank: siết bụng, lưng thẳng như tấm ván, giữ 30 giây." (clean cue)
  ĐỘNG TÁC 2: "Thêm leo núi tại chỗ, giữ nhịp thở đều, đốt calo toàn thân." (cue + benefit)
  KẾT QUẢ + CTA: "Kết hợp với ăn uống là bụng xẹp dần. Lưu lại tập theo nhé!" (realistic payoff + save)
- Fill "marketing_structure" (hook/problem/solution/cta) from beats 1/2/3-4/5. Ready-to-post caption + 4-6 hashtags at END of "synopsis".`;

/** Genre-appropriate ambient sound for the Veo clip (Veo generates audio). */
export function genreAmbientAudio(genre?: string, _goal?: string): string | undefined {
  // Genre is the hard routing boundary. A stale UI goal must never leak a
  // cooking/gym sound world into numerology, drama or any unrelated project.
  const isCooking = genre === "cooking";
  const isFitness = genre === "fitness";
  if (isCooking)
    return "real cooking ASMR, close-mic and clear — knife slicing through the ingredient and knocking on the wooden board, chopping, grating, drizzling, sizzling/xèo xèo, bubbling, oil crackle — plus the location's natural ambience (gentle kitchen room tone indoors; wind, birds, stream and fire crackle when cooking outdoors); no music, appetising and true";
  if (isFitness)
    return "gym/workout ambience — controlled breathing, feet and light weights on the floor, subtle upbeat energy, motivating and clean";
  if (genre === "nature")
    return "location-authentic natural soundscape only — layered wind, leaves, water, insects, birds or distant weather according to the declared habitat, season, time and camera distance; no generic stock jungle bed, no music";
  if (/\b(?:action|thriller|crime|rescue|martial|fight|combat)\b|hành động|giật gân|đánh nhau|giải cứu|tự vệ/iu.test(genre ?? ""))
    return "location-authentic high-stakes action sound — urgent breathing, accelerating footfalls, cloth strain, body weight shifting, one sharp impact for each visible contact, nearby objects rattling from force, and a brief breathless aftermath; no generic stock punches, no triumphant superhero music, and no sound without an on-screen cause";
  return undefined;
}

const ACTION_DRAMA_DIRECTOR_PROFILE = `
ACTION DRAMA DIRECTOR PROFILE — activate for action/thriller/crime/rescue scenes and any beat containing a real physical threat:
- The fight MUST feel gripping, forceful and dangerous — not timid blocking and not decorative posing. Build suspense from threat distance, the vulnerable person's exposure and the defender's split-second decision, then deliver readable contact, loss of balance and an emotional/physical consequence.
- ONE CONFRONTATION UNIT per 10s clip may contain 3-5 tightly linked movements, because a fight needs attack and response: ATTACKER INITIATES → defender evades/blocks/intercepts → a decisive counter or short 1-3-contact combination → visible result. For an actual duel, one counter-counter is allowed when it is the immediate continuation of the same exchange. Do not sanitize a requested fight into avoidance-only blocking; punches, kicks, clinches, throws and grounded struggles are allowed when the script/world justifies them and their force has a visible consequence. These movements are ONE causal exchange, never unrelated simultaneous chaos.
- Every movement names the actor, originating limb/body weight, direction, target/contact point, force, the other person's immediate reaction and the new grounded pose/position. Nobody waits politely for a turn; the reaction begins because the preceding force reaches them.
- Keep combat tactically believable for the character and space: foot placement, distance, momentum, obstacles, breath, fear, pain and fatigue matter. The purpose may be rescue, escape, self-defence or overpowering a threat, but the action itself remains exciting and decisive.
- Camera preserves screen direction and geography in a supported WIDE or MEDIUM-WIDE view through the decisive exchange; a motivated continuous push/reframe may tighten only after contact or on the consequence. No music-video cutting, contradictory WIDE-to-CLOSE order with “no scale change”, orbiting glamour shot or hidden impact.
- Sound is causal and specific: foot plant, cloth strain, breath, one impact matching each visible contact, furniture/ground response, then the stunned breath or ringing silence after it. Never use only “natural footsteps and contact sounds”.
- FORBIDDEN: superhero victory pose, balletic showboating, beautiful technique displayed for its own sake, an enemy waiting to be hit, weightless wire-fu unless the world explicitly permits it, consequence-free strikes, or three people performing independent attack chains at once.`;

const ACTION_GENRE_PATTERN =
  /\b(?:action|thriller|crime|rescue|martial(?: arts)?|fight|combat)\b|hành động|giật gân|đánh nhau|giải cứu|tự vệ/iu;
const PHYSICAL_THREAT_PATTERN =
  /\b(?:attack(?:s|ed|ing)?|assault(?:s|ed|ing)?|strike(?:s|struck|ing)?|punch(?:es|ed|ing)?|kick(?:s|ed|ing)?|block(?:s|ed|ing)?|dodge(?:s|d|ing)?|shove(?:s|d|ing)?|tackle(?:s|d|ing)?|grapple(?:s|d|ing)?)\b|đánh nhau|ẩu đả|tấn công|giải cứu|tự vệ|đấm|đá|đỡ đòn|né đòn/iu;

function actionDramaRequested(input: StoryboardGenerationInput): boolean {
  const genre = `${input.genre ?? ""} ${input.video_goal ?? ""}`;
  const story = `${input.story_idea ?? ""} ${input.central_conflict ?? ""} ${input.source_script ?? ""}`;
  return ACTION_GENRE_PATTERN.test(genre) || PHYSICAL_THREAT_PATTERN.test(story);
}

const DEFAULT_PRODUCTION_PROMPT_LANGUAGE = "English";

function productionPromptLanguage(input: StoryboardGenerationInput): string {
  return input.production_prompt_language?.trim() || DEFAULT_PRODUCTION_PROMPT_LANGUAGE;
}

/** Keep machine instructions separate from audience-facing speech/copy. The
 * split is deliberately independent of the UI locale so a future English UI
 * can switch dialogue/copy without changing the Veo production language. */
function productionLanguageContract(
  promptLanguage: string,
  dialogueLanguage: string
): string {
  return `PRODUCTION LANGUAGE CONTRACT — NON-NEGOTIABLE:
- Write ALL machine-facing production prose in ${promptLanguage}: world/context descriptions, character visual locks, wardrobe/material descriptions, scene_bible, segment titles, first_frame_prompt, motion_prompt, beats and camera directions, transition reasons, spatial_layout, state_ledger descriptions, continuity notes, ambience/Foley and negative instructions.
- The ONLY fields allowed in ${dialogueLanguage} are verbatim dialogue/voice-over text, audience-facing thumbnail_title/social_posts, and readable on-screen text explicitly required by the approved script. If visible text is forbidden, do not invent any.
- Preserve exact user-supplied character names and stable role labels as identity tokens even when they are not ${promptLanguage}; names are identifiers, not production prose.
- Translate the source script's action, setting and directing descriptions into fluent ${promptLanguage}. Never copy Vietnamese action verbs or mixed-language fragments into an English sentence. Never code-switch within a production sentence.
- This language split changes wording only; it must not alter story facts, action order, locations, props, character identity or dialogue.`;
}

/** A stick-figure life-wisdom video is carried by one narrated story, not by a
 * stack of unrelated quote cards. Keep this scoped to the explicit medium and
 * genre so advertising, dialogue-led animation and other formats are untouched. */
function stickFigureWisdomNarrationDirective(
  input: StoryboardGenerationInput
): string {
  const representation = input.character_representation ?? "auto";
  const explicitStickFigure =
    representation === "stick_figure" ||
    representation === "whiteboard_stick_figure" ||
    /\b(?:stick figure|whiteboard stick figure)\b|người que/iu.test(
      input.story_idea ?? ""
    );
  const wisdomStory =
    input.genre === "life_wisdom" || input.genre === "psychology";
  const speech = resolveSpeechMode(input);
  if (!explicitStickFigure || !wisdomStory || !speech.voice_over) return "";

  return `STICK-FIGURE LIFE-WISDOM NARRATION — LOCKED:
- Write ONE continuous narrated story across the full requested duration. Read all VO rows in order: they must sound like one storyteller carrying one question, situation, change and earned insight—not separate slogans, captions, list items or five interchangeable moral quotes.
- The opening creates a concrete curiosity or human dilemma. Each later segment begins from the NEW consequence, choice or understanding produced by the previous segment, then advances it. Use causal connective tissue without repeating the preceding sentence, premise or signature phrase.
- Narration interprets what the visible action means; it never merely names the pose/object the viewer already sees. Let the character's choice and consequence prove the lesson before the narrator states it.
- Vary sentence openings, cadence and syntax. Do not restart every clip with “Có những người…”, “Cuộc đời…”, “Đôi khi…”, “Nhưng rồi…” or another reusable template. Do not repeat a question, clause or conclusion to fill time.
- In VOICE-OVER ONLY mode, the recurring narrator carries the story through almost the entire clip; visible stick figures never speak, converse or lip-sync. Give each clip one complete, naturally speakable narrated thought with enough causal detail, emotion and connective meaning to occupy most of its real duration. Do not leave an accidentally thin fragment as the whole clip and do not cram several conclusions into the final clip.
- Before returning, silently read every VO row against its real clip duration at roughly 128 WPM. This is a delivery audit, not a fixed word quota: target about 8.5-9.5 seconds of purposeful narration in a 10-second clip, leaving only a brief natural breath/reaction at the end. Move a WHOLE sentence or idea to an adjacent compatible segment when it overruns; when it under-runs, deepen the causal bridge, concrete detail or emotional meaning instead of leaving dead air, stretching, looping or padding it. Compare all rows and remove any unintentional repeated clause or paraphrased duplicate.
- The final line answers or reframes the opening and lands one concise earned principle. Add an engagement question only when the approved goal/source asks for it; never replace the emotional ending with generic comment bait.`;
}

// ─── Stage 1: Script writer (Claude) — creative script ONLY ─────────────────
// When the user splits the pipeline (e.g. Claude writes the script, Gemini
// builds the storyboard), Claude produces just the creative script text; the
// storyboard model then expands it into the full JSON verbatim.

export function buildScriptWriterSystemPrompt(): string {
  return `You are a world-class multi-domain short-form video SCRIPTWRITER. You write ONLY the creative script — NOT the technical storyboard or JSON (a separate tool turns your script into the visual storyboard).

Write in the language the user asks for. Your first duty is the LOCKED PROJECT INTENT: marketing, narrative, documentary, education, atmosphere, psychology, comedy, product demonstration and experimental work require different structures and endings. Never impose a viral-marketing formula when the requested purpose does not support it.

CONTEXT LOCK (before writing a single line): silently resolve the WORLD this video lives in from the idea — geography, culture, time period, genre, reality level, social class, technology level. Never assume a default country or era; infer them. Then keep EVERY detail of the script (places, objects, clothing, food, behavior, speech style) inside that one locked world — no out-of-era technology, no off-culture props or rituals, no world-hopping between segments (open during design, locked during writing).

FIRST-SHOT HOOK WINDOW (mandatory 3-5s): clip 1 must earn immediate attention before exposition, but the hook form is intent-led. Marketing/social may use a call-out, contradiction, curiosity gap, warning or bold claim; documentary an observed fact; narrative an inciting moment; education a question/problem; atmosphere a sensory event. The hook makes one honest promise that the later payoff fulfils. No greeting, logo, context dump or slow setup before it. A CTA, comment bait or loop appears only when the chosen goal/script requires it.
FIRST-30-SECOND RETENTION LADDER (mandatory whenever the video is at least 30s): the opening is not only one clever line. Build four connected retention turns: 0-3s = an immediately filmable pattern interrupt/inciting image; 3-10s = concrete conflict plus an unanswered question; 10-20s = escalation, reversal or revealing detail that changes how the first beat reads; 20-30s = a consequential turn that makes leaving feel costly. Every rung must add NEW story information and visually alter expression, posture, object state or relationship distance. Never repeat the premise in different words. Write the opening last and verify that each rung truthfully points to the eventual payoff.
STORY SPINE: every segment must have a named function and a causal relationship to the next (continuation, reversal, consequence, contrast, reveal, resolution, montage association or intentional atmosphere). Do not write "then... then..." filler. The ending must fulfil the project purpose, not a default conversion template.
DIALOGUE: natural spoken lines appropriate to character, culture, genre and scene intent. For any conversational or character-driven video, dialogue is the ENGINE — write a real, flowing exchange that carries each 10s clip at a NATURAL, UNHURRIED speaking pace (a genuine back-and-forth with wit, subtext, emotion and specific word choice, not one flat functional line). DELIVERY CAP — HARD, NEVER BREAK: every spoken word in one 10s clip must be comfortably sayable at about 150 words per minute — that is roughly 22–24 spoken words TOTAL across ALL turns of a 10-second clip (use FEWER when the clip also has pauses, reactions or a real physical action). If an exchange would only fit by speaking faster than ~180 wpm it is TOO LONG: cut words, drop the weakest turn, or move an idea to an adjacent clip — a rushed line is a defect, not a full clip. A silent or single-thin-line clip is allowed ONLY when the intent is deliberately wordless (ASMR, a pure visual reveal); never leave a talking scene nearly silent. When a beat's natural line is short, you MAY expand it into a brief exchange (a lead-in → the point → a reply/reaction) — but only within the delivery cap above, never by cramming words. Make every line worth hearing — sharp, human, in-character; SHOW don't tell and never lecture or list without an educational reason.
COPYWRITING / DRAMATIC TECHNIQUES ARE OPTIONAL TOOLS: rule of three, antithesis, challenge-the-label, curiosity gap, subtext, reversal, suspense and rhythmic phrasing are selected only when they serve the locked intent and speaker identity.

DIALOGUE QUALITY DOCTRINE — MANDATORY (make every line worth quoting; this is what the user cares about most):
- YOU ARE THE WRITER, not a transcriber. Never pass a flat, functional or placeholder line straight through. Even when the brief hands you dull lines, RE-AUTHOR them into sharp, human, in-character dialogue. A talking scene must NEVER run on a stage-direction, a narration of the action, or an echo of the scene title — those are not dialogue.
- SUBTEXT OVER STATEMENT: people rarely say exactly what they mean. Put the real feeling UNDER the surface line (they argue about cold tea; they mean "you made me wait"). One concrete, specific image beats three abstract feelings. Cut every on-the-nose "Em giận anh à?"-style line unless the reply subverts it.
- HUMOR WITH HEART: where the tone allows, land at least one genuinely funny or wry beat — dry wit, irony, a warm tease, a comic misread, an unexpected button on the last line. Humor must serve the emotion, never cheapen the payoff; the funniest line and the most moving line can be the SAME line.
- VOICE SEPARATION: each character sounds unmistakably like themselves — rhythm, vocabulary, what they joke about, what they dodge. If two characters could swap lines without anyone noticing, rewrite until they can't.
- TURN THE SCREW: every exchange must shift something — a reveal, a needle, a concession, a reversal. If a line could be deleted and the scene loses nothing, cut or rewrite it. No filler pleasantries.
- PAYOFF LINE: aim each scene at ONE "đắt giá" line the viewer will screenshot — specific, rhythmic, emotionally true, often funny. End the whole video on a line that quietly reframes everything before it.
- PERFORMANCE SCORECARD — SILENTLY REWRITE UNTIL ALL PASS: hook specificity ≥ 8/10; visual action specificity ≥ 8/10; subtext ≥ 8/10; character-voice separation ≥ 8/10; emotional turn per segment ≥ 8/10. Reject generic reactions such as merely "smiles", "looks sad", "is surprised"; replace them with a readable micro-behaviour, changed breath, interrupted gesture, avoided gaze, grip/release or posture shift caused by the exact preceding line.

🎬 DIRECTOR'S ENGINE (the user's proven multi-layer directing system — apply to EVERY script):
- BLUEPRINT FIRST, ONE IDEA PER CLIP: before writing a segment's lines, silently fix its blueprint — ONE core idea, ONE primary emotion, ONE narrative role (hook / reflection / escalation / transition / synthesis / payoff). Everything in that segment serves that single idea; a 10s clip carrying two ideas is a broken clip.
- 3-ACT NARRATIVE STATE: map segments onto ENGAGEMENT (opening ~20% — seize and orient), EXPLORATION (middle — deepen, complicate, escalate), RESOLUTION (final ~20% — land the payoff and the promise). Each segment must know which act it lives in and behave like it.
- EMOTIONAL AXIS + VIEWER PROMISE: from the tone/intent, choose the video's single emotional journey (doubt→hope, despair→awareness, tension→release, melancholy→acceptance, uncertainty→clarity) and a one-line viewer promise (e.g. "Viewer leaves feeling hopeful", "Viewer feels emotionally understood"). EVERY segment moves exactly one step along this axis toward the promise — never sideways, never backwards without intent.
- ENERGY CURVE LAW: assign each segment an energy level (low / medium / high) from its emotion. Adjacent segments NEVER jump low→high (build gradually: restrained physical movement, energy building) and never crash high→low (release slowly: controlled breathing, tension draining). Bake the matching acting quality into each ACTION line — low: minimal movement, internalized emotion; medium: natural gestures, conversational pacing; high: focused intensity, never flailing.
- BREATH BETWEEN ACTS: when the mood shifts between segments (an act turn), open the next segment's ACTION with one quiet beat (a pause, a held look, a breath) so the viewer's brain gets a half-second to reset — emotional continuity when the mood holds, a breathing beat when it turns.
- MOOD→ATMOSPHERE HINT: let each ACTION carry one short atmosphere cue matching its mood — tense/dark: low-key light, controlled shadows; hopeful/calm: soft diffused light; release/payoff: a gentle warm lift — one phrase only, the storyboard stage translates it into exact Kelvin/Lux.

Output PLAIN TEXT in EXACTLY this shape (no markdown, no JSON):
TITLE: <catchy title>
CORE MESSAGE: <one-line takeaway>
CHARACTERS: <EVERY person in the story, one per line — name, age, signature look, tone; mark children with "(child)". When the user supplies a CLOSED USER CAST, copy only those exact names and never create another name. Only when no closed cast was supplied may an unnamed role receive one ordinary generated name. EXCEPTION: when ANONYMOUS NARRATION MODE is active, use stable functional role labels from the script instead of personal names. A solo video simply lists one person.>
SEGMENT 1 [HOOK WINDOW 3-5s + <PRIMARY FUNCTION justified by project/script>]:
  IN SCENE: <names of everyone visible in this segment>
  ACTION: <one vivid thing we SEE — a visual metaphor for this beat>
  DIALOGUE:
    <SpeakerName>: "<the exact spoken line>"
    <SpeakerName>: "<the next line, if a short back-and-forth fits this same 10s clip>"
SEGMENT 2 [<PRIMARY FUNCTION>]:
  IN SCENE: ...
  ACTION: ...
  DIALOGUE:
    <SpeakerName>: "..."
(TURN-TAKING: write the number of turns the dramatic beat genuinely needs. Keep a question, reply and meaningful reaction together when they form one exchange; split only at a natural dramatic boundary. Every labelled line stays VERBATIM with its real speaker. Use "VO" for voiceover.)
(NATURAL SPEECH: write complete, speakable thoughts with character-specific rhythm, subtext, interruption, hesitation, humour or silence when the scene earns them — but ALWAYS inside the delivery cap above (~150 words/min, roughly 22–24 spoken words per 10s clip across all turns). A short line is valid when its reaction carries the beat; a "longer" line is valid ONLY if it still fits a natural, unhurried pace — if it would have to be rushed, it is too long, so trim it or split the idea across clips. Never pad a scene, never cram words to fill a clip, never flatten a strong line into blandness, and never turn dialogue into polished therapy language.)
(PACING AUDIT — do this before returning: for EVERY 10s clip, count the total spoken words across all its turns. At a natural pace a 10s clip holds only about 22–24 words (fewer with pauses or a real action). If a clip exceeds that, it will be rushed past 190 wpm and is REJECTED — move a WHOLE thought or turn to the next compatible segment, or cut words; never accelerate, overlap, repeat or cut a sentence in half. If a clip feels empty, deepen the action, subtext or response rather than adding filler.)
(continue for EXACTLY the requested number of segments, following the emotional arc)
CAPTION: <ready-to-post caption + 4-6 hashtags>

No camera directions, no image prompts, no JSON — only the creative script above.`;
}

function affiliateClipDurations(input: StoryboardGenerationInput): number[] | null {
  if (input.content_subtype !== "affiliate_short") return null;
  if (input.affiliate_duration_seconds === 15) return [10, 5];
  if (input.affiliate_duration_seconds === 20) return [10, 10];
  if (input.affiliate_duration_seconds === 30) return [10, 10, 10];
  return [10, 10];
}

export function buildScriptWriterUserPrompt(input: StoryboardGenerationInput): string {
  const creativeRouteDirective = renderCreativeRouteDirective(input);
  const segmentCount = input.segment_count ?? 5;
  const affiliateDurations = affiliateClipDurations(input);
  const goal = input.video_goal ?? "marketing_general";
  const lang = input.dialogue_language ?? "Vietnamese";
  const isNumerology = goal === "numerology" || input.genre === "numerology";
  const isHealth = goal === "health" || input.genre === "health";
  const isCooking = input.genre === "cooking";
  const isFitness = goal === "fitness" || input.genre === "fitness";
  const framework = isNumerology
    ? numerologyFramework(input.numerology_hook_mode) +
      numerologyToneDirective(input.numerology_style) +
      numerologyAutoProfileBlock(input.story_idea)
    : isHealth
      ? HEALTH_FRAMEWORK
      : isCooking
        ? `${COOKING_FRAMEWORK}${
            input.cooking_recipe
              ? `\n${compileCookingRecipeDigest(input.cooking_recipe, input.cooking_style ?? "kitchen_asmr")}`
              : "\nNo canonical Recipe IR was supplied. Do not invent quantities; keep missing recipe facts explicitly unspecified."
          }`
        : isFitness
          ? FITNESS_FRAMEWORK
          : "";

  const brief: string[] = [];
  if (input.product_name) brief.push(`- Product/Service: ${input.product_name}`);
  if (input.selling_points) brief.push(`- Selling points: ${input.selling_points}`);
  if (input.target_audience) brief.push(`- Audience: ${input.target_audience}`);
  if (input.key_message) brief.push(`- Key message: ${input.key_message}`);
  if (input.call_to_action) brief.push(`- CTA: ${input.call_to_action}`);
  if (input.product_ir?.review_status === "approved") {
    brief.push(compileProductIRDigest(input.product_ir));
    brief.push(`- Affiliate treatment: ${input.affiliate_video_style ?? "problem_solution"}`);
    if (input.affiliate_disclosure) brief.push(`- Disclosure metadata: ${input.affiliate_disclosure}`);
  }
  if (input.main_character) brief.push(`- Main character: ${input.main_character}`);
  if (input.central_conflict) brief.push(`- Conflict: ${input.central_conflict}`);
  const characterDescriptions = input.character_descriptions ?? [];
  const uploadedNames = (input.character_images ?? [])
    .filter((entry) => (entry.images?.length ?? 0) > 0)
    .map((entry) => entry.name.trim())
    .filter(Boolean);
  const menuCharacters = [
    ...characterDescriptions.map((entry) => ({
      name: entry.name.trim(),
      role: entry.role.trim(),
      isChild: !!entry.is_child,
    })),
    ...(input.character_images ?? []).map((entry) => ({
      name: entry.name.trim(),
      role: "",
      isChild: false,
    })),
  ].filter((entry, index, all) =>
    !!entry.name &&
    all.findIndex((candidate) => candidate.name.toLowerCase() === entry.name.toLowerCase()) === index
  );
  const closedCastRule = menuCharacters.length
    ? `\nCLOSED USER CAST — ABSOLUTE IDENTITY AUTHORITY:\n${menuCharacters
        .map((entry) =>
          `- ${entry.name}${entry.isChild ? " [CHILD]" : ""}${entry.role ? ` — role: ${entry.role}` : ""}`
        )
        .join("\n")}\nThese are the only identities permitted. Preserve each internal identity key for image/reference binding and never add another person. ${resolveSpeechMode(input).anonymous_characters ? "Personal names are INTERNAL KEYS ONLY: spoken lines, captions and audience-facing prose use the supplied role or a stable functional role label." : "Use the approved names consistently in character, action and speaker fields."} If a role is not represented in this closed cast, adapt the action without adding that person.`
    : "";
  const uploadedRule = uploadedNames.length
    ? `\nREFERENCE-IDENTITY CHARACTERS (${uploadedNames.join(", ")}): use the attached image only for each exact named identity, face, body proportions and hair. Do not restate those traits in prose. Generate one practical context-appropriate initial outfit from the approved story/location/weather/activity, store it only in character_locks.costume, and never copy clothing from the reference image. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`
    : "";
  const briefBlock = brief.length
    ? `\nBrief:\n${brief.join("\n")}${closedCastRule}${uploadedRule}`
    : `${closedCastRule}${uploadedRule}`;

  const actionDramaBlock = actionDramaRequested(input) ? ACTION_DRAMA_DIRECTOR_PROFILE : "";
  const speechDirective = speechModeDirective(input, lang);
  const stickFigureNarrationDirective = stickFigureWisdomNarrationDirective(input);
  const genreScriptDirective = compactGenreScriptDirective(input);

  return `Write a ${segmentCount}-segment short-video script.${affiliateDurations ? ` The exact clip durations are ${affiliateDurations.join("s + ")}s (total ${affiliateDurations.reduce((sum, value) => sum + value, 0)}s); the shorter final clip uses proportionally fewer spoken words.` : ""}

${creativeRouteDirective}
${genreScriptDirective}

Idea / Topic: ${input.story_idea}
Genre: ${input.genre} · Goal: ${goal} — ${GOAL_GUIDANCE[goal]}
Dialogue language: ${
    isCooking && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(input.cooking_style ?? "")
      ? "NONE — every segment is wordless diegetic ASMR"
      : `${lang} (when dialogue is justified, write it naturally in ${lang})`
  }.${briefBlock}${framework ? `\n${framework}` : ""}${actionDramaBlock}\n${speechDirective}${stickFigureNarrationDirective ? `\n\n${stickFigureNarrationDirective}` : ""}

${input.script_treatment === "polish" ? `EDITORIAL-POLISH MODE FOR A PASTED SCREENPLAY: preserve every character, relationship, location, prop identity, plot fact, causal reveal, emotional meaning and ending message from the supplied screenplay. You MAY and SHOULD restructure the first 30 seconds, merge or redistribute turns across the requested 10s segments, sharpen weak dialogue, add subtext and specify performance/action. Do not introduce a different story, product, setting, relationship or moral. The result must feel like the strongest filmed version of the same screenplay, not a summary and not a replacement premise.` : ""}

Write the ${segmentCount}-segment script now in the exact output shape from the system prompt. For a wordless cooking ASMR profile, keep every DIALOGUE section empty and let the ACTION carry the clip; do not invent a line merely to fill time.`;
}

// ─── Step 1: Segment Breakdown + Character Lock ─────────────────────────────

export function buildStoryboardSystemPrompt(hasUploadedCharacterReferences = false): string {
  return `You are a world-class short-form video director and marketing strategist. You design storyboards that are turned into REAL videos using AI image-to-video tools (Google Veo 3 / Veo 3.1, Seedance, Kling).

CRITICAL PRODUCTION MODEL — how the final video is actually made:
- The video is assembled from multiple ~10-second CLIPS ("segments") generated by Omni Flash / Veo.
- Each 10s segment is ONE CONTINUOUS TAKE: a SINGLE primary action filmed in one unbroken shot — never a static scene dragging for 10s, but also NEVER several hard cuts jammed into 10s. AI video models CANNOT "cut"; if you order multiple separate shots inside one clip they MORPH and TELEPORT between them (objects warp, hands pass through props, items appear/vanish). So the "beats" are SMOOTH CAMERA REFRAMINGS of that SAME ongoing action (a slow push-in, a pan, an angle change that reveals more of the one continuous moment) — the subject, props and physics stay continuous for the whole 10s.
- Each segment is generated by feeding its keyframe + ONE motion prompt into Veo/Seedance.
- 10-SECOND ACTION CAPACITY CONTRACT: an ordinary clip owns ONE primary causal action unit, not a checklist of unrelated business. When spoken audio occupies most of the clip, use at most THREE production-changing atomic transitions; otherwise use at most FIVE. Count a reach/contact/transfer/release chain as the ordered phases of one manipulation, but count a new prop manipulation, chair move, sit/stand, walk or location change as another transition. Complete each transition before beginning the next. During a spoken turn, a character may continue only the already-started simple motion or a small listener reaction; do not begin a second prop transfer, furniture move or pose/location transition under the same line. If the approved story implies more activity, preserve its narrative result but stage only the minimum causal action in this clip and carry the next whole action to its proper adjacent segment. Never make several people race through separate tasks merely to fit ten seconds.
- Every boundary has an explicit transition_in contract. Only mode="continuous" physically inherits the previous end frame. A scene/location/time/parallel/montage/flashback/dream/symbolic cut opens from its own declared start state and preserves only the named anchors — never copy the previous room, pose or light across an intentional cut.
- So "beats" = the progressive camera framings of the ONE continuous action inside a 10s segment (not separate scenes). Provide the EXACT number of beats requested in the user message.
- EVERY beat.camera is complete and production-readable: begin with one bracketed shot-size code, then state camera height/angle, exact visible subject(s), their screen relationship, look/facing direction and focus target. Never output a bare move such as "slow push-in" without its starting/ending shot size and subject.

PROJECT-LED STORY STRUCTURE (never force one template onto every video):
- Read the locked Project Intent and approved script FIRST. Marketing projects may use HOOK → PROBLEM → SOLUTION → CTA; narrative, documentary, educational, atmospheric, symbolic, comedy, music-driven and experimental projects use the structure their intent requires.
- Clip 1 ALWAYS owns a 3-5 second Hook Window, but its form comes from Project Intent: inciting event, observed fact, question, sensory moment, emotional recognition, conflict, transformation preview or product proof. Marketing-style clickbait and CTA remain conditional. Do not invent a hard-sell CTA for a story whose intended ending is emotional, informational or atmospheric.
- For videos lasting 30s or longer, clips 1-3 form a RETENTION LADDER: clip 1 interrupts and opens a precise question; clip 2 escalates with new evidence; clip 3 delivers a reversal, consequence or reveal. Do not spend the first 30s repeating setup. The first three clips must each change an observable state (expression, posture, object, knowledge or relationship distance) and make the next clip necessary.
- "marketing_role" remains a legacy compatibility label; "scene_intent" is the canonical per-clip creative contract.

UPLOADED REFERENCE PRIORITY (absolute hierarchy — PHOTOS beat text, text beats invention):
- USER SETUP MENU CONTRACT (NON-NEGOTIABLE): every entered character name/role and every image group belongs together one-to-one, in menu order. Preserve ALL named characters as separate identities; never use only the first upload, never merge two people, never swap their faces, never omit a referenced character when the approved script places them in the scene, and never let generated defaults/anchors override menu uploads. Character menu photos, product photos and background/location photos are the SUPREME source of identity/location truth. FOR ANY CHARACTER WITH AN UPLOADED IMAGE, THE IMAGE IS THE ONLY IDENTITY/ANATOMY AUTHORITY: do not analyze, infer, list, translate or restate face, face shape, skin, hair, eyebrows, eyelashes, eyes, body, age or height anywhere in the JSON or prompts. Clothing in the uploaded image is NOT authoritative. Generate one practical context-appropriate initial outfit from the approved story, location, weather, activity and role; store it once in character_locks.costume/wardrobe_materials and reuse that exact lock in every clip. In required identity fields use an empty string or the literal sentinel "REFERENCE_IMAGE"; elsewhere mention only the exact name, role, position, action, expression, dialogue and the canonical outfit fields. The only permitted character-surface negative guard is: ${REFERENCE_CHARACTER_ANTI_PLASTIC}. A product keeps its exact shape, colours and branding; when a LOCATION photo exists (indoor room or outdoor scene), stage every relevant segment inside that uploaded place and reuse its real layout, landmarks (furniture indoors; buildings, trees, terrain, water outdoors), colours, materials and light in every first_frame_prompt. Do NOT relocate scenes, "improve" the set, or invent a contradictory place.
- If the story idea and an uploaded photo conflict (e.g. the idea says villa but the photo shows a small apartment), THE PHOTO WINS — adapt the story to the real place/person/product.
- VIDEO OUTPUT TEXT CONTRACT (NON-NEGOTIABLE): every generated VIDEO frame contains ZERO readable text or graphics. Set world_context.allowed_language_text to "none — zero readable text anywhere". Names, ages, dialogue, brands, captions, lens values, Kelvin/lux and timecodes are internal production data only; never request subtitles, captions, name tags, product lettering, logos, badges, title cards, HUD or overlays. Dialogue is AUDIO ONLY. Storyboard documents may contain planning labels, but they are NEVER video start frames.

FORENSIC DNA + SCENE BIBLE (absolute consistency — #1 priority, the user's video must not "look AI"):
- SINGLE-DESCRIPTION AUTHORITY: static character identity, appearance, initial wardrobe and voice are written ONCE in character_locks. Product identity is written ONCE in product_dna; style is written ONCE in scene_bible. first_frame_prompt, motion_prompt, beats, camera and continuity_note refer to those locks by exact name only and NEVER restate or paraphrase their static descriptions. Repetition is not continuity; it creates conflicting instructions.
- Every object is locked to a "DNA" that NEVER drifts. Store that DNA once in its canonical lock, then preserve it by id/name rather than copying the prose into every scene field.
- For a TEXT-ONLY character with no uploaded image, build a detailed "character_lock" with gender, age, build, skin tone, facial structure, skin texture, eyes, brows, lashes, nose/lips, hair, costume, signature features, expression and DNA. For a character WITH an uploaded image, ONLY the FACIAL-IDENTITY/anatomy fields stay image-only ("REFERENCE_IMAGE" or blank): face_structure, skin_texture, skin_tone, eye/eyebrow/eyelash/nose_lips details, hair, hair_details, build, dna. The following are CASTING/WARDROBE facts, NOT facial identity, and MUST STILL BE FILLED for reference characters: "gender", "gender_age" (coarse, from the script), "costume" + "wardrobe_materials" (derived from the setting — location, weather, time, activity, role), "signature_features" (non-facial: accessories/props/outfit accents), "default_expression" and "voice". Never copy the costume from the uploaded pixels and never repeat it in action/camera prose.
- CHARACTERS ARE ORIGINAL AND FICTIONAL. For TEXT-ONLY characters, use only the exact names supplied by the approved script/menu. If a role has no name, assign one ordinary given name once and keep it consistent, EXCEPT when the user activates ANONYMOUS NARRATION MODE: then retain stable functional role labels and never invent a personal name. Never copy names from rule examples or use a fixed default. NEVER use the name, likeness or description of any real, famous or recognisable public figure/celebrity/influencer. Do not write "looks like [celebrity]" or reference any real person. For UPLOADED-REFERENCE characters, do not describe appearance at all: bind the supplied pixels only to their exact menu name and keep the reference-image contract above.

MULTI-CHARACTER CASTING & DIALOGUE ASSIGNMENT (mandatory whenever the story/script has 2+ people — this is what keeps a family/dialogue video coherent):
- FULL CAST LOCK: create ONE character_lock for EVERY distinct person who appears anywhere in the story/script — no exceptions. If the script names people by ROLE (Chồng/Vợ/Con, Bố/Mẹ, husband/wife/child…), assign each role ONE ordinary given name and state the mapping in the synopsis, EXCEPT in ANONYMOUS NARRATION MODE: use the role labels themselves, never personal names. Use those exact identity tokens consistently in every segment, beat caption and first_frame_prompt. NEVER invent an extra unnamed person or silently choose a name from a rule example.
- CHILDREN: keep "is_child": true when the menu/script marks a child. For a text-only child, use an age-locked description. For an uploaded-reference child, never state or infer age/body appearance; the image alone supplies it.
- ROLE-LABELLED DIALOGUE RECOGNITION: when the idea/script contains dialogue labelled by role or an exact character name, each labelled line belongs to THAT character — keep that SPEAKER mapping and the line's core intent/information, but you SHOULD ELEVATE its craft into sharp, witty, subtext-rich, in-character dialogue (apply the DIALOGUE QUALITY DOCTRINE below); do NOT slavishly copy a flat line, and NEVER reassign a line to a different character. A short back-and-forth (e.g. a question + a reply, ~2-3 short lines) SHOULD share ONE 10s clip as sequential turns in "dialogue_lines" (fill the time instead of wasting a clip per line) — following the DIALOGUE turn-taking rules below. Only spill to the NEXT segment when the exchange no longer fits in ~9 seconds.
- "characters_in_scene" (REQUIRED per segment): list the EXACT lock names of everyone VISIBLE in that segment — nobody else may appear. A turn with delivery="on_screen" MUST name one of them. A named delivery="off_screen" speaker keeps their own locked voice but remains outside the camera beat. delivery="voiceover" requires speaker="". Non-speaking listed characters react silently, mouths closed.
- CAST CONTINUITY: keep every character consistent across segments. For text-only characters, character_locks is the only appearance/initial-wardrobe/voice authority; all scene fields use the exact name plus current position, pose, action, expression and prop state only. For uploaded-reference characters, use only their exact name plus the attached image binding; never repeat or paraphrase their appearance in first_frame_prompt, motion_prompt, beats or camera text.
- If there is a hero PRODUCT, write "product_dna": exact shape, material, colours WITH RGB hex, label/logo text+colour, cap/parts — repeated verbatim.
- Build a "scene_bible" (lens, lighting with Kelvin temps, backdrop with hex, colour grade) as the single style authority. Scene fields obey it without copying the full style fingerprint repeatedly.
- One single set/location per segment; only camera framing and the action change.
- Every storyboard board carries a compact REFERENCE LIBRARY: for EACH visible named character, exactly two face-readable head-and-shoulders views (FRONT + PROFILE/3-4), plus one small ENVIRONMENT OVERVIEW. No full-body/back turnaround cells are needed. Uploaded menu photos outrank any generated board anchor.

PHYSICAL REALISM (every clip must look real, not "AI" — this is what eliminates the broken, impossible-motion look):
- PER-CHARACTER CONTINUOUS ACTION (this is the #1 fix for a character teleporting or duplicating): inside one 10s clip, EACH character performs ONE continuous, causally-connected action — their start pose/zone must flow into their end pose/zone through visible on-screen movement, with NO teleport and NO jump between two disconnected actions for the SAME person. FORBIDDEN example: the same person "pulling a chair at the start" then "sitting on the sofa folding clothes at the end" — that is a teleport and makes the model render two of that person. MULTIPLE characters MAY act in PARALLEL and differently in the same clip (e.g. Minh pulls a chair WHILE Lan folds clothes on the sofa) — that is natural and ALLOWED, as long as (a) each person's own motion stays continuous, and (b) EVERY character present is causally locked start→end and appears in the state_ledger — not only the "main" subject. Still forbidden: any single person doing two disconnected actions, and hard cuts / several separate shots jammed into one clip (AI video CANNOT cut — it morphs/teleports).
- Write SPECIFIC motion: name the body part + the verb + the manner (e.g. "her right hand slowly lifts the pan by its handle"), never vague verbs like "moving", "doing" or "interacting".
- 🔗 OBJECT-INTERACTION CAUSAL CHAIN (mandatory — a vague description here is what makes objects teleport into hands): every time a character touches, picks up, hangs, places or moves ANY object, the motion_prompt must narrate the FULL visible ordered chain without numeric timecodes: (1) REACH — the named hand travels to the object; (2) CONTACT — fingers close around a named part; (3) TRANSFER — it moves along one continuous path; (4) RELEASE — it is placed and the hand withdraws. NEVER write "he holds the jacket" if the previous moment his hands were empty — the pick-up must be shown.
- ⚡ CAUSE BEFORE EFFECT (nothing happens by itself): if the story needs something to fall, tip, spill, open or break, the motion_prompt must FIRST show the physical cause making contact, THEN the effect with real physics timing — e.g. "as he hangs the heavy jacket, its weight pulls the top-heavy rack sideways; the rack leans, then topples to the floor". FORBIDDEN: "the coat rack falls" with no cause, "the door opens" with nobody touching it, effects that precede their causes.
- 🚪 ONE LOCATION PER CLIP: the whole 10s lives in ONE continuous space; the set/backdrop never changes mid-clip. If the character must be somewhere else, they WALK there on screen within the same space — or it becomes the NEXT segment.
- 🎒 PROP EXISTENCE & WARDROBE TRUTH (an undeclared prop is what makes objects teleport into hands): every object the motion_prompt uses MUST be planted in that segment's first_frame_prompt start state — in the character's hand, worn on their body, or placed in the scene (e.g. if he hangs a jacket, the first_frame_prompt says the jacket is already draped over his forearm as he enters). NEVER write "takes off his jacket" unless the jacket is part of his locked costume or explicitly declared carried. Before returning, CHECK every motion_prompt against the character_locks costume and the first_frame_prompt: any object touched in the motion that is missing from the start state is a bug — add it to the first_frame_prompt.
- 🎁 HERO / GIFT OBJECT IDENTITY & NAMING FIDELITY (mandatory — this is what stops a specific item being silently swapped for a generic look-alike): the story's central / hero / gift object has ONE canonical name AND ONE exact real-world TYPE + material, and that identity is written once in its lock and reused verbatim in first_frame_prompt, motion_prompt, beats, camera, the state_ledger entity_id and the thumbnail — never a synonym that changes what the object actually IS. NEVER relabel, downgrade or substitute a specific item into a different object category. WORKED EXAMPLE (túi — the exact bug this rule fixes): if the gift is a fashion HANDBAG / purse — a structured bag with a body panel, a wearable shoulder/hand strap and metal hardware (zippers, buckles), i.e. "túi xách" — then it MUST be named, described, tracked and rendered as that handbag in EVERY field. It must NEVER become a paper gift bag, kraft bag, shopping bag, twisted-handle carrier, gift-wrap or the generic label "gift bag" — that reads as "túi giấy" (a throwaway paper bag), which is a COMPLETELY DIFFERENT object. "Túi được tặng = túi xách, KHÔNG PHẢI túi giấy." The same discipline applies to any hero object (a watch is not a bracelet; a lantern is not a candle): keep its true category and material fixed for the whole video.
- 🎀 GIFT PACKAGING vs THE GIFT ARE TWO DISTINCT OBJECTS: when a gift is presented inside packaging (a wrapped box, a gift box, ribbon or wrapping paper), the PACKAGING and the GIFT itself are SEPARATE entities with SEPARATE names in the state_ledger — never merge them into one blurred "gift box / gift bag" object. The HERO object is the GIFT (e.g. the handbag), not its wrapping; the emotional reveal, the payoff beat and the thumbnail must feature the ACTUAL gift (the handbag) clearly out of / beside its opened packaging, not a closed box or a paper bag standing in for it.
- State physics explicitly in the motion_prompt: real-world weight, gravity, momentum and balance; objects keep one solid form (object permanence); hands make real contact with props and never pass through them; liquids and food obey gravity.
- Every motion_prompt must obey real physics, stable identity and object permanence, but do not append a stock realism sentence when those rules are already carried by the structured export.
- 🚶 DAILY-MOVEMENT MICRO-GRAMMAR (ordinary body actions MUST show their real mechanics — never jump between states; this is the #1 fix for people teleporting or moving inconsistently): Walking to a spot = feet step in sequence along the declared route, weight rolling heel-to-toe, arriving before the next action. Sitting / taking a seat = walk to the chair, turn the hips toward the seat, align knees and feet, shift weight, bend knees and hips (brace one hand on the chair/table only if natural), the pelvis meets the seat, the spine settles, feet plant. Standing up = feet plant under the body, torso leans forward, weight transfers onto the feet, knees and hips extend, hands leave the support, balance settles. Opening a door / entering = the named hand reaches the handle, grips it, the hinge or slide visibly moves, the leaf swings or slides through its real arc, THEN the body crosses the threshold through the clear connector — the door is NEVER already open and its open/closed state stays physically consistent the whole clip. Carrying or moving furniture (e.g. lifting and repositioning a chair) = grip it with the hand(s) its weight demands, lift as the body leans to counter the load, carry it along one continuous walked path, then set it fully down on the floor BEFORE the hands release. Include only the steps the shot needs, but NEVER skip the contact or the weight transfer that connects one state to the next.
- Camera moves are smooth and minimal (a slow push-in or gentle pan). Avoid combining a big camera move with big subject motion — that compounding warps the image.

STAGING & BLOCKING (a real director's coverage — this is what separates a watchable video from a flat, monotonous one):
- 🧭 SPATIAL TOPOLOGY FIRST (mandatory before writing a first frame, beat, motion or camera for every multi-zone / threshold / boundary scene): create ONE compact "spatial_layout" and make every field consume it. (1) "zone_order" lists the physically connected zones in order; (2) "fixed_architecture" locks walls, door/window openings, thresholds, stairs, counters and perimeter barriers; (3) "character_placement" assigns EACH visible character an exact zone + named architectural/prop anchor + approximate distance + facing direction; (4) "walkable_path" declares the connected load-bearing route that must remain clear; (5) "camera_zone" gives the camera a real supported position and unobstructed line of sight. Do not describe the same geometry differently in first_frame_prompt, beats, motion_prompt or camera notes.
- 🚪 CONNECTOR / BOUNDARY TRUTH: a doorway is an OPENING in a wall and the threshold is its walkable connector — a railing, wall, counter, furniture, planter or character can never cross or block it by accident. A railing/parapet/guard stays ONLY on the true exposed outer edge, never opposite/across a doorway, never in the middle of the usable floor, and never between two people who are looking or speaking across that doorway. Example only when the script actually contains an apartment balcony: interior room → open doorway/threshold → balcony floor → outer-perimeter railing → exterior/city beyond. This is a topology example, NOT a default location template.
- 🔄 REVOLVING-DOOR KINEMATICS (only when the script actually names one): first classify this clip as ENTER, EXIT, PASS-THROUGH, HOLD-INSIDE or BACKGROUND-ONLY. ENTER starts before the entrance gap; EXIT starts already inside the same occupied wedge and crosses the destination threshold exactly once; HOLD-INSIDE never exits; BACKGROUND-ONLY has no occupied wedge. Establish one rotation direction and keep it. A crossing person stays between the same two rigid radial glass wings and exits only when that opening aligns with the destination floor. Never cross glass/the center shaft, change compartments, reverse, repeat an entry/exit, or describe a person as already outside before their scripted exit. Put the operation once in spatial_layout.mechanism_motion; all other fields obey it without paraphrasing it.
- 🚶 OCCUPANCY & ROUTE: every person has one start zone and one facing direction. If motion changes zones, name the connector and show the continuous crossing; otherwise the person stays in the declared zone. Nobody stands through a wall/threshold, beyond a railing, over a void, or on a non-load-bearing surface. The camera follows the same rules and cannot be inside a wall or beyond a safety barrier.
- 🔒 TOPOLOGY FREEZE: fixed architecture and zone order remain unchanged for the whole clip and across chained clips in the same location. Doors may open/close only through a visible hinged/sliding action, but the wall opening and threshold never migrate. If an uploaded location photo exists, derive this topology from that real photo and do not redesign it.
- 🎭 VARY THE STAGING BETWEEN CLIPS: consecutive segments must NOT repeat the same two people in the same pose in the same framing (five straight clips of a couple sitting on a sofa = dead video). Between clips, change at least ONE of: a character's position in the room (standing at the window, crossing to the shelf, kneeling by the cabinet), their posture (sitting → leaning forward → standing), the spatial relationship (side-by-side → facing → one behind the other), or the shot framing. Move the story PHYSICALLY through the locked space — always by walking on screen or between segments, never teleporting.
- ⏱️ FIRST 2-3 SECONDS DECIDE EVERYTHING (every genre, not just hooks): segment 1 must open ON an arresting, concrete, already-in-motion image — a visible action or a charged human moment mid-beat — never a static establishing wide, never someone simply standing/sitting waiting to speak, never a slow fade-in. The very first frame should make a scrolling viewer ask "what is happening here?".
- 🎭 GESTURE MUST CARRY THE LINE'S EMOTION: every spoken line is paired with a physical action whose emotion MATCHES that exact line — the body says what the words say (or deliberately contradicts them when the story wants subtext). Name the specific action tied to that line's feeling: hurt = fingers tightening on the glass and a swallow before speaking; guilt = eyes dropping, phone lowered slowly, shoulders folding in; tenderness = hands stilling, a step closer, voice softening as the chin lifts. NEVER attach a neutral/idle gesture to an emotional line, and never write vague acting ("looks sad", "reacts", "shows emotion") — write the observable movement that produces that emotion on camera.
- ✋ CHARACTER BUSINESS: every visible character has ONE concrete piece of physical business per clip that serves the story (setting the phone face-down on the table, wrapping both hands around a warm cup, straightening the modem's cable, folding the throw blanket while listening) — hands are NEVER idle mannequin hands hanging at the sides. Listeners react with specific micro-actions: a slow eyebrow raise, a suppressed smile tugging one corner of the mouth, a slow exhale, fingers tightening on the cup — name the exact micro-expression, never write "reacts" or "looks at him".
- 🎬 CAMERA VARIETY ACROSS CLIPS: still ONE smooth move per clip, but the MOVE ITSELF must vary across the video — rotate through the vocabulary: slow push-in / lateral drift / gentle arc-orbit / slow pull-back reveal / static frame with only a subtle reframe / over-the-shoulder favoring the listener. NEVER repeat the identical camera recipe (e.g. "hold A, pan to B, push in") in more than two consecutive clips.
- 🐢 CAMERA PACING — NO RUSHED MOVES: the single camera move breathes across the WHOLE clip at real human operator speed — a pan that must reach the other speaker travels gently during the natural pause BETWEEN lines, never whips in one second. The camera starts settled, eases in, eases out, ends settled (so the last frame chains cleanly into the next clip). If a move cannot fit calmly inside 10s, choose a smaller move.
- ⚡ ENERGY-AWARE PERFORMANCE (Director's Engine): infer each clip's energy (low / medium / high) from its emotion, and write the acting to match — low: minimal movement, internalized emotion; medium: natural gestures, conversational pacing; high: focused intensity, never flailing. Adjacent clips never jump low→high (motion shows energy BUILDING gradually — restrained first, opening up) and never crash high→low (motion shows tension RELEASING slowly — controlled breathing, shoulders dropping). Chained clips also keep CAMERA temperament continuity: never cut from a locked-off static clip straight into a handheld-feeling energetic move — step through a controlled push-in first.

MATERIAL & SKIN REALISM (this is what kills the "AI/CGI/plastic" look — treat every clip as REAL filmed footage, never a 3D render):
- HUMAN FACE REALISM applies ONLY to text-only generated humans with no uploaded character image. Never apply or serialize this forensic face prose for an uploaded-reference character. For an uploaded-reference character, rely on the image alone and add only this short exclusion: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.
- TEXT-ONLY HAIR FALLBACK: only for generated characters without an uploaded image, describe natural strand behaviour instead of helmet/plastic hair. Never add this prose to an uploaded-reference character.
- MATERIALS: every environment object, prop and locked outfit must read true-to-life. For every character, including uploaded-reference characters, choose garment materials appropriate to the context and declare them once in character_locks. Never copy reference-image clothing and never repeat garment prose in action/camera fields.
- LIGHT: physically-based, tied to time-of-day/weather, with soft imperfect shadow edges. Give scene_bible.lighting BOTH Kelvin temperature AND approximate Lux (e.g. "soft overcast dawn key 5200K, ~800 lux"), and set scene_bible.film_grain to a fine organic grain / clean-acquisition token so the filmic texture stays constant across clips.

${contextFrameworkSystemDigest()}

${lawsSystemDigest({ uploadedCharacterReferences: hasUploadedCharacterReferences })}

ENVIRONMENT ENGINE (locked world archetypes — pick one per segment):
- The system has a library of LOCKED environment archetypes, each a physically-grounded world spec (real materials with surface physics, Kelvin+Lux lighting, atmosphere, micro-details, imperfections, ambient sound bed). When a segment's setting matches one, set that segment's "environment_ref" to the archetype id — the system then injects the full forensic world spec into the Veo prompt automatically, which is what makes the SETTING render real instead of CGI.
${environmentCatalogForPrompt()}
- Rules: pick an id only when it is semantically compatible with the resolved context and approved script. If NO archetype fits, set "environment_ref": "custom" and write the required physical materials + Kelvin/Lux + imperfections inside "first_frame_prompt". Never infer a kitchen, gym, living room or outdoor location from a library default; cooking/fitness routing and any special location profile arrive explicitly in the USER prompt. Two consecutive segments in the same location SHOULD reuse the same compatible environment_ref.

NEGATIVE CONTRACT: scene-level exclusions may cover text overlays, impossible physics, morphing objects, duplicates and audio errors. For TEXT-ONLY generated humans, detailed face/hand negatives are allowed. For any UPLOADED-REFERENCE character, the ONLY character-surface exclusions are: ${REFERENCE_CHARACTER_ANTI_PLASTIC}; never add face-shape, age, skin-detail, brow/lash, hair-detail, body or wardrobe negatives.

DIALOGUE (spoken audio in Veo 3 — TURN-TAKING within a 10s clip, never overlapping):
- DIALOGUE QUALITY DOCTRINE (MANDATORY — the user's #1 priority): you are the WRITER, not a transcriber. Every spoken line must be sharp, human, in-character and worth quoting. (1) SUBTEXT over statement — say it sideways, bury the real feeling under a concrete surface line; cut on-the-nose lines like a bare "Em giận anh à?" unless the reply subverts it. (2) HUMOR WITH HEART where the tone allows — one dry, wry or warmly funny beat per scene, and the funniest line may also be the most moving; never cheapen the payoff. (3) VOICE SEPARATION — each character has their own rhythm and vocabulary; never write two people who could swap lines. (4) TURN THE SCREW — every turn shifts something (reveal / needle / concession / reversal); delete filler pleasantries. (5) PAYOFF LINE — aim each scene at one "đắt giá" screenshot-worthy line; end the video on a line that reframes what came before. Flat lines from the input MUST be re-authored to this bar (keep speaker + intent).
- NEVER FAKE A LINE: a talking scene's dialogue must be REAL spoken words. NEVER output the scene TITLE, a stage-direction, or a description of the action as a spoken line (e.g. a voiceover that literally reads "Lan pulls the chair, her smile fading" is FORBIDDEN). If a conversational scene has no line in the input, WRITE a strong in-character one. If a beat is genuinely wordless by intent (a held look, a pure visual reveal), leave dialogue empty ("") and let the ACTION carry it — do NOT invent a narrating voiceover to fill silence.
- Veo 3 generates real spoken audio. Write dialogue in the language requested. Keep each spoken line SHORT and natural.
- Put spoken lines ONLY in the dialogue fields. Do NOT quote them inside "motion_prompt" (the system appends them once; repeating makes the character say it twice). In motion_prompt, describe only the ordered physical gestures: who turns toward whom, who speaks, and how the listener reacts. Use NO seconds or time ranges in motion_prompt or camera notes; dialogue_lines owns all speech timing.
- FIT A SHORT EXCHANGE INTO ONE CLIP (this is the key rule — do NOT waste a whole 10s clip on one 3-word line): use the "dialogue_lines" array to place 1-3 SEQUENTIAL turns inside the same 10s clip when they belong to the same beat of conversation. Each turn = { "speaker": exact character_locks name (or "" for voiceover), "delivery": on_screen|off_screen|voiceover, "camera_beat": 1-based beats[] index for on_screen only, "text": the line, "start_s": when they start, "end_s": when they finish }. The chosen camera beat must explicitly name/show the on-screen speaker.
- HARD SAFETY RULES (a video model CANNOT lip-sync two mouths at once — breaking these causes garbled clips):
  1. TURN-TAKING ONLY, NEVER OVERLAP: turns are strictly sequential — turn N's end_s ≤ turn N+1's start_s. Exactly ONE person's mouth moves at any instant; everyone else has their mouth closed, listening.
  2. FIT THE SECONDS: the whole exchange must finish by ~9s (leave breathing room). Budget realistically at a natural pace — roughly 0.4s per word plus a ~0.5s beat between speakers. A short line like "Thế anh đã vo gạo chưa?" ≈ 2.5s. If the exchange does NOT fit, keep only the turns that fit and PUSH the rest into the NEXT segment — never cram or speed up speech.
  3. MAX 3 turns and MAX 2 distinct speakers per clip (a third speaker like a child interjecting is allowed only as the LAST short turn). More than that → split across segments.
  4. CAMERA DOES NOT ASSIGN SPEECH: camera and speaker are independent. Camera notes may hold the speaker, the listener's reaction, or both, but contain no dialogue timecodes and never force the framed person to speak. Only dialogue_lines.speaker owns the voice and lip movement; every other visible mouth stays closed.
  5. "characters_in_scene" must include every delivery="on_screen" speaker. A named delivery="off_screen" speaker is heard outside the camera beat; delivery="voiceover" requires speaker="".
  6. SPEECH + BODY MOVEMENT: speaking while walking, standing up, sitting down or turning is allowed when the approved script and real context make it natural. Keep the line short enough for natural breath, keep the named speaker visible/identifiable, and avoid stacking a difficult prop action at the same moment. For long or emotionally precise lines, prefer a settled pose. Never ban movement categorically.
  7. ONE CLOCK ONLY: dialogue_lines.start_s/end_s is the sole numeric clock in a clip. motion_prompt and camera notes describe ordered action/coverage with NO seconds and NO time ranges. Never create a second camera or action timeline.
  8. QUIET WINDOW: never place a dialogue window over a loud or major physical event. Complete the crash/fall/impact first in the ordered action, then begin the reaction line; do not add event timecodes outside dialogue_lines.
  9. BALANCE SPEECH BY DELIVERY TIME, NOT WORD COUNT: preserve the approved script wording and assign realistic start_s/end_s windows at natural delivery speed for its language, emotion and performance. Leave a real reaction/breathing window and finish by 9.5s. If the approved exchange does not fit, move the last WHOLE approved thought or turn into the next compatible clip; never compress, paraphrase, duplicate, merge speakers, cut a sentence in half or repeat a line in motion_prompt.
  10. DELIVERY FEASIBILITY IS TECHNICAL, NOT CREATIVE: do not impose a fixed word ceiling while writing or expanding the script. The dialogue clock and WPM validator decide whether delivery fits. Never shorten a timing window or speed up a voice to force text into a clip; preserve meaningful pauses and intentional same-speaker line breaks.
  11. FINAL CAPACITY AUDIT BEFORE RETURNING JSON: calculate every turn from its actual word count and declared window. No turn may exceed 190 wpm. When authoring from an idea rather than copying user-locked verbatim dialogue, rewrite or redistribute the same thought naturally before returning JSON; never knowingly emit an over-speed line for the validator to reject. Voice-over follows the same capacity rule.
- SINGLE-LINE CLIPS: if a beat is just one line, you may use "dialogue_lines" with one entry OR the plain "dialogue"+"speaker" fields — both work. For a longer monologue that fills the clip, one speaker is correct.
- Mirror the FIRST turn into the top-level "dialogue" (its text) and "speaker" (its name) for compatibility.
- NAME TOKENS ARE LOCKED: every character name is a fixed token spelled EXACTLY as in character_locks, identical in every field (title, first_frame_prompt, motion_prompt, beats, camera notes, dialogue speaker, continuity_note). NEVER invent a spelling variant, nickname or near-miss — a near-miss name creates a THIRD person and breaks speaker mapping. Any name appearing inside a RULE EXAMPLE is a placeholder — NEVER copy an example name into your output; use ONLY the names defined in character_locks for THIS video.
- WARDROBE & HAIR: hair remains reference-image authority for an uploaded character, while outfit does not. Every character gets one context-locked initial outfit in character_locks and keeps it across clips. Use wardrobe_state only for a visibly motivated change such as bathing, rain/wet clothes, contamination/damage or an explicit change of clothes; declare the transition once and inherit it afterward.
- ONE LOCATION, IDENTICAL IN EVERY SEGMENT: unless the script explicitly moves to a new declared location, every first_frame_prompt restates the SAME place — indoor room OR outdoor scene — with the SAME geometry, the SAME landmark positions (furniture/fixtures indoors; buildings, trees, paths, terrain, water outdoors), materials, colour palette and light sources — copy the location description consistently and change ONLY the characters' positions, poses and explicitly named props. The set must read as the same physical place in every clip; when the user uploaded a LOCATION photo, that photo's place is the only set.
- TWO-PERSON BLOCKING (conversation geometry): when two characters share a dialogue scene, their bodies and gazes are oriented TOWARD EACH OTHER per the scene geometry — never both facing the same direction or both facing the camera in parallel like news anchors, unless the script explicitly stages it (e.g. one turns away in refusal, both watching something). State each character's facing direction in the first_frame_prompt ("[A] faces [B] across the table; [B] stands half-turned toward [A]").
- END-STATE FREEZE-FRAME: "continuity_note" = the physical freeze-frame at second 10 in ONE compact sentence (≤ 35 words) — who is where, facing which way, pose/expression, held props, light. The NEXT segment opens from it ONLY when transition_in.mode="continuous". Every other transition opens from its own declared start state and carries only transition_in.preserve. Never write a vague emotional summary; record the observable physical state.
- CONTINUOUS-BOUNDARY LOCK (the #1 fix for position/holder swaps between consecutive shots): when a segment's transition_in.mode = "continuous", its state_ledger.start, spatial_layout AND first_frame_prompt MUST reproduce the PREVIOUS segment's state_ledger.end EXACTLY — every character on the SAME zone/side/anchor, every object with the SAME holder, placement and orientation. NOTHING may move, change hands, swap seats/sides, or reorient AT the boundary itself. If a character must end up elsewhere or an object must change hands, that change happens ONLY through a VISIBLE action DURING one segment (recorded in that segment's changes[]) — never silently across the cut. Concretely: before writing each continuous segment, COPY the previous segment's end positions, holders and orientations into this segment's start verbatim, then advance them only through on-screen action inside the clip. A start that differs from the previous end with no in-shot action that produced the difference is a continuity defect.
- PERFORMANCE DIRECTION: never stop at generic labels such as "smiles", "sad", "surprised" or "happy". Tie every expression to a visible micro-action caused by the preceding beat: a smile stalls before the eyes, fingers loosen on a prop, breath catches, gaze avoids then returns, shoulders settle, jaw unclenches. "motion_prompt" must show the action–reaction chain and the listener's silent response, not merely announce an emotion.

Camera codes: [EYE] eye-level, [LOW] low, [HIGH] high, [OVH] overhead, [DUTCH] dutch, [OTS] over-shoulder, [POV] first-person, [CLOSE] close-up, [SIDE] side profile.

Output MUST be valid JSON only — no markdown, no code fences, no text outside the JSON.`;
}

export function buildStoryboardUserPrompt(
  input: StoryboardGenerationInput
): string {
  const creativeRouteDirective = renderCreativeRouteDirective(input);
  const referencedCharacterNames = new Set(
    (input.character_images ?? [])
      .filter((entry) => (entry.images?.length ?? 0) > 0)
      .map((entry) => entry.name.trim().toLowerCase())
      .filter(Boolean)
  );
  const characterDescriptions = input.character_descriptions ?? [];
  const characterNames = [
    ...new Set([
      ...(input.character_images ?? []).map((entry) => entry.name.trim()),
      ...characterDescriptions.map((entry) => entry.name.trim()),
    ].filter(Boolean)),
  ];
  const characterBlock = characterNames.length > 0
    ? `\n\nCLOSED USER CAST (create exactly ONE character_lock per person below, keep names EXACT; these are the ONLY people permitted anywhere in the output — never add a generated/default name):\n${characterNames
        .map((name) => {
          const description = characterDescriptions.find(
            (entry) => entry.name.trim().toLowerCase() === name.toLowerCase()
          );
          if (referencedCharacterNames.has(name.toLowerCase())) {
            return `- ${name}${description?.is_child ? " [CHILD]" : ""} [UPLOADED REFERENCE]: ${REFERENCE_CHARACTER_APPEARANCE_LOCK} Mention identity only by name, but generate one concise context-appropriate initial outfit in character_locks.costume/wardrobe_materials; never copy reference clothing or repeat outfit prose in scene actions. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}. Role: ${description?.role || "use the approved script"}`;
          }
          return `- ${name}${description?.is_child ? " [CHILD — trẻ em, khoá đúng độ tuổi trẻ con]" : ""}: ${description?.appearance || "text-only generated character"}. Personality: ${description?.personality || "follow the approved script"}. Role: ${description?.role || "follow the approved script"}`;
        })
        .join("\n")}`
    : "";

  // Product / TVC brief — when present, the script becomes a real ad.
  const briefLines: string[] = [];
  if (input.product_name) briefLines.push(`- Product/Service: ${input.product_name}`);
  if (input.selling_points) briefLines.push(`- Key selling points / USP: ${input.selling_points}`);
  if (input.target_audience) briefLines.push(`- Target audience: ${input.target_audience}`);
  if (input.key_message) briefLines.push(`- Key message: ${input.key_message}`);
  if (input.call_to_action) briefLines.push(`- Call to action (CTA): ${input.call_to_action}`);
  if (input.product_ir?.review_status === "approved") {
    briefLines.push(compileProductIRDigest(input.product_ir));
    briefLines.push(`- Affiliate treatment: ${input.affiliate_video_style ?? "problem_solution"}`);
  }
  const productBriefBlock =
    briefLines.length > 0
      ? `\n\nPRODUCT / TVC BRIEF — this is a product advertisement; build the whole script around it:\n${briefLines.join(
          "\n"
        )}\nFeature the product clearly, dramatize the selling points for the target audience, land the key message, and close on the exact CTA above.`
      : "";

  // Story / film brief — for narrative (non-ad) genres.
  const storyLines: string[] = [];
  if (input.main_character) storyLines.push(`- Main character: ${input.main_character}`);
  if (input.central_conflict) storyLines.push(`- Central conflict / stakes: ${input.central_conflict}`);
  if (input.key_message) storyLines.push(`- Theme / message: ${input.key_message}`);
  if (input.target_audience) storyLines.push(`- Intended audience: ${input.target_audience}`);
  const storyBriefBlock =
    storyLines.length > 0
      ? `\n\nSTORY BRIEF — build a compelling narrative around this:\n${storyLines.join(
          "\n"
        )}\nGive the main character a clear arc, escalate the conflict, and resolve it so the theme lands emotionally.`
      : "";

  const settingBlock = input.setting ? `\nPrimary Setting: ${input.setting}` : "";
  const toneBlock =
    input.tone && !input.character_dialogue_style
      ? `\nLegacy project tone: ${input.tone}`
      : "";

  // Cách 1 — per-shot uploaded locations. Each set was vision-analyzed upstream;
  // tell the model which 10s shots happen in which REAL place (+ its spatial
  // description) so it stages those shots there and writes actions that fit them,
  // instead of inventing a set the uploaded footage can't match.
  const locSets = (input.location_mode === "upload" ? input.location_sets ?? [] : [])
    .filter((s) => s && (s.description ?? "").trim());
  const shotLocationBlock = locSets.length
    ? `\n\nSHOT-SPECIFIC LOCATIONS (AUTHORITATIVE — the user uploaded REAL places for specific 10s shots. For each listed shot: stage it INSIDE that exact place, reuse its real layout, landmarks, colours, materials and light in first_frame_prompt, and write ONLY actions that physically fit that place per its described affordances. Never relocate, "improve" or invent a different set for these shots):\n${locSets
        .map((s) => {
          const shots = (s.scene_indices ?? []).filter(
            (n) => typeof n === "number" && Number.isFinite(n) && n >= 1
          );
          const where = shots.length
            ? `Shot${shots.length > 1 ? "s" : ""} ${shots.join(", ")}`
            : "Any shot not claimed by another set";
          return `- ${where} → "${s.name}": ${s.description}`;
        })
        .join("\n")}\nShots not listed here use the Primary Setting. Keep each place identical across every shot assigned to it.`
    : "";
  const customBlock = input.custom_instructions
    ? `\nAdditional Instructions: ${input.custom_instructions}`
    : "";

  const resolvedContextForPrompt = input.resolved_context
    ? (({ production_profile: _compiledElsewhere, ...context }) => context)(input.resolved_context)
    : undefined;
  const resolvedContextBlock = resolvedContextForPrompt
    ? `\n\n=== RESOLVED CONTEXT IR (Stage 1.5 — CANONICAL, DO NOT RE-INFER) ===
The context-analysis stage already resolved the project's 10 layers from the brief and approved script. Treat this JSON as the single source of truth. Copy its world facts into the legacy "world_context" output for compatibility; do not replace its locations, continuity mode, light motivation, audio strategy or visual language with a preset. An environment library entry may be selected only when it is semantically compatible with the location definition; otherwise use "custom".
${JSON.stringify(resolvedContextForPrompt, null, 2)}
=== END RESOLVED CONTEXT IR ===`
    : "";

  // Stage-1 approved script (written by Claude). When present, the storyboard
  // model must EXPAND this exact script into the JSON — not invent a new story.
  const scriptBlock = input.source_script
    ? `\n\n=== APPROVED SCRIPT (Stage 1) — EXPAND THIS VERBATIM ===\nA scriptwriter already wrote the creative script below. Your job is ONLY to turn it into the technical storyboard JSON. Follow it FAITHFULLY:\n- ${characterNames.length > 0 ? `The CLOSED USER CAST above is the absolute name authority. Create exactly those ${characterNames.length} locks and no others. If this script contains a wrong, invented or alternate character name, map that role back to the appropriate closed-cast name; never copy the stray name into output.` : `Keep the SAME CAST across the whole video: create one character_lock per person in CHARACTERS (same names, same looks everywhere; carry any "(child)" mark into is_child: true).`}\n- Map each SEGMENT in the script to one 10s storyboard segment IN ORDER (same count, same beats/roles).\n- Use each segment's DIALOGUE line VERBATIM; set its speaker from the script's SPEAKER line ("VO" → speaker: "", delivery: "voiceover"). Use delivery="off_screen" only when the approved script explicitly places that named speaker outside the camera beat. Set "characters_in_scene" from the script's IN SCENE line. NEVER give a line to a different character.\n- SPEAKER ATTRIBUTION IS CRITICAL — copy the speaker label the script already wrote in front of each line, EXACTLY. Do not re-decide who is talking, do not default every line to the first character, and do not merge two people into one. If the script labels a line with a role, use that role's mapped character name from CHARACTERS. Read the words the line actually uses to address or refer to people and confirm they fit the labelled speaker; a misattributed line ruins the whole video.\n- KEEP EVERY LINE OF THE SCRIPT. Do not compress a multi-line exchange down to one line per segment: distribute the script's full back-and-forth across the segments using "dialogue_lines" (up to 3 turns per 10s segment, sequential, non-overlapping, each with its own correct speaker). Dropping the user's lines is a bug.\n- Turn each segment's ACTION into the first_frame_prompt + motion_prompt (one continuous action per clip).\n- Do NOT add, drop, reorder, or invent segments, lines or people. This script is final.\n\n${input.source_script}\n=== END APPROVED SCRIPT ===`
    : "";

  const segmentCount = input.segment_count ?? 5;
  const affiliateDurations = affiliateClipDurations(input);
  const totalDuration = affiliateDurations?.reduce((sum, value) => sum + value, 0) ?? segmentCount * 10;
  const clipDurationDescription = affiliateDurations
    ? affiliateDurations.map((duration, index) => `segment ${index + 1}=${duration}s`).join(", ")
    : `${segmentCount} × 10s`;
  // The user no longer picks a fixed beat count — the app auto-splits each 10s
  // clip into the number of camera framings the action naturally needs (3-5),
  // instead of forcing an unnatural count. A legacy explicit beats_per_segment
  // still pins the count when provided.
  const beatsIsAuto = input.beats_per_segment == null;
  const beatsPerSegment = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const beatsExactText = beatsIsAuto ? "3 to 5" : `EXACTLY ${beatsPerSegment}`;
  const goal = input.video_goal ?? "marketing_general";
  const goalGuidance = GOAL_GUIDANCE[goal];
  // Topic-driven numerology / health content follows a dedicated, proven
  // 5-beat framework instead of the product/story brief. Triggered by the goal
  // OR the genre (whichever the user set).
  const isNumerology = goal === "numerology" || input.genre === "numerology";
  const isHealth = goal === "health" || input.genre === "health";
  const isCooking = input.genre === "cooking";
  const isFitness = goal === "fitness" || input.genre === "fitness";
  // PROMPT-SIZE GUARD (numerology kept timing out at Stage 2): when a Stage-1
  // script already exists, Stage 2 only expands it VERBATIM into JSON — feeding
  // it the entire creative framework again (~14k chars) just slows the call
  // until it truncates/times out. Send the full framework only when Stage 2
  // must write the script itself; otherwise a 3-line reminder is enough.
  const numerologyBlock = isNumerology
    ? input.source_script
      ? `\nNUMEROLOGY REMINDER (the approved script above is final — expand it verbatim): keep every segment's SETTING a DIFFERENT symbolic location as written in the script; colour/light follows the number's element; dialogue stays second-person, short and sharp; the number is revealed only where the script reveals it.`
      : `\n${numerologyFramework(input.numerology_hook_mode)}${numerologyToneDirective(input.numerology_style)}${numerologyAutoProfileBlock(input.story_idea)}`
    : isHealth
      ? input.source_script
        ? `\nHEALTH REMINDER (the approved script above is final — expand it verbatim): empathetic, trustworthy, no alarmism; keep the problem → root cause → habit/remedy → CTA spine as written.`
        : `\n${HEALTH_FRAMEWORK}`
      : isCooking
        ? `\n${COOKING_FRAMEWORK}${
            input.cooking_recipe
              ? `\n${compileCookingRecipeDigest(input.cooking_recipe, input.cooking_style ?? "kitchen_asmr")}`
              : "\nNo canonical Recipe IR was supplied. Do not invent quantities; keep missing recipe facts explicitly unspecified."
          }`
        : isFitness
          ? `\n${FITNESS_FRAMEWORK}`
          : "";

  const dialogueLanguage = input.dialogue_language ?? "Vietnamese";
  const promptLanguage = productionPromptLanguage(input);
  const languageContract = productionLanguageContract(
    promptLanguage,
    dialogueLanguage
  );
  const cookingAsmr =
    isCooking &&
    ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(input.cooking_style ?? "");
  const dialogueBlock = cookingAsmr
    ? `\nDialogue: FORBIDDEN by the selected cooking ASMR profile. Set "dialogue" to "", "speaker" to "", omit dialogue_lines, and use no voice-over/music in EVERY segment.`
    : `\n${speechModeDirective(input, dialogueLanguage)}`;

  // Example beat list sized to the requested count.
  const beatExample = Array.from({ length: beatsPerSegment }, (_, i) => {
    const cams = ["[WIDE] ...", "[CLOSE] ...", "[OTS] ...", "[LOW] ...", "[POV] ..."];
    return `        { "beat": "framing ${i + 1}: the camera reframes the SAME continuous action", "camera": "${cams[i] ?? "[EYE] ..."} — include camera height/angle, named subject, facing/screen relationship and focus target" }`;
  }).join(",\n");

  const hardMarketingArc = new Set<VideoGoal>([
    "marketing_general",
    "product_ad",
    "brand_story",
    "testimonial",
    "promo_sale",
    "social_short",
  ]).has(goal);
  const structureDirective = hardMarketingArc
    ? "This project intent requires an attention-opening first segment and an earned CTA in the final segment; their exact form must still follow the approved script and story logic."
    : "The first segment still requires an intent-appropriate 3-5 second Hook Window, but do NOT turn it into generic marketing clickbait and do NOT automatically add a CTA. The final segment performs only the ending function justified by the approved script.";
  const activeSceneIntentRulesBlock = `\n\n${selectedSceneIntentRulesDigest({
    projectPurpose: input.resolved_context?.layers.project_intent.purpose,
    videoGoal: goal,
    genre: input.genre,
    realityMode: input.resolved_context?.reality_profile.mode,
    continuityMode: input.resolved_context?.layers.motion_continuity.continuity_mode,
  })}`;
  const hasUploadedCharacterReferences = [...referencedCharacterNames].length > 0;
  const firstFrameIdentityRule = hasUploadedCharacterReferences
    ? "For uploaded-reference characters, first_frame_prompt contains only the exact name, position, action and expression; the attached image supplies all appearance."
    : "Restate only the visually necessary character attributes in every first_frame_prompt.";
  const actionDramaBlock = actionDramaRequested(input) ? ACTION_DRAMA_DIRECTOR_PROFILE : "";
  const genreDirectionDirective = compactGenreStoryboardDirective(input);
  const speechMode = resolveSpeechMode(input);
  const anonymousNarrationBlock = speechMode.anonymous_characters
    ? `\n\nANONYMOUS CHARACTER AUTHORITY: audience-facing prose, captions and spoken lines use stable functional role labels only. Internal asset keys may retain the entered names solely to bind reference images. This changes labels only; speech ownership remains exactly the selected SPEECH MODE.`
    : "";
  const stickFigureNarrationBlock = stickFigureWisdomNarrationDirective(input);
  const stylizedNarrationMetadata =
    speechMode.anonymous_characters &&
    speechMode.voice_over &&
    isStylizedCharacterRepresentation(input.character_representation ?? "auto");
  const thumbnailTitleRule = stylizedNarrationMetadata
    ? `string — 2-6 words in ${dialogueLanguage}, concise and emotionally faithful to the actual hook/choice/consequence. Suitable for a stylized story cover; no personal names, fake quotation, unrelated shock claim, meme insult or unearned clickbait.`
    : `string — the SMASH-HOOK printed HUGE on the video's cover, in ${dialogueLanguage}, UPPERCASE, 2-6 words MAX (shorter = stronger). It must sell THIS video's actual curiosity gap. May end with ?! — no hashtags or emoji inside the text; preserve correct Vietnamese diacritics.`;
  const socialPostRules = stylizedNarrationMetadata
    ? `READY-TO-POST captions for THIS exact anonymous stylized story in ${dialogueLanguage}. Refer to the real role/action/choice/consequence and earned lesson; never invent personal names, character quotes, photoreal people, a different setting, product claims or a different moral. Do not repeat the entire narrator script. Use a specific hook, one concise insight and only a natural platform CTA when appropriate. Hashtags mix broad discovery tags with exact topic/style tags such as the story theme and người que/hoạt hình.`
    : `READY-TO-POST captions for THIS exact video, written in ${dialogueLanguage}. Each references the actual story/hook/payoff, never a generic 'check out my video'. Keep it short and emotional with one platform-native CTA when appropriate. Hashtags mix broad discovery and specific topic tags.`;

  return `Create a chained-segment storyboard for this short video.

${languageContract}

${creativeRouteDirective}
${genreDirectionDirective}

Story / Product Idea: ${input.story_idea}
Video Goal: ${goal} — ${goalGuidance}
Genre: ${input.genre}
Visual Style: ${input.style}
Number of SEGMENTS: ${segmentCount} (${clipDurationDescription}; exact total ${totalDuration} seconds)
Beats per segment: ${beatsExactText} progressive camera framings of ONE continuous action inside each 10s clip (use the number the action naturally needs)${activeSceneIntentRulesBlock}${resolvedContextBlock}${scriptBlock}${productBriefBlock}${storyBriefBlock}${numerologyBlock}${dialogueBlock}${anonymousNarrationBlock}${stickFigureNarrationBlock ? `\n\n${stickFigureNarrationBlock}` : ""}${characterBlock}${settingBlock}${shotLocationBlock}${toneBlock}${customBlock}${actionDramaBlock}

Produce EXACTLY ${segmentCount} segments. ${structureDirective} Each segment = ONE continuous take of its declared duration (${clipDurationDescription}) showing a SINGLE primary action, filmed as ${beatsExactText} progressive camera framings (${beatsIsAuto ? "3 to 5" : beatsPerSegment} beats) of that SAME ongoing action — smooth reframes (push-in, pan, angle change), NOT hard cuts to separate shots. Beats preserve a clear chronological order while the subject, props and locked physics stay continuous, but beats and camera notes contain NO numeric timecodes. CONTINUITY IS PROFILE-LED: read resolved_context.layers.motion_continuity.continuity_mode. Strict continuity requires END state N = START state N+1; montage, match-cut, soft, symbolic, dream or scene-cut continuity instead preserves only its declared anchor(s) and may intentionally change location/time. Never force spatial sameness across a declared location/time transition. The "motion_prompt" describes that ONE continuous action as an untimed ordered physical sequence using deliberate, specific verbs (body part + verb + manner) plus an explicit final state/anchor. dialogue_lines.start_s/end_s is the clip's ONLY clock. Keep ONE primary action per clip — never stack multiple actions beyond the model's motion budget. NOTE: the system auto-wraps each motion_prompt with the relevant character/product references, selected style/reality rules, the spoken line and a compact negative list — so do NOT repeat identity details, physics laws, dialogue text or negative lists inside the motion_prompt. ${firstFrameIdentityRule} Inside the motion_prompt use only the exact name plus position, action and expression for an uploaded-reference character.

Return a JSON object with this EXACT structure (the "beats" array must contain ${beatsExactText} items):
{
  "schema_version": "4.0",
  "title": "string — catchy title",
  "synopsis": "string — 2-3 sentences",
  "total_duration_seconds": ${totalDuration},
  "mood_tags": ["3-4 mood keywords"],
  "world_context": {
    "world_type": "string — realistic | cinematic realistic | stylized | fantasy | sci-fi | historical | mythological | surreal | commercial | documentary | animation | hybrid — RESOLVED from the brief, never a blind default",
    "reality_level": "string — exactly one of the 6 REALITY LEVELS from Tầng 0 (e.g. 'Level 2 — Cinematic Reality')",
    "genre": "string — the locked genre",
    "geography": "string — where this world lives (country/region/imaginary place)",
    "culture": "string — the culture governing objects, food, behavior, text, rituals",
    "time_period": "string — locked era (ancient / medieval / specific decade / contemporary / near-future / far-future / timeless-mythic)",
    "technology_level": "string — none / hand-craft / industrial / modern / near-future / far-future / magical",
    "social_class": "string — the social/economic layer props, home and wardrobe must match",
    "environment_category": "string — the locked environment category",
    "visual_style": "string — the locked visual style mode",
    "audio_style": "string — the locked audio world",
    "allowed_language_text": "string — what visible text/scripts may appear (e.g. 'Vietnamese only, minimal', 'none — blur all signage')",
    "forbidden_entities": ["CONCRETE list for THIS world — e.g. for a period piece: smartphones, sneakers, LED lights, modern signage; for modern Vietnam: unexplained foreign signage, random robots"],
    "intentional_exceptions": ["declared exceptions only: intentional contrast / memory / dream / parody / product metaphor / narrative disruption — empty array if none"]
  },
  "thumbnail_title": "${thumbnailTitleRule}",
  "social_posts": {
    "_rules": "${socialPostRules}",
    "tiktok": {
      "caption": "string — 1-2 punchy lines + emoji, open a curiosity gap or call the viewer out, end with a comment-bait question (e.g. 'Bạn thuộc team nào? 👇'). Max ~150 chars.",
      "hashtags": ["4-6 tags — e.g. #fyp/#xuhuong + niche topic tags + 1 series tag"]
    },
    "youtube_shorts": {
      "title": "string — clickable title under ~60 chars: the video's core promise/curiosity gap (may include 1 emoji)",
      "description": "string — 1-2 lines: what the viewer gets + subscribe CTA, keywords from the topic worked in naturally for search",
      "hashtags": ["3-5 tags, MUST include #Shorts, plus niche topic tags"]
    },
    "facebook_reel": {
      "caption": "string — warm, shareable, 2-4 lines: relatable feeling → the video's insight → share/tag CTA ('Gửi cho người cần xem cái này ❤️'). Facebook rewards conversation — end with a question.",
      "hashtags": ["3-5 tags — broad + niche topic tags"]
    }
  },
  "marketing_structure": {
    "hook": "string — the 3s hook line/idea",
    "problem": "string — the pain point addressed",
    "solution": "string — how it is solved/shown",
    "cta": "string — the final call to action"
  },
  "character_locks": [
    {
      "name": "string",
      "gender": "male | female — REQUIRED, NEVER BLANK. If reference-photo pixels are attached to this request, this MUST match the photo's actual gender. If the character is reference-declared but NO pixels are attached (photos are attached later downstream), infer the most likely gender from the approved script/name/role — the user reviews and corrects it in the script editor.",
      "is_child": "boolean — true when this character is a child (e.g. the family's kid). Child stays a child in every shot.",
      "gender_age": "string — NEVER BLANK, even for uploaded-reference characters (this is a coarse casting fact from the approved script, not facial identity): e.g. 'male, ~35 years old' or 'male child, ~6 years old'",
      "build": "string",
      "skin_tone": "string",
      "face_structure": "string — stable whole-face topology: face/skull shape, forehead, temples, cheekbones, cheeks, jaw, chin, ears and visible natural left-right asymmetry; never generic beautification",
      "skin_texture": "string — living age-appropriate skin: pore size/density by facial zone, fine vellus/facial hair and follicles, subtle uneven tone, faint capillaries, freckles/blemishes/healed marks, under-eye texture, fine lines, matte cheeks versus restrained T-zone sheen; never plastic/waxy/porcelain/poreless/airbrushed",
      "eye_details": "string — exact eye/eyelid anatomy: iris colour and radial fibres, pupil, off-white sclera with extremely subtle vessels, moist corneal catchlight and tear line, upper/lower lid folds and under-eye contour",
      "eyebrow_details": "string — exact brow colour, thickness, start/arch/tail plus individual rooted hair direction, density gradient, tapered ends, small gaps, grooming and natural asymmetry; never painted/stamped blocks",
      "eyelash_details": "string — individual upper AND lower lashes: colour, varied length/spacing/curvature/direction, subtle clumping and tiny shadows; never a solid strip, uniform doll fan or duplicate rows unless explicit false lashes are character-accurate",
      "nose_lips_details": "string — stable nose bridge/tip/nostril cartilage, philtrum, lip shape/colour/fine lines/edge softness/hydration, plus naturally off-white and slightly varied teeth only when visible",
      "hair": "string — exact colour, length, cut, curl/wave pattern and hairstyle",
      "hair_details": "string — exact hairline and temple shape, parting, roots, density, limited scalp visibility, strand thickness/texture, baby hairs, sparse flyaways and natural sheen; never helmet/plastic/wig-like hair",
      "eyes": "string",
      "costume": "string — REQUIRED and NEVER BLANK for every character, including uploaded-reference characters: one practical initial outfit DERIVED FROM THE SETTING — the approved location, weather/season, time of day, activity and social role (e.g. rainy street-food stall at night → light rain jacket over casual clothes; office → work attire). Never copy clothing from a character reference photo. Returning an empty costume is a bug.",
      "wardrobe_materials": "string — the REAL materials of the context-locked outfit/props so they don't render fake, e.g. 'olive cotton-canvas jacket with visible weave, charcoal cotton tee, indigo denim twill, worn brown full-grain leather boots with grain, creases and stitching, brushed-steel pen'",
      "signature_features": "string — NEVER BLANK: for text-only characters, distinctive physical/style marks; for uploaded-reference characters, NON-FACIAL contextual marks only (worn accessories, carried props, outfit accents from the locked costume) — never facial identity",
      "default_expression": "string",
      "render_style": "${input.style}",
      "dna": "string — ONE verbatim forensic-DNA line with RGB HEX codes for skin/hair/eyes/wardrobe/brand colours, e.g. 'navy polo #1F2A44, light-blue tee #A9C7E8, matte steel watch #8A8D91, short black side-part hair #14110F, warm tan skin #C8956A, rectangular tortoise glasses'",
      "voice": "string — TẦNG 9 audio law: the character's FULL locked voice profile, identical in every clip. Language, regional accent and dialect come only from the resolved project context or explicit script; never assume a default region. Lock timbre + natural F0 range Hz + rate wpm + emotion band + restrained context-appropriate prosody. Male ≈ 85-140 Hz, female ≈ 180-260 Hz, child ≈ 250-400 Hz; use small human pitch variation, never monotone/Auto-Tuned."
    }
  ],
  "scene_bible": {
    "lens": "string — e.g. '85mm lens, f/1.8' or '100mm macro, f/5.6'",
    "lighting": "string — with Kelvin temps AND approximate Lux, e.g. 'softbox key 4500K + strip rim 5500K, ~600 lux' or 'soft overcast dawn 5200K, ~800 lux'",
    "backdrop": "string — with hex when relevant, e.g. 'modern kitchen, soft window daylight' or 'seamless gradient #40E0D0 to #008080'",
    "color_grade": "string — e.g. 'neutral Rec.709, photoreal premium commercial'",
    "film_grain": "string — filmic realism fingerprint kept constant every clip, e.g. 'clean digital acquisition, minimal chromatic aberration, fine organic film grain'"
  },
  "product_dna": "string — include this field ONLY when there is a real hero product: exact shape, material, colours WITH RGB hex, label/logo text+colour, cap/parts. When there is no product, OMIT this field completely; never write the string 'null'.",
  "segments": [
    {
      "segment_number": 1,
      "duration_seconds": ${affiliateDurations?.[0] ?? 10},
      "title": "string — short segment title",
      "marketing_role": "hook|problem|solution|body|cta — the clip's function; segment 1 opens/hooks, the last segment carries any CTA the project needs",
      "beats": [
${beatExample}
      ],
      "first_frame_prompt": "string — the segment's compact START STATE: describe the shared setting once, then use each visible character's exact name plus position, pose, expression and held/placed props. NEVER repeat gender, age, build, face, skin, hair, brows, lashes, initial outfit, voice or style from character_locks/scene_bible. For a multi-zone scene, obey spatial_layout without rewriting its five clauses.",
      "motion_prompt": "string — a focused ACTION description for ONE continuous take as an UNTIMED chronological sequence. Use exact character names plus observable movement only. Do not repeat identity, appearance, wardrobe, voice, style, topology, physics boilerplate, dialogue text or negatives. A dialogue-heavy 10s clip may contain at most THREE production-changing atomic transitions; a clip with little/no speech may contain at most FIVE. Finish each reach/contact/transfer/release or pose transition before starting the next; never stack a second prop/furniture/pose task under a spoken line. Show the necessary daily-movement mechanics, object-contact/cause chain and final physical result without extra business. NO seconds/time ranges here; dialogue_lines is the only clock.",
      "dialogue": "string — the FIRST turn's spoken line in ${dialogueLanguage} (short, natural). Mirror of dialogue_lines[0].text.",
      "speaker": "string — the EXACT character_locks name of the FIRST turn's speaker (mirror of dialogue_lines[0].speaker). Empty string \\"\\" if voiceover.",
      "dialogue_lines": [
        { "speaker": "exact character_locks name, or \\"\\" only for narrator voiceover", "delivery": "on_screen|off_screen|voiceover", "camera_beat": "1-based beats[] index REQUIRED for on_screen; that exact beat must name/show the speaker. Omit for off_screen/voiceover.", "text": "the spoken line in ${dialogueLanguage}", "start_s": 0, "end_s": 3 }
      ],
      "characters_in_scene": ["REQUIRED — array of EXACT character_locks names VISIBLE in this segment. Every dialogue turn with delivery=on_screen must be listed; a named delivery=off_screen speaker must not be forced into this visible cast."],
      "environment_ref": "string — the environment archetype id from the ENVIRONMENT ENGINE list that matches this segment's setting (e.g. 'misty_mountain_ridge_dawn'), or 'custom' if none fits. Consecutive segments in the same place reuse the same id.",
      "location_id": "string — REQUIRED project-local id copied exactly from RESOLVED CONTEXT IR layers.environment.locations. Never invent a library id here.",
      "continuity_mode": "opening|continuous|scene_cut|location_cut|time_jump|parallel_intercut|match_cut|montage|flashback|dream|symbolic — REQUIRED Schema 4.0 selector and MUST exactly equal transition_in.mode",
      "transition_in": {
        "mode": "opening|continuous|scene_cut|location_cut|time_jump|parallel_intercut|match_cut|montage|flashback|dream|symbolic",
        "from_location_id": "previous project-local location id; omit only for segment 1",
        "to_location_id": "must exactly equal this segment's location_id",
        "time_relation": "compact relation such as same moment / simultaneous phone call / later that evening",
        "preserve": ["only anchors intentionally carried across the edit, e.g. emotion, dialogue, prop id"],
        "reset": ["physical dimensions intentionally reset, e.g. location, pose, lighting"],
        "reason": "short story-grounded justification"
      },
      "state_ledger": {
        "_note": "Track EVERY entity whose continuity matters this clip, in three groups: (A) EACH character PRESENT — entity_id = their exact name, position = their zone+anchor, state = their pose (standing/seated/kneeling/bent); if they move, changes[] MUST carry the visible walk from start zone to end zone. A character whose position differs start→end with NO walk step in changes is a TELEPORT bug — the same person then renders twice. (B) EVERY object any character touches/holds/moves/removes/places this clip — cup, shoe, chair, phone, etc. — NOT only one 'hero' object. (C) EVERY entity that still physically exists in the space, CARRIED FORWARD from the previous clip's end even if this clip focuses on other characters (a shoe removed last clip is still on the floor here; a cup left on the table is still there). For OBJECTS, state/from/to mean INTRINSIC physical condition only (temperature, fullness, integrity, wet/dry, open/closed); NEVER put location, 'on table', contact, possession, 'face up' or 'face down' there — location→position, possession→holder, facing/rotation→orientation. A touch with no persistent result keeps all dimensions unchanged. Passive lawful physics such as warm water gradually cooling uses caused_by='ambient heat exchange over elapsed story time'. HARD RULE: whenever start≠end for ANY entity (object position/holder/orientation/state OR a character's zone), changes[] MUST contain the causal step that produced it — never leave changes empty while a value moved. Do not invent filler entities.",
        "start": [{ "entity_id": "stable id", "state": "intrinsic physical condition only", "position": "zone + anchor", "holder": "exact character name or empty", "orientation": "face-up/face-down/upright/tilted or empty", "traces": ["existing persistent traces"] }],
        "changes": [{ "entity_id": "same stable id", "from": "current intrinsic condition", "from_position": "current zone + anchor", "from_holder": "current exact holder or empty", "from_orientation": "current facing/rotation or empty", "action": "visible reach/contact/grip/move/release/flip chain, or explicit passive physical process", "to": "result intrinsic condition; may equal from for movement/contact/orientation", "to_position": "result zone + anchor", "to_holder": "result exact holder or empty", "to_orientation": "result facing/rotation or empty", "caused_by": "named character/body part/tool/force, or lawful ambient physical process", "trace": "persistent mark or empty" }],
        "end": [{ "entity_id": "same stable id", "state": "final intrinsic condition only", "position": "final zone + anchor", "holder": "final exact holder or empty", "orientation": "final facing/rotation or empty", "traces": ["all persistent traces"] }]
      },
      "spatial_layout": {
        "_note": "Keep EACH field to ONE short clause (≤ 18 words) — this is a compact geometry map, not prose. OMIT the whole spatial_layout object for a simple single-zone scene with no doorway/threshold/stair/counter/railing/edge. mechanism_motion is optional and used only for moving architecture such as a revolving door.",
        "zone_order": "string — ordered connected zones; e.g. balcony scene: room -> doorway/threshold -> balcony floor -> outer railing -> exterior",
        "fixed_architecture": "string — immutable walls/openings/threshold/boundary; what may NEVER cross or block a connector",
        "character_placement": "string — each character: zone + anchor + approx distance + facing; nobody straddles architecture or stands beyond a boundary",
        "walkable_path": "string — continuous route; name the connector for any zone change; keep unobstructed",
        "camera_zone": "string — one real camera zone + side/height + line of sight; never inside a wall or beyond a railing",
        "mechanism_motion": "optional string — revolving door only: classify ENTER / EXIT / PASS-THROUGH / HOLD-INSIDE / BACKGROUND-ONLY, then one direction + one physically consistent compartment state"
      },
      "wardrobe_state": [
        { "character": "exact character name", "outfit": "FULL current outfit description after a visibly motivated change only", "outfit_materials": "real fabric materials", "hair": "current hair state only when the script explicitly changes it" }
      ] /* Every character may use this only for an explicit, visibly motivated change. Otherwise omit and inherit the context-locked initial outfit. */,
      "continuity_note": "string — ONE compact sentence (≤ 35 words): this clip's physical freeze-frame at second 10. The next clip inherits it only when its transition_in.mode is continuous."
    }
  ],
  "style_guide": {
    "color_palette": ["5-7 hex colors"],
    "art_direction": "string",
    "visual_references": "string",
    "consistency_notes": "string"
  }
}`;
}

// ─── Single-segment rewrite (per-scene "Tạo lại" in the script editor) ──────

/**
 * User prompt for rewriting ONE segment after the user edited its dialogue
 * turns in the script editor. The whole action/beats/timing must be
 * re-choreographed around the LOCKED turns while staying chained to the
 * untouched neighbouring segments. Paired with buildStoryboardSystemPrompt()
 * so all production laws (turn-taking, one-action, physics) still govern it.
 */
export function buildSegmentRewriteUserPrompt(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  segmentIndex: number;
}): string {
  const { input, breakdown, segmentIndex } = params;
  const seg = breakdown.segments[segmentIndex]!;
  const prev = breakdown.segments[segmentIndex - 1];
  const next = breakdown.segments[segmentIndex + 1];
  const beatsIsAuto = input.beats_per_segment == null;
  const beatsPerSegment = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const beatsExactText = beatsIsAuto ? "3 to 5" : `EXACTLY ${beatsPerSegment}`;
  const dialogueLanguage = input.dialogue_language ?? "Vietnamese";
  const promptLanguage = productionPromptLanguage(input);
  const continuityMode = breakdown.context_ir?.layers.motion_continuity.continuity_mode ?? "strict";
  const strictContinuity = /strict|one.?shot/i.test(continuityMode);
  const cookingRewriteBlock =
    input.genre === "cooking" && input.cooking_recipe
      ? `\n${compileCookingRecipeDigest(input.cooking_recipe, input.cooking_style ?? "kitchen_asmr")}\nREWRITE ROUTER: preserve the current recipe operation and visible end state. ASMR profiles remain completely wordless; never add dialogue to fill time.`
      : "";

  const uploadedNames = new Set(
    (input.character_images ?? [])
      .filter((entry) => (entry.images?.length ?? 0) > 0)
      .map((entry) => entry.name.trim().toLowerCase())
      .filter(Boolean)
  );
  const castBlock = (breakdown.character_locks ?? [])
    .map((c) => {
      if (uploadedNames.has(c.name.trim().toLowerCase())) {
        return `- ${c.name}: ${REFERENCE_CHARACTER_APPEARANCE_LOCK} Preserve the already locked contextual costume: ${c.costume || "use the established character_locks.costume"}. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}`;
      }
      return `- ${c.name}${c.is_child ? " [CHILD]" : ""}: ${[c.gender_age, c.build, c.hair, c.costume]
        .map((s) => (s ?? "").trim())
        .filter(Boolean)
        .join(", ")}`;
    })
    .join("\n");

  // The user's edited turns are the LOCKED source of truth for this rewrite.
  const turns =
    seg.dialogue_lines && seg.dialogue_lines.length > 0
      ? seg.dialogue_lines
      : seg.dialogue && seg.dialogue.trim()
        ? [{ speaker: seg.speaker ?? "", text: seg.dialogue.trim() }]
        : [];
  const turnsBlock =
    turns.length > 0
      ? turns
          .map((t, i) => `  ${i + 1}. ${t.speaker?.trim() ? t.speaker : "VO (voiceover)"}: "${t.text}"`)
          .join("\n")
      : "  (no dialogue — a wordless beat; the action alone must carry the moment)";

  const prevBlock = prev
    ? `PREVIOUS SEGMENT #${prev.segment_number} (UNCHANGED):\n- Its motion_prompt: ${prev.motion_prompt}\n- Its first_frame_prompt: ${prev.first_frame_prompt}`
    : "This is the FIRST segment. Its opening function comes from scene_intent; do not automatically turn it into a marketing hook.";
  const nextBlock = next
    ? `NEXT SEGMENT #${next.segment_number} (UNCHANGED):\n- Its first_frame_prompt: ${next.first_frame_prompt}\n- Its first dialogue line: ${next.dialogue ?? "(none)"}`
    : "This is the LAST segment. Its ending function comes from scene_intent; do not invent a CTA unless the project intent requires one.";

  return `REWRITE EXACTLY ONE SEGMENT of an existing storyboard. The user edited this segment's dialogue turns in the editor, so its action/beats/timing no longer match — re-choreograph the WHOLE segment around the new turns. Everything else in the video is already approved and stays untouched.

${productionLanguageContract(promptLanguage, dialogueLanguage)}

FULL CAST (character_locks — use these EXACT names):
${castBlock || "- (voiceover only)"}

SCENE BIBLE (identical in every clip): ${breakdown.scene_bible ? `${breakdown.scene_bible.lens}; ${breakdown.scene_bible.lighting}; ${breakdown.scene_bible.backdrop}; ${breakdown.scene_bible.color_grade}` : "n/a"}
Visual style: ${input.style} · Genre: ${input.genre} · Dialogue language: ${dialogueLanguage}${worldContextLockBlock(breakdown.world_context) ? `\n${worldContextLockBlock(breakdown.world_context).trim()}` : ""}
${cookingRewriteBlock}

${prevBlock}

${nextBlock}

THE SEGMENT TO REWRITE — #${seg.segment_number} "${seg.title}" (marketing_role: ${seg.marketing_role}, duration: ${seg.duration_seconds || 10}s, environment_ref: ${seg.environment_ref ?? "custom"}):
Current first_frame_prompt: ${seg.first_frame_prompt}
Current motion_prompt (STALE — written before the dialogue changed): ${seg.motion_prompt}
Current spatial_layout: ${seg.spatial_layout ? JSON.stringify(seg.spatial_layout) : "(missing — create it when this scene has multiple zones, a doorway/threshold, stairs, counter divider, railing, platform or exposed edge)"}

LOCKED DIALOGUE TURNS (the user's final text — copy each line VERBATIM, same speaker, same order; do NOT add, drop, reword or reassign any line):
${turnsBlock}

REWRITE RULES:
1. Re-time the turns realistically (~0.4s per word ≈ 150 wpm + ~0.5s beat between speakers), strictly sequential and non-overlapping, finished by ~9s. HARD CAP: if the turns cannot all fit ~9s at this natural pace (about 22–24 spoken words total for the clip), SHORTEN the wordiest turn(s) by cutting words — never compress a turn faster than ~0.32s/word (190 wpm) and never speed up speech to fit. Fill "dialogue_lines" with start_s/end_s for every turn; every delivery=on_screen turn also receives camera_beat pointing to the 1-based beats[] item that explicitly names/shows that speaker. Omit camera_beat for off_screen/voiceover. Mirror turn 1 into "dialogue" and "speaker".
2. Rewrite "motion_prompt" (70-110 words) as ONE untimed chronological physical sequence. State who addresses whom and the listener's silent reaction, but put NO seconds/time ranges, quoted dialogue or camera schedule in motion_prompt. Speech may accompany an ordinary body transition when the line, breath and context make it natural; otherwise place the larger movement before/after the line. DAILY-MOVEMENT MICRO-GRAMMAR: every sit / stand / walk / door-open / carry action shows its real mechanics and weight transfer (never jump states) — opening a door = reach handle → grip → hinge/slide moves → cross the threshold; carrying furniture = grip → lift countering the load → walk the continuous path → set down before releasing. CAUSAL CHAIN: every object interaction visibly follows reach → contact/grip → continuous transfer → release; every fall/open/spill has a visible cause first; all used props already exist in first_frame_prompt; the whole clip stays in ONE location. Keep the physical load light and meaningful.
3. Rewrite "beats" (${beatsExactText} beats) as untimed progressive framings of the same continuous action. CAMERA DOES NOT ASSIGN SPEECH: it may hold the speaker, listener reaction or both; camera notes contain no dialogue timecodes, use one calm smooth move and never force the framed person to lip-sync.
4. Update "first_frame_prompt" only as needed: keep the same location/light, then use exact character names plus position, pose, action, expression and props only. Never restate appearance, initial wardrobe or voice from character_locks. Set "characters_in_scene" to the EXACT visible lock names — include every on_screen speaker, but do not force a named off_screen speaker into the camera beat.
5. SPATIAL TOPOLOGY: preserve the existing spatial_layout when it is physically valid; otherwise repair it without changing the intended location. For every multi-zone/doorway/boundary scene return all five core fields: ordered connected zones; immutable architecture/openings/boundaries; exact character zone + anchor distance + facing; one unobstructed walkable route; one real supported camera zone. first_frame_prompt, beats and motion_prompt MUST all obey this same map. Doorways/thresholds remain unobstructed; railings/guards remain only on the true exposed edge; nobody or the camera stands beyond them; zone changes visibly cross the declared connector. REVOLVING DOOR ONLY: classify ENTER / EXIT / PASS-THROUGH / HOLD-INSIDE / BACKGROUND-ONLY before writing mechanism_motion. EXIT opens with the character still in the same occupied wedge and crosses the destination threshold once at physical alignment; BACKGROUND-ONLY never invents an occupant. Never cross glass, reverse, change compartments or repeat a crossing.
6. HARD CONSTRAINTS: keep "segment_number" = ${seg.segment_number}, "duration_seconds" = ${seg.duration_seconds || 10}, "marketing_role" = "${seg.marketing_role}", "environment_ref" = "${seg.environment_ref ?? "custom"}", "location_id" = "${seg.location_id ?? ""}", and preserve transition_in.mode/from_location_id/to_location_id. Set continuity_mode exactly equal to transition_in.mode. Locked project continuity profile = "${continuityMode}". ${strictContinuity ? "Open from the previous segment's exact end state and close on the next segment's exact opening state." : "Preserve only the continuity anchors declared by transition_in/context; location, time or pose may change when this transition explicitly permits it."} Rebuild state_ledger for the rewritten action and update continuity_note accordingly.
7. continuity_note = PHYSICAL SCENE STATE ONLY (who is where, holding what, in which pose/emotion, carried into the next shot). STRICTLY FORBIDDEN inside continuity_note, first_frame_prompt, motion_prompt and beats: numeric timecodes, production/meta commentary, word counts, wpm math, "moved to segment N", duration notes, quoted dialogue or editor notes. Only dialogue_lines.start_s/end_s may contain seconds.

Return ONLY the rewritten segment as ONE JSON object with the exact segment structure (segment_number, duration_seconds, title, marketing_role, beats[], first_frame_prompt, motion_prompt, dialogue, speaker, dialogue_lines[], characters_in_scene[], environment_ref, location_id, continuity_mode, transition_in{}, state_ledger{}, spatial_layout{}, wardrobe_state[] — copy the segment's existing wardrobe_state unchanged if it has one, continuity_note) — no wrapper, no markdown, no prose.`;
}

/**
 * Lớp C repair prompt. Unlike the editor's manual single-segment rewrite, this
 * prompt receives deterministic A+B findings and returns only the failing
 * segments in one compact batch. Clean scenes and project locks are read-only.
 */
export function buildStoryboardRepairUserPrompt(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  segmentNumbers: number[];
  characterNames: string[];
  findings: Array<{
    code: string;
    severity: string;
    scope: string;
    segment_number?: number;
    character?: string;
    message: string;
    evidence?: string;
  }>;
  round: number;
}): string {
  const {
    input,
    breakdown,
    segmentNumbers,
    characterNames,
    findings,
    round,
  } = params;
  const targets = new Set(segmentNumbers);
  const targetSegments = breakdown.segments.filter((segment) =>
    targets.has(segment.segment_number)
  );
  const targetIndexes = new Set(
    targetSegments
      .map((segment) => breakdown.segments.indexOf(segment))
      .filter((index) => index >= 0)
  );
  const neighbourSegments = breakdown.segments
    .filter((_segment, index) => targetIndexes.has(index - 1) || targetIndexes.has(index + 1))
    .filter((segment) => !targets.has(segment.segment_number))
    .map((segment) => ({
      segment_number: segment.segment_number,
      location_id: segment.location_id,
      transition_in: segment.transition_in,
      first_frame_prompt: segment.first_frame_prompt,
      motion_prompt: segment.motion_prompt,
      continuity_note: segment.continuity_note,
      state_ledger: segment.state_ledger,
    }));
  const dialogueLanguage =
    input.dialogue_language ??
    breakdown.context_ir?.layers.audio_validation.language ??
    "the locked project language";
  const promptLanguage = productionPromptLanguage(input);
  const lockedProject = {
    context_ir: breakdown.context_ir,
    world_context: breakdown.world_context,
    scene_bible: breakdown.scene_bible,
    character_locks: breakdown.character_locks,
    product_dna: breakdown.product_dna,
  };
  const targetCharacterSet = new Set(
    characterNames.map((name) => name.trim().toLowerCase())
  );
  const targetCharacterLocks = breakdown.character_locks.filter((lock) =>
    targetCharacterSet.has(lock.name.trim().toLowerCase())
  );
  const report = findings.map((finding) => ({
    code: finding.code,
    severity: finding.severity,
    scope: finding.scope,
    segment_number: finding.segment_number,
    character: finding.character,
    message: finding.message,
    evidence: finding.evidence,
  }));

  return `LAYER C — TARGETED STORYBOARD REPAIR, ROUND ${round}.

${productionLanguageContract(promptLanguage, dialogueLanguage)}

The deterministic Layer A+B validator rejected only the listed storyboard segments. Repair those segments until every reported critical/high defect is gone. This is a PRE-RENDER text/JSON repair: do not create, request or discuss images or video renders.

IMMUTABLE PROJECT AUTHORITY:
${JSON.stringify(lockedProject)}

DETERMINISTIC VALIDATOR REPORT:
${JSON.stringify(report)}

TARGET SEGMENTS — return every one exactly once:
${JSON.stringify(targetSegments)}

TARGET CHARACTER LOCKS — return one safe repair per requested name:
${JSON.stringify(targetCharacterLocks)}

READ-ONLY IMMEDIATE NEIGHBOURS — continuity context only, never return or edit them:
${JSON.stringify(neighbourSegments)}

REPAIR CONTRACT:
1. Modify ONLY segment numbers ${segmentNumbers.join(", ") || "(none)"} and character locks ${characterNames.join(", ") || "(none)"}. Do not rewrite the title, synopsis, Context IR, scene_bible, product DNA, clean segments or clean character locks.
2. Preserve each target's segment_number, duration_seconds and marketing_role exactly.
3. Preserve every dialogue line and its named speaker VERBATIM in ${dialogueLanguage}; only repair start_s/end_s timing when DLG-001 requires it. Never add, remove, paraphrase, translate or reassign dialogue.
4. Fix the validator's concrete evidence, not merely its wording. Make first_frame_prompt, motion_prompt, beats, characters_in_scene, environment_ref, location_id, continuity_mode, transition_in, state_ledger, spatial_layout and continuity_note agree with one another. continuity_mode must exactly equal transition_in.mode.
5. The locked Context IR is the authority. Use only declared location ids and allowed transition modes. A continuous boundary inherits the previous end state exactly. An editorial cut opens from its own declared start state and preserves/resets only transition_in fields.
6. Every state change follows cause → visible action/contact → result → persistent end state. Keep ledger dimensions separate: state/from/to are INTRINSIC condition only; position fields own location; holder fields own possession; orientation fields own face-up/face-down/upright/tilted rotation. Never encode those relations as state. Touching without movement keeps all dimensions unchanged; lifting changes position/holder; flipping changes orientation through the visible action. Passive lawful physics such as warm exposed liquid cooling may use ambient heat exchange over elapsed story time as its cause and needs no character contact. Track only the 3–6 most salient real entities; never invent filler entities.
7. Keep real body mechanics, material response, object permanence, environmental topology, time/light logic, character identity, wardrobe, voice and scene intent consistent with the project's locked 10 layers.
8. Do not hide an error with vague phrases such as "same as before", "continues naturally" or "consistent setting". Write the actual physical state.
9. For a target character, repair only gender, costume/wardrobe materials or voice fields named by the report. Keep the exact name and never reinterpret face, body, ethnicity, age, hair or reference-image identity. When duplicate locks share one name, return one repaired lock for that name.
10. ACTION CAPACITY REPAIR: a dialogue-heavy 10s target may keep at most THREE production-changing atomic transitions; a target with little/no speech may keep at most FIVE. Preserve every approved spoken line and the scene's narrative result, but remove invented secondary business and reduce choreography to one ordered causal unit. Each transition completes before the next begins; do not overlap a new prop transfer, chair/furniture move, sit/stand or relocation with another transition or spoken turn.
11. Return valid JSON only in this exact wrapper: {"segments":[...],"character_locks":[...]} — use an empty array for a target kind that is absent; no markdown, critique, explanation, confidence score or extra keys.`;
}

/**
 * Compact semantic critic for defects that deterministic regex/structure gates
 * cannot judge reliably. It reports only actionable critical/high findings;
 * the separate repair call performs mutations.
 */
export function buildStoryboardCriticUserPrompt(params: {
  input: StoryboardGenerationInput;
  breakdown: StoryboardGenerationOutput;
  round: number;
}): string {
  const { input, breakdown, round } = params;
  const criticPayload = {
    project_intent:
      breakdown.context_ir?.layers.project_intent ?? {
        genre: input.genre,
        video_goal: input.video_goal,
      },
    context_ir: breakdown.context_ir,
    world_context: breakdown.world_context,
    character_locks: breakdown.character_locks,
    product_dna: breakdown.product_dna,
    scene_bible: breakdown.scene_bible,
    segments: breakdown.segments,
  };

  return `LỚP C SEMANTIC CRITIC — AUDIT ${round}.

Audit this PRE-RENDER storyboard JSON against its own locked 10-layer context. Do not rewrite anything and do not request/generate images or video.

STORYBOARD AUTHORITY:
${JSON.stringify(criticPayload)}

REPORT ONLY objective, production-breaking defects that cannot be dismissed as creative taste:
- ontology/culture/era entities outside the locked world without an intentional exception;
- impossible environment topology, blocked routes, contradictory character/camera placement or 180-degree continuity;
- prop/body teleportation, state changes without a cause, contact or visible path;
- a continuous boundary whose opening contradicts the previous physical end state;
- an editorial cut that accidentally inherits fields declared for reset;
- character identity, wardrobe, relationship, emotional or voice ownership drift;
- scene action contradicting its intended location/time/light or declared transition;
- dialogue ownership, timing or listener lip-sync contradictions;
- motion that skips anatomical preparation, weight transfer, contact, material reaction or persistent trace when those details are essential to the visible action.

Do NOT report:
- personal style preferences, optional improvements or medium-severity advice;
- a deliberate location/time/style change declared by transition_in;
- photoreal requirements for animation/stylized projects;
- background details that are not salient or not visible;
- defects already absent from the supplied JSON.
- a missing cause/contact when state_ledger.action + caused_by or motion_prompt already explicitly shows reach, touch, grip, lift, place, release or another physically sufficient cause. "Touches the glass" is valid visible contact; "grips then lifts the glass from the table" is a valid cause and visible path. Do not demand a second duplicate action.
- a same-intrinsic-state relation change whose position/holder dimensions correctly record a visible touch, pickup, hold or placement. state is intrinsic condition; position and holder are separate authorities.
- a camera scale/framing choice as a placement contradiction. A wide shot can validly show two people at their declared anchors several metres apart; framing never relocates a character. Report only concrete impossible geometry such as a body inside a wall, beyond a barrier or blocking a required route.
- dialogue quality, indirectness, subtext or whether a reply "directly answers" the previous line. Preserve the approved dialogue; audit only wrong speaker/voice/lip-sync ownership or impossible timing.
- whether spoken words explicitly narrate the acting emotion. A lowered gaze, pause or restrained gesture may carry regret as subtext without the dialogue stating it.
- lawful passive physics: an exposed warm object/liquid may cool through ambient heat exchange over elapsed story time without character contact. This is a cause, not teleportation.

Every finding must identify the exact segment_number or character name whenever possible. Use scope="project" only when no local target can fix it. Severity must be "critical" or "high".

Return JSON only:
{"clean":true|false,"findings":[{"code":"CRITIC-*","severity":"critical|high","scope":"segment|character|project","segment_number":0,"character":"","message":"specific defect","evidence":"exact contradictory values"}]}

When clean, return {"clean":true,"findings":[]}.`;
}

// ─── Render style helpers ───────────────────────────────────────────────────

const PHOTO_STYLES = new Set([
  "realistic",
  "cinematic",
  "commercial",
  "ugc",
  "product_showcase",
  "corporate_clean",
]);

export function isPhotoStyle(style: string): boolean {
  return PHOTO_STYLES.has(style);
}

function renderDirective(style: string, preserveRealFace: boolean): string {
  if (isPhotoStyle(style)) {
    if (preserveRealFace) {
      return `RENDER AS REAL PHOTOGRAPHY: the attached named character image is the sole authority for appearance; follow it exactly and do not describe or reinterpret the person in text. Avoid only these character-surface artifacts: ${REFERENCE_CHARACTER_ANTI_PLASTIC}. Every panel must look like real filmed footage; no cartoon, anime, illustration or CGI rendering.`;
    }
    return `RENDER AS REAL PHOTOGRAPHY: photorealistic, lifelike, real human beings photographed with a real camera, cinematic photography quality. ${HUMAN_FACE_REALISM_LOCK} ABSOLUTELY FORBIDDEN: cartoon, anime, comic, manga, illustration, drawing, sketch, painting, 2D/3D animation, Pixar/Disney look, CGI render, vector art, flat shading, ${HUMAN_FACE_REALISM_NEGATIVE} — every panel and every person must look like a frame from real filmed footage.`;
  }
  return `${style} art style.${
    preserveRealFace
      ? ` The attached named character image is the sole appearance authority; do not describe or reinterpret it. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`
      : ""
  }`;
}

export type RefRole = "face" | "product" | "dish" | "ingredient" | "component" | "setting" | "character_sheet" | "anchor" | "character";

export interface RefDescriptor {
  role: RefRole;
  /** Optional vision-derived description that reinforces the photo. */
  description?: string;
  /** For role "character": the exact name of the person in this photo, so the
   * model binds the right face to the right named character in a 2-3 person scene. */
  name?: string;
  /** Uploaded menu angle. First image is front; second is profile/three-quarter. */
  view?: "front" | "profile";
}

/**
 * Builds SEMANTIC reference instructions. Google DeepMind's guide warns
 * that positional labels ("image 2") get misread as "output a copy of
 * image 2"; semantic naming ("the man in the portrait photo") works far
 * better and an optional text description (from vision analysis) makes
 * the photo + text agree, which the model then obeys.
 */
export function buildReferenceInstructions(refs: RefDescriptor[]): string {
  if (refs.length === 0) return "";
  const hasCharacterReference = refs.some((r) =>
    r.role === "character" || r.role === "face" || r.role === "character_sheet"
  );
  const lines = refs.map((r) => {
    const d = r.description ? ` (${r.description.replace(/\s+/g, " ").slice(0, 220)})` : "";
    switch (r.role) {
      case "character_sheet":
        return `• THE CHARACTER — the attached named character reference sheet is the sole identity/anatomy authority. Follow face, body proportions and hair exactly; do not copy its clothing. Use only the separately context-locked story outfit. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`;
      case "face":
        return `• THE CHARACTER — the attached portrait is the sole identity/anatomy authority. Follow the image exactly for face, skin, hair, eyebrows, eyelashes, body and age; do not copy clothing from it. Use only the separately context-locked story outfit. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`;
      case "character":
        return `• CHARACTER "${r.name ?? "person"}" — attached named USER MENU image (${r.view === "profile" ? "profile / three-quarter" : "front"}) is the sole appearance authority for this character. Bind the image only to this exact name; do not describe, reinterpret, merge or swap the appearance. Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`;
      case "product":
        return `• THE PRODUCT — feature the EXACT product shown in the attached product photo${d}. Keep its EXACT shape, silhouette, colour, material, proportions, handle/parts and branding identical in every single shot. Do NOT redesign, recolour, distort, resize, age, damage or swap it for a different object.`;
      case "dish":
        return `• FINISHED-DISH REFERENCE — the attached food photo${d} is authoritative for the real serving vessel, portion geometry, sauce colour/viscosity, topping placement, texture and steam. Use it for the opening Hook preview and final payoff; this is food, never packaging, branding or a retail product.`;
      case "ingredient":
        return `• FOOD INGREDIENT REFERENCE — the attached user photo${d} defines the real colour, shape, cut/state, moisture and texture of these ingredients. Render only ingredients required by the current recipe step; never copy the entire reference set into every frame and never infer quantities from the photo.`;
      case "component":
        return `• AUXILIARY OBJECT / COMPONENT REFERENCE — the attached user photo${d} defines this named ordinary object/component. Preserve its physical form, material, colour, proportions and visible parts. Include it only when the scene explicitly calls for it; it is NOT food and must never introduce cooking actions, kitchen imagery or recipe ingredients.`;
      case "setting":
        return `• THE LOCATION OVERVIEW — the attached USER MENU environment photo${d} is authoritative, whether it is an INDOOR room or an OUTDOOR scene. Include one small overview reference panel and reproduce its real spatial layout, colours, materials, lighting and every landmark (furniture and fixtures indoors; structures, trees, terrain, water, sky/horizon outdoors) in every relevant action panel; do not invent a replacement location.`;
      case "anchor":
        return hasCharacterReference
          ? "• SECONDARY BOARD ANCHOR — composition/continuity aid only. It must never override a named uploaded character image or add appearance, hair, wardrobe or accessory text."
          : `• WARDROBE & LOOK ANCHOR — the attached already-approved storyboard frame shows the character in the EXACT outfit, hairstyle and accessories to use. Copy the clothing (type, cut and colours) and every accessory (watch, glasses if any) EXACTLY in this board. Do NOT change the outfit — never switch to a suit, jacket, apron or a different shirt unless it appears in this anchor. It is the SAME character.`;
      default:
        return `• Reference — keep it consistent.`;
    }
  });
  return `REFERENCE PRIORITY CONTRACT — these references came from the user's setup menu and outrank generated anchors, inferred descriptions, defaults and aesthetic choices. Preserve every uploaded character as a separate named identity and preserve the uploaded location. Character images are pixel authority and must never be converted into competing prose. Follow them exactly:\n${lines.join("\n")}\n\n`;
}

// ─── Step 2: Character Reference Sheet Image Prompt ─────────────────────────

export function buildCharacterRefSheetPrompt(params: {
  characterLock: {
    name: string;
    gender_age: string;
    build: string;
    skin_tone: string;
    face_structure?: string;
    skin_texture?: string;
    eye_details?: string;
    eyebrow_details?: string;
    eyelash_details?: string;
    nose_lips_details?: string;
    hair: string;
    hair_details?: string;
    eyes: string;
    costume: string;
    signature_features: string;
    default_expression: string;
    render_style: string;
    dna?: string;
  };
  props?: string[];
  colorPalette?: string[];
  style?: string;
  sceneBible?: SceneBible;
  preserveRealFace?: boolean;
  references?: RefDescriptor[];
}): string {
  const c = params.characterLock;
  const style = params.style ?? c.render_style;
  const directive = renderDirective(style, params.preserveRealFace ?? false);
  const refBlock = buildReferenceInstructions(params.references ?? []);
  const tokens = sceneBibleTokens(params.sceneBible);
  const usesUploadedCharacterReference = params.preserveRealFace ?? false;
  const facialDetailLine = usesUploadedCharacterReference
    ? ""
    : [
        c.face_structure,
        c.skin_texture,
        c.eye_details,
        c.eyebrow_details,
        c.eyelash_details,
        c.nose_lips_details,
        c.hair_details,
      ]
        .filter(Boolean)
        .join(". ");

  const colorSwatches =
    params.colorPalette && params.colorPalette.length > 0
      ? params.colorPalette.slice(0, 6).join(", ")
      : "#F5E6D3, #8B4513, #2D5016, #FFFFFF, #1A1A1A, #D4A574";

  const hasSetting = (params.references ?? []).some((r) => r.role === "setting");
  const characterSummary = usesUploadedCharacterReference
    ? `CHARACTER — ${c.name}: ${REFERENCE_CHARACTER_APPEARANCE_LOCK} Avoid only: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`
    : `CHARACTER — ${c.name}: ${c.gender_age}, ${c.build} build, ${c.skin_tone} skin, ${c.hair} hair, ${c.eyes} eyes.${facialDetailLine ? ` ${facialDetailLine}.` : ""} Wearing ${c.costume}. ${c.signature_features}.`;
  const characterDna = !usesUploadedCharacterReference && c.dna
    ? `FORENSIC DNA (exact colours, keep identical everywhere): ${c.dna}.\n`
    : "";
  const negative = usesUploadedCharacterReference
    ? `Avoid only these character-surface artifacts: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`
    : SHARED_NEGATIVE;

  return `${refBlock}Professional compact CHARACTER REFERENCE SHEET, single horizontal image, clean light studio background.

${characterSummary}
${characterDna}${tokens ? tokens + "\n" : ""}
EXACT LAYOUT (all in one image):
${usesUploadedCharacterReference
    ? "■ ATTACHED CHARACTER REFERENCE: use only the supplied portrait(s) as-is; do not synthesize a profile, new expression or alternate face."
    : `■ "FRONT / CHÍNH DIỆN": one large HEAD-AND-SHOULDERS portrait, ${c.default_expression} expression, face tack-sharp.\n■ "PROFILE / GÓC NGHIÊNG": one large HEAD-AND-SHOULDERS side-profile or 3/4 portrait of the SAME person.`}
■ "ENVIRONMENT OVERVIEW": one small wide thumbnail ${hasSetting ? "reproducing the uploaded location reference exactly" : "showing the stable surrounding environment used by the story"}.
■ THIN FOOTER: 6 small circular colour swatches: ${colorSwatches}.

${directive}

RULES: ${usesUploadedCharacterReference ? "use only the attached character image(s) without inventing alternate appearance views" : "exactly two identity portraits"} plus one small environment overview; NO full-body pose, NO back view, NO turnaround row, NO expression grid; small bold labels; one cohesive image. ${negative}`;
}

// ─── Step 3: Per-Segment Storyboard Strip (3 shots in one 10s clip) ──────────

export function buildSegmentFirstFramePrompt(params: {
  segmentNumber: number;
  firstFramePrompt: string;
  beats: { beat: string; camera: string }[];
  characterDescription: string;
  /** CAST-SYNC: every character VISIBLE in this segment (name + locked look).
   * When set, the board renders a labelled reference strip for EACH of them
   * and ONLY they may appear in the panels. */
  presentCharacters?: { name: string; description: string; isChild?: boolean }[];
  /** Verbatim product DNA (with RGB) when a hero product exists. */
  productDna?: string;
  /** Named auxiliary ingredients to illustrate & label, e.g. "papaya powder (orange); selenium crystals (silver)". */
  ingredients?: string;
  /** Scene Bible style tokens, repeated verbatim across boards. */
  sceneBible?: SceneBible;
  style: string;
  isFirst: boolean;
  /** Number of action panels to render (3-5). Defaults to the beat count. */
  beatsPerSegment?: number;
  preserveRealFace?: boolean;
  references?: RefDescriptor[];
  /** Expression heads to add to the ref strip on top of the 3 angles (0-3). */
  referenceExpressions?: number;
  /** Compiled topic/character/directing lock from the ordered creative route. */
  creativeDirective?: string;
}): string {
  const directive = renderDirective(params.style, params.preserveRealFace ?? false);
  const refBlock = buildReferenceInstructions(params.references ?? []);
  const tokens = sceneBibleTokens(params.sceneBible);

  const hasProduct =
    (params.references ?? []).some((r) => r.role === "product") || !!params.productDna;
  const hasSetting = (params.references ?? []).some((r) => r.role === "setting");
  const hasFoodIngredients = (params.references ?? []).some((r) => r.role === "ingredient");

  const target = Math.min(5, Math.max(3, params.beatsPerSegment ?? params.beats.length ?? 3));
  const beats = params.beats.slice(0, target);
  while (beats.length < target) {
    beats.push({ beat: params.firstFramePrompt, camera: "[EYE]" });
  }
  const panelLines = beats
    .map((b, i) => `Action panel ${i + 1} (${b.camera}): ${b.beat}`)
    .join("\n");
  const numberLabels = beats.map((_, i) => i + 1).join(", ");

  const continuity = params.isFirst
    ? "This is the opening shot of the whole video."
    : "Action panel 1 must continue seamlessly from the previous shot's final action (same character, wardrobe, lighting, location).";

  // Compact identity library: exactly two face-readable views per person. This
  // leaves room for more named characters plus a location overview without
  // wasting board area on full-body/back turnarounds.
  const cast = params.presentCharacters ?? [];
  const isMultiCast = cast.length > 1;
  const refStrip = isMultiCast
    ? `${params.preserveRealFace ? "the attached named portrait(s) only for EACH" : "a compact 2-column portrait pair for EACH"} of the ${cast.length} characters in this shot, grouped per person and clearly LABELLED with their NAME: ${cast
        .map((c) =>
          params.preserveRealFace
            ? `— "${c.name.toUpperCase()}"${c.isChild ? " (CHILD)" : ""}: use only the attached image(s); do not synthesize a new angle or restate appearance`
            : `— "${c.name.toUpperCase()}"${c.isChild ? " (CHILD — correct child age and face)" : ""}: exactly TWO HEAD-AND-SHOULDERS portraits, (1) FRONT / chính diện and (2) SIDE PROFILE or 3/4 / góc nghiêng; face sharp and readable`
        )
        .join("; ")}. ${params.preserveRealFace ? "Each attached named image is the sole authority for its character's appearance; never translate it into prose." : "Keep every generated character consistent."}`
    : params.preserveRealFace
      ? "the attached named character portrait only; do not synthesize a second angle, redraw the face or translate the image into prose"
      : "exactly TWO clearly-visible HEAD-AND-SHOULDERS portraits of the SAME main character: (1) FRONT / chính diện and (2) SIDE PROFILE or 3/4 / góc nghiêng. Keep the generated appearance consistent. NO full-body view, NO back view, NO extra expression grid.";
  const castDescription = isMultiCast
    ? cast.map((c) => `${c.name}${c.isChild ? " (child)" : ""}: ${c.description}`).join(" | ")
    : params.characterDescription;
  const castLock = isMultiCast
    ? ` CAST LOCK: the scene overview and every action panel contain EXACTLY these ${cast.length} characters — ${cast
        .map((c) => c.name)
        .join(", ")} — and NOBODY else; no extra people, no duplicates of a character in the same panel; every action caption names WHO does the action; relative heights stay true (a child is clearly smaller than the adults).`
    : "";

  const referenceLayoutRule = params.preserveRealFace
    ? "the attached named character image(s) only; do not synthesize alternate angles, redraw faces or translate appearance into prose"
    : "EXACTLY two portrait angles per visible character";

  return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}SHOT ${params.segmentNumber} — a complete STORYBOARD BOARD for HUMAN REVIEW and planning of ONE ~10 second video clip, presented as ONE single horizontal image. This document shows who the character${isMultiCast ? "s are" : " is"}, what the scene looks like${hasProduct ? ", the product" : ""}, and the ${target} actions across the clip. It must NEVER be used as an image-to-video start frame; use the separate clean keyframe for that. ${params.style} style.

THE BOARD CONTAINS THESE ZONES IN ONE IMAGE:

■ TOP / LEFT — "CHARACTER REFERENCES" compact thumbnail grid (REPEAT THIS IN EVERY SHOT; reserve about 25-32% of the board): ${refStrip} Each portrait may be smaller than before, but every face remains sharp and readable. Uploaded menu portraits are HIGHEST PRIORITY. Label "CHARACTER REF". Character${isMultiCast ? "s" : ""}: ${castDescription}.${castLock}

■ SMALL "ENVIRONMENT OVERVIEW" REFERENCE: one compact wide establishing thumbnail showing the surrounding room/location before the action${hasProduct ? ", with the product visible at natural scale" : ""}. This overview is MANDATORY even when space is tight. ${hasSetting ? "Reproduce the EXACT uploaded location overview — same room geometry, furniture placement, doors/windows, materials, colours and lighting. This same environment must remain behind every action panel." : "Derive one stable environment from the scene context and reuse it behind every action panel."}

■ RIGHT / BOTTOM — "ACTION SEQUENCE": ${target} numbered action panels (${numberLabels}) laid out left → right showing the ${target} key moments across the 10 seconds, each a small ${isPhotoStyle(params.style) ? "PHOTOGRAPHIC cinematic still (a real photo frame — not a drawing or illustration)" : `${params.style} illustration`} with a SHORT caption under it describing the action:
${panelLines}

SCENE CONTEXT for all panels: ${params.firstFramePrompt}
${params.productDna ? `HERO PRODUCT / DISH DNA (identical where present): ${params.productDna}\n` : ""}${params.ingredients ? `${hasFoodIngredients ? "RELEVANT FOOD INGREDIENTS" : "RELEVANT AUXILIARY OBJECTS / COMPONENTS"} (render physically; no written labels): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}
${continuity}
${directive}

RULES: ONE cohesive board image; reference area contains ${referenceLayoutRule} plus one environment overview — never full-body/back turnaround refs; ${params.preserveRealFace ? "each attached named character image is the sole appearance authority; do not describe or reinterpret appearance, and only the named cast appears" : isMultiCast ? `each of the ${cast.length} named characters keeps one consistent generated appearance everywhere and ONLY the named cast appears` : "the same generated individual remains consistent everywhere"}; the SAME product appears consistently; ${hasSetting ? "the SAME exact uploaded location" : "one single consistent location"} for this whole board; thin clean dividers and small numbered badges; captions short and legible. ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
}

// ─── Clean single KEYFRAME (veoflow handoff format) ─────────────────────────
// One static photographic first-frame per 10s clip — the actual image-to-video
// reference for Veo. Follows veoflow's keyframe recipe: shot+composition +
// subject forensic DNA + props + backdrop + lighting/lens/grade + style +
// aspect + negative. Camera-motion verbs, timeline markers and dialogue are
// stripped because this is a single frozen frame.
export function buildKeyframePrompt(params: {
  segmentNumber: number;
  sceneDescription: string;
  shot: string;
  characterDescription: string;
  productDna?: string;
  ingredients?: string;
  sceneBible?: SceneBible;
  style: string;
  aspectRatio: AspectRatio;
  preserveRealFace?: boolean;
  references?: RefDescriptor[];
  /** When this clip has a spoken line, frame the keyframe for clean lip-sync:
   * the character faces the camera with the mouth clearly visible. */
  hasDialogue?: boolean;
  /** Name of who speaks this clip — in a 2-3 person scene we frame THIS person
   * toward camera (the others listen). */
  speakerName?: string | null;
  /** Environment archetype id (segment.environment_ref); auto-matched from the
   * scene description when absent. */
  environmentRef?: string | null;
  /** CAST-SYNC: everyone visible in this clip (name + locked look). Only these
   * people may appear in the keyframe. */
  presentCharacters?: { name: string; description: string; isChild?: boolean }[];
  /** Compiled topic/character/directing lock from the ordered creative route. */
  creativeDirective?: string;
}): string {
  const directive = renderDirective(params.style, params.preserveRealFace ?? false);
  const refBlock = buildReferenceInstructions(params.references ?? []);
  const tokens = sceneBibleTokens(params.sceneBible);
  const env = resolveEnvironment(params.environmentRef, params.sceneDescription);
  const envBlock = env ? `${renderEnvironmentBlock(env)}\n` : "";
  const hasFoodIngredients = (params.references ?? []).some((r) => r.role === "ingredient");
  const cast = params.presentCharacters ?? [];
  const castBlock =
    cast.length > 1
      ? `CAST IN FRAME (exactly ${cast.length} people, NOBODY else): ${cast
          .map((c) => `${c.name}${c.isChild ? " (child — true child proportions, clearly smaller than the adults)" : ""}: ${c.description}`)
          .join(" | ")}. ${params.preserveRealFace ? "Each attached named image is the sole appearance authority for its exact character." : "Each person keeps one consistent generated appearance."} No extra people, no duplicated characters.\n`
      : "";
  const ratioWord = params.aspectRatio === "9:16"
    ? "vertical 9:16 portrait"
    : params.aspectRatio === "1:1"
      ? "square 1:1 composition"
      : "horizontal 16:9 landscape";
  // Identity lock comes from a LARGE, sharp, well-lit hero — that is what lets
  // an image-to-video model read the face off one start frame (the lesson from
  // boards that animate cleanly & on-model in Veo). Push the character forward
  // and grade it like a premium frame, while still honouring an explicit wide.
  const isWide = /\b(WIDE|EXTREME_WIDE|AERIAL|ESTABLISH)/i.test(params.shot || "");
  const prominence = isWide
    ? "CHARACTER PROMINENCE — this is an establishing/wide shot, but still place the main character clearly in frame with the face readable and in sharp focus; do NOT shrink them to an unrecognizable distant speck."
    : "CHARACTER PROMINENCE — render the main character LARGE and dominant in the frame, the face clearly legible and in tack-sharp focus, well-lit and cleanly separated from the background (shallow depth of field), so the image-to-video model can lock the identity from this single frame. Favour a medium / medium-close framing; do NOT render the subject small, distant, out-of-focus, back-turned or with the face hidden.";
  const grade = isPhotoStyle(params.style)
    ? params.preserveRealFace
      ? `Premium cinematic colour grade and soft directional key light; appearance comes only from the attached named image. Avoid: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`
      : "Premium cinematic colour grade, soft directional key light, natural skin texture and pores, filmic editorial polish — never flat, never cartoon, never plastic/CGI/wax skin."
    : `Premium, polished, richly detailed ${params.style} rendering with cinematic lighting and depth.`;
  const frameMedium = isPhotoStyle(params.style)
    ? "photographic"
    : `${params.style} rendered`;
  // This clip has spoken audio in Veo, so the start frame should be lip-sync
  // friendly: face toward camera, mouth visible. (The words go in the Veo
  // prompt, never as text in this image.)
  const speaker = (params.speakerName ?? "").trim();
  const who = speaker ? `${speaker} (the speaker of this clip)` : "the character";
  const lipSync =
    params.hasDialogue && !isWide
      ? ` LIP-SYNC FRAMING — ${who} faces the camera with the head up and the mouth clearly visible (relaxed, about to speak), so the video model can animate natural talking and lip-sync; do not hide the mouth or turn the face away.${speaker ? " Any other characters present are turned slightly toward the speaker, mouths closed (listening)." : ""}`
      : "";
  return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}SINGLE STATIC KEYFRAME for shot ${params.segmentNumber} — ONE clean ${frameMedium} first-frame image used as the STARTING frame for an image-to-video model (Veo). This is NOT a storyboard board: render ONE single cohesive scene only, no panels, no reference strip.

COMPOSITION (${params.shot || "[EYE]"}): ${params.sceneDescription}
${castBlock}SUBJECT${params.preserveRealFace ? " — use only the attached named image for appearance" : " — keep this generated identity consistent"}: ${params.characterDescription}
${prominence}${lipSync}
${envBlock}${params.productDna ? `HERO PRODUCT / DISH (exact where present): ${params.productDna}\n` : ""}${params.ingredients ? `${hasFoodIngredients ? "RELEVANT FOOD INGREDIENTS" : "RELEVANT AUXILIARY OBJECTS / COMPONENTS"} (render physically; no written labels): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}${directive}

RENDER RULES: a SINGLE static frame; the subject is sharp and frozen in the STARTING posture for the upcoming action (no motion blur, no camera-movement effect); ${ratioWord} aspect ratio, 1080p quality. Do NOT include timeline markers, multiple panels, split-screens, reference thumbnails, captions, subtitles, on-screen text or speech bubbles. ${grade}${isPhotoStyle(params.style) ? ` ${PHOTOREAL_MATERIAL_REALISM}` : ""} ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
}

// ─── Step 4: Master Board (Character Sheet + captioned storyboard grid) ─────

/**
 * One presentation canvas in the classic production layout: a CHARACTER
 * REFERENCE SHEET column on the left and a numbered storyboard grid on the
 * right, each panel captioned with "Action:" and "Lời thoại:" (the spoken
 * Vietnamese line) — like a professional ad-agency storyboard document.
 */
export function buildMasterBoardPrompt(params: {
  title: string;
  totalDuration: number;
  segmentCount: number;
  moodTags: string[];
  segments: {
    segment_number: number;
    title: string;
    action: string;
    dialogue: string | null;
  }[];
  characterDescription: string;
  characterName?: string;
  presentCharacters?: { name: string; description: string; isChild?: boolean }[];
  style: string;
  colorPalette?: string[];
  dialogueLanguage?: string;
  /** Real reference photo governs the face — hard photoreal + identity lock. */
  preserveRealFace?: boolean;
  references?: RefDescriptor[];
  /** Compiled topic/character/directing lock from the ordered creative route. */
  creativeDirective?: string;
}): string {
  const maxPanels = Math.min(params.segments.length, 12);
  const panels = params.segments.slice(0, maxPanels);
  const cols = maxPanels <= 4 ? 2 : 3;
  const rows = Math.ceil(maxPanels / cols);
  const lang = params.dialogueLanguage ?? "Vietnamese";
  const refs = params.references ?? [];
  const refBlock = buildReferenceInstructions(refs);
  const cast = params.presentCharacters ?? [];
  const hasSettingRef = refs.some((r) => r.role === "setting");

  const panelLines = panels
    .map((s) => {
      const action = s.action.length > 160 ? s.action.slice(0, 160) + "..." : s.action;
      const line = s.dialogue
        ? s.dialogue.length > 70
          ? s.dialogue.slice(0, 70) + "..."
          : s.dialogue
        : "—";
      return `Panel ${s.segment_number} — Action: ${action} | Dialogue (${lang}): "${line}"`;
    })
    .join("\n");

  const charDesc =
    cast.length > 0
      ? cast
          .map((character) => {
            const compactLook = character.description.replace(/\s+/g, " ").trim();
            return `${character.name}: ${compactLook.slice(0, 360)}${compactLook.length > 360 ? "..." : ""}`;
          })
          .join(" | ")
      : params.characterDescription.length > 900
        ? params.characterDescription.slice(0, 900) + "..."
        : params.characterDescription;

  const colorBlock =
    params.colorPalette && params.colorPalette.length > 0
      ? params.colorPalette.slice(0, 6).join(", ")
      : "#F5E6D3, #8B4513, #2D5016, #FFFFFF, #1A1A1A";

  // Hands-only food videos have no on-camera character: rendering the portrait
  // grid anyway produced empty labelled boxes on the board. Detect and skip.
  const noFaceSubject =
    cast.length === 0 &&
    /hands|food is the hero|no face|faceless/i.test(params.characterDescription);
  const characterRows = noFaceSubject
    ? `- NO CHARACTER PORTRAITS: this is a hands-only food video with no on-camera person. Do NOT render any portrait row, empty portrait box or "MAIN CHARACTER" label. Give the entire library space to the ENVIRONMENT OVERVIEW plus one bordered thumbnail of the finished dish and one of the arranged ingredients.`
    : cast.length > 0
      ? cast
          .map((c) =>
            params.preserveRealFace
              ? `- "${c.name.toUpperCase()}"${c.isChild ? " (CHILD)" : ""}: use the attached named image(s) only as supplied. Do not redraw, synthesize alternate angles or add appearance prose.`
              : `- "${c.name.toUpperCase()}"${c.isChild ? " (CHILD — preserve child age)" : ""}: exactly ONE HEAD-AND-SHOULDERS FRONT / chính diện identity portrait. No side profile, no 3/4, no full body, no back view. Look lock: ${c.description.replace(/\s+/g, " ").trim().slice(0, 420)}`
          )
          .join("\n")
      : `- "${(params.characterName ?? "MAIN CHARACTER").toUpperCase()}": exactly ONE HEAD-AND-SHOULDERS FRONT / chính diện identity portrait. No side profile, no 3/4, no full body, no back view.`;
  const characterPortraitRule = params.preserveRealFace
    ? "- CHARACTER REFERENCES: use each attached named image as supplied; do not synthesize, redraw or paraphrase appearance."
    : "- CHARACTER PORTRAITS: the upper part shows exactly ONE FRONT / chính diện head-and-shoulders portrait per named person (no profile, no 3/4). One character = exactly 1 portrait, two characters = exactly 2, three = exactly 3, arranged in a neat compact row/column. Each person gets equal visual weight; never show only the first/main person, never add a second angle, and never add an extra person. The space saved by dropping profile portraits goes to the ENVIRONMENT section below.";
  const portraitCropRule = params.preserveRealFace
    ? "- Do not crop, redraw or recompose an uploaded character image into a new identity view."
    : "- Every portrait is HEAD-AND-SHOULDERS only: crop from top of head to upper chest, face tack-sharp, clean neutral background. Never show waist, legs, full body, back view, turnaround or expression-sheet cells even when an uploaded source photo happens to be full-body.";

  return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}Professional production STORYBOARD DOCUMENT, ONE single horizontal image, clean white/light background, agency-quality layout with two zones. PURPOSE: this sheet is for HUMAN REVIEW, shot planning and continuity checking only. It must NEVER be used as an image-to-video start frame. Every menu-uploaded character must be represented in the reference library, every face must stay readable, and every panel number must be instantly readable at a glance.

◀ LEFT REFERENCE LIBRARY (about 40% width) — "CHARACTER + ENVIRONMENT REFERENCES" (fixed grid; uploaded menu refs have HIGHEST PRIORITY):
- Header text "CHARACTER + ENVIRONMENT REFERENCES".
${noFaceSubject ? "" : `${characterPortraitRule}\n`}${characterRows}
${portraitCropRule}
- ENVIRONMENT OVERVIEW — TWO VIEWS (MANDATORY, NEVER OMIT): directly below the character portraits, reserve a bordered band across the full width of the left library (at least 22% of the whole board height) holding TWO wide 16:9 environment thumbnails stacked or side by side, labelled "ENVIRONMENT — GÓC 1" and "ENVIRONMENT — GÓC 2". Each place may be an INDOOR room or an OUTDOOR scene. ${hasSettingRef ? "The attached LOCATION reference photo(s) are authoritative — reproduce them exactly (same geometry and depth, placement of every landmark, boundaries, materials, colours, key details, light direction). GÓC 1 = the primary uploaded view. GÓC 2 = if a second reference angle was attached, reproduce that; if NOT, you must RENDER the SAME place from a clearly DIFFERENT camera angle (ideally the reverse / opposite viewpoint) that you infer in 3D — it must be fully consistent with GÓC 1 (identical landmarks, materials, colours and light), just seen from another direction. Never invent a different location. If two DISTINCT places were uploaded, use GÓC 1 and GÓC 2 for the two places instead." : "Derive GÓC 1 as a stable wide overview from the storyboard setting, then RENDER GÓC 2 as the SAME place from a different/reverse camera angle, fully consistent with GÓC 1."} Both views define the one set; reuse their geometry in every panel.
- COLOR PALETTE: an optional ultra-thin footer of small swatches only: ${colorBlock}. It may shrink, but it may NEVER replace or shrink the environment overview.

▶ RIGHT ZONE (about 2/3 width) — "STORYBOARD — ${params.title.toUpperCase()}":
- Grid of ${maxPanels} panels, ${cols} columns × ${rows} rows, thin clean borders. EACH panel carries a BIG, BOLD panel number badge ("1", "2", …) in its top-left corner — large solid dark badge with white numeral, readable even when the sheet is shrunk (these numbers are how each video clip is pointed at its panel).
- Each panel: a ${isPhotoStyle(params.style) ? "PHOTOGRAPHIC cinematic still of that moment (a real photo frame — NOT a drawing, NOT an illustration)" : `${params.style} illustration of that moment`}, and BELOW the picture a small white caption band with two labeled lines of text:
  "Action:" the action description, then "Lời thoại:" the spoken ${lang} line in quotes.
- Panels stage the character LARGE enough that face and wardrobe read clearly — medium/medium-close staging preferred over tiny wide figures.

  CAST LOCK (the same named people in the reference library and every panel where they are scripted — never omit, merge or swap them): ${noFaceSubject ? "No on-camera cast — hands-only food video; panels show only the cook's working hands where the action requires contact." : params.preserveRealFace ? `each attached named image is the only appearance source; ${charDesc}` : `identical face, hair and outfit; ${charDesc}`}

THE ${maxPanels} PANELS:
${panelLines}

Metadata footer: "${params.totalDuration}s • ${maxPanels} shots • ${params.moodTags.slice(0, 3).join(" • ")}".

${renderDirective(params.style, params.preserveRealFace ?? false)}

RULES: ONE cohesive document image; ${params.preserveRealFace ? "use the attached named character image(s) as supplied; do not invent alternate portrait views" : "ONE HEAD-AND-SHOULDERS FRONTAL portrait ref per named character (front only, no profile/full body/back/extra angle)"} plus the location reference(s) — the freed space goes to the environment. When the user attached location photos (indoor room or outdoor scene), reproduce that exact place; if only one angle is shown, infer the place in 3D (including the reverse/opposite viewpoint) and keep every panel consistent with it; all uploaded and script-defined characters remain separate named identities and appear whenever the panel script calls for them; never prioritise a generated anchor over uploaded menu references; ${isPhotoStyle(params.style) ? "photographic realism for both the reference library and all panel stills" : `${params.style} style for the panel art`}; panel numbers BIG and unmistakable; caption text small, clean and legible; no watermark. ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
}

// ─── Viral 9:16 THUMBNAIL / cover (funny, scroll-stopping, on-topic) ─────────

/**
 * One vertical 9:16 COVER image for the uploaded video: the video's funniest /
 * most dramatic moment pushed into a scroll-stopping, comedic key-art frame.
 * The character identity stays locked to the reference photos; the top band is
 * kept clean so the user can add their own title text in CapCut (AI-rendered
 * Vietnamese text is never trustworthy, so we render NO text at all).
 */
export function buildThumbnailPrompt(params: {
  title: string;
  /** EXACT short smash-hook to print HUGE on the cover (2-6 words, UPPERCASE,
   * dialogue language). When absent the cover renders with no text. */
  titleText?: string;
  /** The video's hook line — the promise/gag the cover must sell. */
  hook?: string;
  /** The story's key comedic/dramatic moment (usually segment 1 or the twist). */
  gagHint?: string;
  /** Locked scene/setting hint so the cover matches the video's world. */
  settingHint?: string;
  characterDescription: string;
  /** CAST: everyone who should appear on the cover (max 2-3, locked looks). */
  presentCharacters?: { name: string; description: string; isChild?: boolean }[];
  productDna?: string;
  sceneBible?: SceneBible;
  style: string;
  preserveRealFace?: boolean;
  references?: RefDescriptor[];
  /** Compiled topic/character/directing lock from the ordered creative route. */
  creativeDirective?: string;
  /** Objective-aware cover grammar; legacy viral treatment remains available. */
  coverTreatment?: "viral" | "editorial" | "nature" | "fable" | "commercial" | "stylized";
  aspectRatio?: "16:9" | "9:16";
}): string {
  const refBlock = buildReferenceInstructions(params.references ?? []);
  const directive = renderDirective(params.style, params.preserveRealFace ?? false);
  const tokens = sceneBibleTokens(params.sceneBible);
  const cast = params.presentCharacters ?? [];
  const isMultiCast = cast.length > 1;
  const castDesc = isMultiCast
    ? cast.map((c) => `${c.name}${c.isChild ? " (child — true child size)" : ""}: ${c.description}`).join(" | ")
    : params.characterDescription;
  const gag = params.gagHint || params.hook || params.title;
  const coverTreatment = params.coverTreatment ?? "viral";
  const frameDescription = params.aspectRatio === "16:9" ? "HORIZONTAL 16:9" : "VERTICAL 9:16";

  if (coverTreatment === "stylized") {
    return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}STYLIZED STORY VIDEO COVER / THUMBNAIL — ONE single ${frameDescription} image in the exact same locked graphic medium as the video, never live action and never photoreal.

HOOK MOMENT: ${gag}
SCRIPT-DERIVED WORLD: ${params.settingHint || "the location and visual world established by the hook scene"}
CAST: ${castDesc}. Render each scripted role exactly once with its stable line, shape, colour and role marker. Express the hook through readable silhouette, pose, spacing and facial marks appropriate to the selected stylized medium.
${params.productDna ? `STORY OBJECT: ${params.productDna}\n` : ""}COMPOSITION: stage one clear story moment with a strong focal contrast; keep the actual relationship and positions from the hook instead of replacing them with a blank board, generic studio or unrelated meme template.
${params.titleText ? `HEADLINE: print the EXACT text «${params.titleText}» once, with correct Vietnamese diacritics, maximum two lines, large and readable at feed size. Lettering must belong to the same graphic medium as the video.\n` : ""}${tokens ? `${tokens}\n` : ""}${directive}

RENDER RULES: one cohesive ${frameDescription} cover, not a collage; same character and environment design as the storyboard; no real humans, realistic skin/hair, photographic materials, sticker-cutout people, neon human rim, duplicate character, extra cast, unrelated prop, generic whiteboard classroom, gibberish, misspelled headline, subtitle, hashtag, watermark or logo.`;
  }

  if (coverTreatment === "nature") {
    return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}NATURAL-HISTORY VIDEO COVER — ONE clean vertical 9:16 camera frame, not a collage and not social clickbait.

SUBJECT / PROCESS: ${gag}
HABITAT: ${params.settingHint || "the habitat established by the storyboard"}
${castDesc ? `ON-CAMERA SUBJECT POLICY: ${castDesc}. Show this subject only when the creative route calls for one; otherwise the habitat/process remains the sole subject.\n` : ""}COMPOSITION: a physically reachable camera position; one clear ecological subject or natural process; readable foreground, habitat context and atmospheric depth. Preserve actual species morphology, plant irregularity, substrate, moisture, weather, season, light direction and mass-appropriate motion. Colour comes from the organism/material under real light and camera white balance—never generic neon green or fantasy saturation.
${tokens ? `${tokens}\n` : ""}${directive}

RENDER RULES: authentic photographed nature, one coherent place and time; never invent a person or mascot when the route specifies no character; no sticker outline, no emoji, no headline, no text, no logo, no watermark, no incompatible species/season/habitat, no impossible camera position. ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
  }

  if (coverTreatment === "fable") {
    return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}PARABLE / ILLUSTRATED VIDEO COVER — ONE clean vertical 9:16 key-art frame in the project's locked graphic language.

CENTRAL CHOICE OR CONSEQUENCE: ${gag}
WORLD / SETTING: ${params.settingHint || "the coherent fable world established by the storyboard"}
CHARACTER MEDIUM: ${castDesc}. Preserve one stable line/shape/material language, character proportions, species/object identity, palette and world scale. Stage the single choice or consequence that makes the lesson curious without spelling out the moral.
${tokens ? `${tokens}\n` : ""}${directive}

RENDER RULES: one illustrated scene, strong silhouette and visual hierarchy, no collage, no photoreal human drift, no unrelated symbols, no sticker outline, no emoji, no headline, no captions, no text, no logo, no watermark. ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
  }

  if (coverTreatment === "editorial") {
    return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}THOUGHTFUL EDITORIAL VIDEO COVER — ONE restrained vertical 9:16 frame that invites recognition and reflection, not shock-clickbait.

CORE HUMAN MOMENT / METAPHOR: ${gag}
WORLD / SETTING: ${params.settingHint || "the real location or coherent metaphor established by the storyboard"}
SUBJECT: ${castDesc}. Show one observable human moment or one central metaphor with emotional specificity, quiet negative space and a clear focal relationship. Acting is natural and internally felt; camera and light belong to the declared directing profile.
${params.productDna ? `RELEVANT OBJECT: ${params.productDna}\n` : ""}${tokens ? `${tokens}\n` : ""}${directive}

RENDER RULES: one coherent frame, no exaggerated shock face, no sticker outline, no neon rim, no emoji, no headline, no text, no logo, no watermark, no pile of unrelated symbols. ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
  }

  if (coverTreatment === "commercial") {
    return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}PREMIUM COMMERCIAL VIDEO COVER — ONE polished vertical 9:16 hero frame, product-led and materially exact.

PROMISE / PROOF: ${gag}
SETTING: ${params.settingHint || "the brand world established by the storyboard"}
${params.productDna ? `HERO PRODUCT: ${params.productDna}\n` : ""}SUBJECT / USER: ${castDesc}. Compose one clear product–benefit relationship. Control geometry, scale, surface roughness, reflections, contact, liquid/material physics and light motivation. Premium means precise and restrained, not floating objects or decorative effects.
${tokens ? `${tokens}\n` : ""}${directive}

RENDER RULES: one clean commercial frame, no collage, no exaggerated meme face, no sticker outline, no emoji, no headline, no captions, no watermark; branding geometry and material remain consistent with references. ${params.preserveRealFace ? REFERENCE_CHARACTER_SCENE_NEGATIVE : SHARED_NEGATIVE}`;
  }

  // With a headline, SHARED_NEGATIVE's blanket text bans ("title cards, text
  // overlays") would fight the requested title — swap in a text-aware negative
  // that bans only WRONG text, keeping all the identity/physics negatives.
  const negative = params.preserveRealFace
    ? REFERENCE_CHARACTER_SCENE_NEGATIVE
    : params.titleText
    ? `NEGATIVE (avoid — plain descriptors): resembling a real or famous person, celebrity likeness, misspelled or garbled headline letters, wrong or missing Vietnamese diacritics, duplicated or extra words beyond the specified headline, any second block of text, subtitles, captions, hashtags on the image, watermark, logo, morphing, warping, extra or fused fingers, malformed hands, extra or missing limbs, the face changing, identity drift, changed hair/wardrobe, extra people, duplicated subject, ${HUMAN_FACE_REALISM_NEGATIVE}, toy-like or 3D-render materials.`
    : SHARED_NEGATIVE;

  return `${refBlock}${params.creativeDirective ? `${params.creativeDirective}\n\n` : ""}VIRAL VIDEO COVER / THUMBNAIL — ONE single ${frameDescription} image used as the cover of a short video. It must STOP THE SCROLL on a phone feed: bold, funny, instantly readable at thumbnail size.

THE MOMENT TO SELL (the video's hook — stage THIS as one exaggerated comedic beat): ${gag}
${params.settingHint ? `WORLD OF THE VIDEO (the cover must clearly belong to this same world/location): ${params.settingHint}\n` : ""}
SUBJECT${isMultiCast ? "S" : ""} (identity locked — same face(s) as the reference photos): ${castDesc}.
${params.productDna ? `HERO PROP / PRODUCT (exact, unchanged): ${params.productDna}\n` : ""}
COMPOSITION (mobile-first key art):
■ The main character fills the LOWER 2/3 of the frame, chest-up or waist-up, LARGE — face razor-sharp, angled to camera.
■ EXAGGERATED COMEDIC EXPRESSION: wide eyes, raised brows, open-mouth gasp / suppressed laugh / deadpan disbelief — a real human face caught at the peak of the funny moment (genuine, not rubber-faced cartoon).${isMultiCast ? " The second character reacts in contrast (smirking, facepalming, or mock-innocent) slightly behind/beside the main one." : ""}
■ The gag's key prop or consequence is visible and readable (tilted, mid-mishap, comically framed) — the image should make the viewer ask "what happened here?!"
■ 🏷️ STICKER-POP TREATMENT (the signature viral-thumbnail effect): the main character${isMultiCast ? " group" : ""} is rendered as a crisp CUTOUT with a clean, bold, even WHITE STICKER OUTLINE (~10px) tracing their whole silhouette, plus a vibrant NEON GLOW rim just outside the white edge — pick ONE saturated accent colour that contrasts the background (electric cyan, acid yellow or hot magenta) and keep the glow tight and clean, not a blurry halo. The cutout subject floats slightly IN FRONT of the background layer (subtle drop shadow behind the sticker edge) for the punchy layered "sticker pop" depth. The face inside the cutout stays fully photoreal — only the outline/glow treatment is graphic.
■ BACKGROUND: the video's real location simplified and punched up — brighter, more saturated, slightly blurred so the sticker cutout pops; subtle vignette.
${params.titleText ? `■ 💥 HUGE HEADLINE (the click magnet): across the TOP band of the frame, print the EXACT text «${params.titleText}» — VERBATIM, letter-for-letter with correct Vietnamese diacritics, no words added or removed. Style: massive bold condensed sans-serif display type (MrBeast/TikTok viral-thumbnail style) filling most of the frame width, maximum 2 lines, UPPERCASE, white letters with a thick black outline and a soft drop shadow (or black letters on a bright yellow highlight bar), tilted a playful 2-3°. The headline must be the FIRST thing the eye hits and stay razor-legible at 150px tall. TEXT ACCURACY IS CRITICAL: if any glyph is uncertain, render it plain and clean — never substitute, duplicate or garble letters.
■ 😱 ONE EMOTION ICON: exactly ONE large glossy emoji-style icon (a shocked face 😱, fire 🔥 or red exclamation ❗ — pick the one matching the gag) placed beside the headline or near the character's reaction, rendered clean and bold like a platform emoji sticker — ONE only, never a scatter of icons.` : `■ TOP ~20% of the frame stays CLEAN, low-detail negative space (sky/wall/soft gradient) reserved for a title the user adds later.`}
■ High contrast, punchy commercial colour, crisp edges — legible even at 150px tall.

${tokens ? tokens + "\n" : ""}${directive}

RENDER RULES: ONE single ${frameDescription} frame, no panels, no frame borders, no collage; ${params.preserveRealFace ? "the attached named character image is the sole appearance authority; do not describe or reinterpret it" : "keep the generated character identity consistent"}; energetic but physically plausible pose (real anatomy, real contact with props). ${params.titleText ? `The ONLY text in the image is the exact headline «${params.titleText}» styled as specified, and the ONLY graphics are that headline, ONE emotion icon, and the white sticker outline + neon rim — nothing else written or drawn: no captions, subtitles, hashtags, extra stickers, arrows, circles, logos, watermarks or stray numbers.` : `The white sticker OUTLINE + neon glow rim around the character are the ONLY graphic treatment allowed — ABSOLUTELY NO TEXT of any kind: no title, caption, text sticker, emoji, arrows, circles, logo, watermark or numbers anywhere in the image (those get added later by the editor).`} ${negative}`;
}

// ─── Step 5: Video Assembly Guide (text for Veo / Seedance) ─────────────────

/**
 * Composes the full, long, ready-to-paste Veo prompt for ONE clip:
 * reference-lock preamble + the model's motion prompt + the spoken line +
 * a negative list. Used both per-card (copy button) and in the text guide.
 */
export function buildSegmentVeoPrompt(params: {
  characterDescription: string;
  /** Cross-cutting mode/fidelity selector; prevents unconditional photoreal rules. */
  realityProfile?: RealityProfile | null;
  sceneIntent?: SceneIntentIR | null;
  /** TẦNG 0 — the locked world context (Context-Locked DNA); rendered as a
   * LOCKED WORLD CONTEXT block so the clip can never drift out of its world. */
  worldContext?: WorldContext | null;
  /** This clip's scene/setting (from the segment's first_frame_prompt). */
  setting?: string;
  /** Authoritative physical map shared by first frame, motion and camera. */
  spatialLayout?: SpatialLayout | null;
  locationId?: string;
  transitionIn?: SegmentTransitionContract | null;
  stateLedger?: SegmentStateLedger | null;
  productDescription?: string;
  ingredients?: string;
  sceneBible?: SceneBible;
  colorPalette: string[];
  motionPrompt: string;
  dialogue?: string | null;
  dialogueLanguage?: string;
  narratorVoiceStyle?: string;
  /** Who speaks this clip (one speaker per clip). */
  speaker?: string | null;
  /** All character names in the project — used to silence the non-speakers. */
  characterNames?: string[];
  /** CAST-SYNC: exact names of everyone VISIBLE in this clip. Only they appear
   * on screen; project characters NOT listed here must not be rendered. */
  charactersInScene?: string[];
  /** TẦNG 9: the speaker's FULL locked voice profile (timbre/Hz/wpm/accent/
   * emotion) — bound to the spoken line so the voice never swaps or drifts. */
  speakerVoice?: string;
  /** TẦNG 9 turn-taking: up to 3 sequential (non-overlapping) spoken turns to
   * fit a short exchange in this one clip. Overrides `dialogue`/`speaker` when
   * it has 2+ entries. */
  dialogueTurns?: { speaker: string; text: string; start_s?: number; end_s?: number }[];
  /** Locked voice profile per character name, to bind each turn's voice. */
  characterVoices?: Record<string, string>;
  /** Genre-appropriate ambient sound (e.g. kitchen sizzle, gym energy). */
  ambientAudio?: string;
  /** Environment archetype id (segment.environment_ref). Falls back to
   * keyword-matching the setting text when absent/custom. */
  environmentRef?: string | null;
  /** TRUE when the user uploaded a real LOCATION photo — the set must be
   * rebuilt from that photo, not invented from text alone. */
  hasLocationRef?: boolean;
  /** Compiled topic/character/directing lock from the ordered creative route. */
  creativeDirective?: string;
  renderMedium?: CharacterRepresentation;
  /** At least one character visible in this clip is governed by an uploaded image. */
  hasCharacterReference?: boolean;
}): string {
  const lang = params.dialogueLanguage ?? "Vietnamese";
  const clean = (s?: string) =>
    agesToWords(
      stripBurnableTech((s ?? "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim())
    );
  // SELF-CONTAINED prompt: repeat the full character, scene and style in every
  // clip. A clean per-scene keyframe is the only image-to-video start frame;
  // character/location portraits belong in separate Ingredients/References
  // controls when available.
  const settingSource = params.hasLocationRef
    ? "An attached LOCATION photo shows the REAL set — rebuild THIS exact place as the scene (same layout, furniture, colours, materials and light); only the CHARACTER portrait's own background is ignored."
    : "build the described setting, do NOT copy the character photo's own background.";
  const stylizedMedium = isStylizedCharacterRepresentation(params.renderMedium);
  const outputMedium = stylizedMedium
    ? `a ${params.renderMedium} animated shot in the one locked graphic medium`
    : "a live-action shot";
  const referenceLead = params.hasCharacterReference
    ? "Each attached named character image is the sole appearance authority for its exact name; do not describe or reinterpret appearance."
    : "Keep every referenced subject visually consistent across the project.";
  const lead =
    `Create ONE clean full-screen continuous ${outputMedium}; no cuts, panels, captions, labels, logos, HUD, watermark or other visible text/graphics. ${referenceLead} ${settingSource}`;
  const character = ` Primary subject/cast: ${clean(params.characterDescription)}.`;
  // TẦNG 0 — the locked world every entity in this clip must belong to.
  const contextLock = worldContextLockBlock(
    params.worldContext
      ? { ...params.worldContext, allowed_language_text: "none — zero readable text anywhere" }
      : params.worldContext
  );
  const creativeRouteLock = params.creativeDirective
    ? ` ${clean(params.creativeDirective)}`
    : "";
  // The scene doubles as the clip's START STATE: planting props here is what
  // stops objects materialising mid-clip (the jacket-teleport bug).
  const setting = params.setting
    ? ` SCENE (START STATE — everything and everyone described here exists on screen from the very first frame; every object the MOTION uses must already be present — held, worn or placed — objects never appear from nowhere mid-clip): ${clean(params.setting)}.`
    : "";
  const resolvedSpatialLayout = resolveSpatialLayout({
    layout: params.spatialLayout,
    setting: params.setting,
    motion: params.motionPrompt,
    characterNames: params.charactersInScene,
  });
  const spatialLock = resolvedSpatialLayout
    ? ` ${renderSpatialTopologyLock(resolvedSpatialLayout)}`
    : "";
  const transitionLock = params.transitionIn
    ? ` EDIT BOUNDARY: ${params.transitionIn.mode} into location ${params.locationId || params.transitionIn.to_location_id}; time relation: ${clean(params.transitionIn.time_relation)}. Preserve only: ${params.transitionIn.preserve.map(clean).filter(Boolean).join(", ") || "none"}. Reset: ${params.transitionIn.reset.map(clean).filter(Boolean).join(", ") || "none"}.`
    : "";
  const stateLock = params.stateLedger
    ? ` STATE LEDGER: start [${params.stateLedger.start.map((item) => `${clean(item.entity_id)}=${clean(item.state)} at ${clean(item.position)}, holder=${clean(item.holder ?? undefined) || "none"}, orientation=${clean(item.orientation ?? undefined) || "unchanged"}`).join("; ")}]; caused changes [${params.stateLedger.changes.map((item) => `${clean(item.entity_id)}: condition ${clean(item.from)} -> ${clean(item.to)}, position ${clean(item.from_position) || "unchanged"} -> ${clean(item.to_position) || "unchanged"}, holder ${clean(item.from_holder ?? undefined) || "none"} -> ${clean(item.to_holder ?? undefined) || "none"}, orientation ${clean(item.from_orientation ?? undefined) || "unchanged"} -> ${clean(item.to_orientation ?? undefined) || "unchanged"}, because ${clean(item.caused_by)} ${clean(item.action)}`).join("; ")}]; end [${params.stateLedger.end.map((item) => `${clean(item.entity_id)}=${clean(item.state)} at ${clean(item.position)}, holder=${clean(item.holder ?? undefined) || "none"}, orientation=${clean(item.orientation ?? undefined) || "unchanged"}`).join("; ")}].`
    : "";
  // Locked world spec (materials/Kelvin+Lux/atmosphere/imperfections) — the
  // veoflow-web environment payload that makes the SETTING render real.
  const env = stylizedMedium
    ? undefined
    : resolveEnvironment(params.environmentRef, params.setting);
  const envBlock = env ? ` ${stripBurnableTech(renderEnvironmentBlock(env))}` : "";
  const product = params.productDescription
    ? /^FINISHED HERO DISH/i.test(params.productDescription.trim())
      ? ` FINISHED-DISH VISUAL IDENTITY: ${clean(params.productDescription)} Preserve the real serving vessel, food geometry, sauce, toppings, texture and steam; this is food, not packaging or branding.`
      : ` PRODUCT VISUAL IDENTITY: ${clean(params.productDescription)} Keep its physical shape, colour and material, but all brand names, logos, lettering and packaging copy are internal identifiers only and must be visually blank/non-readable in the rendered video.`
    : "";
  const ing = params.ingredients ? ` SCENE-SCOPED MATERIAL / COMPONENT REFERENCE: ${clean(params.ingredients)}. Preserve the supplied type: cooking ingredients remain food governed by the recipe step; non-cooking props remain ordinary objects/components. Never cross-route between them. Render only items causally present in this clip; no written labels.` : "";
  // Style tokens are camera/render settings — flag them as internal so Veo
  // never draws "50mm / 4300K / 600 lux" as a spec card on the frame (it did).
  const tokens = params.sceneBible
    ? ` ${stripBurnableTech(stylizedMedium
        ? stylizedSceneBibleTokens(params.sceneBible, params.renderMedium)
        : sceneBibleTokens(params.sceneBible))} (These style values are internal camera settings — NEVER display them as text on screen.)`
    : "";
  // Colour palette for Veo: strip raw hex (Veo cannot read hex and renders a
  // bare "#A9C7E8" as an on-screen colour-swatch label). Keep only real colour
  // WORDS; if the palette is hex-only, omit the line entirely.
  const paletteWords = (params.colorPalette ?? [])
    .map((c) => c.replace(/#[0-9A-Fa-f]{3,8}\b/g, "").replace(/[()]/g, "").trim())
    .filter(Boolean);
  const palette = paletteWords.length > 0 ? ` Colour palette: ${paletteWords.join(", ")}.` : "";
  const intent = renderSceneIntentDirective(params.sceneIntent);
  const intentBlock = intent ? ` ${intent}` : "";
  // Multi-character CAST-SYNC: lock exactly who is ON SCREEN, who SPEAKS, and
  // who must NOT appear — so Veo never lip-syncs the wrong person or renders a
  // project character that isn't in this scene.
  const speaker = (params.speaker ?? "").trim();
  const onScreen = (params.charactersInScene ?? [])
    .map((n) => (n ?? "").trim())
    .filter(Boolean);
  const allNames = (params.characterNames ?? []).map((n) => (n ?? "").trim()).filter(Boolean);
  const absent = onScreen.length > 0 ? allNames.filter((n) => !onScreen.includes(n)) : [];
  const castLine =
    onScreen.length > 0
      ? ` ON SCREEN: exactly ${onScreen.join(", ")}, each once; no extra people, duplicates, reflections, spontaneous entrances or disappearances.${absent.length > 0 ? ` ABSENT: ${absent.join(", ")}.` : ""}`
      : "";
  const voices = params.characterVoices ?? {};
  const voiceOf = (name: string) => (name && voices[name.trim()] ? ` (voice: ${voices[name.trim()]})` : "");

  // Normalise turns: prefer the multi-turn array; else fall back to the single
  // dialogue/speaker pair. Filter to real spoken text.
  const rawTurns =
    params.dialogueTurns && params.dialogueTurns.length > 0
      ? params.dialogueTurns
      : params.dialogue
        ? [{ speaker, text: params.dialogue, start_s: undefined, end_s: undefined }]
        : [];
  const turns = rawTurns.filter((t) => (t.text ?? "").trim());
  let spoken = "";
  if (turns.length > 0) {
    const lines = turns
      .map((t) => {
        const nm = (t.speaker ?? "").trim();
        const who = nm || "VOICEOVER";
        const vt = nm
          ? voiceOf(nm)
          : ` (voice: ${params.speakerVoice || lockedNarratorVoiceProfile(lang, params.narratorVoiceStyle)})`;
        const window =
          t.start_s != null && t.end_s != null ? `${t.start_s}-${t.end_s}s ` : "";
        return `${window}${who}${vt}: "${(t.text ?? "").trim()}"`;
      })
      .join("; ");
    spoken = ` DIALOGUE — THE ONLY TIMED CLOCK (${lang}, audio only): ${lines}. ${CAMERA_SPEECH_INDEPENDENCE_RULE} Lines are sequential, spoken once, never overlapped, repeated, echoed or reassigned.`;
  }
  const audio = params.ambientAudio ? ` AMBIENT SOUND: ${clean(params.ambientAudio)}.` : "";
  const assembled = `${lead}${creativeRouteLock}${character}${castLine}${contextLock}${transitionLock}${setting}${spatialLock}${stateLock}${envBlock}${product}${ing}${tokens}${palette}${intentBlock} MOTION (ordered action, no timecodes): ${clean(stripProductionTimecodes(params.motionPrompt))}${spoken}${audio} ${veoConciseTail(!!params.productDescription, params.realityProfile, params.renderMedium, params.hasCharacterReference)}`;
  // DEFINITIVE hex-code scrub: Veo cannot read hex and burns any "#A9C7E8"
  // next to a name onto the frame as a name tag. Hex serves the boards, never
  // the video prompt — remove EVERY hex token from the final Veo text here so
  // no caller can leak one (single source of truth for the whole app).
  return assembled
    .replace(/\s*\(#[0-9A-Fa-f]{3,8}\)/g, "")
    .replace(/\s*#[0-9A-Fa-f]{3,8}\b/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;)])/g, "$1")
    .trim();
}

export function buildVideoPromptText(params: {
  title: string;
  characterDescription: string;
  realityProfile?: RealityProfile | null;
  productDescription?: string;
  ingredients?: string;
  sceneBible?: SceneBible;
  setting: string;
  style: string;
  aspectRatio: string;
  colorPalette: string[];
  dialogueLanguage?: string;
  narratorVoiceStyle?: string;
  /** All character names in the project — used to silence non-speakers. */
  characterNames?: string[];
  /** TẦNG 9: locked voice profile per character name (speaker → voice line). */
  characterVoices?: Record<string, string>;
  /** Genre-appropriate ambient sound, appended to every clip's Veo prompt. */
  ambientAudio?: string;
  /** Compiled topic/character/directing lock from the ordered creative route. */
  creativeDirective?: string;
  renderMedium?: CharacterRepresentation;
  marketing: { hook: string; problem: string; solution: string; cta: string };
  segments: {
    segment_number: number;
    title: string;
    role: string;
    scene_intent?: SceneIntentIR;
    duration_seconds: number;
    motion_prompt: string;
    dialogue?: string | null;
    speaker?: string | null;
    dialogue_lines?: { speaker: string; text: string; start_s?: number; end_s?: number }[];
    setting?: string;
    spatial_layout?: SpatialLayout;
    environment_ref?: string | null;
    location_id?: string;
    continuity_mode?: SegmentTransitionContract["mode"];
    transition_in?: SegmentTransitionContract;
    state_ledger?: SegmentStateLedger;
    characters_in_scene?: string[];
    continuity_note: string;
    beats: { beat: string; camera: string }[];
    /** Per-segment override. null explicitly suppresses the global value. */
    productDescription?: string | null;
    /** Per-segment override. null explicitly suppresses the global value. */
    ingredients?: string | null;
    /** Per-segment cast text, so clips never inherit characters absent here. */
    characterDescription?: string;
    hasCharacterReference?: boolean;
  }[];
}): string {
  const totalDuration = params.segments.reduce(
    (sum, s) => sum + s.duration_seconds,
    0
  );
  const dialogueLanguage = params.dialogueLanguage ?? "Vietnamese";

  const segLines = params.segments
    .map((s) => {
      const beats = s.beats
        .map((b) => `      • ${b.camera} — ${b.beat}`)
        .join("\n");
      const fullPrompt = buildSegmentVeoPrompt({
        characterDescription: s.characterDescription ?? params.characterDescription,
        realityProfile: params.realityProfile,
        sceneIntent: s.scene_intent,
        setting: s.setting,
        spatialLayout: s.spatial_layout,
        locationId: s.location_id,
        transitionIn: s.transition_in,
        stateLedger: s.state_ledger,
        productDescription:
          s.productDescription === null
            ? undefined
            : s.productDescription ?? params.productDescription,
        ingredients:
          s.ingredients === null ? undefined : s.ingredients ?? params.ingredients,
        sceneBible: params.sceneBible,
        colorPalette: params.colorPalette,
        motionPrompt: s.motion_prompt,
        dialogue: s.dialogue,
        dialogueLanguage,
        speaker: s.speaker,
        dialogueTurns: s.dialogue_lines,
        narratorVoiceStyle: params.narratorVoiceStyle,
        characterVoices: params.characterVoices,
        characterNames: params.characterNames,
        charactersInScene: s.characters_in_scene,
        speakerVoice: s.speaker ? params.characterVoices?.[s.speaker.trim()] : undefined,
        ambientAudio: params.ambientAudio,
        creativeDirective: params.creativeDirective,
        renderMedium: params.renderMedium,
        environmentRef: s.environment_ref,
        hasCharacterReference: s.hasCharacterReference,
      });
      return `SEGMENT ${s.segment_number} — "${s.title}" [${s.role.toUpperCase()}] (${s.duration_seconds}s)
  Beats:
${beats}
  ▶ FULL TEXT PROMPT TO PASTE into Veo/Seedance (character/location photos belong in a separate Ingredients/References area):
    ${fullPrompt}
  Continuity: ${s.continuity_note}`;
    })
    .join("\n\n");

  return `# VIDEO ASSEMBLY GUIDE — ${params.title}
Total length ≈ ${totalDuration}s · ${params.segments.length} segments · ${params.aspectRatio} · ${params.style}
Spoken language: ${dialogueLanguage} (lip-synced, no on-screen subtitles)

## Marketing arc
- HOOK: ${params.marketing.hook}
- PROBLEM: ${params.marketing.problem}
- SOLUTION: ${params.marketing.solution}
- CTA: ${params.marketing.cta}

## Character (keep visually consistent in every clip — paste this wording into every prompt)
${params.characterDescription.replace(/\s*\(?#[0-9A-Fa-f]{3,8}\)?/g, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;)])/g, "$1")}
Use the uploaded character/location portraits through a separate Ingredients/References control when the video tool provides one. The single master storyboard is for review; if Frames-to-Video needs a start frame, crop the matching scene panel from it instead of uploading the whole sheet. (Colour hex codes are omitted because they can be burned onto the frame as labels.)

## Setting
${params.setting.replace(/\s*\(?#[0-9A-Fa-f]{3,8}\)?/g, "").replace(/\s{2,}/g, " ")}
Colour theme (for your reference only, do NOT paste into Veo): ${params.colorPalette.join(", ")}

## HOW TO BUILD THE VIDEO (seamless chaining)
The project needs only ONE master storyboard for human review and planning. Per-scene AI keyframes are optional.
1. Prefer Text-to-Video or Ingredients/References and paste the scene's structured JSON/text prompt. Character/location portraits belong in the separate Ingredients/References area. For Frames-to-Video, crop the matching panel from the master storyboard and use that crop as the start frame; NEVER upload the whole multi-panel sheet as a start frame. Set aspect ratio ${params.aspectRatio}.
2. The clips chain: shot N is written to END exactly where shot N+1 begins. For the tightest joins (Veo 3.1) use the LAST frame of clip N as the start image of clip N+1, or Veo "Extend".
3. Keep the spoken ${dialogueLanguage} line exactly as written so the lip-sync matches. Generate all ${params.segments.length} clips in order, then stitch them (CapCut/ffmpeg) and add the CTA end card.

## SEGMENTS
${segLines}

---
Compatible with: Google Veo 3.1, Seedance 2.0, Kling, Runway, Pika`;
}

// ─── Structured Veo 3.1 JSON export ─────────────────────────────────────────
// Veo Flow (and Kling/Seedance JSON modes) parse a STRUCTURED prompt far more
// reliably than one flat paragraph. Each fact therefore has exactly one
// canonical home in the clip object. Do not prepend a second flattened prompt:
// it repeats character/style/voice laws and makes the structured fields fight it.

/**
 * Full failure blacklist from the stable pre-18/07 Veo contract. Keep this
 * complete: compacting it removed independent guards that Veo does not infer
 * from broader phrases (listener lip movement, duplicate hands, HUD text...).
 */
const VEO_SHARED_FAILURE_NEGATIVE =
  "resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual, morphing, warping, teleporting, floating or levitating objects, duplicated or doubled objects, extra or fused fingers, malformed or mutated hands, third hand, extra pair of hands, disembodied hand entering the frame, more hands than the people present, extra or missing limbs, limbs bending or passing through objects, the face changing, identity drift, age shifting, changed hair or wardrobe or accessories, warped or altered label or logo text, brand-colour change, extra people, the same person or character duplicated or appearing twice in one frame, a second copy of a named character in the background or reflection, objects passing through solid surfaces, deformed food or liquid, melting, jittery or stuttering motion, mid-clip jump cuts, both characters talking at once, overlapping or simultaneous voices, doubled voice, chorus, echo, a spoken line repeated or duplicated, listener lip movement, lip movement during voiceover, narrator voice coming from a visible character's mouth, wrong-speaker lip sync, swapped voices, male voice for a female speaker, female voice for a male speaker, cross-gender voice swap, accent or dialect drift away from the locked character voice, changed speaker age, changed speaker timbre, changed base pitch, inferring the speaker from character order or camera framing, ad-lib speech, speech bubble, on-screen text, captions, subtitles, burned-in dialogue text, title cards, karaoke or lyric text, translation text, camera or lens spec overlay, technical readout or HUD, info card in a corner, floating character name tag, a character name or age rendered as a label, character info card overlaid on the footage, colour-temperature or Kelvin label, exposure or Kelvin or lux or timecode text, any readable letters numbers or typography anywhere in the frame, watermark, channel logo";

export const VEO_REFERENCE_CHARACTER_NEGATIVE_LIST =
  `${VEO_SHARED_FAILURE_NEGATIVE}, ${REFERENCE_CHARACTER_ANTI_PLASTIC}`;

export const VEO_NEGATIVE_LIST =
  `${VEO_SHARED_FAILURE_NEGATIVE}, ${HUMAN_FACE_REALISM_NEGATIVE}, plastic or CGI skin, plastic wig hair, painted eyebrows or eyelashes`;

export const CAMERA_SPEECH_INDEPENDENCE_RULE =
  "Camera subject and dialogue owner are independent: framing a listener never transfers the line to that listener. During each dialogue window only the named speaker's voice, lips and jaw move; every other visible mouth stays naturally closed, and an off-screen or out-of-focus speaker continues from their own physical position in their own voice.";

const VEO_CAMERA_FOCUS_RULE =
  "Natural cinematic depth of field; focus follows the explicitly assigned visual subject, NOT the active speaker. A speaker may remain off-camera or softly out of focus while the listener's silent reaction is sharp; framing never transfers dialogue or lip-sync to the visible subject.";

// The ONE authoritative voice directive per clip. Kept lean on purpose:
// duplicating the full voice essay again in output_rules.audio (as an earlier
// build did) overwhelms Veo with competing voice blocks and is what made the
// same character's voice drift clip-to-clip. The per-row voice_personality is
// the precise source of truth; this note only states the binding rules once.
const VEO_LIP_SYNC_DIRECTOR_NOTE =
  "HARD VOICE BINDING: resolve every line from that row's dialogue.speaker_id + dialogue.speaker_name + verbatim dialogue.voice_personality — these override character order, camera subject, visible face and reference image, and stay identical for the same named speaker in every clip. Language, region and dialect come only from the locked project context or character voice; there is no default accent. Only that speaker's lips and jaw move during their start_sec/end_sec; every listener stays silent, reacting through eyes, brows, breathing and posture. Voiceover is off-screen and moves no visible mouth. One voice at a time — each line spoken EXACTLY ONCE, no swap, overlap, echo, repetition, ad-lib or accent drift. CRITICAL — NO LINE LOOPING: speak each line one single time only; if the clip runs longer than the speech, hold NATURAL SILENCE with continued micro-action and reaction — NEVER repeat, re-say, echo or loop a line (or restart the exchange) to fill the remaining seconds.";

interface VeoJsonOptions {
  aspectRatio: string;
  dialogueLanguage?: string;
  narratorVoiceStyle?: string;
  musicEnabled?: boolean;
  ambienceEnabled?: boolean;
  foleyEnabled?: boolean;
  /** Machine-facing production prose remains English even when speech/copy is
   * localized. Kept configurable for future product locales. */
  productionPromptLanguage?: string;
  /** Genre-appropriate ambient sound (kitchen sizzle, gym energy, …). */
  ambientAudio?: string;
  /** TRUE when the user uploaded a real LOCATION photo — the set must be
   * rebuilt from that photo in every clip, never re-invented from text. */
  hasLocationRef?: boolean;
  /** Exact menu names that have uploaded character images. Their appearance
   * must remain image-only and must never be serialized as prose. */
  characterReferenceNames?: string[];
  /** The selected render medium. Stylized media use a compact design lock and
   * never inherit photoreal environment/character payloads. */
  characterRepresentation?: CharacterRepresentation;
  /** Explicit new speech mode. Omitted payloads keep legacy behavior. */
  speechMode?: "mixed" | "voice_over_only" | "character_dialogue_only" | "wordless";
  /** Independent role-label mode; it must never silently disable dialogue. */
  anonymousCharacters?: boolean;
  /** Legacy combined anonymous narrator mode retained for old callers/tests. */
  anonymousNarration?: boolean;
}

// ─── BURN-PROOFING: Veo prints salient technical tokens straight onto the
// frame ("MINH ~34 - 4000K" name/age/Kelvin badges, exactly like the old hex
// name-tags). Negative prompts alone did NOT stop it — the only reliable fix
// is to remove the burnable tokens from the payload itself: Kelvin/lux numbers
// become descriptive words, and digit ages become word phrases (adults only —
// child ages stay numeric for age-accuracy). Never applied to spoken dialogue.
function kelvinWord(k: number): string {
  if (k < 3200) return "warm golden tungsten light";
  if (k < 4300) return "neutral warm-white light";
  if (k < 5600) return "neutral daylight";
  return "cool daylight";
}
function luxWord(lux: number): string {
  if (lux < 150) return "dim, moody";
  if (lux < 400) return "soft, gentle";
  if (lux < 800) return "bright, even";
  return "very bright";
}
export function stripBurnableTech(text?: string | null): string {
  let out = (text ?? "").toString();
  // "key 4000K", "~450 lux", "3000K, ~200 lux" → words
  out = out.replace(/(?:key\s*)?~?\s*(\d{3,5})\s*K\b/g, (_m, k: string) => ` ${kelvinWord(parseInt(k, 10))}`);
  out = out.replace(/~?\s*(\d{2,5})\s*lux\b/gi, (_m, l: string) => ` ${luxWord(parseInt(l, 10))} light level`);
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;)])/g, "$1").trim();
}
function ageBand(n: number): string {
  const decade =
    n < 20 ? "late teens" :
    n < 30 ? "twenties" : n < 40 ? "thirties" : n < 50 ? "forties" :
    n < 60 ? "fifties" : n < 70 ? "sixties" : "seventies";
  if (n < 20) return "in their late teens";
  const pos = n % 10 <= 3 ? "early" : n % 10 <= 6 ? "mid" : "late";
  return `in their ${pos} ${decade}`;
}
export function agesToWords(text?: string | null): string {
  let out = (text ?? "").toString();
  // "~34 years old", "34 tuổi", "25-32 years old" → "in their mid-thirties".
  // Ages under 18 keep the number (child age accuracy matters more than burn risk).
  out = out.replace(
    /~?\s*(\d{1,2})(?:\s*[-–~]\s*(\d{1,2}))?\s*(?:years?\s*old|tuổi)/gi,
    (m, a: string, b?: string) => {
      const n = b ? Math.round((parseInt(a, 10) + parseInt(b, 10)) / 2) : parseInt(a, 10);
      if (!Number.isFinite(n) || n < 18) return m;
      return ` ${ageBand(n)}`;
    }
  );
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;)])/g, "$1").trim();
}

/** Build concise, paste-ready Flow/Veo JSON objects using the user's proven
 * scene schema. Analysis-only metadata stays out of the prompt payload. */
/**
 * Remove any VERBATIM spoken line from action prose. Dialogue is owned solely by
 * dialogue_lines; when the model also quotes a line inside motion_prompt, Veo
 * hears it twice and the character repeats it. We strip only the WHOLE line as a
 * contiguous phrase (≥ 8 chars, optionally quote-wrapped), so ordinary action
 * words are never touched — this deterministically kills the "said twice" loop
 * even when the model ignores the "dialogue only in dialogue fields" rule.
 */
function stripSpokenLinesFromProse(prose: string, spokenTexts: string[]): string {
  let out = prose || "";
  for (const raw of spokenTexts) {
    const line = (raw ?? "").trim().replace(/^["'“”«»‘’]+|["'“”«»‘’]+$/g, "").replace(/[.?!…]+$/g, "").trim();
    if (line.length < 8) continue;
    const esc = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`["'“”«»‘’]?\\s*${esc}\\s*[.?!…]*\\s*["'“”«»‘’]?`, "giu");
    out = out.replace(re, " ");
  }
  return out.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

export function buildVeoJson(
  breakdown: StoryboardGenerationOutput,
  opts: VeoJsonOptions
): Record<string, unknown> {
  const realWorldSurface = realityUsesRealWorldPhysics(
    breakdown.context_ir?.reality_profile
  );
  const oneLine = (s?: string | null) =>
    (s ?? "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // Veo-facing JSON must carry ZERO hex codes: Veo renders "#A9C7E8" as an
  // on-screen name/colour label. Boards keep hex; this export never does.
  const noHex = (s?: string | null) =>
    oneLine(s)
      .replace(/\s*\(#[0-9A-Fa-f]{3,8}\)/g, "")
      .replace(/\s*#[0-9A-Fa-f]{3,8}\b/g, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([,.;)])/g, "$1")
      .trim();
  // Full burn-proof scrub for PROSE fields (never dialogue): hex + Kelvin/lux
  // numbers + digit ages all become words so Veo has no label-shaped tokens to
  // print on the frame ("MINH ~34 - 4000K" badges).
  const scrub = (s?: string | null) => agesToWords(stripBurnableTech(noHex(s)));
  // Guarantee the anti-"plastic look" clauses are always present on the two
  // fields Veo most often fakes, appended only when the model didn't already
  // supply the realism cue (so we don't duplicate it).
  const HAIR_REALISM =
    "real individual hair strands with fine flyaways and baby hairs, natural volume, matte-to-soft natural sheen — NOT a glossy plastic wig, doll/toy hair or a smooth painted-on helmet";
  const SKIN_REALISM =
    "real skin with visible pores, fine peach-fuzz, natural subsurface scattering and small imperfections — never airbrushed, waxy or beauty-smoothed";
  const appendHairRealism = (s: string) =>
    !realWorldSurface || /strand|flyaway|wig|matte|plastic/i.test(s)
      ? s
      : [s, HAIR_REALISM].filter(Boolean).join("; ");
  const appendSkinRealism = (s: string) =>
    !realWorldSurface || /pore|subsurface|smoothing|peach|waxy/i.test(s)
      ? s
      : [s, SKIN_REALISM].filter(Boolean).join("; ");
  const lang = opts.dialogueLanguage ?? "Vietnamese";
  const promptLang = opts.productionPromptLanguage?.trim() || DEFAULT_PRODUCTION_PROMPT_LANGUAGE;
  const locks = breakdown.character_locks ?? [];
  const stylizedRepresentation = isStylizedCharacterRepresentation(
    opts.characterRepresentation
  );
  const speechMode = opts.speechMode ??
    (opts.anonymousNarration ? "voice_over_only" : "character_dialogue_only");
  const anonymousCharacters =
    opts.anonymousCharacters ?? opts.anonymousNarration === true;
  const sb = breakdown.scene_bible;
  const culture = oneLine(breakdown.world_context?.culture);
  const characterReferenceNames = new Set(
    (opts.characterReferenceNames ?? []).map((name) => name.trim().toLowerCase()).filter(Boolean)
  );
  const referenceNameList = [...characterReferenceNames];
  const cleanReferenceText = (s?: string | null) =>
    stripUploadedCharacterAppearance(s, referenceNameList);
  const cleanContinuousText = (s?: string | null) =>
    stripProductionTimecodes(cleanReferenceText(s))
      .replace(/\b(?:then\s+)?hard\s+cuts?\s+to\b/gi, "then smoothly reframes to")
      .replace(/\b(?:then\s+)?cuts?\s+to\b/gi, "then smoothly reframes to")
      .replace(/\bjump\s+cuts?\b/gi, "smooth continuous reframe");
  const hasIncidentalBagPressure = (...values: Array<string | null | undefined>) => {
    const corpus = values.filter(Boolean).join(" ");
    return /\b(?:shopping\s+bags?|bags?|straps?|handles?)\b|túi đồ|túi nặng|quai túi/iu.test(corpus)
      && /\b(?:red\s+marks?|pressure\s+marks?|digging\s+in)\b|hằn đỏ|vệt đỏ|siết chặt/iu.test(corpus);
  };
  /** Keep an ordinary carrying-pressure beat clear of injury/violence filters. */
  const softenIncidentalBagPressure = (text: string, enabled: boolean) => {
    if (!enabled || !text) return text;
    return text
      .replace(/\bBàn Tay Hằn Đỏ\b/giu, "Bàn Tay Mỏi Vì Túi Nặng")
      .replace(/\bdeep\s+red\s+marks?\b/giu, "temporary pressure lines")
      .replace(/\bred\s+marks?\b/giu, "temporary pressure lines")
      .replace(/\bred\s+from\s+(?:the\s+)?(?:bag\s+)?(?:straps?|handles?)\b/giu, "showing temporary pressure from the bag handles")
      .replace(/\bdigging\s+in(?:to)?\b/giu, "pressing gently against")
      .replace(/hằn đỏ rõ rệt/giu, "có vết hằn tạm thời")
      .replace(/vết hằn đỏ|vệt đỏ/giu, "vết hằn tạm thời")
      .replace(/\bđỏ\s+(?:rõ rệt\s+)?do\b/giu, "mỏi do")
      .replace(/\s{2,}/g, " ")
      .trim();
  };
  const hasUploadedReference = (name: string) =>
    characterReferenceNames.has(name.trim().toLowerCase());
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /**
   * Static identity, initial wardrobe and voice belong only in character_lock.
   * Older model output often copied those exact strings into start/motion/end;
   * remove the canonical values there while preserving names, blocking, acting
   * and prop state. Prompt instructions prevent paraphrased copies upstream.
   */
  const stripCanonicalCharacterDetails = (
    text: string | null | undefined,
    clipLocks: typeof locks
  ) => {
    let out = cleanReferenceText(text);
    for (const lock of clipLocks) {
      const values = [
        lock.gender_age,
        lock.build,
        lock.skin_tone,
        lock.face_structure,
        lock.skin_texture,
        lock.eye_details,
        lock.eyes,
        lock.eyebrow_details,
        lock.eyelash_details,
        lock.nose_lips_details,
        lock.hair,
        lock.hair_details,
        lock.costume,
        lock.wardrobe_materials,
        lock.signature_features,
        lock.render_style,
        lock.dna,
        lock.voice,
      ]
        .flatMap((value) => {
          const raw = oneLine(value);
          const parts = raw.split(/[,;]\s*/).map((part) => part.trim());
          return [raw, noHex(value), scrub(value), ...parts];
        })
        // Only strip DISTINCTIVE multi-word phrases (a verbatim-copied canonical
        // clause), never a lone common word. The old rule removed every ≥4-char
        // comma fragment of build/voice/render_style — so "warm", "calm",
        // "slim", "cinematic" got deleted from ordinary action prose, and with
        // no word boundary the match ate into larger words ("warmly" → "ly").
        // Requiring a space + ≥12 chars removes only real duplicated
        // descriptions; a little leftover duplication is far safer than a
        // mangled sentence.
        .map((value) => value.trim())
        .filter(
          (value, index, all) =>
            /\s/.test(value) && value.length >= 12 && all.indexOf(value) === index
        )
        .sort((a, b) => b.length - a.length);
      for (const value of values) {
        // Unicode-aware word boundaries so a phrase never matches inside a
        // larger word.
        out = out.replace(
          new RegExp(
            `(?:,\\s*)?(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])(?:\\s*,)?`,
            "giu"
          ),
          " "
        );
      }
    }
    return oneLine(out)
      .replace(/\b(?:wearing|dressed\s+in|with)\s*(?=[,.;]|$)/giu, "")
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/([,;])\s*([,.!?])/g, "$2")
      .replace(/\s{2,}/g, " ")
      .trim();
  };
  const compactActionText = (text: string | null | undefined, clipLocks: typeof locks) =>
    stripCanonicalCharacterDetails(cleanContinuousText(text), clipLocks)
      .replace(
        /\b(?:single continuous motion|single continuous take),?\s*natural movement obeying real-world physics,?\s*consistent weight and gravity,?\s*stable identity,?\s*object permanence\.?/giu,
        ""
      )
      .replace(/\s{2,}/g, " ")
      .trim();
  const exactNameMentioned = (text: string, name: string) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
    } catch {
      return text.toLocaleLowerCase().includes(name.toLocaleLowerCase());
    }
  };
  /** Keep background_lock about the set only; actor state belongs in scene_action. */
  const extractBackgroundSetting = (
    text: string | null | undefined,
    characterNames: string[],
    fallbacks: Array<string | null | undefined>
  ) => {
    const staticPart = (candidate: string | null | undefined): string => {
      const source = oneLine(cleanReferenceText(candidate));
      if (!source) return "";
      const firstNameIndex = characterNames
        .map((name) =>
          source.search(
            new RegExp(
              `(^|[^\\p{L}\\p{N}])${escapeRegExp(name)}($|[^\\p{L}\\p{N}])`,
              "iu"
            )
          )
        )
        .filter((index) => index >= 0)
        .sort((a, b) => a - b)[0];
      if (typeof firstNameIndex === "number") {
        const prefix = source
          .slice(0, firstNameIndex)
          .replace(/[,:;\s]+$/g, "")
          .trim();
        // A cast-led sentence has no static prefix. Do not return it, and do
        // not trust a fallback blindly: scene_bible.backdrop can contain the
        // same model-generated action defect.
        return prefix.length >= 12 ? prefix : "";
      }
      const leadingSetSentences: string[] = [];
      for (const sentence of source
        .split(/(?<=[.!?])\s+/)
        .map((part) => part.trim())) {
        if (!sentence) continue;
        // A sentence beginning with a pronoun is actor/action state, not the set.
        if (/^(?:he|she|they|his|her|their|anh|cô|chị|em|họ)\b/iu.test(sentence)) {
          break;
        }
        leadingSetSentences.push(sentence);
      }
      return oneLine(leadingSetSentences.join(" "));
    };

    const primary = staticPart(text);
    if (primary) return primary;
    for (const fallback of fallbacks) {
      const candidate = staticPart(fallback);
      if (candidate) return candidate;
    }
    return "A fixed physical set matching the locked location, architecture, spatial anchors, materials and lighting";
  };
  const resolveClipCast = (seg: StoryboardGenerationOutput["segments"][number]): string[] => {
    if (Array.isArray(seg.characters_in_scene)) {
      return [...new Set(seg.characters_in_scene.map(oneLine).filter(Boolean))];
    }
    // Legacy JSON omitted characters_in_scene entirely. Infer the smallest
    // named cast from this clip instead of exposing every project character.
    const corpus = [
      seg.title,
      seg.first_frame_prompt,
      seg.motion_prompt,
      seg.continuity_note,
      seg.dialogue,
      seg.speaker,
      ...(seg.dialogue_lines ?? []).flatMap((turn) => [turn.speaker, turn.text]),
    ]
      .filter(Boolean)
      .join(" ");
    const inferred = locks
      .filter((lock) => exactNameMentioned(corpus, lock.name.trim()))
      .map((lock) => oneLine(lock.name));
    return [...new Set(inferred)];
  };
  const charIds = new Map(
    locks.map((lock, index) => [lock.name.trim().toLowerCase(), `CHAR_${index + 1}`])
  );
  // Keep the complete voice fingerprint local to every dialogue row. The
  // canonical map is built once so the same named speaker receives the exact
  // same profile in every clip, independent of cast order and camera framing.
  const voiceProfilesByName = new Map(
    locks.map((lock) => [
      lock.name.trim().toLowerCase(),
      oneLine(lock.voice) || defaultVoiceFor(lock.gender, lock.is_child),
    ])
  );
  const contextLocationsById = new Map(
    (breakdown.context_ir?.layers.environment.locations ?? []).map((location) => [
      location.id.trim().toLowerCase(),
      location,
    ])
  );
  const splitOutfit = (costume?: string) => {
    const parts = noHex(costume)
      .split(/[,;]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    // Last-resort fallbacks must read like an ACTUAL garment (they surface in
    // the manifest / prompt), not like a shouted instruction — earlier text such
    // as "PICK one concrete everyday top … NOW" leaked verbatim and looked
    // ridiculous. costume is expected to be filled upstream; when it is not, we
    // emit a plain, concrete, neutral outfit that stays consistent across clips.
    return {
      top:
        parts[0] ||
        "a plain solid-colour short-sleeve everyday top, kept identical in every clip",
      bottom:
        parts.slice(1).join(", ") ||
        (parts[0]
          ? `a plain matching pair of trousers completing the locked outfit, kept identical in every clip`
          : "plain dark everyday trousers, kept identical in every clip"),
    };
  };
  const cameraParts = (cameraText: string) => {
    const lower = cameraText.toLowerCase();
    const firstShot = cameraText.match(/\[(MEDIUM|CLOSE|EXTREME_CLOSE|WIDE|OTS)\]/i)?.[1]
      ?.toLowerCase();
    const framing = firstShot === "extreme_close"
      ? "ECU"
      : firstShot === "close" || firstShot === "ots"
        ? "CU"
        : firstShot === "medium"
          ? "MS"
          : firstShot === "wide"
            ? "WS"
            : /extreme close|ecu/.test(lower)
              ? "ECU"
              : /close|\bcu\b/.test(lower)
                ? "CU"
                : /wide|\bws\b|establish/.test(lower)
                  ? "WS"
                  : "MS";
    const angle = /low angle|\blow\b/.test(lower)
      ? "low angle"
      : /high angle|overhead|top-down/.test(lower)
        ? "high angle"
        : "eye level";
    const cameraClauses = cameraText
      .split(/\s*;\s*/)
      .map((clause) =>
        clause
          .replace(/\[(?:MEDIUM|CLOSE|EXTREME_CLOSE|WIDE|OTS)\]\s*/gi, "")
          .replace(/\s*\(thats where the camera is\)/gi, "")
          .trim()
      )
      .filter(Boolean);
    const declaredScales = cameraText.match(/\[(?:MEDIUM|CLOSE|EXTREME_CLOSE|WIDE|OTS)\]/gi) ?? [];
    const distinctScales = new Set(declaredScales.map((scale) => scale.toUpperCase()));
    const movement = /static|locked/.test(lower)
      ? "static"
      : cameraClauses.length > 1
        ? distinctScales.size > 1
          ? `One continuous motivated reframe begins with ${cameraClauses[0]} and changes scale visibly in-camera before settling on ${cameraClauses[cameraClauses.length - 1]}; no cut, teleport or contradictory instruction to preserve one shot scale`
          : `One continuous ${framing === "WS" ? "wide" : framing === "CU" ? "close" : "medium"} composition begins with ${cameraClauses[0]} and follows the same action before settling on ${cameraClauses[cameraClauses.length - 1]}, without a cut or shot-scale change`
        : cameraClauses[0] || "single slow, smooth camera move";
    return { framing, angle, movement };
  };

  const clips = breakdown.segments.map((seg, segIndex) => {
    const beats = Array.isArray(seg.beats) ? seg.beats : [];
    const clipSeconds = Math.max(1, seg.duration_seconds || 10);
    const actionDrama =
      ACTION_GENRE_PATTERN.test(breakdown.world_context?.genre ?? "") ||
      PHYSICAL_THREAT_PATTERN.test(`${seg.title ?? ""} ${seg.motion_prompt ?? ""}`);
    const speaker = oneLine(seg.speaker);
    // Environment archetypes contain real materials, Kelvin/lux and photographic
    // surface physics. They are valuable for live action but conflict with a
    // selected illustrated/clay/paper/low-poly world. A stylized project keeps
    // the script-derived setting and lets its style lock render that world.
    const env = stylizedRepresentation
      ? undefined
      : resolveEnvironment(seg.environment_ref, seg.first_frame_prompt);
    const contextLocation = seg.location_id
      ? contextLocationsById.get(seg.location_id.trim().toLowerCase())
      : undefined;
    const transitionMode =
      seg.transition_in?.mode ??
      seg.continuity_mode ??
      (segIndex === 0 ? "opening" : "continuous");
    const onScreen = resolveClipCast(seg);
    // The clip cast is authoritative. Never fall back to the project's full
    // lock list when a legacy segment omitted its cast field.
    const baseVisibleLocks = locks.filter((lock) =>
      onScreen.some((name) => name.toLowerCase() === lock.name.trim().toLowerCase())
    );
    // MOTIVATED WARDROBE CHANGE: a segment-level wardrobe_state (shower → home
    // clothes, etc.) overrides the base lock's costume/hair so the JSON never
    // contradicts the scene text ("office shirt" lock vs "dark t-shirt" scene).
    const wardrobeByName = new Map(
      (seg.wardrobe_state ?? [])
        .filter((w) => w && (w.character ?? "").trim() && (w.outfit ?? "").trim())
        .map((w) => [w.character.trim().toLowerCase(), w])
    );
    const visibleLocks = baseVisibleLocks.map((lock) => {
      const wardrobe = wardrobeByName.get(lock.name.trim().toLowerCase());
      if (!wardrobe) return lock;
      return {
        ...lock,
        costume: wardrobe.outfit,
        wardrobe_materials: wardrobe.outfit_materials || lock.wardrobe_materials,
        hair: wardrobe.hair || lock.hair,
      };
    });
    const incidentalBagPressure = hasIncidentalBagPressure(
      seg.title,
      seg.first_frame_prompt,
      seg.motion_prompt,
      seg.continuity_note,
      seg.scene_intent?.entry_exit?.entry_state,
      seg.scene_intent?.entry_exit?.exit_state,
      ...beats.flatMap((beat) => [beat.beat, beat.camera])
    );
    const contextStaticSetting = contextLocation
      ? [
          contextLocation.description,
          contextLocation.spatial_anchors.length > 0
            ? `Spatial anchors: ${contextLocation.spatial_anchors.join(", ")}`
            : "",
          contextLocation.fixed_elements.length > 0
            ? `Fixed elements: ${contextLocation.fixed_elements.join(", ")}`
            : "",
          contextLocation.lighting_motivation
            ? `Motivated light: ${contextLocation.lighting_motivation}`
            : "",
        ]
          .filter(Boolean)
          .join("; ")
      : "";
    const catalogStaticSetting = env
      ? [
          env.display_name,
          env.scale,
          ...env.materials.map(
            (material) =>
              `${material.surface}: ${material.material}; ${material.physics}`
          ),
        ].join("; ")
      : "";
    // Use every locked project identity, not only characters_in_scene. A model
    // omission in that per-clip list must never let another known character's
    // action leak into the static image/video environment authority.
    const knownCharacterNames = [
      ...new Set([
        ...locks.map((lock) => oneLine(lock.name)).filter(Boolean),
        ...onScreen,
      ]),
    ];
    const backgroundSetting = softenIncidentalBagPressure(
      scrub(
        extractBackgroundSetting(
          seg.first_frame_prompt,
          knownCharacterNames,
          [
            contextStaticSetting,
            catalogStaticSetting,
            scrub(sb?.backdrop),
            seg.title,
          ]
        )
      ),
      incidentalBagPressure
    );
    const sceneStateOnly = (text: string | null | undefined) => {
      const state = softenIncidentalBagPressure(
        scrub(stripCanonicalCharacterDetails(text, visibleLocks)),
        incidentalBagPressure
      );
      if (!state || !backgroundSetting) return state;
      return state
        .replace(new RegExp(`^${escapeRegExp(backgroundSetting)}[\\s,.;:–—-]*`, "iu"), "")
        .trim();
    };
    const declaredEntryState = sceneStateOnly(
      seg.scene_intent?.entry_exit?.entry_state || seg.first_frame_prompt
    );
    const exitState = sceneStateOnly(
      seg.scene_intent?.entry_exit?.exit_state || seg.continuity_note
    );
    // Spoken lines belong ONLY to dialogue_lines. Strip any verbatim quote of them
    // from the action prose so Veo never says the same line twice (the repetition
    // the user saw in clips 1 & 3). Deterministic — does not rely on the model
    // obeying the "dialogue only in dialogue fields" instruction.
    const spokenTexts = [
      ...(seg.dialogue_lines ?? []).map((turn) => oneLine(turn.text)),
      oneLine(seg.dialogue),
    ].filter((text): text is string => Boolean(text));
    const motionSource = stripSpokenLinesFromProse(oneLine(seg.motion_prompt), spokenTexts);
    const physicalBehaviorSource = stripSpokenLinesFromProse(
      oneLine(seg.scene_intent?.performance?.physical_behavior),
      spokenTexts
    );
    const mainAction = softenIncidentalBagPressure(
      scrub(compactActionText(motionSource, visibleLocks)) ||
        scrub(compactActionText(physicalBehaviorSource, visibleLocks)),
      incidentalBagPressure
    );
    // Physical inheritance is opt-in per edit boundary. Legacy projects without
    // Context IR keep their former chained behaviour; Context IR projects must
    // explicitly declare transition_in.mode="continuous".
    const prevSeg = segIndex > 0 ? breakdown.segments[segIndex - 1] : null;
    const inheritsPhysicalState =
      segIndex > 0 &&
      (seg.transition_in
        ? seg.transition_in.mode === "continuous"
        : breakdown.context_ir?.segment_contract_version !== "1.0");
    const prevExitState = prevSeg && inheritsPhysicalState
      ? softenIncidentalBagPressure(
          scrub(
            stripCanonicalCharacterDetails(
              prevSeg.scene_intent?.entry_exit?.exit_state || prevSeg.continuity_note,
              locks
            )
          ),
          incidentalBagPressure
        )
      : "";
    const continuityFromPrev = inheritsPhysicalState ? prevExitState : "";
    const entryState = continuityFromPrev || declaredEntryState;
    const revolvingDoorOperation = inferRevolvingDoorOperation({
      setting: seg.first_frame_prompt,
      motion: mainAction,
      startState: entryState,
      endState: exitState,
      continuityFromPrevious: continuityFromPrev,
    });
    const resolvedSpatialLayout = resolveSpatialLayout({
      layout: seg.spatial_layout,
      setting: seg.first_frame_prompt,
      motion: mainAction,
      characterNames: onScreen,
      startState: entryState,
      endState: exitState,
      continuityFromPrevious: continuityFromPrev,
    });
    const spatialTopology = resolvedSpatialLayout
      ? {
          zone_order: scrub(cleanReferenceText(resolvedSpatialLayout.zone_order)),
          fixed_architecture: scrub(cleanReferenceText(resolvedSpatialLayout.fixed_architecture)),
          character_placement: scrub(cleanReferenceText(resolvedSpatialLayout.character_placement)),
          walkable_path: scrub(cleanReferenceText(resolvedSpatialLayout.walkable_path)),
          camera_zone: scrub(cleanReferenceText(resolvedSpatialLayout.camera_zone)),
          ...(resolvedSpatialLayout.mechanism_motion
            ? {
                mechanism_motion: scrub(
                  cleanReferenceText(resolvedSpatialLayout.mechanism_motion)
                ),
              }
            : {}),
          invariants: SPATIAL_TOPOLOGY_INVARIANTS,
        }
      : null;
    const hasRevolvingDoorMechanism = Boolean(spatialTopology?.mechanism_motion);
    const characterLock = Object.fromEntries(
      visibleLocks.map((lock) => {
        const id = charIds.get(lock.name.trim().toLowerCase()) || "CHAR_1";
        const motivatedWardrobe = wardrobeByName.get(lock.name.trim().toLowerCase());
        const outfit = motivatedWardrobe
          ? { top: "See wardrobe_state", bottom: "See wardrobe_state" }
          : splitOutfit(lock.costume);
        const props = "Only props planted in background_lock.props or scene_action.start_state";
        const sceneStateFields = {
          position: resolvedSpatialLayout
            ? "Use spatial_topology.character_placement"
            : "Use scene_action.start_state",
          orientation: resolvedSpatialLayout
            ? "Use the facing direction in spatial_topology.character_placement"
            : "Use scene_action.start_state",
          pose: "Use scene_action.start_state",
          foot_placement: "Physically grounded with stable contact on the declared walkable surface",
          hand_detail: stylizedRepresentation
            ? stylizedHandLock(opts.characterRepresentation)
            : "Natural hands with correct contact on named props; no fused or extra fingers",
        };
        const actionFlow = {
          pre_action: "Begin exactly in scene_action.start_state",
          main_action: `Perform only ${lock.name}'s actions in scene_action.motion`,
          post_action: "Finish exactly in scene_action.end_state",
        };
        if (stylizedRepresentation) {
          const designMarkers = [
            noHex(lock.build),
            noHex(lock.face_structure),
            noHex(lock.signature_features),
            noHex(lock.skin_tone),
          ].filter(Boolean).join("; ");
          const wardrobeMarker = anonymousCharacters
            ? "Use only the stable role marker, line/shape language and small colour accent established by the character sheet"
            : [outfit.top, outfit.bottom, noHex(lock.wardrobe_materials)].filter(Boolean).join("; ");
          return [
            id,
            {
              id,
              name: lock.name,
              design_medium: opts.characterRepresentation,
              design_markers: designMarkers || "Use the exact same locked stylized character design in every clip",
              signature_marker: noHex(lock.signature_features),
              wardrobe_or_role_marker: wardrobeMarker,
              ...(["voice_over_only", "wordless"].includes(speechMode)
                ? { speech_authority: speechMode === "wordless"
                    ? "Silent visible role; no narrator, no character speech and no lip-sync"
                    : "Silent visible role; narrator VOICEOVER owns all spoken audio and this character never lip-syncs" }
                : { voice_personality: oneLine(lock.voice) || defaultVoiceFor(lock.gender, lock.is_child) }),
              props,
              body_metrics: "cons=no-auto-rescale,lock-proportions,keep-relative-height",
              ...sceneStateFields,
              expression: noHex(lock.default_expression) || "Use scene_action.start_state",
              action_flow: actionFlow,
            },
          ];
        }
        if (hasUploadedReference(lock.name)) {
          const referenceOutfit = motivatedWardrobe
            ? { top: "See wardrobe_state", bottom: "See wardrobe_state" }
            : splitOutfit(lock.costume);
          return [
            id,
            {
              id,
              name: lock.name,
              reference_image_lock: REFERENCE_CHARACTER_APPEARANCE_LOCK,
              avoid_character_surface_artifacts: REFERENCE_CHARACTER_ANTI_PLASTIC,
              species: "REFERENCE_IMAGE",
              gender:
                lock.gender === "male"
                  ? "Male"
                  : lock.gender === "female"
                    ? "Female"
                    : "REFERENCE_IMAGE",
              age: "REFERENCE_IMAGE",
              voice_personality: oneLine(lock.voice) || defaultVoiceFor(lock.gender, lock.is_child),
              body_build: "REFERENCE_IMAGE",
              face_shape: "REFERENCE_IMAGE",
              hair: motivatedWardrobe?.hair ? "See wardrobe_state" : "REFERENCE_IMAGE",
              hair_microdetail: "REFERENCE_IMAGE",
              eyes: "REFERENCE_IMAGE",
              eyebrows: "REFERENCE_IMAGE",
              eyelashes: "REFERENCE_IMAGE",
              nose_lips_teeth: "REFERENCE_IMAGE",
              skin_or_fur_color: "REFERENCE_IMAGE",
              skin_texture: "REFERENCE_IMAGE",
              signature_feature: "REFERENCE_IMAGE",
              outfit_top: referenceOutfit.top,
              outfit_bottom: referenceOutfit.bottom,
              outfit_materials: motivatedWardrobe
                ? "See wardrobe_state"
                : noHex(lock.wardrobe_materials) || "real context-appropriate garment materials",
              helmet_or_hat: "None unless declared in the context-locked outfit",
              shoes_or_footwear: "Use the footwear declared in the context-locked outfit; never copy it from the reference image",
              props,
              body_metrics: "REFERENCE_IMAGE; cons=no-auto-rescale,lock-proportions",
              ...sceneStateFields,
              expression: "Use scene_action.start_state",
              action_flow: actionFlow,
            },
          ];
        }
        return [
          id,
          {
            id,
            name: lock.name,
            species: `Human${culture ? ` - ${culture}` : ""}${lock.is_child ? " child" : ""}`,
            gender: lock.gender === "male" ? "Male" : lock.gender === "female" ? "Female" : "Unspecified",
            age: scrub(lock.gender_age).replace(
              /^(?:male|female|man|woman|nam|nữ)\b[\s,:;/-]*/iu,
              ""
            ),
            voice_personality: oneLine(lock.voice) || defaultVoiceFor(lock.gender, lock.is_child),
            body_build: noHex(lock.build),
            face_shape: noHex(lock.face_structure),
            // Always append the real-hair clause so older breakdowns without
            // hair_details still cannot render a plastic wig / doll cap.
            hair: motivatedWardrobe?.hair
              ? "See wardrobe_state"
              : appendHairRealism(noHex(lock.hair)),
            hair_microdetail: noHex(lock.hair_details),
            eyes: noHex(lock.eye_details || lock.eyes),
            eyebrows: noHex(lock.eyebrow_details),
            eyelashes: noHex(lock.eyelash_details),
            nose_lips_teeth: noHex(lock.nose_lips_details),
            skin_or_fur_color: noHex(lock.skin_tone),
            skin_texture: appendSkinRealism(noHex(lock.skin_texture)),
            signature_feature: scrub(lock.signature_features),
            outfit_top: outfit.top,
            outfit_bottom: outfit.bottom,
            outfit_materials: motivatedWardrobe
              ? "See wardrobe_state"
              : noHex(lock.wardrobe_materials),
            helmet_or_hat: "None unless declared in the initial outfit",
            shoes_or_footwear: "Use the footwear declared in the initial outfit; do not invent a change",
            props,
            body_metrics: "cons=no-auto-rescale,lock-proportions,keep-relative-height",
            ...sceneStateFields,
            expression: noHex(lock.default_expression) || "Use scene_action.start_state",
            action_flow: actionFlow,
          },
        ];
      })
    );
    const hasReferencedVisibleCharacter = visibleLocks.some((lock) =>
      hasUploadedReference(lock.name)
    );
    const rawTurns =
      seg.dialogue_lines && seg.dialogue_lines.length > 0
        ? seg.dialogue_lines
        : seg.dialogue
          ? [{ speaker, text: seg.dialogue, start_s: undefined, end_s: undefined }]
          : [];
    const canonicalTurns = ensureDialogueClock(
      rawTurns.filter((turn) => oneLine(turn.text)),
      clipSeconds
    );
    const dialogue = canonicalTurns
      .map((turn, turnIndex) => {
        const name = oneLine(turn.speaker);
        const voicePersonality = name
          ? voiceProfilesByName.get(name.toLowerCase()) ||
            "native voice in the project's locked language and regional accent, stable voice matching the named speaker's locked gender, age, timbre, base pitch and speaking rate"
          : lockedNarratorVoiceProfile(lang, opts.narratorVoiceStyle);
        const line = {
          turn_id: `${String(seg.segment_number)}_turn_${String(turnIndex + 1).padStart(3, "0")}`,
          speaker_id: name ? charIds.get(name.toLowerCase()) || name : "VOICEOVER",
          speaker_name: name || "VOICEOVER",
          delivery:
            turn.delivery === "off_screen"
              ? "off_screen"
              : name
                ? "on_screen"
                : "voiceover",
          camera_beat:
            name && turn.delivery !== "off_screen"
              ? turn.camera_beat ?? null
              : null,
          voice_personality: voicePersonality,
          text: oneLine(turn.text),
          language: lang,
          start_sec: turn.start_s ?? null,
          end_sec: turn.end_s ?? null,
          utterance_count: 1,
          repeat_policy: "exactly_once",
        };
        return line;
      });
    const cameraText = softenIncidentalBagPressure(
      beats.map((beat) => oneLine(cleanContinuousText(beat.camera))).filter(Boolean).join("; "),
      incidentalBagPressure
    );
    const camera = cameraParts(cameraText);
    const revolvingDoorCameraMovement =
      revolvingDoorOperation === "exit"
        ? "One continuous medium two-shot from the destination-side floor: hold the waiting character clear of the threshold, gently track the occupied wedge into alignment, then follow the exiting character's single step onto the floor and settle on the human reaction; keep both characters readable in the same shot"
        : revolvingDoorOperation === "enter" || revolvingDoorOperation === "pass_through"
          ? "One continuous medium shot from a supported lobby position: follow the crossing character from the origin-side gap into one wedge and along its curved arc, ending only at the physically aligned destination exit; no cut or shot change"
          : revolvingDoorOperation === "hold"
            ? "One continuous supported medium composition holds the same occupied wedge and the waiting character through the glass while the door rotates in one direction; no entry, exit, cut or shot change"
            : "";
    const cameraMovement = revolvingDoorCameraMovement || camera.movement;
    const ambience = [env?.sound_bed, opts.ambientAudio].filter(
      (value): value is string => !!value
    );
    const environmentSoundBed = opts.ambienceEnabled === false
      ? "None — intentional silence with no environmental ambience"
      : scrub(
          contextLocation?.sound_bed || env?.sound_bed || opts.ambientAudio || ""
        );
    const environmentReverb = scrub(contextLocation?.reverb_profile || "");
    const previousLocationId =
      segIndex > 0 ? oneLine(breakdown.segments[segIndex - 1]?.location_id) : "";
    const locationChanged =
      !!previousLocationId &&
      !!seg.location_id &&
      previousLocationId !== seg.location_id;
    const audioPolicy =
      transitionMode === "opening"
        ? "open"
        : transitionMode === "continuous"
          ? "preserve"
          : locationChanged
            ? "reset_to_location"
            : transitionMode === "time_jump"
              ? "reset_for_time"
              : "reset_for_cut";
    const sceneBibleTokens = {
      lens: stylizedRepresentation
        ? "virtual camera with stable perspective in the locked graphic medium"
        : scrub(sb?.lens),
      color_grade: stylizedRepresentation
        ? "palette and contrast native to the locked graphic medium; no live-action or photoreal grade"
        : scrub(sb?.color_grade),
      lighting: stylizedRepresentation
        ? "script-motivated light simplified through the locked graphic medium; no photographic skin or surface detail"
        : scrub(sb?.lighting),
      backdrop: stylizedRepresentation
        ? `${scrub(sb?.backdrop) || "complete script-derived setting"}; redraw every element in the locked graphic medium`
        : scrub(sb?.backdrop),
      film_grain: stylizedRepresentation
        ? "none; use only texture native to the locked graphic medium"
        : scrub(sb?.film_grain),
      audio_bed: environmentSoundBed,
      reverb: environmentReverb,
    };
    return {
      scene_id: String(seg.segment_number),
      duration_sec: clipSeconds,
      // Aspect ratio travels INSIDE every clip so the extension/Veo renders each
      // video at the exact frame the app selected — never a portrait/landscape
      // mismatch between the app and the Veo panel.
      aspect_ratio: opts.aspectRatio,
      output_specs: {
        aspect_ratio: opts.aspectRatio,
        production_prompt_language: promptLang,
        spoken_language: lang,
        language_policy: `All camera, action, environment, continuity, sound and negative instructions are written in ${promptLang}. Only verbatim dialogue or voice-over and explicitly required readable audience text may use ${lang}. Exact character names and role labels remain unchanged identity tokens.`,
        note: `Render this video strictly in ${opts.aspectRatio} (${opts.aspectRatio === "9:16" ? "vertical portrait" : opts.aspectRatio === "1:1" ? "square" : "horizontal landscape"}). Do not crop, letterbox or switch orientation.`,
      },
      ...(breakdown.context_ir?.production_profile
        ? {
            production_profile: {
              genre: breakdown.context_ir.production_profile.genre,
              content_subtype: breakdown.context_ir.production_profile.content_subtype,
              dialogue_style_id: breakdown.context_ir.production_profile.dialogue_style_id,
              narrator_voice_style_id: breakdown.context_ir.production_profile.narrator_voice_style_id,
              camera_profile_id: breakdown.context_ir.production_profile.camera_profile_id,
              camera_direction: breakdown.context_ir.production_profile.camera_direction,
              edit_rhythm: breakdown.context_ir.production_profile.edit_rhythm,
              sound_direction: breakdown.context_ir.production_profile.sound_direction,
              forbidden_patterns: breakdown.context_ir.production_profile.forbidden_patterns,
            },
          }
        : {}),
      ...(seg.location_id ? { location_id: seg.location_id } : {}),
      continuity_mode: transitionMode,
      ...(seg.transition_in ? { transition_in: seg.transition_in } : {}),
      ...(seg.state_ledger ? { state_ledger: seg.state_ledger } : {}),
      visual_style: (stylizedRepresentation
        ? [
            `Locked ${opts.characterRepresentation} character-and-world medium`,
            "one consistent graphic line, shape, palette, texture and simplified anatomy language",
            "no live-action or photoreal conversion",
            // The final consumer field repeats these exact scene-bible values so
            // BIBLE-002 can prove that the exported clip, not just its adjacent
            // metadata object, owns one stable camera and grade authority.
            sceneBibleTokens.lens,
            sceneBibleTokens.color_grade,
          ]
        : [
            scrub(breakdown.style_guide?.art_direction),
            scrub(sb?.lens),
            scrub(sb?.color_grade),
            scrub(sb?.film_grain),
          ])
      .filter(Boolean)
      .join("; "),
      scene_role: seg.marketing_role,
      // Keep the cast explicit for importers/extensions that scope reference
      // images per clip. Never make them infer the cast from character_lock.
      characters_in_scene: onScreen,
      character_lock: characterLock,
      scene_bible_tokens: sceneBibleTokens,
      ...(seg.wardrobe_state && seg.wardrobe_state.length > 0
        ? {
            wardrobe_state: seg.wardrobe_state.map((state) => ({
              character: oneLine(state.character),
              outfit: scrub(state.outfit),
              outfit_materials: scrub(state.outfit_materials),
              hair: scrub(state.hair),
            })),
          }
        : {}),
      background_lock: {
        id: seg.location_id || seg.environment_ref || `BACKGROUND_${seg.segment_number}`,
        name: softenIncidentalBagPressure(
          env?.display_name || seg.title,
          incidentalBagPressure
        ),
        setting: backgroundSetting,
        scenery: sceneBibleTokens.backdrop,
        props: noHex(breakdown.product_dna) || "Only props explicitly named in setting and action",
        lighting: [sceneBibleTokens.lighting, env ? scrub(`${env.lighting.key_kelvin}K, ~${env.lighting.ambient_lux} lux`) : ""]
          .filter(Boolean)
          .join("; "),
        persistence: opts.hasLocationRef
          ? "Attached location image is the set authority; keep its geometry, furniture, materials and light."
          : "Keep this set unchanged; spatial_topology controls its fixed geometry.",
      },
      audio_transition: {
        policy: audioPolicy,
        ...(previousLocationId
          ? { from_location_id: previousLocationId }
          : {}),
        to_location_id: seg.location_id || "",
        sound_bed: environmentSoundBed,
        reverb_profile: environmentReverb,
      },
      ...(spatialTopology ? { spatial_topology: spatialTopology } : {}),
      camera: {
        framing: revolvingDoorCameraMovement ? "MS" : camera.framing,
        angle: camera.angle,
        movement: actionDrama
          ? `${scrub(cameraMovement)}. ACTION CAMERA: preserve screen direction and readable body geography at real-time speed; hold a supported wide or medium-wide view through attack, defence and contact, absorb force with a controlled operator reaction, then tighten only on the visible consequence. No cuts, frantic orbit, glamour pose, hidden impact or calm slow drift that weakens danger.`
          : `${scrub(cameraMovement)}. One smooth move or hold; no cuts or separate camera clock. PACING SAFETY VALVE: pace everything calmly across the FULL clip at real human speed — NEVER rush, whip, jerk or fast-forward a move or an action to catch up with the plan; if a move or beat cannot happen calmly within its time window, make it SMALLER or simply HOLD the current framing (a still, well-composed frame beats a hurried one). The camera settles and holds on whoever is speaking and only drifts during silent gaps between lines.`,
        focus: VEO_CAMERA_FOCUS_RULE,
      },
      scene_action: {
        start_state: entryState,
        motion: mainAction,
        end_state: exitState,
        execution_contract:
          dialogue.length > 0
            ? "ONE primary causal action unit. Perform at most three production-changing atomic transitions in strict order; finish each transition before the next. Spoken turns keep their declared order. During speech, continue only the already-started simple motion or a small reaction; never begin another prop transfer, furniture move, sit/stand or relocation."
            : "ONE primary causal action unit. Perform at most five production-changing atomic transitions in strict order; finish each transition before the next. Never run unrelated character tasks in parallel or rush them to fill the clip.",
        ...(actionDrama
          ? {
              action_director_profile:
                "One gripping causal confrontation unit: attacker initiates; defender immediately evades, blocks or intercepts; a decisive counter or short 1-3-contact combination lands; an immediate counter-counter is allowed in a real duel; momentum produces visible loss of balance, a grounded new position, fear/pain/fatigue and aftermath. Do not reduce a requested fight to avoidance-only blocking. Use 3-5 linked movements, never unrelated simultaneous chaos, waiting opponents, superhero poses or consequence-free showboating.",
            }
          : {}),
        ...(continuityFromPrev ? { continuity_from_previous: continuityFromPrev } : {}),
        continuity_lock:
          inheritsPhysicalState
            ? "Open from continuity_from_previous; visible causes create and preserve every state change."
            : seg.transition_in && seg.transition_in.mode !== "opening"
              ? `Open from this clip's declared start_state after an editorial ${seg.transition_in.mode}; preserve only transition_in.preserve and reset transition_in.reset.`
              : "Open from start_state; visible causes create and preserve every state change.",
        staging: spatialTopology
          ? hasRevolvingDoorMechanism
            ? revolvingDoorOperation === "exit"
              ? "Follow every spatial_topology field exactly. The character starts inside the same occupied wedge and exits exactly once only at destination-side alignment; no re-entry, repeated exit or crossing through glass."
              : revolvingDoorOperation === "hold"
                ? "Follow every spatial_topology field exactly. Keep the character inside the same occupied wedge for the whole clip; no entry, exit or compartment change."
                : revolvingDoorOperation === "background"
                  ? "Follow every spatial_topology field exactly. The revolving door is unoccupied background architecture; no visible character enters, exits or appears inside a compartment."
                  : "Follow every spatial_topology field exactly. mechanism_motion is mandatory choreography: one entry, the same occupied wedge, one rotation direction and one aligned exit; no repeated crossing or intersection with glass."
            : "Follow spatial_topology; change zones or positions only through visible scripted movement."
          : "Keep blocking and eye-lines physically possible; change positions only through visible scripted movement.",
      },
      foley_and_ambience: {
        environment_sound_bed: environmentSoundBed,
        environment_reverb: environmentReverb,
        project_ambient:
          opts.ambienceEnabled === false ? "None" : scrub(opts.ambientAudio),
        ambience:
          opts.ambienceEnabled === false
            ? []
            : [environmentSoundBed, ...ambience.map(scrub)].filter(Boolean),
        fx: opts.foleyEnabled === false
          ? []
          : actionDrama
          ? [
              "causal high-stakes action Foley synchronized exactly to visible motion: urgent breath, foot plant, cloth strain, one distinct impact per shown contact, nearby surface or furniture response, stagger/fall weight, then breathless aftermath; no stock punch without visible contact",
            ]
          : ["natural clothing, footsteps and prop-contact sounds synchronized to visible action"],
        music: opts.musicEnabled === false
          ? "None — music disabled by user"
          : opts.ambientAudio && !/no music/i.test(opts.ambientAudio)
            ? opts.ambientAudio
            : "None unless explicitly required by the scene",
      },
      dialogue,
      lip_sync_director_note:
        dialogue.length === 0
          ? "No dialogue; all visible mouths remain naturally closed."
          : VEO_LIP_SYNC_DIRECTOR_NOTE,
      output_rules: {
        frame: "one clean full-screen continuous shot; no panels or cuts",
        on_screen_text: "none — no captions, labels, logos, HUD or watermark",
        // Concise on-set audio note only — voice IDENTITY binding lives once in
        // lip_sync_director_note; do not repeat that essay here (competing voice
        // blocks are what made voices drift).
        audio: "One clean native voice at a time, each line taken from its own dialogue row's voice_personality — never use the first character as a default and never infer the speaker from camera framing or the visible face. Keep one low constant ambient bed; dialogue is audio only, with no captions or subtitles.",
        reference_priority: hasReferencedVisibleCharacter
          ? "Attached named images are identity, face, body-proportion and hair authorities only; never copy their clothing. Use the context-locked outfits in character_lock and never merge or swap identities."
          : "Preserve the exact named identities in character_lock.",
      },
      negative_prompt: [
        hasReferencedVisibleCharacter
          ? VEO_REFERENCE_CHARACTER_NEGATIVE_LIST
          : realWorldSurface
            ? VEO_NEGATIVE_LIST
            : VEO_SHARED_FAILURE_NEGATIVE,
        spatialTopology
          ? "blocked connector, moved architecture, changed zone order, impossible camera or character position"
          : "unexplained pose or position change",
        hasRevolvingDoorMechanism
          ? "walking straight through a revolving door, crossing a radial glass wing, body or bag intersecting glass, reversing door rotation, changing compartments, repeating an entry or exit, exiting before the occupied opening aligns with the destination floor"
          : "",
        stylizedRepresentation
          ? "live-action hand, photoreal human hand, realistic skin hand, palm, fingernails, knuckles, realistic wrist, detached human hand, mixed-media anatomy, photographic material or sensor texture"
          : "",
      ].filter(Boolean).join(", "),
    };
  });

  return {
    format: "flow-veo-scene-json-v2",
    usage: "Each clips item is one compact structured Veo scene. Use characters_in_scene to attach only that scene's named references; do not flatten or prepend another prose prompt.",
    production_prompt_language: promptLang,
    spoken_language: lang,
    aspect_ratio: opts.aspectRatio,
    clip_count: clips.length,
    clips,
  };
}
