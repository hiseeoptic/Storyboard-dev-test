import type {
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  VideoGoal,
  SceneBible,
  AspectRatio,
} from "@/types";
import {
  resolveEnvironment,
  renderEnvironmentBlock,
  environmentCatalogForPrompt,
} from "@/lib/environment";
import {
  lawsSystemDigest,
  clipMotionLawLine,
  clipCameraLawLine,
  clipAudioLawLine,
  defaultVoiceFor,
  worldContextLockBlock,
} from "@/lib/laws";
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
import { compileCookingRecipeDigest } from "@/lib/cooking";

// Forbidden in every generated image/clip (the brief's negative list).
// Phrased as plain descriptors (no instructive "no/don't") — Veo/Kling read the
// negative list as nouns/adjectives to avoid, and "no X" phrasing can backfire.
const SHARED_NEGATIVE =
  "NEGATIVE (avoid — plain descriptors): resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual, warped or altered label/logo text, logo change, brand-colour change, extra products, duplicated or doubled objects (e.g. two pans / two of the same item), floating or levitating objects, objects passing through solid surfaces, physically impossible actions (e.g. lifting/holding a pan with a spatula), sudden appearing or disappearing objects, teleporting, morphing, warping, melting, distorting, deforming, object/container morphing, inconsistent physics, unnatural motion, jittery or stuttering movement, frame skipping, mid-clip jump cuts, extra people, changed hair/wardrobe/accessories, identity drift, face morphing, changing facial features, age shifting, extra or missing limbs, extra or fused fingers, mutated or malformed hands, human hands when the action does not require them, limbs bending or passing through objects, deformed liquid, floating ingredients, melted food, warping plate, liquid flowing upward, on-screen text overlays, captions, subtitles, burned-in dialogue text, title cards, karaoke/lyric text, camera or lens spec overlay (e.g. '50mm', 'f/2.8', '4300K', 'lux'), technical readout, HUD, info card pinned in a corner, timecode or timestamp text, watermark, duplicate subject, plastic/CGI skin.";

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
  "PHOTOREAL REALISM (this is REAL filmed footage, physically-based rendering — NOT CGI, NOT 3D render, NOT illustration): human skin keeps real texture — visible pores, fine vellus/facial hair, natural subsurface scattering, subtle moisture/oil sheen, real catchlights and micro-imperfections; NEVER airbrushed, waxy, plastic or beauty-smoothed. Every object and material reads true-to-life: leather shows grain, creases, worn scuffs and real stitching; denim a woven twill weave; metal brushed or worn with real specular reflections; wood visible grain; fabric real thread and drape — no plastic, toy-like or CGI surfaces. Physically accurate light with soft imperfect shadow edges, natural depth of field and a fine organic film grain.";

// Concise anti-artifact tail. Product-related negatives are included ONLY when
// the clip actually has a product, so a person-only clip never mentions products.
// The physics/camera/audio clauses are RENDERED FROM the frozen PRODUCTION_LAWS
// manifest (src/lib/laws) — single source of truth, per the 9-layer canon.
function veoConciseTail(
  hasProduct: boolean,
  realityProfile?: RealityProfile | null
): string {
  const productNeg = hasProduct
    ? "warped or altered label/logo text, brand-colour change, extra or duplicated products, "
    : "";
  const realWorld = realityUsesRealWorldPhysics(realityProfile);
  const realityDirective = realityProfile
    ? buildRealityDirective(realityProfile)
    : PHOTOREAL_REALISM;
  const motionLaw = !realityProfile
    ? clipMotionLawLine()
    : realWorld
      ? "ACTION LAW: intention or another declared trigger precedes deliberate change; contact precedes influence; force has a source/direction; materials react; secondary motion follows; result state and meaningful traces persist according to the locked continuity mode."
      : "INTERNAL PHYSICS LAW: motion, anatomy, materials and causality obey the locked reality profile consistently; any impossible or stylized behaviour must be explicitly allowed by that world, never accidental drift.";
  const cameraLaw = realityProfile
    ? "CAMERA LAW: follow the locked visual-language grammar and scene proof requirements; the viewpoint must make required evidence observable without adding unrelated moves, cuts or impossible camera positions."
    : clipCameraLawLine();
  const audioLaw = realityProfile
    ? "AUDIO LAW: follow the locked audio world; voices, ambience and foley have causal sources, correct timing and perspective, while silence remains available when required by scene intent."
    : clipAudioLawLine();
  const renderNeg = realWorld
    ? "plastic/CGI/wax/airbrushed skin, toy-like or 3D-render materials"
    : "unmotivated photoreal/stylized switching, accidental world-physics drift";
  const textLaw = "ZERO VISIBLE TEXT OR GRAPHICS: every frame is clean live footage with no readable letters, words, names, numbers, logos, labels or typography anywhere, including real-world signs and product printing. No subtitles, captions, dialogue transcription, title cards, name tags, floating boxes, badges, watermarks, HUD, camera data or technical overlays. All names, dialogue, brands, ages, temperatures, lens values and timing values in this prompt are INTERNAL instructions only. Spoken words are AUDIO ONLY.";
  return `${realityDirective} ${motionLaw} ${cameraLaw} ${audioLaw} ${textLaw} Avoid: ${productNeg}storyboard sheets, grids, panel borders, reference thumbnails, character name tags or labels on screen, a character's name or age rendered as a floating label or info card, colour-code or hex-code text overlays, burned-in subtitles or captions, spoken words rendered as on-screen text, morphing, warping, teleporting, floating or duplicated objects, extra or fused fingers, malformed hands, a third hand, an extra pair of hands, a disembodied hand entering the frame, the face changing, deformed food or liquid, ${renderNeg}.`;
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
  return undefined;
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
STORY SPINE: every segment must have a named function and a causal relationship to the next (continuation, reversal, consequence, contrast, reveal, resolution, montage association or intentional atmosphere). Do not write "then... then..." filler. The ending must fulfil the project purpose, not a default conversion template.
DIALOGUE: natural spoken lines appropriate to character, culture, genre and scene intent. Keep them performable inside the duration; let action or silence carry a clip when the intent requires it. SHOW don't tell and never lecture or list without an educational reason.
COPYWRITING / DRAMATIC TECHNIQUES ARE OPTIONAL TOOLS: rule of three, antithesis, challenge-the-label, curiosity gap, subtext, reversal, suspense and rhythmic phrasing are selected only when they serve the locked intent and speaker identity.

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
CHARACTERS: <EVERY person in the story, one per line — name, age, signature look, tone; mark children with "(child)". If the idea/script uses role labels (Chồng/Vợ/Con, Bố/Mẹ…), assign each role ONE consistent given name (e.g. Chồng = Nam) and keep the mapping for the whole script. A solo video simply lists one person.>
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
(TURN-TAKING: a short exchange — a question + reply, ~2-3 short lines total — SHOULD share ONE segment as consecutive speaker-tagged DIALOGUE lines so the 10s isn't wasted; they play in order, never overlapping. Keep each labelled line VERBATIM with its real speaker. Only push lines to the NEXT segment when they no longer fit ~9 seconds. Use "VO" as the name for a voiceover line. A single speaker with one line is fine too.)
(PACING AUDIT — MANDATORY before you output: speech runs ~0.4s/word, so a lone 5-8 word line fills only ~2-3s of a 10s clip — that clip is WASTED. Re-scan every segment: if its DIALOGUE is a single line under ~10 words AND it is part of an exchange (a question, a reply, a reaction to the adjacent segment's line), MERGE those lines into ONE segment as 2-3 consecutive turns, and give the freed segment new story value (a new beat of the arc with its own line) — never leave a near-silent 10s clip unless the ACTION itself deliberately carries the moment, e.g. ASMR or a wordless reveal.)
(LOAD BUDGET — every segment carries 8-22 TOTAL spoken words (all its lines combined). Over 22 → push the overflow line(s) into the next segment; a single line longer than ~22 words is that segment's ONLY line. Distribute evenly across the whole script: never one segment with a lone 4-word line while the next crams 3 long lines.)
(continue for EXACTLY the requested number of segments, following the emotional arc)
CAPTION: <ready-to-post caption + 4-6 hashtags>

No camera directions, no image prompts, no JSON — only the creative script above.`;
}

export function buildScriptWriterUserPrompt(input: StoryboardGenerationInput): string {
  const segmentCount = input.segment_count ?? 5;
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
  if (input.main_character) brief.push(`- Main character: ${input.main_character}`);
  if (input.central_conflict) brief.push(`- Conflict: ${input.central_conflict}`);
  const briefBlock = brief.length ? `\nBrief:\n${brief.join("\n")}` : "";

  return `Write a ${segmentCount}-segment short-video script.

Idea / Topic: ${input.story_idea}
Genre: ${input.genre} · Goal: ${goal} — ${GOAL_GUIDANCE[goal]}
Dialogue language: ${
    isCooking && ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(input.cooking_style ?? "")
      ? "NONE — every segment is wordless diegetic ASMR"
      : `${lang} (when dialogue is justified, write it naturally in ${lang})`
  }.${briefBlock}${framework ? `\n${framework}` : ""}

Write the ${segmentCount}-segment script now in the exact output shape from the system prompt. For a wordless cooking ASMR profile, keep every DIALOGUE section empty and let the ACTION carry the clip; do not invent a line merely to fill time.`;
}

// ─── Step 1: Segment Breakdown + Character Lock ─────────────────────────────

export function buildStoryboardSystemPrompt(): string {
  return `You are a world-class short-form video director and marketing strategist. You design storyboards that are turned into REAL videos using AI image-to-video tools (Google Veo 3 / Veo 3.1, Seedance, Kling).

CRITICAL PRODUCTION MODEL — how the final video is actually made:
- The video is assembled from multiple ~10-second CLIPS ("segments") generated by Omni Flash / Veo.
- Each 10s segment is ONE CONTINUOUS TAKE: a SINGLE primary action filmed in one unbroken shot — never a static scene dragging for 10s, but also NEVER several hard cuts jammed into 10s. AI video models CANNOT "cut"; if you order multiple separate shots inside one clip they MORPH and TELEPORT between them (objects warp, hands pass through props, items appear/vanish). So the "beats" are SMOOTH CAMERA REFRAMINGS of that SAME ongoing action (a slow push-in, a pan, an angle change that reveals more of the one continuous moment) — the subject, props and physics stay continuous for the whole 10s.
- Each segment is generated by feeding its keyframe + ONE motion prompt into Veo/Seedance.
- Segments are CHAINED for seamless playback: the visual state at the END of segment N must flow naturally into the START of segment N+1 (same character, location, lighting, continuous action). No jarring cuts between segments.
- So "beats" = the progressive camera framings of the ONE continuous action inside a 10s segment (not separate scenes). Provide the EXACT number of beats requested in the user message.

PROJECT-LED STORY STRUCTURE (never force one template onto every video):
- Read the locked Project Intent and approved script FIRST. Marketing projects may use HOOK → PROBLEM → SOLUTION → CTA; narrative, documentary, educational, atmospheric, symbolic, comedy, music-driven and experimental projects use the structure their intent requires.
- Clip 1 ALWAYS owns a 3-5 second Hook Window, but its form comes from Project Intent: inciting event, observed fact, question, sensory moment, emotional recognition, conflict, transformation preview or product proof. Marketing-style clickbait and CTA remain conditional. Do not invent a hard-sell CTA for a story whose intended ending is emotional, informational or atmospheric.
- "marketing_role" remains a legacy compatibility label; "scene_intent" is the canonical per-clip creative contract.

UPLOADED REFERENCE PRIORITY (absolute hierarchy — PHOTOS beat text, text beats invention):
- USER SETUP MENU CONTRACT (NON-NEGOTIABLE): every entered character name/role and every image group belongs together one-to-one, in menu order. Preserve ALL named characters as separate identities; never use only the first upload, never merge two people, never swap their faces, never omit a referenced character when the approved script places them in the scene, and never let generated defaults/anchors override menu uploads. Character menu photos, product photos and background/location photos are the SUPREME source of truth. A character keeps the uploaded gender, age, face, hair and look; a product keeps its exact shape, colours and branding; when a LOCATION photo exists (indoor room or outdoor scene), stage every relevant segment inside that uploaded place and reuse its real layout, landmarks (furniture indoors; buildings, trees, terrain, water outdoors), colours, materials and light in every first_frame_prompt. Do NOT relocate scenes, "improve" the set, or invent a contradictory place.
- If the story idea and an uploaded photo conflict (e.g. the idea says villa but the photo shows a small apartment), THE PHOTO WINS — adapt the story to the real place/person/product.
- VIDEO OUTPUT TEXT CONTRACT (NON-NEGOTIABLE): every generated VIDEO frame contains ZERO readable text or graphics. Set world_context.allowed_language_text to "none — zero readable text anywhere". Names, ages, dialogue, brands, captions, lens values, Kelvin/lux and timecodes are internal production data only; never request subtitles, captions, name tags, product lettering, logos, badges, title cards, HUD or overlays. Dialogue is AUDIO ONLY. Storyboard documents may contain planning labels, but they are NEVER video start frames.

FORENSIC DNA + SCENE BIBLE (absolute consistency — #1 priority, the user's video must not "look AI"):
- Every object is locked to a "DNA" that NEVER drifts and is repeated VERBATIM in every board/keyframe and every motion prompt.
- Build a detailed "character_lock" per character with an EXPLICIT "gender" field (male/female — if a reference photo was provided it MUST match that real person's gender), plus age, build, skin tone, hair, eyes, exact costume, signature features, default expression, PLUS a single-line "dna" string capturing the forensic identity WITH RGB HEX CODES for skin/hair/eyes/wardrobe/brand colours (e.g. "navy polo #1F2A44, light-blue tee #A9C7E8, matte steel watch #8A8D91, warm tan skin #C8956A").
- CHARACTERS ARE ORIGINAL AND FICTIONAL. Use ordinary, common given names (e.g. Mai, Minh, Lan, Nam) and describe a made-up everyday person — NEVER the name, likeness, or description of any real, famous or recognisable public figure/celebrity/influencer. Do not write "looks like [celebrity]" or reference any real person. Describe appearance by generic attributes only, so the render never resembles a specific real individual (this is what makes Veo/Flow reject the clip as a public-figure likeness).

MULTI-CHARACTER CASTING & DIALOGUE ASSIGNMENT (mandatory whenever the story/script has 2+ people — this is what keeps a family/dialogue video coherent):
- FULL CAST LOCK: create ONE character_lock for EVERY distinct person who appears anywhere in the story/script — no exceptions. If the script names people by ROLE (Chồng/Vợ/Con, Bố/Mẹ, husband/wife/child…), assign each role ONE ordinary given name and state the mapping in the synopsis (e.g. "Chồng = Nam, Vợ = Mai, Con = bé Minh"). Use those EXACT names consistently in every segment, beat caption, first_frame_prompt, dialogue and speaker field. NEVER invent an extra unnamed person.
- CHILDREN: a character who is a child gets "is_child": true and an age-locked description (e.g. "bé trai ~6 tuổi, dáng nhỏ nhắn"). A child stays a child in EVERY shot — never rendered as an adult, never changes age, and their small relative height vs the adults stays consistent.
- ROLE-LABELLED DIALOGUE RECOGNITION: when the idea/script contains dialogue labelled by role or name ("Chồng: …", "Vợ: …", "Con: …", "Nam: …"), each labelled line belongs to THAT character — copy it VERBATIM and set that character's lock name as its speaker. NEVER reassign a line to a different character. A short back-and-forth (e.g. a question + a reply, ~2-3 short lines) SHOULD share ONE 10s clip as sequential turns in "dialogue_lines" (fill the time instead of wasting a clip per line) — following the DIALOGUE turn-taking rules below. Only spill to the NEXT segment when the exchange no longer fits in ~9 seconds.
- "characters_in_scene" (REQUIRED per segment): list the EXACT lock names of everyone VISIBLE in that segment — nobody else may appear (no background family members drifting in). The "speaker" MUST be one of them (empty speaker = voiceover). Non-speaking listed characters are present, reacting silently, mouths closed. If someone ENTERS mid-clip (e.g. the child runs in), they are still IN characters_in_scene and the motion_prompt describes the entrance explicitly.
- CAST CONTINUITY: a character's face, hair, wardrobe and colours are IDENTICAL in every segment they appear in (repeat their lock verbatim in that segment's first_frame_prompt). The SAME wardrobe across the whole video — never re-dress anyone between segments.
- If there is a hero PRODUCT, write "product_dna": exact shape, material, colours WITH RGB hex, label/logo text+colour, cap/parts — repeated verbatim.
- Build a "scene_bible" (lens, lighting with Kelvin temps, backdrop with hex, colour grade) — the style fingerprint reused VERBATIM so lens, lighting, backdrop and tone never change.
- One single set/location per segment; only camera framing and the action change.
- Every storyboard board carries a compact REFERENCE LIBRARY: for EACH visible named character, exactly two face-readable head-and-shoulders views (FRONT + PROFILE/3-4), plus one small ENVIRONMENT OVERVIEW. No full-body/back turnaround cells are needed. Uploaded menu photos outrank any generated board anchor.

PHYSICAL REALISM (every clip must look real, not "AI" — this is what eliminates the broken, impossible-motion look):
- ONE primary physical action per 10s clip, performed SLOWLY and DELIBERATELY. Never stack multiple simultaneous or sequential actions into one clip — that is the #1 cause of morphing, teleporting, duplicated limbs and objects passing through each other.
- Write SPECIFIC motion: name the body part + the verb + the manner (e.g. "her right hand slowly lifts the pan by its handle"), never vague verbs like "moving", "doing" or "interacting".
- 🔗 OBJECT-INTERACTION CAUSAL CHAIN (mandatory — a vague description here is what makes objects teleport into hands): every time a character touches, picks up, hangs, places or moves ANY object, the motion_prompt must narrate the FULL visible chain with timing: (1) REACH — the named hand travels to the object ("2-3s: his right hand reaches toward the denim jacket on the chair back"); (2) CONTACT — fingers close around a named part ("grips the jacket's collar"); (3) TRANSFER — carried along one continuous path ("lifts it off the chair and carries it two steps to the coat rack"); (4) RELEASE — placed/hung and the hand withdraws ("loops it over the rack's second arm, lets go"). NEVER write "he holds the jacket" if the previous moment his hands were empty — the pick-up must be shown.
- ⚡ CAUSE BEFORE EFFECT (nothing happens by itself): if the story needs something to fall, tip, spill, open or break, the motion_prompt must FIRST show the physical cause making contact, THEN the effect with real physics timing — e.g. "as he hangs the heavy jacket, its weight pulls the top-heavy rack sideways; the rack leans, then topples to the floor". FORBIDDEN: "the coat rack falls" with no cause, "the door opens" with nobody touching it, effects that precede their causes.
- 🚪 ONE LOCATION PER CLIP: the whole 10s lives in ONE continuous space; the set/backdrop never changes mid-clip. If the character must be somewhere else, they WALK there on screen within the same space — or it becomes the NEXT segment.
- 🎒 PROP EXISTENCE & WARDROBE TRUTH (an undeclared prop is what makes objects teleport into hands): every object the motion_prompt uses MUST be planted in that segment's first_frame_prompt start state — in the character's hand, worn on their body, or placed in the scene (e.g. if he hangs a jacket, the first_frame_prompt says the jacket is already draped over his forearm as he enters). NEVER write "takes off his jacket" unless the jacket is part of his locked costume or explicitly declared carried. Before returning, CHECK every motion_prompt against the character_locks costume and the first_frame_prompt: any object touched in the motion that is missing from the start state is a bug — add it to the first_frame_prompt.
- State physics explicitly in the motion_prompt: real-world weight, gravity, momentum and balance; objects keep one solid form (object permanence); hands make real contact with props and never pass through them; liquids and food obey gravity.
- Every motion_prompt must include a positive realism clause, e.g.: "single continuous motion, natural movement obeying real-world physics, consistent weight and gravity, stable identity, object permanence".
- Camera moves are smooth and minimal (a slow push-in or gentle pan). Avoid combining a big camera move with big subject motion — that compounding warps the image.

STAGING & BLOCKING (a real director's coverage — this is what separates a watchable video from a flat, monotonous one):
- 🎭 VARY THE STAGING BETWEEN CLIPS: consecutive segments must NOT repeat the same two people in the same pose in the same framing (five straight clips of a couple sitting on a sofa = dead video). Between clips, change at least ONE of: a character's position in the room (standing at the window, crossing to the shelf, kneeling by the cabinet), their posture (sitting → leaning forward → standing), the spatial relationship (side-by-side → facing → one behind the other), or the shot framing. Move the story PHYSICALLY through the locked space — always by walking on screen or between segments, never teleporting.
- ✋ CHARACTER BUSINESS: every visible character has ONE concrete piece of physical business per clip that serves the story (setting the phone face-down on the table, wrapping both hands around a warm cup, straightening the modem's cable, folding the throw blanket while listening) — hands are NEVER idle mannequin hands hanging at the sides. Listeners react with specific micro-actions: a slow eyebrow raise, a suppressed smile tugging one corner of the mouth, a slow exhale, fingers tightening on the cup — name the exact micro-expression, never write "reacts" or "looks at him".
- 🎬 CAMERA VARIETY ACROSS CLIPS: still ONE smooth move per clip, but the MOVE ITSELF must vary across the video — rotate through the vocabulary: slow push-in / lateral drift / gentle arc-orbit / slow pull-back reveal / static frame with only a subtle reframe / over-the-shoulder favoring the listener. NEVER repeat the identical camera recipe (e.g. "hold A, pan to B, push in") in more than two consecutive clips.
- 🐢 CAMERA PACING — NO RUSHED MOVES: the single camera move breathes across the WHOLE clip at real human operator speed — a pan that must reach the other speaker travels gently during the natural pause BETWEEN lines, never whips in one second. The camera starts settled, eases in, eases out, ends settled (so the last frame chains cleanly into the next clip). If a move cannot fit calmly inside 10s, choose a smaller move.
- ⚡ ENERGY-AWARE PERFORMANCE (Director's Engine): infer each clip's energy (low / medium / high) from its emotion, and write the acting to match — low: minimal movement, internalized emotion; medium: natural gestures, conversational pacing; high: focused intensity, never flailing. Adjacent clips never jump low→high (motion shows energy BUILDING gradually — restrained first, opening up) and never crash high→low (motion shows tension RELEASING slowly — controlled breathing, shoulders dropping). Chained clips also keep CAMERA temperament continuity: never cut from a locked-off static clip straight into a handheld-feeling energetic move — step through a controlled push-in first.

MATERIAL & SKIN REALISM (this is what kills the "AI/CGI/plastic" look — treat every clip as REAL filmed footage, never a 3D render):
- SKIN: describe real skin — visible pores, fine vellus/facial hair, natural subsurface scattering, subtle moisture/oil sheen, real catchlights and small natural imperfections. NEVER airbrushed, waxy, plastic or beauty-smoothed. Fill each character_lock's "skin_texture" and "eye_details" with these forensic details (this is the #1 fix for fake-looking faces).
- MATERIALS: every object/prop/garment must read true-to-life with its real surface physics. Leather = grain, creases, worn scuffs, real stitching; denim = woven twill weave; metal = brushed/worn with real specular reflections; wood = visible grain; fabric = real thread and drape. Put these into each character_lock's "wardrobe_materials" and describe hero props with the same material honesty — no plastic, toy-like or CGI surfaces.
- LIGHT: physically-based, tied to time-of-day/weather, with soft imperfect shadow edges. Give scene_bible.lighting BOTH Kelvin temperature AND approximate Lux (e.g. "soft overcast dawn key 5200K, ~800 lux"), and set scene_bible.film_grain to a fine organic grain / clean-acquisition token so the filmic texture stays constant across clips.

${contextFrameworkSystemDigest()}

${lawsSystemDigest()}

ENVIRONMENT ENGINE (locked world archetypes — pick one per segment):
- The system has a library of LOCKED environment archetypes, each a physically-grounded world spec (real materials with surface physics, Kelvin+Lux lighting, atmosphere, micro-details, imperfections, ambient sound bed). When a segment's setting matches one, set that segment's "environment_ref" to the archetype id — the system then injects the full forensic world spec into the Veo prompt automatically, which is what makes the SETTING render real instead of CGI.
${environmentCatalogForPrompt()}
- Rules: pick an id only when it is semantically compatible with the resolved context and approved script. If NO archetype fits, set "environment_ref": "custom" and write the required physical materials + Kelvin/Lux + imperfections inside "first_frame_prompt". Never infer a kitchen, gym, living room or outdoor location from a library default; cooking/fitness routing and any special location profile arrive explicitly in the USER prompt. Two consecutive segments in the same location SHOULD reuse the same compatible environment_ref.

NEGATIVE (forbidden in every image/clip — plain descriptors): warped/changed label or logo text, brand-colour change, extra products or extra people, changed hair/wardrobe/accessories, human hands when the script does not call for them, on-screen text overlays, object/container morphing, teleporting, floating or levitating objects, objects passing through surfaces, deformed liquid, melted food, extra or fused fingers, malformed hands, face morphing, identity drift, plastic/CGI skin.

DIALOGUE (spoken audio in Veo 3 — TURN-TAKING within a 10s clip, never overlapping):
- Veo 3 generates real spoken audio. Write dialogue in the language requested. Keep each spoken line SHORT and natural.
- Put spoken lines ONLY in the dialogue fields. Do NOT quote them inside "motion_prompt" (the system appends them once; repeating makes the character say it twice). In motion_prompt, describe each speaking moment as a PHYSICAL GESTURE bound to its owner — WHO speaks WHEN, aimed at WHOM, and where the camera is (which may be on the LISTENER): e.g. "0-4s: [A] turns his head toward [B] and speaks, his lips moving naturally; 4-7s: [B] answers while looking down at the cup, camera holding on [A]'s listening face, [A]'s mouth closed" (replace [A]/[B] with the EXACT character_locks names). NEVER write a bare "[A] speaks" with no gesture/direction, and never quote the words.
- FIT A SHORT EXCHANGE INTO ONE CLIP (this is the key rule — do NOT waste a whole 10s clip on one 3-word line): use the "dialogue_lines" array to place 1-3 SEQUENTIAL turns inside the same 10s clip when they belong to the same beat of conversation. Each turn = { "speaker": exact character_locks name (or "" for voiceover), "text": the line, "start_s": when they start, "end_s": when they finish }.
- HARD SAFETY RULES (a video model CANNOT lip-sync two mouths at once — breaking these causes garbled clips):
  1. TURN-TAKING ONLY, NEVER OVERLAP: turns are strictly sequential — turn N's end_s ≤ turn N+1's start_s. Exactly ONE person's mouth moves at any instant; everyone else has their mouth closed, listening.
  2. FIT THE SECONDS: the whole exchange must finish by ~9s (leave breathing room). Budget realistically at a natural pace — roughly 0.4s per word plus a ~0.5s beat between speakers. A short line like "Thế anh đã vo gạo chưa?" ≈ 2.5s. If the exchange does NOT fit, keep only the turns that fit and PUSH the rest into the NEXT segment — never cram or speed up speech.
  3. MAX 3 turns and MAX 2 distinct speakers per clip (a third speaker like a child interjecting is allowed only as the LAST short turn). More than that → split across segments.
  4. FOUR INDEPENDENT ELEMENTS PER TURN (mandatory — camera and speaker are NEVER coupled by default): for EVERY dialogue turn, the motion_prompt must state, in the turn's exact time window, all four of: (a) WHO speaks and WHO they look at ("[A] looks at [B] and speaks" — replace [A]/[B] with EXACT character_locks names; the speaker faces their conversational partner per the scene geometry, NEVER automatically toward the camera and never with their back to the person addressed unless the script demands it); (b) what the LISTENER does — mouth fully closed, no speech-like jaw or lip movement, reacting only with eyes/brows/breathing/posture; (c) the CAMERA SUBJECT — chosen freely and explicitly: it may be the speaker, OR the listener's reaction, OR both in frame; when the camera holds the listener, write it out ("6.0-7.9s: [A] continues speaking off-screen while the camera holds on [B]'s silent reaction, mouth closed"); (d) the same clock as the dialogue window. It is FORBIDDEN to let the camera simply follow whoever is speaking turn after turn — in a clip with 2+ turns, at least ONE turn must hold the camera on the listener's reaction while the other continues speaking on- or off-screen. Reframes between turns are gentle pans, still ONE continuous take — no hard cut.
  5. "characters_in_scene" must include every speaker; a voiceover speaker ("") is heard but not shown.
  6. SPEAK-WHILE-STILL (critical — the video model reassigns a line to whichever stable face is on camera if the named speaker is mid-action): a character NEVER delivers a line while performing a large body action (standing up, sitting down, walking, turning away, bending). Choreograph big movements into the GAPS between turns: move first THEN speak from a stable pose, or speak first THEN move. Small gestures while speaking are fine (a nod, lifting a spoon).
  7. ONE SHARED CLOCK: the second-by-second timing in "motion_prompt" MUST use the exact same clock as the dialogue_lines start_s/end_s — the action described at second X must be what is physically happening while the line at second X plays (e.g. if Minh speaks 4-6s, the motion at 4-6s shows Minh stable in his speaking gesture, NOT walking — whether the camera is on him or on the listener). Never write a motion timeline that contradicts the dialogue windows.
  8. QUIET WINDOW: never schedule a line during a loud or major physical event (a crash, a fall, an impact, something breaking) — even if the speaker themselves is standing still. A reaction line starts AFTER the event has fully finished (e.g. the rack topples 5-7s → the wry comment starts at ~7.5s), so the voice is never buried under the event and the camera can be on the speaker's face.
  9. BALANCE THE LOAD ACROSS SEGMENTS (mandatory final audit — unbalanced clips are the #1 cause of dropped/garbled lines): before returning, COUNT the spoken words in every clip. Budget = ~0.4s/word + ~0.5s gap per speaker change + breathing room ⇒ a 10s clip carries 8-22 total spoken words. A clip OVER 22 words → move its last turn(s) into the next segment (and shift that segment's lighter lines down); a clip UNDER 8 words whose line belongs to the same conversation as an adjacent clip's line → merge them into one clip's dialogue_lines. A SINGLE turn longer than ~22 words must be that clip's ONLY line — never squeeze a 24-word line into a 4-second window and never pair it with another turn. The final distribution should feel even: no clip nearly silent while its neighbour is crammed.
- SINGLE-LINE CLIPS: if a beat is just one line, you may use "dialogue_lines" with one entry OR the plain "dialogue"+"speaker" fields — both work. For a longer monologue that fills the clip, one speaker is correct.
- Mirror the FIRST turn into the top-level "dialogue" (its text) and "speaker" (its name) for compatibility.
- NAME TOKENS ARE LOCKED: every character name is a fixed token spelled EXACTLY as in character_locks, identical in every field (title, first_frame_prompt, motion_prompt, beats, camera notes, dialogue speaker, continuity_note). NEVER invent a spelling variant, nickname or near-miss (if the cast is "Minh" and "Lan", then "MInh", "Linh" or "Lan Anh" must never appear anywhere — a near-miss name creates a THIRD person and breaks speaker mapping). PLACEHOLDER WARNING: any name appearing inside RULE EXAMPLES in this prompt ([A], [B], Nam, Mai, Minh, Lan used as illustrations) is a placeholder — NEVER copy an example name into your output; use ONLY the names defined in character_locks for THIS video.
- WARDROBE & HAIR ARE LOCKED — EXCEPT A MOTIVATED CHANGE: each character wears ONE outfit and ONE hairstyle (the ones in their character_lock), described with the SAME words in every first_frame_prompt. The ONLY exception is a story action that PHYSICALLY changes their look — showering ("để anh tắm đã" → wet hair + fresh home clothes), changing clothes, getting soaked by rain, dressing up to go out. When that happens: (a) fill the segment field "wardrobe_state" with the character's NEW look — a FULL outfit description as detailed as the original lock (garments + colours + materials, and hair state like "damp black hair, freshly towelled") — on the FIRST segment where the new look is visible AND every segment after; (b) describe the SAME new look in those segments' first_frame_prompt; (c) never mix old and new wardrobe wording in the same segment — after the change, the office shirt/tie must never be mentioned again. A look change may happen at most ONCE per video and only with an explicit on-screen or between-scenes cause.
- ONE LOCATION, IDENTICAL IN EVERY SEGMENT: unless the script explicitly moves to a new declared location, every first_frame_prompt restates the SAME place — indoor room OR outdoor scene — with the SAME geometry, the SAME landmark positions (furniture/fixtures indoors; buildings, trees, paths, terrain, water outdoors), materials, colour palette and light sources — copy the location description consistently and change ONLY the characters' positions, poses and explicitly named props. The set must read as the same physical place in every clip; when the user uploaded a LOCATION photo, that photo's place is the only set.
- TWO-PERSON BLOCKING (conversation geometry): when two characters share a dialogue scene, their bodies and gazes are oriented TOWARD EACH OTHER per the scene geometry — never both facing the same direction or both facing the camera in parallel like news anchors, unless the script explicitly stages it (e.g. one turns away in refusal, both watching something). State each character's facing direction in the first_frame_prompt ("[A] faces [B] across the table; [B] stands half-turned toward [A]").
- CONTINUITY FREEZE-FRAME (what makes clip N cut smoothly into clip N+1): "continuity_note" = the physical freeze-frame at second 10 in ONE compact sentence (≤ 35 words) — who is where, facing which way, pose/expression, held props, light. The NEXT segment's first_frame_prompt must open from EXACTLY that freeze-frame (same positions, poses, wardrobe state, light) unless the story declares a time/location jump — so the cut lands invisibly. Never a vague emotional summary ("Minh nhận ra lỗi lầm").

Camera codes: [EYE] eye-level, [LOW] low, [HIGH] high, [OVH] overhead, [DUTCH] dutch, [OTS] over-shoulder, [POV] first-person, [CLOSE] close-up, [SIDE] side profile.

Output MUST be valid JSON only — no markdown, no code fences, no text outside the JSON.`;
}

export function buildStoryboardUserPrompt(
  input: StoryboardGenerationInput
): string {
  const characterBlock =
    input.character_descriptions && input.character_descriptions.length > 0
      ? `\n\nCharacters (create ONE character_lock per person below, keep names EXACT):\n${input.character_descriptions.map((c) => `- ${c.name}${c.is_child ? " [CHILD — trẻ em, khoá đúng độ tuổi trẻ con]" : ""}: ${c.appearance}. Personality: ${c.personality}. Role: ${c.role}`).join("\n")}`
      : "";

  // Product / TVC brief — when present, the script becomes a real ad.
  const briefLines: string[] = [];
  if (input.product_name) briefLines.push(`- Product/Service: ${input.product_name}`);
  if (input.selling_points) briefLines.push(`- Key selling points / USP: ${input.selling_points}`);
  if (input.target_audience) briefLines.push(`- Target audience: ${input.target_audience}`);
  if (input.key_message) briefLines.push(`- Key message: ${input.key_message}`);
  if (input.call_to_action) briefLines.push(`- Call to action (CTA): ${input.call_to_action}`);
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
  const toneBlock = input.tone ? `\nTone: ${input.tone}` : "";
  const customBlock = input.custom_instructions
    ? `\nAdditional Instructions: ${input.custom_instructions}`
    : "";

  const resolvedContextBlock = input.resolved_context
    ? `\n\n=== RESOLVED CONTEXT IR (Stage 1.5 — CANONICAL, DO NOT RE-INFER) ===
The context-analysis stage already resolved the project's 10 layers from the brief and approved script. Treat this JSON as the single source of truth. Copy its world facts into the legacy "world_context" output for compatibility; do not replace its locations, continuity mode, light motivation, audio strategy or visual language with a preset. An environment library entry may be selected only when it is semantically compatible with the location definition; otherwise use "custom".
${JSON.stringify(input.resolved_context, null, 2)}
=== END RESOLVED CONTEXT IR ===`
    : "";

  // Stage-1 approved script (written by Claude). When present, the storyboard
  // model must EXPAND this exact script into the JSON — not invent a new story.
  const scriptBlock = input.source_script
    ? `\n\n=== APPROVED SCRIPT (Stage 1) — EXPAND THIS VERBATIM ===\nA scriptwriter already wrote the creative script below. Your job is ONLY to turn it into the technical storyboard JSON. Follow it FAITHFULLY:\n- Keep the SAME CAST across the whole video: create one character_lock per person in CHARACTERS (same names, same looks everywhere; carry any "(child)" mark into is_child: true).\n- Map each SEGMENT in the script to one 10s storyboard segment IN ORDER (same count, same beats/roles).\n- Use each segment's DIALOGUE line VERBATIM as that segment's "dialogue"; set "speaker" from the script's SPEAKER line ("VO" → speaker: ""); set "characters_in_scene" from the script's IN SCENE line (exact lock names). NEVER give a line to a different character.\n- Turn each segment's ACTION into the first_frame_prompt + motion_prompt (one continuous action per clip).\n- Do NOT add, drop, reorder, or invent segments, lines or people. This script is final.\n\n${input.source_script}\n=== END APPROVED SCRIPT ===`
    : "";

  const segmentCount = input.segment_count ?? 5;
  const beatsPerSegment = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
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
  const cookingAsmr =
    isCooking &&
    ["nature_asmr", "kitchen_asmr", "pov_hands"].includes(input.cooking_style ?? "");
  const dialogueBlock = cookingAsmr
    ? `\nDialogue: FORBIDDEN by the selected cooking ASMR profile. Set "dialogue" to "", "speaker" to "", omit dialogue_lines, and use no voice-over/music in EVERY segment.`
    : input.force_dialogue === false
      ? `\nDialogue: optional. When a segment has a spoken line, write it in ${dialogueLanguage}.`
      : `\nDialogue: REQUIRED. EVERY segment MUST have a non-empty "dialogue" line spoken in ${dialogueLanguage} (natural, conversational ${dialogueLanguage} — not translated word-for-word). Keep each line short (about 5-12 words). Put the line ONLY in the "dialogue" field — do NOT quote it inside the "motion_prompt" (the system appends it once; repeating it makes the character say it twice).`;

  // Example beat list sized to the requested count.
  const beatExample = Array.from({ length: beatsPerSegment }, (_, i) => {
    const cams = ["[WIDE] ...", "[CLOSE] ...", "[OTS] ...", "[LOW] ...", "[POV] ..."];
    return `        { "beat": "framing ${i + 1}: the camera reframes the SAME continuous action", "camera": "${cams[i] ?? "[EYE] ..."}" }`;
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

  return `Create a chained-segment storyboard for this short video.

Story / Product Idea: ${input.story_idea}
Video Goal: ${goal} — ${goalGuidance}
Genre: ${input.genre}
Visual Style: ${input.style}
Number of 10-second SEGMENTS: ${segmentCount} (total ≈ ${segmentCount * 10} seconds)
Beats per segment: ${beatsPerSegment} progressive camera framings of ONE continuous action inside each 10s clip${activeSceneIntentRulesBlock}${resolvedContextBlock}${scriptBlock}${productBriefBlock}${storyBriefBlock}${numerologyBlock}${dialogueBlock}${characterBlock}${settingBlock}${toneBlock}${customBlock}

Produce EXACTLY ${segmentCount} segments. ${structureDirective} Each segment = ONE continuous 10s take showing a SINGLE primary action, filmed as EXACTLY ${beatsPerSegment} progressive camera framings (${beatsPerSegment} beats) of that SAME ongoing action — smooth reframes (push-in, pan, angle change), NOT hard cuts to separate shots. Each beat covers a distinct time-frame inside the unbroken 10 seconds while the subject, props and locked physics stay continuous. CONTINUITY IS PROFILE-LED: read resolved_context.layers.motion_continuity.continuity_mode. Strict continuity requires END state N = START state N+1; montage, match-cut, soft, symbolic, dream or scene-cut continuity instead preserves only its declared anchor(s) and may intentionally change location/time. Never force spatial sameness across a declared location/time transition. The "motion_prompt" must describe that ONE continuous action across the 10s with rough timing (split 10s across the beats, e.g. "0-3s ...; 3-6s ...; 6-10s ..."), using deliberate, specific motion verbs (body part + verb + manner) plus an explicit final state/anchor. Keep ONE primary action per clip — never stack multiple simultaneous actions that exceed the target model's motion budget. NOTE: the system auto-wraps each motion_prompt with the relevant character/product references, selected style/reality rules, the spoken line and a compact negative list — so do NOT repeat identity details, physics laws, dialogue text or negative lists inside the motion_prompt. Restate only the visually necessary character attributes in every first_frame_prompt; inside the motion_prompt use a short reference anchor.

Return a JSON object with this EXACT structure (the "beats" array must contain EXACTLY ${beatsPerSegment} items):
{
  "title": "string — catchy title",
  "synopsis": "string — 2-3 sentences",
  "total_duration_seconds": ${segmentCount * 10},
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
  "thumbnail_title": "string — the SMASH-HOOK printed HUGE on the video's 9:16 cover, in ${dialogueLanguage}, UPPERCASE, 2-6 words MAX (shorter = stronger). It must sell THIS video's gag/curiosity gap in one glance, hot-trend style: a shock equation ('MẤT WIFI = MẤT VỢ?!'), a call-out ('CHỒNG ĐOẢNG CẤP ĐỘ MAX'), a forbidden question ('AI SAI Ở ĐÂY?!'). May end with ?! — no hashtags, no emoji inside the text (an emoji graphic is added separately), correct Vietnamese diacritics.",
  "social_posts": {
    "_rules": "READY-TO-POST captions for THIS exact video, written in ${dialogueLanguage} — each must reference the video's actual story/hook/payoff (a specific moment, the punchline, the question it answers), NEVER a generic 'check out my video'. SHORT and emotional: hook first, 1-3 fitting emoji woven in naturally (not a wall of emoji), one platform-native CTA. Hashtags = real SEO: mix 1-2 broad trending tags + 2-3 niche topic tags (the video's subject, in ${dialogueLanguage} where natural) + 1 branded/series tag when it fits; every tag starts with # and contains no spaces.",
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
      "gender": "male | female — REQUIRED. If a reference photo of this person was provided, this MUST match the photo's actual gender. Never guess from the story.",
      "is_child": "boolean — true when this character is a child (e.g. the family's kid). Child stays a child in every shot.",
      "gender_age": "string — e.g. 'male, ~35 years old' or 'male child, ~6 years old'",
      "build": "string",
      "skin_tone": "string",
      "skin_texture": "string — FORENSIC skin realism (anti-CGI): real texture with visible pores, fine vellus/facial hair, subsurface scattering, subtle sheen and small natural imperfections; NEVER plastic/waxy/airbrushed. e.g. 'warm tan skin, visible pores, faint stubble, natural under-eye texture, no beauty smoothing'",
      "eye_details": "string — exact eye shape + iris colour + real catchlights, e.g. 'dark brown almond eyes, double eyelid, natural moist catchlight'",
      "hair": "string",
      "eyes": "string",
      "costume": "string",
      "wardrobe_materials": "string — the REAL materials of the outfit/props so they don't render fake, e.g. 'olive cotton-canvas jacket with visible weave, charcoal cotton tee, indigo denim twill, worn brown full-grain leather boots with grain, creases and stitching, brushed-steel pen'",
      "signature_features": "string",
      "default_expression": "string",
      "render_style": "${input.style}",
      "dna": "string — ONE verbatim forensic-DNA line with RGB HEX codes for skin/hair/eyes/wardrobe/brand colours, e.g. 'navy polo #1F2A44, light-blue tee #A9C7E8, matte steel watch #8A8D91, short black side-part hair #14110F, warm tan skin #C8956A, rectangular tortoise glasses'",
      "voice": "string — TẦNG 9 audio law: the character's FULL locked voice profile, identical in every clip: timbre + pitch range Hz + rate wpm + accent + emotion band. Male ≈ 85-140 Hz, female ≈ 180-260 Hz, child ≈ 250-400 Hz. e.g. 'warm low male timbre, 95-135 Hz, Northern Vietnamese, ~110 wpm, calm-grounded'"
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
      "duration_seconds": 8,
      "title": "string — short segment title",
      "marketing_role": "hook|problem|solution|body|cta — the clip's function; segment 1 opens/hooks, the last segment carries any CTA the project needs",
      "beats": [
${beatExample}
      ],
      "first_frame_prompt": "string — the segment's START STATE: describe the SHARED scene/setting (location, lighting, EXACT character appearance from character_locks, product if any) AND every prop the motion_prompt will use, already present — held in a named hand, worn, or placed in the scene (e.g. 'his dark grey jacket draped over his right forearm'). It is used as the scene-overview context for the shot board, so describe the environment and the character clearly; an object the motion touches but the start state omits is a bug.",
      "motion_prompt": "string — a focused 70-110 word image-to-video ACTION prompt for Omni Flash / Veo describing ONE continuous take. IMPORTANT: the system automatically wraps this text with the full character + product description, the style tokens (lens/light/backdrop/grade), a physics directive and a negative list — so DO NOT repeat identity attributes, style tokens, a physics clause or a negative list here; describe only what HAPPENS. Order: (1) a SHORT anchor that it is the same man and same product from the attached references, rendered as a slightly younger, more attractive version (one phrase — do NOT re-list every attribute); (2) ONE single continuous primary action across the 10s with rough timing ('0-3s ...; 3-6s ...; 6-10s ...') using slow, deliberate, specific motion verbs (body part + verb + manner) — no hard cuts, no second simultaneous action; every object interaction written as the FULL causal chain (hand reaches → fingers grip a named part → carried along one path → released), and every effect (something falls/tips/spills) PRECEDED by its visible physical cause making contact — an object never appears in a hand and nothing ever moves by itself; the whole clip stays in ONE location; (3) camera (shot size + SMOOTH minimal movement); (4) a brief mood/light accent only if it changes; (5) note WHEN the character speaks with natural lip movement, but DO NOT quote the spoken words (the dialogue line is appended automatically exactly once); (6) finish with the exact final state so it leads into the next segment.",
      "dialogue": "string — the FIRST turn's spoken line in ${dialogueLanguage} (short, natural). Mirror of dialogue_lines[0].text.",
      "speaker": "string — the EXACT character_locks name of the FIRST turn's speaker (mirror of dialogue_lines[0].speaker). Empty string \\"\\" if voiceover.",
      "dialogue_lines": [
        { "speaker": "exact character_locks name or \\"\\" for voiceover", "text": "the spoken line in ${dialogueLanguage}", "start_s": 0, "end_s": 3 }
      ],
      "characters_in_scene": ["REQUIRED — array of EXACT character_locks names VISIBLE in this segment (e.g. [\\"Nam\\", \\"Mai\\"]). Only these people appear on screen; the speaker must be listed here; others in the list react silently."],
      "environment_ref": "string — the environment archetype id from the ENVIRONMENT ENGINE list that matches this segment's setting (e.g. 'misty_mountain_ridge_dawn'), or 'custom' if none fits. Consecutive segments in the same place reuse the same id.",
      "wardrobe_state": [
        { "character": "exact character_locks name", "outfit": "FULL current outfit description (garments + colours), as detailed as the base lock — e.g. 'clean dark grey cotton t-shirt, black soft home shorts'", "outfit_materials": "real fabric materials of the new outfit", "hair": "current hair state, e.g. 'damp black hair, freshly towelled'" }
      ] /* OMIT this field entirely unless a MOTIVATED look change happened (shower/changing/rain); once it happens, include it on that segment and EVERY later segment */,
      "continuity_note": "string — ONE compact sentence (≤ 35 words): the physical freeze-frame at second 10 — who is where, facing which way, pose, expression, held props, light (the next segment opens from exactly this frame)"
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
  const beatsPerSegment = Math.min(5, Math.max(3, input.beats_per_segment ?? 3));
  const dialogueLanguage = input.dialogue_language ?? "Vietnamese";
  const continuityMode = breakdown.context_ir?.layers.motion_continuity.continuity_mode ?? "strict";
  const strictContinuity = /strict|one.?shot/i.test(continuityMode);
  const cookingRewriteBlock =
    input.genre === "cooking" && input.cooking_recipe
      ? `\n${compileCookingRecipeDigest(input.cooking_recipe, input.cooking_style ?? "kitchen_asmr")}\nREWRITE ROUTER: preserve the current recipe operation and visible end state. ASMR profiles remain completely wordless; never add dialogue to fill time.`
      : "";

  const castBlock = (breakdown.character_locks ?? [])
    .map(
      (c) =>
        `- ${c.name}${c.is_child ? " [CHILD]" : ""}: ${[c.gender_age, c.build, c.hair, c.costume]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join(", ")}`
    )
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

LOCKED DIALOGUE TURNS (the user's final text — copy each line VERBATIM, same speaker, same order; do NOT add, drop, reword or reassign any line):
${turnsBlock}

REWRITE RULES:
1. Re-time the turns realistically (~0.4s per word + ~0.5s beat between speakers), strictly sequential and non-overlapping, finished by ~9s. Fill "dialogue_lines" with start_s/end_s for every turn; mirror turn 1 into "dialogue" and "speaker".
2. Rewrite "motion_prompt" (70-110 words) as ONE continuous take whose physical action and camera are choreographed AROUND those timed turns. FOUR INDEPENDENT ELEMENTS PER TURN: for every turn state (a) WHO speaks and WHO they look at ("[A] looks at [B] and speaks" — replace [A]/[B] with EXACT character_locks names; the speaker faces their conversational partner, never automatically the camera, never back-turned to the person addressed) — never a bare "X speaks"; (b) the LISTENER's state — mouth fully closed, no speech-like jaw movement, reacting only with eyes/brows/posture; (c) the CAMERA SUBJECT, chosen explicitly and independently — the speaker OR the listener's reaction (when the listener, write it out: "camera stays on [B] as [A] speaks off-screen; [B]'s mouth stays closed"); with 2+ turns, at least one turn holds the camera on the listener — the camera must NOT simply follow whoever speaks; (d) the same clock as the turn windows (the action at second X is what happens while the line at second X plays). SPEAK-WHILE-STILL: a speaker NEVER performs a large body action (standing up, walking, turning away) during their own line — schedule big movements into the GAPS between turns, and while a line plays its speaker holds a stable speaking pose. Time left before/after/between the turns must be filled with meaningful physical action that advances the story — never dead air. CAUSAL CHAIN: write every object interaction as the full visible chain (hand reaches → fingers grip a named part → carried along one continuous path → released), never let an object appear in a hand; every effect (something falls/tips/spills) must be PRECEDED by its visible physical cause making contact; the whole clip stays in ONE location. PROP EXISTENCE: every object the motion uses must be planted in the first_frame_prompt start state (held, worn or placed) — update the first_frame_prompt if the new action needs a prop it doesn't mention. QUIET WINDOW: no line plays during a loud/major physical event — a reaction line starts only after the event has finished. LOAD BUDGET: a 10s clip carries 8-22 total spoken words (~0.4s/word + gaps). ALL locked turns STAY in THIS segment — you cannot move, drop or defer a line to another segment. If the turns exceed the budget, keep a natural speaking pace and let the last line end as late as 10s; NEVER squeeze speech to an unnatural rate and NEVER write commentary about it. STAGING: give every visible character one concrete physical business (a named hand action serving the story) and name exact micro-expressions (an eyebrow raise, a suppressed smile) — never write "reacts"; the camera move must differ from the neighbouring clips' moves and travel calmly across the whole 10s, easing in and out, never a rushed 1-second whip. Do NOT quote the spoken words inside motion_prompt.
3. Rewrite the "beats" (EXACTLY ${beatsPerSegment} beats) as the progressive camera framings of that one continuous action, aligned with the turn windows.
4. Update "first_frame_prompt" only as needed (same location/lighting; restate the present characters' looks from character_locks). Set "characters_in_scene" to the EXACT lock names visible — every speaker with a non-empty name must be included.
5. HARD CONSTRAINTS: keep "segment_number" = ${seg.segment_number}, "duration_seconds" = ${seg.duration_seconds || 10}, "marketing_role" = "${seg.marketing_role}", "environment_ref" = "${seg.environment_ref ?? "custom"}". Locked continuity mode = "${continuityMode}". ${strictContinuity ? "Open from the previous segment's exact end state and close on the next segment's exact opening state." : "Preserve only the continuity anchors declared by scene_intent/context; location, time or pose may change when this continuity mode explicitly permits it."} Update continuity_note accordingly.
6. continuity_note = PHYSICAL SCENE STATE ONLY (who is where, holding what, in which pose/emotion, carried into the next shot). STRICTLY FORBIDDEN inside continuity_note, first_frame_prompt and motion_prompt: production/meta commentary of any kind — word counts, wpm or seconds-per-word math, "moved to segment N", "due to duration constraints", quoted dialogue lines, or notes to the editor. This text is rendered by the video model verbatim; meta commentary corrupts the clip.

Return ONLY the rewritten segment as ONE JSON object with the exact segment structure (segment_number, duration_seconds, title, marketing_role, beats[], first_frame_prompt, motion_prompt, dialogue, speaker, dialogue_lines[], characters_in_scene[], environment_ref, wardrobe_state[] — copy the segment's existing wardrobe_state unchanged if it has one, continuity_note) — no wrapper, no markdown, no prose.`;
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

// Light, natural "glow-up": keep identity, render a younger/attractive take.
const BEAUTIFY_DIRECTIVE =
  "Derive EVERY view from the attached reference photo(s) — same exact person, same face geometry, bone structure, eye shape and colour, same hairline. Render in sharp, high-resolution photoreal portrait quality with natural skin texture and pores. Apply only a tasteful editorial retouch — even healthy skin tone, clear complexion, softened under-eye shadows and blemishes, a subtle cheekbone highlight, bright eyes, neat well-groomed hair, a fresh fit look — so he reads a few years younger, more handsome and camera-ready, like a flattering professional headshot of the SAME man. Shot on an 85mm portrait lens, soft natural light. Do NOT over-smooth into a plastic/CGI/wax/airbrushed look, do NOT beautify into a different face, do NOT change his identity, ethnicity or age bracket drastically.";

function renderDirective(style: string, preserveRealFace: boolean): string {
  if (isPhotoStyle(style)) {
    return `RENDER AS REAL PHOTOGRAPHY: photorealistic, lifelike, real human beings photographed with a real camera, cinematic photography quality. ABSOLUTELY FORBIDDEN: cartoon, anime, comic, manga, illustration, drawing, sketch, painting, 2D/3D animation, Pixar/Disney look, CGI render, vector art, flat shading — every panel and every person must look like a frame from real filmed footage.${
      preserveRealFace
        ? ` CRITICAL: preserve the EXACT face, skin tone, hairstyle and likeness from the attached reference photo — the same character with the same face in every panel; never redraw the face, never swap it for a different person, never stylize it into a cartoon. ${BEAUTIFY_DIRECTIVE}`
        : ""
    }`;
  }
  return `${style} art style.${
    preserveRealFace
      ? ` Keep the person's real facial structure and likeness recognizable from the reference photo, rendered in this art style, as a slightly younger and more attractive version of himself.`
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
  const lines = refs.map((r) => {
    const d = r.description ? ` (${r.description.replace(/\s+/g, " ").slice(0, 220)})` : "";
    switch (r.role) {
      case "character_sheet":
        return `• THE CHARACTER — the attached reference sheet (turnaround + expressions)${d} defines an ORIGINAL FICTIONAL character's look — face, hair, body and costume. Keep this SAME made-up character consistent in every shot — same look, same wardrobe, same proportions, tastefully polished. This is an ordinary invented person, NOT a real, famous or recognisable public figure; do NOT drift to a different look.`;
      case "face":
        return `• THE CHARACTER — use the attached portrait ONLY as an appearance reference for an ORIGINAL FICTIONAL character (an ordinary invented person, NOT a real, famous or recognisable individual). Keep a natural, consistent face, hairstyle and skin tone across every shot (light natural retouch). Match eyewear to the photo — if there are no glasses in the photo, do NOT add glasses; if there are, keep them — consistent across shots. This is the main character.`;
      case "character":
        return `• CHARACTER "${r.name ?? "person"}" — attached ${r.view === "profile" ? "PROFILE / THREE-QUARTER" : "FRONT"} portrait from the USER'S CHARACTER MENU${d}. This uploaded portrait is authoritative: bind its face, hair, skin tone and visible wardrobe to ${r.name ?? "this character"} ONLY. Do NOT omit, replace, merge, blend or swap this person with another character.`;
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
        return `• WARDROBE & LOOK ANCHOR — the attached already-approved storyboard frame shows the character in the EXACT outfit, hairstyle and accessories to use. Copy the clothing (type, cut and colours) and every accessory (watch, glasses if any) EXACTLY in this board. Do NOT change the outfit — never switch to a suit, jacket, apron or a different shirt unless it appears in this anchor. It is the SAME character.`;
      default:
        return `• Reference — keep it consistent.`;
    }
  });
  return `REFERENCE PRIORITY CONTRACT — these references came from the user's setup menu and outrank generated anchors, inferred descriptions, defaults and aesthetic choices. Preserve every uploaded character as a separate named identity and preserve the uploaded location. Use them as appearance/environment references to build ORIGINAL FICTIONAL characters and new cinematic scenes; do not simply copy the source photo as the final frame. Follow them exactly:\n${lines.join("\n")}\n\n`;
}

// ─── Step 2: Character Reference Sheet Image Prompt ─────────────────────────

export function buildCharacterRefSheetPrompt(params: {
  characterLock: {
    name: string;
    gender_age: string;
    build: string;
    skin_tone: string;
    hair: string;
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

  const colorSwatches =
    params.colorPalette && params.colorPalette.length > 0
      ? params.colorPalette.slice(0, 6).join(", ")
      : "#F5E6D3, #8B4513, #2D5016, #FFFFFF, #1A1A1A, #D4A574";

  const hasSetting = (params.references ?? []).some((r) => r.role === "setting");

  return `${refBlock}Professional compact CHARACTER REFERENCE SHEET, single horizontal image, clean light studio background.

CHARACTER — ${c.name}: ${c.gender_age}, ${c.build} build, ${c.skin_tone} skin, ${c.hair} hair, ${c.eyes} eyes. Wearing ${c.costume}. ${c.signature_features}.
${c.dna ? `FORENSIC DNA (exact colours, keep identical everywhere): ${c.dna}.\n` : ""}${tokens ? tokens + "\n" : ""}
EXACT LAYOUT (all in one image):
■ "FRONT / CHÍNH DIỆN": one large HEAD-AND-SHOULDERS portrait, ${c.default_expression} expression, face tack-sharp.
■ "PROFILE / GÓC NGHIÊNG": one large HEAD-AND-SHOULDERS side-profile or 3/4 portrait of the SAME person.
■ "ENVIRONMENT OVERVIEW": one small wide thumbnail ${hasSetting ? "reproducing the uploaded location reference exactly" : "showing the stable surrounding environment used by the story"}.
■ THIN FOOTER: 6 small circular colour swatches: ${colorSwatches}.

${directive}

RULES: exactly two identity portraits plus one small environment overview; NO full-body pose, NO back view, NO turnaround row, NO expression grid; the SAME individual has an identical face in both portraits; small bold labels; one cohesive image. ${SHARED_NEGATIVE}`;
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
    ? `a compact 2-column portrait pair for EACH of the ${cast.length} characters in this shot, grouped per person and clearly LABELLED with their NAME: ${cast
        .map(
          (c) =>
            `— "${c.name.toUpperCase()}"${c.isChild ? " (CHILD — correct child age and face)" : ""}: exactly TWO HEAD-AND-SHOULDERS portraits, (1) FRONT / chính diện and (2) SIDE PROFILE or 3/4 / góc nghiêng; face sharp and readable`
        )
        .join("; ")}. Keep every person's face, hair and visible wardrobe identical to the uploaded menu references.`
    : `exactly TWO clearly-visible HEAD-AND-SHOULDERS portraits of the SAME main character: (1) FRONT / chính diện and (2) SIDE PROFILE or 3/4 / góc nghiêng. Face, hair, skin tone and visible wardrobe must match the uploaded menu photos. NO full-body view, NO back view, NO extra expression grid.`;
  const castDescription = isMultiCast
    ? cast.map((c) => `${c.name}${c.isChild ? " (child)" : ""}: ${c.description}`).join(" | ")
    : params.characterDescription;
  const castLock = isMultiCast
    ? ` CAST LOCK: the scene overview and every action panel contain EXACTLY these ${cast.length} characters — ${cast
        .map((c) => c.name)
        .join(", ")} — and NOBODY else; no extra people, no duplicates of a character in the same panel; every action caption names WHO does the action; relative heights stay true (a child is clearly smaller than the adults).`
    : "";

  return `${refBlock}SHOT ${params.segmentNumber} — a complete STORYBOARD BOARD for HUMAN REVIEW and planning of ONE ~10 second video clip, presented as ONE single horizontal image. This document shows who the character${isMultiCast ? "s are" : " is"}, what the scene looks like${hasProduct ? ", the product" : ""}, and the ${target} actions across the clip. It must NEVER be used as an image-to-video start frame; use the separate clean keyframe for that. ${params.style} style.

THE BOARD CONTAINS THESE ZONES IN ONE IMAGE:

■ TOP / LEFT — "CHARACTER REFERENCES" compact thumbnail grid (REPEAT THIS IN EVERY SHOT; reserve about 25-32% of the board): ${refStrip} Each portrait may be smaller than before, but every face remains sharp and readable. Uploaded menu portraits are HIGHEST PRIORITY. Label "CHARACTER REF". Character${isMultiCast ? "s" : ""}: ${castDescription}.${castLock}

■ SMALL "ENVIRONMENT OVERVIEW" REFERENCE: one compact wide establishing thumbnail showing the surrounding room/location before the action${hasProduct ? ", with the product visible at natural scale" : ""}. This overview is MANDATORY even when space is tight. ${hasSetting ? "Reproduce the EXACT uploaded location overview — same room geometry, furniture placement, doors/windows, materials, colours and lighting. This same environment must remain behind every action panel." : "Derive one stable environment from the scene context and reuse it behind every action panel."}

■ RIGHT / BOTTOM — "ACTION SEQUENCE": ${target} numbered action panels (${numberLabels}) laid out left → right showing the ${target} key moments across the 10 seconds, each a small ${isPhotoStyle(params.style) ? "PHOTOGRAPHIC cinematic still (a real photo frame — not a drawing or illustration)" : `${params.style} illustration`} with a SHORT caption under it describing the action:
${panelLines}

SCENE CONTEXT for all panels: ${params.firstFramePrompt}
${params.productDna ? `HERO PRODUCT / DISH DNA (identical where present): ${params.productDna}\n` : ""}${params.ingredients ? `${hasFoodIngredients ? "RELEVANT FOOD INGREDIENTS" : "RELEVANT AUXILIARY OBJECTS / COMPONENTS"} (render physically; no written labels): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}
${continuity}
${directive}

RULES: ONE cohesive board image; reference area contains EXACTLY two portrait angles per visible character plus one environment overview — never full-body/back turnaround refs; ${isMultiCast ? `each of the ${cast.length} named characters keeps an IDENTICAL face, hair and the EXACT SAME outfit + accessories everywhere they appear (ref grid, environment overview, every action panel) — never omit a menu-uploaded cast member required by the scene, never re-dress or swap faces, and ONLY the named cast appears` : "the SAME individual (identical face, hair, and the EXACT SAME outfit + accessories — same shirt, trousers, watch; NEVER a suit, jacket, apron or different clothes)"} AND the SAME product appear consistently;${params.preserveRealFace ? " match eyewear to the uploaded portrait EXACTLY — if absent, never add it;" : ""} ${hasSetting ? "the SAME exact uploaded location" : "one single consistent location"} for this whole board; thin clean dividers and small numbered badges; captions short and legible. ${SHARED_NEGATIVE}`;
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
          .join(" | ")}. Each person keeps their locked face, hair and wardrobe; no extra people, no duplicated characters.\n`
      : "";
  const ratioWord = params.aspectRatio === "9:16" ? "vertical 9:16 portrait" : "horizontal 16:9 landscape";
  // Identity lock comes from a LARGE, sharp, well-lit hero — that is what lets
  // an image-to-video model read the face off one start frame (the lesson from
  // boards that animate cleanly & on-model in Veo). Push the character forward
  // and grade it like a premium frame, while still honouring an explicit wide.
  const isWide = /\b(WIDE|EXTREME_WIDE|AERIAL|ESTABLISH)/i.test(params.shot || "");
  const prominence = isWide
    ? "CHARACTER PROMINENCE — this is an establishing/wide shot, but still place the main character clearly in frame with the face readable and in sharp focus; do NOT shrink them to an unrecognizable distant speck."
    : "CHARACTER PROMINENCE — render the main character LARGE and dominant in the frame, the face clearly legible and in tack-sharp focus, well-lit and cleanly separated from the background (shallow depth of field), so the image-to-video model can lock the identity from this single frame. Favour a medium / medium-close framing; do NOT render the subject small, distant, out-of-focus, back-turned or with the face hidden.";
  const grade = isPhotoStyle(params.style)
    ? "Premium cinematic colour grade, soft directional key light, natural skin texture and pores, filmic editorial polish — never flat, never cartoon, never plastic/CGI/wax skin."
    : `Premium, polished, richly detailed ${params.style} rendering with cinematic lighting and depth.`;
  // This clip has spoken audio in Veo, so the start frame should be lip-sync
  // friendly: face toward camera, mouth visible. (The words go in the Veo
  // prompt, never as text in this image.)
  const speaker = (params.speakerName ?? "").trim();
  const who = speaker ? `${speaker} (the speaker of this clip)` : "the character";
  const lipSync =
    params.hasDialogue && !isWide
      ? ` LIP-SYNC FRAMING — ${who} faces the camera with the head up and the mouth clearly visible (relaxed, about to speak), so the video model can animate natural talking and lip-sync; do not hide the mouth or turn the face away.${speaker ? " Any other characters present are turned slightly toward the speaker, mouths closed (listening)." : ""}`
      : "";
  return `${refBlock}SINGLE STATIC KEYFRAME for shot ${params.segmentNumber} — ONE clean photographic first-frame image used as the STARTING frame for an image-to-video model (Veo). This is NOT a storyboard board: render ONE single cohesive scene only, no panels, no reference strip.

COMPOSITION (${params.shot || "[EYE]"}): ${params.sceneDescription}
${castBlock}SUBJECT — keep this exact forensic identity: ${params.characterDescription}
${prominence}${lipSync}
${envBlock}${params.productDna ? `HERO PRODUCT / DISH (exact where present): ${params.productDna}\n` : ""}${params.ingredients ? `${hasFoodIngredients ? "RELEVANT FOOD INGREDIENTS" : "RELEVANT AUXILIARY OBJECTS / COMPONENTS"} (render physically; no written labels): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}${directive}

RENDER RULES: a SINGLE static frame; the subject is sharp and frozen in the STARTING posture for the upcoming action (no motion blur, no camera-movement effect); ${ratioWord} aspect ratio, 1080p quality. Do NOT include timeline markers, multiple panels, split-screens, reference thumbnails, captions, subtitles, on-screen text or speech bubbles. ${grade}${isPhotoStyle(params.style) ? ` ${PHOTOREAL_REALISM}` : ""} ${SHARED_NEGATIVE}`;
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
          .map(
            (c) =>
              `- "${c.name.toUpperCase()}"${c.isChild ? " (CHILD — preserve child age)" : ""}: exactly ONE HEAD-AND-SHOULDERS FRONT / chính diện identity portrait. No side profile, no 3/4, no full body, no back view. Look lock: ${c.description.replace(/\s+/g, " ").trim().slice(0, 420)}`
          )
          .join("\n")
      : `- "${(params.characterName ?? "MAIN CHARACTER").toUpperCase()}": exactly ONE HEAD-AND-SHOULDERS FRONT / chính diện identity portrait. No side profile, no 3/4, no full body, no back view.`;

  return `${refBlock}Professional production STORYBOARD DOCUMENT, ONE single horizontal image, clean white/light background, agency-quality layout with two zones. PURPOSE: this sheet is for HUMAN REVIEW, shot planning and continuity checking only. It must NEVER be used as an image-to-video start frame. Every menu-uploaded character must be represented in the reference library, every face must stay readable, and every panel number must be instantly readable at a glance.

◀ LEFT REFERENCE LIBRARY (about 40% width) — "CHARACTER + ENVIRONMENT REFERENCES" (fixed grid; uploaded menu refs have HIGHEST PRIORITY):
- Header text "CHARACTER + ENVIRONMENT REFERENCES".
${noFaceSubject ? "" : `- CHARACTER PORTRAITS: the upper part shows exactly ONE FRONT / chính diện head-and-shoulders portrait per named person (no profile, no 3/4). One character = exactly 1 portrait, two characters = exactly 2, three = exactly 3, arranged in a neat compact row/column. Each person gets equal visual weight; never show only the first/main person, never add a second angle, and never add an extra person. The space saved by dropping profile portraits goes to the ENVIRONMENT section below.
`}${characterRows}
- Every portrait is HEAD-AND-SHOULDERS only: crop from top of head to upper chest, face tack-sharp, clean neutral background. Never show waist, legs, full body, back view, turnaround or expression-sheet cells even when an uploaded source photo happens to be full-body.
- ENVIRONMENT OVERVIEW — TWO VIEWS (MANDATORY, NEVER OMIT): directly below the character portraits, reserve a bordered band across the full width of the left library (at least 22% of the whole board height) holding TWO wide 16:9 environment thumbnails stacked or side by side, labelled "ENVIRONMENT — GÓC 1" and "ENVIRONMENT — GÓC 2". Each place may be an INDOOR room or an OUTDOOR scene. ${hasSettingRef ? "The attached LOCATION reference photo(s) are authoritative — reproduce them exactly (same geometry and depth, placement of every landmark, boundaries, materials, colours, key details, light direction). GÓC 1 = the primary uploaded view. GÓC 2 = if a second reference angle was attached, reproduce that; if NOT, you must RENDER the SAME place from a clearly DIFFERENT camera angle (ideally the reverse / opposite viewpoint) that you infer in 3D — it must be fully consistent with GÓC 1 (identical landmarks, materials, colours and light), just seen from another direction. Never invent a different location. If two DISTINCT places were uploaded, use GÓC 1 and GÓC 2 for the two places instead." : "Derive GÓC 1 as a stable wide overview from the storyboard setting, then RENDER GÓC 2 as the SAME place from a different/reverse camera angle, fully consistent with GÓC 1."} Both views define the one set; reuse their geometry in every panel.
- COLOR PALETTE: an optional ultra-thin footer of small swatches only: ${colorBlock}. It may shrink, but it may NEVER replace or shrink the environment overview.

▶ RIGHT ZONE (about 2/3 width) — "STORYBOARD — ${params.title.toUpperCase()}":
- Grid of ${maxPanels} panels, ${cols} columns × ${rows} rows, thin clean borders. EACH panel carries a BIG, BOLD panel number badge ("1", "2", …) in its top-left corner — large solid dark badge with white numeral, readable even when the sheet is shrunk (these numbers are how each video clip is pointed at its panel).
- Each panel: a ${isPhotoStyle(params.style) ? "PHOTOGRAPHIC cinematic still of that moment (a real photo frame — NOT a drawing, NOT an illustration)" : `${params.style} illustration of that moment`}, and BELOW the picture a small white caption band with two labeled lines of text:
  "Action:" the action description, then "Lời thoại:" the spoken ${lang} line in quotes.
- Panels stage the character LARGE enough that face and wardrobe read clearly — medium/medium-close staging preferred over tiny wide figures.

CAST LOCK (the same named people in the reference library and every panel where they are scripted — identical face, hair and outfit; never omit, merge or swap them): ${noFaceSubject ? "No on-camera cast — hands-only food video; panels show only the cook's working hands where the action requires contact." : charDesc}

THE ${maxPanels} PANELS:
${panelLines}

Metadata footer: "${params.totalDuration}s • ${maxPanels} shots • ${params.moodTags.slice(0, 3).join(" • ")}".

${renderDirective(params.style, params.preserveRealFace ?? false)}

RULES: ONE cohesive document image; ONE HEAD-AND-SHOULDERS FRONTAL portrait ref per named character (front only, no profile/full body/back/extra angle) plus the location reference(s) — the freed space goes to the environment. When the user attached location photos (indoor room or outdoor scene), reproduce that exact place; if only one angle is shown, infer the place in 3D (including the reverse/opposite viewpoint) and keep every panel consistent with it; all uploaded and script-defined characters remain separate named identities and appear whenever the panel script calls for them; never prioritise a generated anchor over uploaded menu references; ${isPhotoStyle(params.style) ? "photographic realism for both the reference library and all panel stills" : `${params.style} style for the panel art`}; panel numbers BIG and unmistakable; caption text small, clean and legible; no watermark. ${SHARED_NEGATIVE}`;
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
  // With a headline, SHARED_NEGATIVE's blanket text bans ("title cards, text
  // overlays") would fight the requested title — swap in a text-aware negative
  // that bans only WRONG text, keeping all the identity/physics negatives.
  const negative = params.titleText
    ? "NEGATIVE (avoid — plain descriptors): resembling a real or famous person, celebrity likeness, misspelled or garbled headline letters, wrong or missing Vietnamese diacritics, duplicated or extra words beyond the specified headline, any second block of text, subtitles, captions, hashtags on the image, watermark, logo, morphing, warping, extra or fused fingers, malformed hands, extra or missing limbs, the face changing, identity drift, changed hair/wardrobe, extra people, duplicated subject, plastic/CGI/wax/airbrushed skin, toy-like or 3D-render materials."
    : SHARED_NEGATIVE;

  return `${refBlock}VIRAL VIDEO COVER / THUMBNAIL — ONE single VERTICAL 9:16 image used as the cover of a short video. It must STOP THE SCROLL on a phone feed: bold, funny, instantly readable at thumbnail size.

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

RENDER RULES: ONE single 9:16 vertical frame, no panels, no frame borders, no collage; the character's face, hair and outfit IDENTICAL to the reference; energetic but physically plausible pose (real anatomy, real contact with props). ${params.titleText ? `The ONLY text in the image is the exact headline «${params.titleText}» styled as specified, and the ONLY graphics are that headline, ONE emotion icon, and the white sticker outline + neon rim — nothing else written or drawn: no captions, subtitles, hashtags, extra stickers, arrows, circles, logos, watermarks or stray numbers.` : `The white sticker OUTLINE + neon glow rim around the character are the ONLY graphic treatment allowed — ABSOLUTELY NO TEXT of any kind: no title, caption, text sticker, emoji, arrows, circles, logo, watermark or numbers anywhere in the image (those get added later by the editor).`} ${negative}`;
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
  productDescription?: string;
  ingredients?: string;
  sceneBible?: SceneBible;
  colorPalette: string[];
  motionPrompt: string;
  dialogue?: string | null;
  dialogueLanguage?: string;
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
  const lead =
    `OUTPUT CONTRACT — CLEAN FULL-SCREEN VIDEO ONLY: create ONE continuous 10-second live-action shot filling the entire frame. ZERO visible text or graphics anywhere: no letters, words, names, ages, numbers, labels, logos, captions, subtitles, badges, cards, HUD or technical overlays. NEVER film, animate or reproduce a storyboard sheet, reference sheet, collage, grid, panel border, thumbnail strip or document page. Keep every referenced subject visually consistent across the project — original characters/entities, not a public-figure imitation; ${settingSource} Every name and technical value in this prompt is INTERNAL production data only and must never be drawn.`;
  const character = ` Primary subject/cast: ${clean(params.characterDescription)}.`;
  // TẦNG 0 — the locked world every entity in this clip must belong to.
  const contextLock = worldContextLockBlock(
    params.worldContext
      ? { ...params.worldContext, allowed_language_text: "none — zero readable text anywhere" }
      : params.worldContext
  );
  // The scene doubles as the clip's START STATE: planting props here is what
  // stops objects materialising mid-clip (the jacket-teleport bug).
  const setting = params.setting
    ? ` SCENE (START STATE — everything and everyone described here exists on screen from the very first frame; every object the MOTION uses must already be present — held, worn or placed — objects never appear from nowhere mid-clip): ${clean(params.setting)}.`
    : "";
  // Locked world spec (materials/Kelvin+Lux/atmosphere/imperfections) — the
  // veoflow-web environment payload that makes the SETTING render real.
  const env = resolveEnvironment(params.environmentRef, params.setting);
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
    ? ` ${stripBurnableTech(sceneBibleTokens(params.sceneBible))} (These style values are internal camera settings — NEVER display them as text on screen.)`
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
      ? ` ON SCREEN: exactly ${onScreen.length} character${onScreen.length > 1 ? "s" : ""} — ${onScreen.join(", ")} — and NOBODY else; no extra people in frame or background, and each named character exists exactly ONCE — never duplicated, mirrored or repeated anywhere in the frame. NO HUMAN TELEPORT: everyone listed is ALREADY in place at second 0 exactly as the START STATE positions them, and stays physically continuous for the whole clip — no person ever pops into frame, materialises in the background, or appears behind someone mid-clip; if the story needs someone to arrive or leave, they visibly WALK in/out through a real entrance as an explicitly described action.${absent.length > 0 ? ` ${absent.join(", ")} ${absent.length > 1 ? "are" : "is"} NOT in this scene and must not appear, not even in the background or as a reflection.` : ""}`
      : "";
  const speakerLabel = speaker || "The character";
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
  if (turns.length > 1) {
    // TURN-TAKING: sequential timed lines, ONE mouth at a time, camera on the
    // active speaker. Everyone else keeps mouths closed.
    const speakersInTurns = Array.from(new Set(turns.map((t) => (t.speaker ?? "").trim()).filter(Boolean)));
    const lines = turns
      .map((t) => {
        const nm = (t.speaker ?? "").trim();
        // A nameless turn is OFF-SCREEN NARRATION — say so explicitly, or Veo
        // lip-syncs it through whichever on-screen face the camera is holding
        // (the wife "spoke" the narrator's line in production).
        const who = nm || "VOICEOVER (off-screen narration — NOBODY on screen moves their mouth or lips during this narration; all on-screen characters keep mouths fully closed)";
        const vt = nm
          ? voiceOf(nm)
          : params.speakerVoice
            ? ` (narrator voice: ${params.speakerVoice} — heard from off-screen only, it does NOT belong to any character visible in frame)`
            : "";
        const window =
          t.start_s != null && t.end_s != null ? `${t.start_s}-${t.end_s}s ` : "";
        return `${window}${who}${vt}: "${(t.text ?? "").trim()}"`;
      })
      .join("; ");
    const listeners = onScreen.filter((n) => !speakersInTurns.includes(n));
    const listenerNote =
      listeners.length > 0
        ? ` While each person speaks, ${listeners.join(", ")} stay silent with mouths closed.`
        : "";
    // LINE OWNERSHIP tied to the PERSON + GESTURE, not the framing. The old
    // "camera is on the speaker" rule made Veo lip-sync whichever face was on
    // screen and mis-assign lines; instead bind each line to its owner's
    // identity and speaking action, and explicitly allow reaction shots where
    // the speaker is heard off-screen while the camera holds on the listener.
    const ownership = ` LINE OWNERSHIP (STRICT): every line above belongs ONLY to its named speaker — bind it to that person's identity and speaking gesture (the one who turns/looks and talks), NEVER let a different character say it, never move another character's mouth to it, and never swap voices between characters (${speakersInTurns.length > 1 ? `${speakersInTurns.join(" and ")} have different voices — each line uses its owner's voice` : "the line stays with its owner"}). The line is tied to the ACTION, not to the framing: a character may speak while the camera favours someone else's face. STILLNESS: whenever the speaker's face IS on camera during their line, keep their speaking pose stable for clean lip-sync; any large body action (standing up, sitting down, walking, turning away) happens in the GAPS between lines, never during a line. If the MOTION timing and these DIALOGUE windows disagree, the DIALOGUE windows win — shift the action beats to fit around them.`;
    spoken = ` DIALOGUE (turn-taking, ONE voice at a time, never overlapping; each line is spoken in its OWNER's voice and belongs only to that named person): ${lines}. VOICE FOLLOWS THE PERSON, NOT THE CAMERA: when the speaker's face is in frame, only THAT person's lips move in exact lip-sync; the camera is free to hold on the LISTENER to catch their reaction, and while it does the line is heard as the speaker's off-screen / over-the-shoulder voice with NO on-screen character moving their lips to it. SPEAKER GAZE: each speaker faces and looks toward the person they are addressing per the scene geometry — never automatically toward the camera, and never with their back turned to the person addressed. Whoever is not speaking keeps their mouth fully closed with no speech-like jaw movement and never mouths the other person's line, their body and gaze naturally oriented toward the speaker — the two characters are never both facing the same direction side-by-side like presenters unless the script explicitly stages it. All lines in ${lang}, AUDIO ONLY — absolutely NO subtitles, captions or on-screen text. SAY IT ONCE: each line is spoken EXACTLY ONCE, straight through at a natural pace — never repeat, stutter, loop or echo any word or phrase of it (a word must never be said twice in a row); when the line ends, the voice stops cleanly and does not restart.${listenerNote}${ownership}`;
  } else if (turns.length === 1) {
    const t = turns[0]!;
    const nm = (t.speaker ?? "").trim();
    if (!nm && !speaker) {
      // Genuine VOICEOVER clip: the line is off-screen narration — if we say
      // "the character speaks", Veo lip-syncs it through an on-screen face.
      const vt = params.speakerVoice ? ` (narrator voice: ${params.speakerVoice} — heard from off-screen only)` : "";
      spoken = ` VOICEOVER${vt}, off-screen narration in ${lang}: "${(t.text ?? "").trim()}" — NOBODY on screen moves their mouth or lips during this narration; every visible character keeps the mouth fully closed. Spoken EXACTLY ONCE, straight through — never repeat, stutter or loop any word or phrase. AUDIO ONLY — absolutely NO subtitles, NO captions, NO burned-in text of these words on screen.`;
    } else {
    const label = nm || speakerLabel;
    const vt = nm ? voiceOf(nm) || (params.speakerVoice ? ` (voice: ${params.speakerVoice})` : "") : params.speakerVoice ? ` (voice: ${params.speakerVoice})` : "";
    const others = (onScreen.length > 0 ? onScreen : allNames).filter((n) => n !== nm);
    const silence =
      nm && others.length > 0
        ? ` Only ${nm} speaks; the other character${others.length > 1 ? "s" : ""} (${others.join(", ")}) stay silent and listen with mouths closed.`
        : "";
    spoken = ` ${label}${vt} delivers this line in their OWN voice with accurate lip-sync — the voice belongs to and comes from ${nm ? `${nm}'s` : "the speaker's"} mouth — saying in ${lang}: "${(t.text ?? "").trim()}" — spoken EXACTLY ONCE, straight through at a natural pace (never repeat, stutter or loop any word or phrase; the voice stops cleanly when the line ends), delivered as AUDIO ONLY (voice + lip-sync); absolutely NO subtitles, NO captions, NO burned-in text of these words on screen.${silence} VOICE FOLLOWS THE PERSON, NOT THE CAMERA: when ${nm || "the speaker"}'s face is in frame their lips move with the line; the camera may instead hold on a listener's reaction, in which case the line is heard as ${nm || "the speaker"}'s off-screen / over-the-shoulder voice and NO on-screen character mouths it. Tie the line to ${nm || "the speaker"}'s speaking gesture (their look or turn toward the person addressed); any large body action (standing up, walking, turning away) happens before or after the line, never during it; the line is NEVER reassigned to another character.`;
    }
  }
  const audio = params.ambientAudio ? ` AMBIENT SOUND: ${clean(params.ambientAudio)}.` : "";
  const assembled = `${lead}${character}${castLine}${contextLock}${setting}${envBlock}${product}${ing}${tokens}${palette}${intentBlock} MOTION: ${clean(params.motionPrompt)}${spoken}${audio} ${veoConciseTail(!!params.productDescription, params.realityProfile)}`;
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
  /** All character names in the project — used to silence non-speakers. */
  characterNames?: string[];
  /** TẦNG 9: locked voice profile per character name (speaker → voice line). */
  characterVoices?: Record<string, string>;
  /** Genre-appropriate ambient sound, appended to every clip's Veo prompt. */
  ambientAudio?: string;
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
    environment_ref?: string | null;
    characters_in_scene?: string[];
    continuity_note: string;
    beats: { beat: string; camera: string }[];
    /** Per-segment override. null explicitly suppresses the global value. */
    productDescription?: string | null;
    /** Per-segment override. null explicitly suppresses the global value. */
    ingredients?: string | null;
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
        characterDescription: params.characterDescription,
        realityProfile: params.realityProfile,
        sceneIntent: s.scene_intent,
        setting: s.setting,
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
        characterVoices: params.characterVoices,
        characterNames: params.characterNames,
        charactersInScene: s.characters_in_scene,
        speakerVoice: s.speaker ? params.characterVoices?.[s.speaker.trim()] : undefined,
        ambientAudio: params.ambientAudio,
        environmentRef: s.environment_ref,
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
// reliably than one flat paragraph. We emit a canonical Veo-3.1 JSON: a shared
// header (style / continuity / negative) + one structured object per clip. The
// self-contained flat `prompt` is ALSO kept per clip for text-mode users.

/** The one comprehensive negative list, reused at project + clip level. */
export const VEO_NEGATIVE_LIST =
  "resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual, morphing, warping, teleporting, floating or levitating objects, duplicated or doubled objects, extra or fused fingers, malformed or mutated hands, third hand, extra pair of hands, disembodied hand entering the frame, more hands than the people present, extra or missing limbs, limbs bending or passing through objects, the face changing, identity drift, age shifting, changed hair/wardrobe/accessories, warped or altered label/logo text, brand-colour change, extra people, the same person or character duplicated or appearing twice in one frame, a second copy of a named character in the background or reflection, objects passing through solid surfaces, deformed food or liquid, melting, jittery or stuttering motion, mid-clip jump cuts, both characters talking at once, overlapping or simultaneous voices, doubled voice, chorus, echo, a spoken line repeated or duplicated, listener lip movement, lip movement during voiceover, narrator voice coming from a visible character's mouth, wrong speaker lip sync, swapped voices, ad-lib speech, speech bubble, on-screen text, captions, subtitles, burned-in dialogue text, title cards, karaoke or lyric text, translation text, camera or lens spec overlay, technical readout or HUD, info card in a corner, floating character name tag, a character's name or age rendered as a label, character info card overlaid on the footage, colour-temperature or Kelvin label, exposure/Kelvin/lux/timecode text, any readable letters numbers or typography anywhere in the frame, watermark, channel logo, plastic or CGI skin";

interface VeoJsonOptions {
  aspectRatio: string;
  dialogueLanguage?: string;
  /** Genre-appropriate ambient sound (kitchen sizzle, gym energy, …). */
  ambientAudio?: string;
  /** TRUE when the user uploaded a real LOCATION photo — the set must be
   * rebuilt from that photo in every clip, never re-invented from text. */
  hasLocationRef?: boolean;
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
export function buildVeoJson(
  breakdown: StoryboardGenerationOutput,
  opts: VeoJsonOptions
): Record<string, unknown> {
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
  const lang = opts.dialogueLanguage ?? "Vietnamese";
  const locks = breakdown.character_locks ?? [];
  const sb = breakdown.scene_bible;
  const culture = oneLine(breakdown.world_context?.culture);
  const charIds = new Map(
    locks.map((lock, index) => [lock.name.trim().toLowerCase(), `CHAR_${index + 1}`])
  );
  const splitOutfit = (costume?: string) => {
    const parts = noHex(costume)
      .split(/[,;]\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    return {
      top: parts[0] || "Match the attached character reference",
      bottom: parts.slice(1).join(", ") || "Match the attached character reference",
    };
  };
  const cameraParts = (cameraText: string) => {
    const lower = cameraText.toLowerCase();
    const framing = /extreme close|ecu/.test(lower)
      ? "ECU"
      : /close|\bcu\b/.test(lower)
        ? "CU"
        : /medium|\bms\b/.test(lower)
          ? "MS"
          : /wide|\bws\b|establish/.test(lower)
            ? "WS"
            : "MS";
    const angle = /low angle|\blow\b/.test(lower)
      ? "low angle"
      : /high angle|overhead|top-down/.test(lower)
        ? "high angle"
        : "eye level";
    const movement = /static|locked/.test(lower)
      ? "static"
      : cameraText || "single slow, smooth camera move";
    return { framing, angle, movement };
  };

  const clips = breakdown.segments.map((seg, segIndex) => {
    const beats = Array.isArray(seg.beats) ? seg.beats : [];
    const clipSeconds = Math.max(1, seg.duration_seconds || 10);
    const speaker = oneLine(seg.speaker);
    const env = resolveEnvironment(seg.environment_ref, seg.first_frame_prompt);
    const onScreen = (seg.characters_in_scene ?? []).map((n) => oneLine(n)).filter(Boolean);
    // An explicitly EMPTY cast list means nobody is on screen (hands-only
    // cooking clips); fall back to all locks only when the field is missing.
    const baseVisibleLocks =
      onScreen.length > 0
        ? locks.filter((lock) =>
            onScreen.some((name) => name.toLowerCase() === lock.name.trim().toLowerCase())
          )
        : seg.characters_in_scene && seg.characters_in_scene.length === 0
          ? []
          : locks;
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
    const entryState = scrub(seg.scene_intent?.entry_exit?.entry_state) || scrub(seg.first_frame_prompt);
    const exitState = scrub(seg.scene_intent?.entry_exit?.exit_state) || scrub(seg.continuity_note);
    const mainAction =
      scrub(seg.motion_prompt) || scrub(seg.scene_intent?.performance?.physical_behavior);
    // CROSS-CLIP CONTINUITY: what the PREVIOUS clip actually ended on — this is
    // what this clip must open from. The old code mislabelled this as the
    // current clip's own continuity_note, so a clip could open in a state that
    // contradicted the previous clip's ending (e.g. one character already
    // seated / standing before the beat that moves them). Falls back to this
    // clip's own note for the very first clip (no predecessor).
    const prevSeg = segIndex > 0 ? breakdown.segments[segIndex - 1] : null;
    const prevExitState = prevSeg
      ? scrub(prevSeg.scene_intent?.entry_exit?.exit_state) || scrub(prevSeg.continuity_note)
      : "";
    const continuityFromPrev = prevExitState || scrub(seg.continuity_note);
    const characterLock = Object.fromEntries(
      visibleLocks.map((lock) => {
        const id = charIds.get(lock.name.trim().toLowerCase()) || "CHAR_1";
        const outfit = splitOutfit(lock.costume);
        return [
          id,
          {
            id,
            name: lock.name,
            species: `Human${culture ? ` - ${culture}` : ""}${lock.is_child ? " child" : ""}`,
            gender: lock.gender === "male" ? "Male" : lock.gender === "female" ? "Female" : "Unspecified",
            age: scrub(lock.gender_age),
            voice_personality: oneLine(lock.voice) || defaultVoiceFor(lock.gender, lock.is_child),
            body_build: noHex(lock.build),
            face_shape: "Match the attached reference; preserve locked facial geometry",
            hair: noHex(lock.hair),
            eyes: noHex(lock.eye_details || lock.eyes),
            skin_or_fur_color: noHex(lock.skin_tone),
            skin_texture: noHex(lock.skin_texture),
            signature_feature: scrub(lock.signature_features),
            outfit_top: outfit.top,
            outfit_bottom: outfit.bottom,
            outfit_materials: noHex(lock.wardrobe_materials),
            helmet_or_hat: "None unless visible in the attached reference",
            shoes_or_footwear: "Match the attached reference; do not invent or change",
            props: "Only props explicitly planted in background_lock.setting and action_flow",
            body_metrics: "cons=no-auto-rescale,lock-proportions,keep-relative-height",
            position: "Use the exact starting position in background_lock.setting",
            orientation: "Use the exact orientation in background_lock.setting",
            pose: "Use the exact starting pose in background_lock.setting",
            foot_placement: "Physically grounded, stable contact with the floor",
            hand_detail: "Natural hands; correct contact with named props; no fused or extra fingers",
            expression: noHex(lock.default_expression),
            action_flow: {
              pre_action: "Hold the exact starting pose assigned in scene_action.start_state",
              main_action: `Perform only ${lock.name}'s actions in scene_action.motion; do not steal another character's action or dialogue`,
              post_action: "Finish in the exact state assigned in scene_action.end_state",
            },
          },
        ];
      })
    );
    const rawTurns =
      seg.dialogue_lines && seg.dialogue_lines.length > 0
        ? seg.dialogue_lines
        : seg.dialogue
          ? [{ speaker, text: seg.dialogue, start_s: undefined, end_s: undefined }]
          : [];
    const dialogue = rawTurns
      .filter((turn) => oneLine(turn.text))
      .map((turn) => {
        const name = oneLine(turn.speaker);
        const lock = locks.find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
        return {
          speaker_id: name ? charIds.get(name.toLowerCase()) || name : "VOICEOVER",
          speaker_name: name || "VOICEOVER",
          text: oneLine(turn.text),
          language: lang,
          start_sec: turn.start_s ?? null,
          end_sec: turn.end_s ?? null,
          voice_personality: lock
            ? oneLine(lock.voice) || defaultVoiceFor(lock.gender, lock.is_child)
            : "off-screen narrator",
        };
      });
    const cameraText = beats.map((beat) => oneLine(beat.camera)).filter(Boolean).join(" -> ");
    const camera = cameraParts(cameraText);
    const ambience = [env?.sound_bed, opts.ambientAudio].filter(
      (value): value is string => !!value
    );
    return {
      scene_id: String(seg.segment_number),
      duration_sec: String(clipSeconds),
      visual_style: [
        scrub(breakdown.style_guide?.art_direction),
        scrub(sb?.lens),
        scrub(sb?.color_grade),
        scrub(sb?.film_grain),
      ]
        .filter(Boolean)
        .join("; "),
      scene_role: seg.marketing_role,
      character_lock: characterLock,
      background_lock: {
        id: seg.environment_ref || `BACKGROUND_${seg.segment_number}`,
        name: env?.display_name || seg.title,
        setting: scrub(seg.first_frame_prompt),
        scenery: scrub(sb?.backdrop),
        props: noHex(breakdown.product_dna) || "Only props explicitly named in setting and action",
        lighting: [scrub(sb?.lighting), env ? scrub(`${env.lighting.key_kelvin}K, ~${env.lighting.ambient_lux} lux`) : ""]
          .filter(Boolean)
          .join("; "),
        persistence: opts.hasLocationRef
          ? "An attached LOCATION photo shows the REAL set — rebuild THIS exact place (same layout, furniture, colours, materials and light) identically in EVERY clip of this project; only the characters, their poses and explicitly named props change between clips."
          : "This exact location — same geometry, furniture positions, materials, colour palette and light sources — is IDENTICAL in every clip of this project; only the characters, their poses and explicitly named props change between clips.",
      },
      camera: {
        framing: camera.framing,
        angle: camera.angle,
        movement: scrub(camera.movement),
        focus: "cinematic natural depth of field; focus follows the explicitly assigned camera subject in the movement plan, NOT the active speaker — a speaker may be off-camera or softly out of focus while the listener's reaction is the sharp focal subject; interacted props stay readable",
      },
      scene_action: {
        start_state: entryState,
        motion: mainAction,
        end_state: exitState,
        continuity_from_previous: continuityFromPrev,
        // Behaviour-timing lock: forbids a character from pre-empting or lagging
        // an action relative to the timed motion (the "Lan is already sitting
        // before Minh pulls her chair" desync). The opening frame is anchored
        // to the previous clip's real end; each character only changes state at
        // the exact second their beat says so.
        continuity_lock:
          (segIndex > 0
            ? "OPENING FRAME = continuity_from_previous, reproduced EXACTLY (same people, same poses, same positions, same props, same seated/standing state). If start_state conflicts with continuity_from_previous, continuity_from_previous WINS. "
            : "OPENING FRAME = start_state, reproduced exactly. ") +
          "STATE-CHANGE TIMING: every character holds their opening pose/position until the exact second in scene_action.motion that moves them. A character must NOT pre-empt a later beat and must NOT lag it — e.g. a character stays STANDING and does not sit until the motion explicitly shows them being seated, and stays SEATED until the motion explicitly shows them standing. Only the characters and props named in scene_action.motion move; everyone else is held frozen in their current state. CLOSING FRAME = end_state, reproduced exactly, so the next clip can open from it seamlessly. No off-plan people appear at the characters' own table.",
        staging: "Conversation partners face EACH OTHER per the positions in background_lock.setting — a speaker never turns their back to the person addressed, and the two are never staged side-by-side facing the same direction like presenters, unless the motion explicitly stages it.",
      },
      foley_and_ambience: {
        ambience,
        fx: ["natural clothing, footsteps and prop-contact sounds synchronized to visible action"],
        music:
          opts.ambientAudio && !/no music/i.test(opts.ambientAudio)
            ? opts.ambientAudio
            : "None unless explicitly required by the scene",
      },
      dialogue,
      lip_sync_director_note: (() => {
        if (dialogue.length === 0)
          return "No spoken dialogue; all visible mouths remain naturally closed.";
        // Deterministic SECOND-BY-SECOND AUDIO MAP (the discipline that made
        // hand-fixed prompts work): silence gaps and exactly one owner per
        // window, so Veo can never guess a speaker from the framing.
        const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
        const windows = dialogue
          .filter((t) => typeof t.start_sec === "number" && typeof t.end_sec === "number")
          .slice()
          .sort((a, b) => (a.start_sec as number) - (b.start_sec as number));
        let timeline = "";
        if (windows.length === dialogue.length && windows.length > 0) {
          const parts: string[] = [];
          let cursor = 0;
          for (const w of windows) {
            const s = w.start_sec as number;
            const e = w.end_sec as number;
            if (s - cursor > 0.15) parts.push(`${fmt(cursor)}-${fmt(s)}s silence`);
            const who =
              w.speaker_id === "VOICEOVER"
                ? "VOICEOVER only (off-screen narrator; NO on-screen mouth moves)"
                : `${String(w.speaker_name).toUpperCase()}/${w.speaker_id} only`;
            parts.push(`${fmt(s)}-${fmt(e)}s ${who}`);
            cursor = Math.max(cursor, e);
          }
          if (clipSeconds - cursor > 0.15) parts.push(`${fmt(cursor)}-${fmt(clipSeconds)}s silence`);
          timeline = `STRICT SEQUENTIAL AUDIO — NEVER MIX OR OVERLAP VOICES: ${parts.join("; ")}. `;
        }
        return `${timeline}DIALOGUE OWNERSHIP: each line belongs exclusively to its named speaker and is spoken in that person's voice from that person's physical position; no other character may produce any lip, jaw or speech-like mouth movement during that line — each line is spoken EXACTLY ONCE, never repeated or echoed. SPEAKER GAZE: the speaker looks toward the person they are addressing per the scene geometry — never automatically toward the camera, and never with their back to the person addressed. LISTENER: silent, lips naturally closed, reacting only through eyes, brows, breathing and posture. VOICEOVER: comes from a fully off-screen narrator — neither visible character may move their lips during narration. CAMERA INDEPENDENCE: camera subject, framing and focus are independent of dialogue ownership — the camera may hold the speaker, the listener's reaction, or both; when it holds the listener, the line continues as the speaker's off-screen voice and NO on-screen mouth moves to it. One voice at a time; dialogue is audio only.`;
      })(),
      output_rules: {
        frame: "one clean full-screen continuous shot; never render a storyboard sheet, grid, panel, reference strip or document",
        on_screen_text: "ZERO — no letters, words, names, ages, numbers, labels, logos, captions, subtitles, badges, cards, HUD or technical overlays",
        audio: "Dialogue and voiceover are spoken audio only. Exactly ONE voice at a time following the dialogue start_sec/end_sec windows; silent gaps between lines are mandatory; no simultaneous voices, chorus, echo, duplicated or repeated line, and no extra ad-lib speech.",
        reference_priority: "uploaded character and location menu references are authoritative; never merge, omit or swap identities",
      },
      negative_prompt: [
        VEO_NEGATIVE_LIST,
        // Continuity-specific negatives (appended, not replacing the base list):
        "a character in a pose that contradicts the timed motion (e.g. already seated before the beat that seats them, or standing before the beat that stands them)",
        "phantom / extra background diners, hands, legs or people at the main characters' own table",
        "a character teleporting between seated and standing without the on-screen movement",
        "the opening frame not matching continuity_from_previous",
      ]
        .filter(Boolean)
        .join(", "),
    };
  });

  return {
    format: "flow-veo-scene-json-v2",
    usage: "Each item in clips is one independent prompt. Paste one object per generation. For bulk tools, use the JSONL export where each physical line is one complete prompt.",
    aspect_ratio: opts.aspectRatio,
    clip_count: clips.length,
    clips,
  };
}
