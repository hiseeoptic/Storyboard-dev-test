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
  environmentToJson,
  environmentCatalogForPrompt,
} from "@/lib/environment";
import {
  lawsSystemDigest,
  clipMotionLawLine,
  clipCameraLawLine,
  clipAudioLawLine,
  lawsForVeoJson,
  defaultVoiceFor,
  contextDnaSystemDigest,
  worldContextLockBlock,
} from "@/lib/laws";
import type { WorldContext } from "@/types";

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
function veoConciseTail(hasProduct: boolean): string {
  const productNeg = hasProduct
    ? "warped or altered label/logo text, brand-colour change, extra or duplicated products, "
    : "";
  return `${PHOTOREAL_REALISM} ${clipMotionLawLine()} ${clipCameraLawLine()} ${clipAudioLawLine()} ABSOLUTE NO-TEXT RULE: the finished frame contains ZERO readable text, letters, numbers or typography of ANY kind — no subtitles, no captions, no karaoke/lyric text, no title cards, no watermark or logo, and NEVER render any of this prompt's technical values (lens like "50mm" or "f/2.8", colour temperature like "4300K", light level like "600 lux", timecodes like "0-3s") as on-screen text, spec cards, HUD readouts or corner overlays — every technical value here is an INTERNAL camera/render instruction, never visible content. Spoken words are AUDIO ONLY. Avoid: ${productNeg}morphing, warping, teleporting, floating or duplicated objects, extra or fused fingers, malformed hands, the face changing, deformed food or liquid, plastic/CGI/wax/airbrushed skin, toy-like or 3D-render materials.`;
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
const NUMEROLOGY_FRAMEWORK = `
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

- THE HOOK IS 80% OF THE VIDEO. The first 2-3 seconds decide everything. The opening SHOT + the opening LINE must both stop the scroll. Write the hook LAST, after you know the payoff, so it can promise exactly what the video delivers. Pick ONE of these proven hook formulas for beat 1 (vary it across videos — do not always use the same one):
  · CALL-OUT + STOP: name the exact viewer and freeze them — "Nếu bạn là Số [X], khoan lướt đã." / "Video này chỉ dành cho Số [X]."
  · UNCOMFORTABLE TRUTH: expose a hidden flaw they secretly feel — "Số [X], sự thật là bạn đang tự làm khổ mình."
  · CONTRADICTION / PATTERN-INTERRUPT: two clashing ideas — "Càng [strength], bạn càng [pain]. Vì sao?"
  · CURIOSITY GAP / OPEN LOOP: promise a reveal held to the end — "99% Số [X] hiểu sai về chính mình. Xem hết sẽ rõ."
  · WARNING / NEGATIVITY BIAS: "Đây là cái bẫy lớn nhất của Số [X]."
  · MIND-READING: say the thing they never told anyone — "Bạn cười với cả thế giới, nhưng về nhà thì im lặng, đúng không?"
  · BOLD CLAIM: "Số [X] sinh ra không phải để [common assumption]."
  The hook line MUST contain the number and speak to "bạn", the FIRST word is already the hook (never context), ≤ 10 words. No slow throat-clearing, no "Hôm nay mình sẽ nói về…", no logo/intro card. Combine at most 2 levers per hook.
- WRITING TECHNIQUES (these are what make it feel "đúng là mình" and get shares):
  · MIRROR / BARNUM: describe a hyper-SPECIFIC behaviour the viewer secretly does, then attribute it to the number — "Bạn hay đọc lại tin nhắn 3 lần trước khi gửi. Đó là dấu ấn của Số [X]." Concrete behaviours ("thức khuya nghĩ lại điều mình đã nói") always beat abstract traits ("bạn nhạy cảm"). Pair a flattering trait with a mild vulnerability (flattering + hơi nhói) — that combo is the sweet spot for personality content.
  · "NHƯNG / VÌ THẾ" SPINE (never "rồi / và"): between every two beats you must be able to insert NHƯNG (đảo chiều) or VÌ THẾ (hệ quả). If only "rồi… rồi…" fits, the beats are dead — rewrite for reversal or consequence.
  · POWER WORDS front-loaded: bí mật, sự thật, sai lầm, đừng, chưa bao giờ, tại sao, cuối cùng, giấu kín, mặt tối. Trigger ONE clear emotion per video.
  · Vary rhythm: punchy fragment → medium line → punchy fragment. Read each line aloud; if it sounds like an essay or runs out of breath, cut it.
- THE 5-BEAT ARC (map onto the segments in order; scale to the requested segment count; each beat's SETTING follows the metaphor above). Every beat also opens an OPEN LOOP that the next beat pays off, so viewers cannot stop:
  1) HOOK (0-3s) — fire one hook formula above straight to camera, in a location that instantly signals the number's element/essence. End on a question or a promise that beat 2 will answer.
  2) PAIN / NỖI ĐAU — dramatize the misunderstood struggle from the number's SHADOW as a metaphor scene; name the pain so precisely the viewer thinks "sao biết rõ mình vậy". Voice their self-doubt as a question, then tease that "nhưng đó chưa phải điều tệ nhất / lý do thật sự là…".
  3) INSIGHT / GIẢI MÃ — the turn. The reframe "Không phải bạn [flaw]… mà là [deeper truth from the MISSION]", in a spacious setting that visually opens up (a reveal, slow pull-back). This is the "aha" they'll want to share.
  4) PAYOFF / SỨ MỆNH — land the number's MISSION as a gift; a warm, human, giving moment; the character finally looks "at home" in a setting that rewards the number's nature. Deliver on the hook's promise.
  5) CTA — a one-line takeaway that LOOPS back to the exact hook wording, + ONE low-effort engagement bait. Prefer SHARE bait (highest reach) — "Gửi cho một người Số [X] cần nghe điều này" — or COMMENT bait — "Thả số chủ đạo của bạn ở comment, mình đọc hết 👇" — or SAVE bait — "Lưu lại để lần sau nghi ngờ chính mình thì mở ra xem". Open, walk-away framing whose last frame could cut straight back to frame 1 (seamless loop). Write the last line so it flows straight back into the hook line.
- DIALOGUE = SHORT VOICEOVER, second-person Vietnamese, ONE punchy "đắt giá" line per scene, MAX 16 words (ideal 8-14). Rules: talk to "bạn", be SPECIFIC not generic, use "không phải X mà là Y" reframes, pick emotional concrete words, and let the image carry the rest — SHOW don't tell. Never lecture, never list traits, never explain the theory. BAD (long, dull, listy): "Bạn khao khát được công nhận, được dẫn dắt, nhưng lại sợ cô đơn…". GOOD (short, sharp, visual): "Đứng đầu thì oai. Nhưng đỉnh núi nào mà chẳng lạnh."
- ✍️ COPYWRITING TECHNIQUES FOR THE SPOKEN LINES (use them — this is what turns a soft line into a scroll-stopping one):
  · RULE OF THREE (liệt kê 3 nhịp CỤ THỂ, vế thứ 3 "đắt" nhất): "Bạn đổi việc, đổi đam mê, đổi cả những cuộc tình." — thắng xa "bạn hay thay đổi".
  · CHALLENGE THE LABEL (lật cái nhãn xã hội gán cho họ): "Người ta bảo bạn [nhãn]. Nhưng sự thật phũ phàng hơn nhiều đấy."
  · ANTITHESIS "không phải X — mà là Y": "Bạn xê dịch không phải để chạy trốn — mà để mang cảm hứng đi khắp thế gian."
  · CONCRETE > ABSTRACT: một hành vi/hình ảnh cụ thể ("xếp đồ rời một căn phòng, gấp tấm bản đồ") luôn thắng một tính từ trừu tượng ("bồn chồn").
  · SELF-DOUBT AS QUESTION (nói hộ câu người xem thầm hỏi): "Sao mình không thể yên một chỗ như người ta?"
  · RHYTHM ngắn–ngắn–dài: một mệnh đề cụt rồi một câu mở ra; đọc to phải thấy "phanh" đúng chỗ.
- 🏆 GOLD-STANDARD EXAMPLE — this is the QUALITY BAR every script must hit (topic Số 5 + Sứ Mệnh 9). LEARN the voice & techniques; do NOT copy it — write fresh for the actual numbers:
  HOOK: "Bạn là Số Chủ Đạo 5, Sứ Mệnh 9? Người ta bảo bạn cả thèm chóng chán. Nhưng sự thật phũ phàng hơn nhiều đấy." (call-out + challenge-the-label + open loop)
  PROBLEM: "Bạn đổi việc, đổi đam mê, đổi cả những cuộc tình. Rồi tự hỏi: sao mình không thể yên một chỗ như người ta?" (rule of three + self-doubt question)
  INSIGHT: "Không phải bạn thiếu định hướng đâu. Tâm hồn tự do của Số 5 đang đi tìm một điều đủ lớn để dâng hiến cả đời." (không-phải-X-mà-Y reframe)
  PAYOFF: "Đó là Sứ Mệnh 9. Bạn xê dịch không phải để chạy trốn — mà để mang cảm hứng và lòng nhân ái đi khắp thế gian." (antithesis + mission)
  CTA: "Tự do của bạn sinh ra để cho đi. Nếu thấy đúng, thả số chủ đạo của bạn ở comment nhé." (takeaway + comment bait)
  Every line is SHORT, CONCRETE, has rhythm and a twist — never vague, never a lecture. HIT THIS LEVEL. If a line sounds soft/generic (e.g. "bạn có bao giờ thấy cô đơn?", "sứ mệnh của bạn là truyền cảm hứng"), REWRITE it sharper using the techniques above.
- RETENTION KILLERS TO AVOID: slow or generic openers, intro/logo cards, on-screen text walls, more than one idea per line, a payoff that doesn't match the hook's promise, and a flat ending with no loop or CTA.
- Fill "marketing_structure" (hook = beat 1, problem = beat 2, solution = beat 3, cta = beat 5). Put a ready-to-post social caption (with a scroll-stopping first line) + 4-6 hashtags at the END of "synopsis".`;

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

// Cooking / recipe short — THE FOOD is the hero. Demonstration content: each
// clip = one continuous cooking action, ending on an irresistible reveal.
const COOKING_FRAMEWORK = `
COOKING / RECIPE SHORT FRAMEWORK (follow this EXACTLY — THE FOOD IS THE STAR):
- SUBJECT: one dish/recipe (e.g. "cơm chiên trứng", "bánh mì chảo", "trà sữa nhà làm"). Keep it to ONE dish, doable, with a satisfying finish.
- 📌 RECIPE CONTENT = SOURCE OF TRUTH: if the idea/topic content contains a structured recipe (lines like "CÔNG THỨC MÓN / NGUYÊN LIỆU / GIA VỊ / CÁC BƯỚC / ÂM THANH ASMR"), that data is ABSOLUTE. Use EXACTLY those ingredients and ONLY those — never invent, swap, add or drop an ingredient/spice; follow CÁC BƯỚC in order and map them onto beats 2-4; use the listed DỤNG CỤ (pot/pan type) verbatim; take each step's ASMR sound from ÂM THANH ASMR; end on the THÀNH PHẨM money shot. If no structured recipe is given, use only common, verifiable ingredients for that dish.
- 🚫 ANTI-HIJACK (this is a COOKING video, NEVER a health/illness video): even if the idea/topic text mentions symptoms, diseases or health benefits, DO NOT build a sickness storyline — no character acting tired/ill, no rubbing temples or pressing the abdomen, no disease explanations, no "dấu hiệu/triệu chứng" hooks. The hook is the FOOD money shot, the arc is the MAKE. A health benefit may appear as at most ONE warm spoken line (e.g. "món này lại mát gan nữa"), never as the story.
- 🥬 INGREDIENT FORENSIC DNA: in every first_frame_prompt, describe each visible ingredient with its REAL look — colour, texture, state (e.g. "sấu xanh vỏ sần hơi bóng", "thịt vịt chặt miếng, da vàng nhạt", "gừng thái lát vàng tươi, xơ rõ") — so the render shows the actual Vietnamese ingredient, not a generic lookalike; keep each ingredient's look IDENTICAL across all segments.

- 🏔️ OUTDOOR / WILDERNESS ASMR MODE (activate when the idea/setting mentions ngoài trời / núi / suối / bản / cao nguyên / wilderness / outdoor — the "The Nikos Knife" formula, overrides the normal kitchen rules):
  · SETTING: a fixed OUTDOOR Vietnamese landscape cooking spot — use environment_ref "vietnam_highland_cook_spot" (đồi núi Tây Bắc) or "vietnam_stream_rock_cook" (bờ suối rừng) for EVERY segment (NOT warm_home_kitchen). Composition law: the cooking action fills the LOWER THIRD of frame (board/bowl/fire in sharp focus), the Vietnamese vista fills the upper frame with real atmospheric depth.
  · CHARACTER = HANDS ONLY, NO FACE EVER: the "character" is a pair of hands — lock their DNA like a face: skin tone, one jacket-sleeve cuff (colour + material), one accessory (e.g. dark field watch on left wrist). The SAME hands, cuff and watch appear in every segment. character_locks describes the hands/cuff/accessory; gender_age is the cook's hands' owner; NEVER show the face, body or reflection.
  · CAMERA: near-POV high angle (~40-60° down) over the hands and board, or a low tabletop close-up along the board toward the vista; slow push-ins and gentle tilts only; the landscape horizon sits in the upper third.
  · AUDIO = 100% DIEGETIC ASMR — THIS OVERRIDES ANY DIALOGUE REQUIREMENT: "dialogue" MUST be an empty string "" and "speaker" "" for EVERY segment. No voiceover, no music, no humming. The soundtrack is ONLY: knife sliding through the ingredient and landing on wood, chop thuds, grating, scraping, drizzling oil, whisking, fire crackle, sizzling, plus the location's nature bed (wind/stream/birds). In every motion_prompt NAME the sound-making contact explicitly (e.g. "the blade glides through the salmon and knocks softly against the board") — Veo generates the audio from the described action.
  · FOOD REALISM: raw ingredients glisten wet and fresh (moist fish flesh, silver skin, juice beading on the cut face), steam in the cool air, smoke curling off coals — appetising, macro-level real.
  · ARC (5 beats): finished-dish money shot over the vista → prep cuts on the board (the hero ASMR beat, slow) → sauce/marinade in the wooden bowl (grate + drizzle + stir) → cooking over the open fire (sizzle + smoke) → reveal + first cut/bite, no CTA speech — the CTA lives in the caption only.
- HERO = THE FOOD, not the person: the camera loves the ingredients, the sizzle, the steam, the texture, the pour, the cheese-pull, the final plating. The cook is usually HANDS + voice (POV) or a warm host; identity matters less than appetite appeal.
- SETTING = A KITCHEN, LOCKED & CONSISTENT: the whole video happens in ONE fixed kitchen (a warm, tidy home kitchen unless the idea says otherwise — stove/hob, wooden board, clean counter, natural window light). LOCK it into scene_bible.backdrop and repeat the SAME kitchen verbatim in every segment's first_frame_prompt — same counter, same stove, same props, same light. Never drift to an unrelated place; the cooking always happens on that counter/stove.
- OVERVIEW SHOT (required): segment 1 (or its first beat) opens with a WIDE ESTABLISHING shot of the whole kitchen counter/setup — ingredients laid out, pan on the stove — so the viewer sees the space, THEN the clips move into the close-ups. (This is the "SCENE OVERVIEW" of the board.)
- AUDIO = KITCHEN ASMR: every clip carries real cooking sound — sizzling/xèo xèo, chopping, bubbling, oil crackle, the pour, gentle kitchen ambience. Appetising, no music bed drowning it. (Veo generates this audio.)
- VOICE = warm, friendly HOME-COOK HOST, second person, easy and inviting (like showing a friend) — never a dry TV-chef read-out.
- PICK ONE CONTENT STYLE (vary across videos):
  · Công thức nhanh (recipe-in-60s) — từng bước gọn gàng.
  · ASMR / tiếng xèo (sizzle & sound) — cận cảnh, âm thanh nấu nướng.
  · POV nấu ăn (chỉ có bàn tay) — người xem như đang tự nấu.
  · "Món này làm 5 phút" — nhanh, tiện, ai cũng làm được.
  · Mẹo bếp bất ngờ — 1 mẹo khiến món ngon/đẹp hơn hẳn.
  · Trước → Sau — nguyên liệu thô → thành phẩm long lanh.
  · Câu chuyện món ăn — kỷ niệm/quê hương gói trong món ăn.
- THE 5-BEAT ARC (each beat = ONE continuous cooking action for one 10s clip):
  1) HOOK (0-3s) — open on the FINISHED-DISH "money shot" (or the most dramatic step: cheese pull, sizzling pour) + a line that promises the payoff. NO slow intro.
  2) NGUYÊN LIỆU — quick, appetising layout of what you need (few, accessible ingredients); tease the tastiest part.
  3-4) CÁC BƯỚC CHÍNH — the key cooking actions, ONE per clip (đảo, chiên, rưới sốt, rắc topping), each shown close and satisfying; keep momentum, hold curiosity toward the result.
  5) THÀNH PHẨM + CTA — the hero reveal (steam, cut-open, first bite/pull) + a save-worthy CTA ("Lưu công thức lại làm cuối tuần nhé", "Tag đứa bạn nấu ăn dở 😆").
- SENSORY LANGUAGE: name taste/sound/texture ("giòn rụm", "thơm nức", "xèo xèo", "kéo phô mai", "nóng hổi"). Make the viewer HUNGRY.
- DIALOGUE = SHORT voiceover narrating the step, second-person, ~8-14 words ("Đầu tiên, phi tỏi cho thơm…"). Warm, easy, encouraging — never a dry recipe read-out.
- 🏆 GOLD-STANDARD EXAMPLE (món "cơm chiên trứng" — learn the voice, don't copy):
  HOOK: "Cơm nguội đừng bỏ — 5 phút nữa nó thành đĩa cơm chiên vàng ươm này." (money shot + promise)
  NGUYÊN LIỆU: "Chỉ cần cơm nguội, hai quả trứng, chút hành lá. Có vậy thôi." (few, accessible)
  BƯỚC 1: "Đánh tan trứng, đổ vào chảo nóng, cho cơm vào đảo thật nhanh tay." (one clear action)
  BƯỚC 2: "Nêm chút nước tương, đảo đều tới khi từng hạt cơm tơi và bóng." (sensory)
  THÀNH PHẨM + CTA: "Vàng ươm, thơm nức mũi. Lưu lại làm bữa tối nay nhé!" (reveal + save-bait)
- Fill "marketing_structure" (hook = the money shot promise, problem = the craving/need, solution = the make, cta = save). Ready-to-post caption + 4-6 hashtags at END of "synopsis".`;

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
export function genreAmbientAudio(genre?: string, goal?: string): string | undefined {
  const isCooking = genre === "cooking" || goal === "cooking";
  const isFitness = genre === "fitness" || goal === "fitness";
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
  return `You are a world-class short-form video SCRIPTWRITER for viral social media (TikTok / Reels / YouTube Shorts). You write ONLY the creative script — NOT the technical storyboard or JSON (a separate tool turns your script into the visual storyboard).

Write in the language the user asks for. Your job is RETENTION: make people watch to the last second and comment.

CONTEXT LOCK (before writing a single line): silently resolve the WORLD this video lives in from the idea — geography, culture, time period, genre, reality level, social class, technology level. Never assume a default country or era; infer them. Then keep EVERY detail of the script (places, objects, clothing, food, behavior, speech style) inside that one locked world — no out-of-era technology, no off-culture props or rituals, no world-hopping between segments (open during design, locked during writing).

THE HOOK (first 2-3s) IS 80% OF THE JOB — write it LAST, after you know the payoff, so it promises exactly what you deliver. Beat 1's opening line must stop the scroll. Use ONE proven hook formula (vary across scripts): CALL-OUT + STOP ("Nếu bạn là [X], khoan lướt đã"); UNCOMFORTABLE TRUTH; CONTRADICTION ("Càng [strength], càng [pain]"); CURIOSITY GAP / OPEN LOOP ("Xem hết sẽ rõ"); WARNING; MIND-READING ("Đúng không?"); or BOLD CLAIM. No slow intros, no "Hôm nay mình nói về…", no logo card.
RETENTION SPINE: every segment ends on a mini open-loop the next one pays off; each beat re-hooks. Use a "NHƯNG / VÌ THẾ" spine between beats (reversal or consequence — never "rồi… rồi…"). Escalate tension to an "aha" reframe, then deliver the promised payoff, then a CTA that LOOPS back to the hook wording + ONE low-effort bait (prefer share bait "Gửi cho người cần nghe điều này", else comment/save bait).
DIALOGUE: SHORT, punchy, natural spoken lines (not literary), ~8-14 words — ONE "đắt giá" line per segment. Talk to "bạn", be hyper-SPECIFIC not generic (a concrete behaviour the viewer secretly does beats an abstract trait), prefer "không phải X mà là Y" reframes, front-load power words (bí mật, sự thật, đừng, tại sao, giấu kín), SHOW don't tell (let the ACTION carry meaning), never lecture or list.
COPYWRITING TECHNIQUES (use them to make each line "đắt"): RULE OF THREE ("đổi việc, đổi đam mê, đổi cả những cuộc tình" > "hay thay đổi"); CHALLENGE THE LABEL ("Người ta bảo bạn [nhãn]. Nhưng sự thật phũ phàng hơn nhiều."); ANTITHESIS ("không phải để chạy trốn — mà để cho đi"); SELF-DOUBT AS QUESTION ("Sao mình không thể yên một chỗ như người ta?"); RHYTHM ngắn–ngắn–dài. QUALITY BAR — a hook like "Người ta bảo bạn cả thèm chóng chán. Nhưng sự thật phũ phàng hơn nhiều đấy." is the level to hit; if a line sounds soft/generic ("bạn có bao giờ thấy cô đơn?"), rewrite it sharper.

Output PLAIN TEXT in EXACTLY this shape (no markdown, no JSON):
TITLE: <catchy title>
CORE MESSAGE: <one-line takeaway>
CHARACTERS: <EVERY person in the story, one per line — name, age, signature look, tone; mark children with "(child)". If the idea/script uses role labels (Chồng/Vợ/Con, Bố/Mẹ…), assign each role ONE consistent given name (e.g. Chồng = Nam) and keep the mapping for the whole script. A solo video simply lists one person.>
SEGMENT 1 [HOOK]:
  IN SCENE: <names of everyone visible in this segment>
  ACTION: <one vivid thing we SEE — a visual metaphor for this beat>
  DIALOGUE:
    <SpeakerName>: "<the exact spoken line>"
    <SpeakerName>: "<the next line, if a short back-and-forth fits this same 10s clip>"
SEGMENT 2 [PROBLEM]:
  IN SCENE: ...
  ACTION: ...
  DIALOGUE:
    <SpeakerName>: "..."
(TURN-TAKING: a short exchange — a question + reply, ~2-3 short lines total — SHOULD share ONE segment as consecutive speaker-tagged DIALOGUE lines so the 10s isn't wasted; they play in order, never overlapping. Keep each labelled line VERBATIM with its real speaker. Only push lines to the NEXT segment when they no longer fit ~9 seconds. Use "VO" as the name for a voiceover line. A single speaker with one line is fine too.)
(PACING AUDIT — MANDATORY before you output: speech runs ~0.4s/word, so a lone 5-8 word line fills only ~2-3s of a 10s clip — that clip is WASTED. Re-scan every segment: if its DIALOGUE is a single line under ~10 words AND it is part of an exchange (a question, a reply, a reaction to the adjacent segment's line), MERGE those lines into ONE segment as 2-3 consecutive turns, and give the freed segment new story value (a new beat of the arc with its own line) — never leave a near-silent 10s clip unless the ACTION itself deliberately carries the moment, e.g. ASMR or a wordless reveal.)
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
  const isCooking = goal === "cooking" || input.genre === "cooking";
  const isFitness = goal === "fitness" || input.genre === "fitness";
  const framework = isNumerology
    ? NUMEROLOGY_FRAMEWORK + numerologyToneDirective(input.numerology_style)
    : isHealth
      ? HEALTH_FRAMEWORK
      : isCooking
        ? COOKING_FRAMEWORK
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
Dialogue language: ${lang} (write ALL dialogue in ${lang}, natural and conversational).${briefBlock}${framework ? `\n${framework}` : ""}

Write the ${segmentCount}-segment script now in the exact output shape from the system prompt. Keep the emotional arc and one short, punchy ${lang} line per segment.`;
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

MARKETING STRUCTURE (always apply):
- HOOK in the first segment (grab attention in 3 seconds).
- Then PROBLEM → SOLUTION → (optional BODY beats) → CTA in the final segment.
- Reset attention every 5-10 seconds with an angle change, push-in, or reveal.

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
- A generated CHARACTER REFERENCE SHEET image (front / 3-4 / side / back + expressions) is attached as a reference to every shot — match it precisely.

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

MATERIAL & SKIN REALISM (this is what kills the "AI/CGI/plastic" look — treat every clip as REAL filmed footage, never a 3D render):
- SKIN: describe real skin — visible pores, fine vellus/facial hair, natural subsurface scattering, subtle moisture/oil sheen, real catchlights and small natural imperfections. NEVER airbrushed, waxy, plastic or beauty-smoothed. Fill each character_lock's "skin_texture" and "eye_details" with these forensic details (this is the #1 fix for fake-looking faces).
- MATERIALS: every object/prop/garment must read true-to-life with its real surface physics. Leather = grain, creases, worn scuffs, real stitching; denim = woven twill weave; metal = brushed/worn with real specular reflections; wood = visible grain; fabric = real thread and drape. Put these into each character_lock's "wardrobe_materials" and describe hero props with the same material honesty — no plastic, toy-like or CGI surfaces.
- LIGHT: physically-based, tied to time-of-day/weather, with soft imperfect shadow edges. Give scene_bible.lighting BOTH Kelvin temperature AND approximate Lux (e.g. "soft overcast dawn key 5200K, ~800 lux"), and set scene_bible.film_grain to a fine organic grain / clean-acquisition token so the filmic texture stays constant across clips.

${contextDnaSystemDigest()}

${lawsSystemDigest()}

ENVIRONMENT ENGINE (locked world archetypes — pick one per segment):
- The system has a library of LOCKED environment archetypes, each a physically-grounded world spec (real materials with surface physics, Kelvin+Lux lighting, atmosphere, micro-details, imperfections, ambient sound bed). When a segment's setting matches one, set that segment's "environment_ref" to the archetype id — the system then injects the full forensic world spec into the Veo prompt automatically, which is what makes the SETTING render real instead of CGI.
${environmentCatalogForPrompt()}
- Rules: pick the id whose world matches the segment's setting and emotional beat (for numerology, prefer archetypes of the number's ngũ hành element). If NO archetype fits the setting you need, set "environment_ref": "custom" and instead write the material physics + Kelvin/Lux + imperfections yourself inside "first_frame_prompt". Cooking videos use warm_home_kitchen for every segment — EXCEPT outdoor/wilderness ASMR cooking, which uses vietnam_highland_cook_spot or vietnam_stream_rock_cook (one of them, same id for ALL segments); fitness ALWAYS modern_gym_daylight. Two consecutive segments in the same location MUST reuse the same environment_ref.

NEGATIVE (forbidden in every image/clip — plain descriptors): warped/changed label or logo text, brand-colour change, extra products or extra people, changed hair/wardrobe/accessories, human hands when the script does not call for them, on-screen text overlays, object/container morphing, teleporting, floating or levitating objects, objects passing through surfaces, deformed liquid, melted food, extra or fused fingers, malformed hands, face morphing, identity drift, plastic/CGI skin.

DIALOGUE (spoken audio in Veo 3 — TURN-TAKING within a 10s clip, never overlapping):
- Veo 3 generates real spoken audio. Write dialogue in the language requested. Keep each spoken line SHORT and natural.
- Put spoken lines ONLY in the dialogue fields. Do NOT quote them inside "motion_prompt" (the system appends them once; repeating makes the character say it twice). In motion_prompt just note WHO speaks WHEN with natural lip movement (e.g. "0-4s Nam speaks; 4-7s Mai replies"), without quoting the words.
- FIT A SHORT EXCHANGE INTO ONE CLIP (this is the key rule — do NOT waste a whole 10s clip on one 3-word line): use the "dialogue_lines" array to place 1-3 SEQUENTIAL turns inside the same 10s clip when they belong to the same beat of conversation. Each turn = { "speaker": exact character_locks name (or "" for voiceover), "text": the line, "start_s": when they start, "end_s": when they finish }.
- HARD SAFETY RULES (a video model CANNOT lip-sync two mouths at once — breaking these causes garbled clips):
  1. TURN-TAKING ONLY, NEVER OVERLAP: turns are strictly sequential — turn N's end_s ≤ turn N+1's start_s. Exactly ONE person's mouth moves at any instant; everyone else has their mouth closed, listening.
  2. FIT THE SECONDS: the whole exchange must finish by ~9s (leave breathing room). Budget realistically at a natural pace — roughly 0.4s per word plus a ~0.5s beat between speakers. A short line like "Thế anh đã vo gạo chưa?" ≈ 2.5s. If the exchange does NOT fit, keep only the turns that fit and PUSH the rest into the NEXT segment — never cram or speed up speech.
  3. MAX 3 turns and MAX 2 distinct speakers per clip (a third speaker like a child interjecting is allowed only as the LAST short turn). More than that → split across segments.
  4. FACE-ON-CAMERA: whoever is speaking in a turn must have their face in medium-close/close-up during their start_s-end_s window; the motion_prompt and the beats must move the camera to the active speaker for each turn (a gentle pan/reframe between speakers, still ONE continuous take — no hard cut).
  5. "characters_in_scene" must include every speaker; a voiceover speaker ("") is heard but not shown.
  6. SPEAK-WHILE-STILL (critical — the video model reassigns a line to whichever stable face is on camera if the named speaker is mid-action): a character NEVER delivers a line while performing a large body action (standing up, sitting down, walking, turning away, bending). Choreograph big movements into the GAPS between turns: move first THEN speak from a stable pose, or speak first THEN move. Small gestures while speaking are fine (a nod, lifting a spoon).
  7. ONE SHARED CLOCK: the second-by-second timing in "motion_prompt" MUST use the exact same clock as the dialogue_lines start_s/end_s — the action described at second X must be what is physically happening while the line at second X plays (e.g. if Minh speaks 4-6s, the motion at 4-6s shows Minh stable and facing camera, NOT walking). Never write a motion timeline that contradicts the dialogue windows.
  8. QUIET WINDOW: never schedule a line during a loud or major physical event (a crash, a fall, an impact, something breaking) — even if the speaker themselves is standing still. A reaction line starts AFTER the event has fully finished (e.g. the rack topples 5-7s → the wry comment starts at ~7.5s), so the voice is never buried under the event and the camera can be on the speaker's face.
- SINGLE-LINE CLIPS: if a beat is just one line, you may use "dialogue_lines" with one entry OR the plain "dialogue"+"speaker" fields — both work. For a longer monologue that fills the clip, one speaker is correct.
- Mirror the FIRST turn into the top-level "dialogue" (its text) and "speaker" (its name) for compatibility.

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
  const isCooking = goal === "cooking" || input.genre === "cooking";
  const isFitness = goal === "fitness" || input.genre === "fitness";
  const numerologyBlock = isNumerology
    ? `\n${NUMEROLOGY_FRAMEWORK}${numerologyToneDirective(input.numerology_style)}`
    : isHealth
      ? `\n${HEALTH_FRAMEWORK}`
      : isCooking
        ? `\n${COOKING_FRAMEWORK}`
        : isFitness
          ? `\n${FITNESS_FRAMEWORK}`
          : "";

  const dialogueLanguage = input.dialogue_language ?? "Vietnamese";
  // OUTDOOR ASMR cooking is voiceless by design — the framework's ASMR mode
  // overrides the forced-dialogue requirement.
  const asmrDialogueException = isCooking
    ? ` EXCEPTION: if the OUTDOOR/WILDERNESS ASMR MODE of the cooking framework is active (idea/setting mentions ngoài trời/núi/suối/wilderness), "dialogue" and "speaker" MUST be empty strings for every segment — audio is 100% diegetic ASMR, no voiceover.`
    : "";
  const dialogueBlock =
    input.force_dialogue === false
      ? `\nDialogue: optional. When a segment has a spoken line, write it in ${dialogueLanguage}.${asmrDialogueException}`
      : `\nDialogue: REQUIRED. EVERY segment MUST have a non-empty "dialogue" line spoken in ${dialogueLanguage} (natural, conversational ${dialogueLanguage} — not translated word-for-word). Keep each line short (about 5-12 words). Put the line ONLY in the "dialogue" field — do NOT quote it inside the "motion_prompt" (the system appends it once; repeating it makes the character say it twice).${asmrDialogueException}`;

  // Example beat list sized to the requested count.
  const beatExample = Array.from({ length: beatsPerSegment }, (_, i) => {
    const cams = ["[WIDE] ...", "[CLOSE] ...", "[OTS] ...", "[LOW] ...", "[POV] ..."];
    return `        { "beat": "framing ${i + 1}: the camera reframes the SAME continuous action", "camera": "${cams[i] ?? "[EYE] ..."}" }`;
  }).join(",\n");

  return `Create a chained-segment storyboard for this short video.

Story / Product Idea: ${input.story_idea}
Video Goal: ${goal} — ${goalGuidance}
Genre: ${input.genre}
Visual Style: ${input.style}
Number of 10-second SEGMENTS: ${segmentCount} (total ≈ ${segmentCount * 10} seconds)
Beats per segment: ${beatsPerSegment} progressive camera framings of ONE continuous action inside each 10s clip${scriptBlock}${productBriefBlock}${storyBriefBlock}${numerologyBlock}${dialogueBlock}${characterBlock}${settingBlock}${toneBlock}${customBlock}

Produce EXACTLY ${segmentCount} segments. Each segment = ONE continuous 10s take showing a SINGLE primary action, filmed as EXACTLY ${beatsPerSegment} progressive camera framings (${beatsPerSegment} beats) of that SAME ongoing action — smooth reframes (push-in, pan, angle change), NOT hard cuts to separate shots. Each beat covers a distinct time-frame inside the unbroken 10 seconds while the subject, props and physics stay continuous. Segment 1 must HOOK. The last segment must contain the CTA. CRITICAL CHAINING RULE: the visual state at the END of segment N (pose, position, expression, camera) must EQUAL the opening moment described in segment N+1's "first_frame_prompt", so the generated clips join into one continuous story with no jumps. The "motion_prompt" must describe that ONE continuous action across the 10s with rough timing (split 10s across the beats, e.g. "0-3s ...; 3-6s ...; 6-10s ..."), using slow, deliberate, specific motion verbs (body part + verb + manner) and SMOOTH, minimal camera moves only, plus an explicit final state that matches the next segment's first_frame_prompt. Keep ONE primary action per clip — never stack multiple or simultaneous actions, which causes morphing and teleporting. NOTE: the system auto-wraps each motion_prompt with the full character + product description, the style tokens, a physics directive, the spoken line and a negative list — so do NOT repeat identity details, a physics clause, the dialogue text or a negative list inside the motion_prompt. Restate the main character's visual attributes (from character_locks) inside every first_frame_prompt so the keyframe stays on-model; inside the motion_prompt use only a SHORT one-phrase anchor that it is the same character. Describe them as a character by appearance — never as "the same real person", "their real face", "same identity", or "strictly follow the reference images".

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
  "product_dna": "string or null — if there is a hero product: exact shape, material, colours WITH RGB hex, label/logo text+colour, cap/parts; else null",
  "segments": [
    {
      "segment_number": 1,
      "duration_seconds": 8,
      "title": "string — short segment title",
      "marketing_role": "hook|problem|solution|body|cta",
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
      "continuity_note": "string — how this segment visually continues from the previous segment (for segment 1 write 'opening shot')"
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
    ? `PREVIOUS SEGMENT #${prev.segment_number} (UNCHANGED — your segment must open exactly where it ends):\n- Its motion_prompt (the END STATE described at its end is your opening moment): ${prev.motion_prompt}\n- Its first_frame_prompt: ${prev.first_frame_prompt}`
    : "This is the FIRST segment (the HOOK — it must stop the scroll; continuity_note = 'opening shot').";
  const nextBlock = next
    ? `NEXT SEGMENT #${next.segment_number} (UNCHANGED — your segment must END in the exact state its first_frame_prompt opens with):\n- Its first_frame_prompt: ${next.first_frame_prompt}\n- Its first dialogue line: ${next.dialogue ?? "(none)"}`
    : "This is the LAST segment (it carries the CTA).";

  return `REWRITE EXACTLY ONE SEGMENT of an existing storyboard. The user edited this segment's dialogue turns in the editor, so its action/beats/timing no longer match — re-choreograph the WHOLE segment around the new turns. Everything else in the video is already approved and stays untouched.

FULL CAST (character_locks — use these EXACT names):
${castBlock || "- (voiceover only)"}

SCENE BIBLE (identical in every clip): ${breakdown.scene_bible ? `${breakdown.scene_bible.lens}; ${breakdown.scene_bible.lighting}; ${breakdown.scene_bible.backdrop}; ${breakdown.scene_bible.color_grade}` : "n/a"}
Visual style: ${input.style} · Genre: ${input.genre} · Dialogue language: ${dialogueLanguage}${worldContextLockBlock(breakdown.world_context) ? `\n${worldContextLockBlock(breakdown.world_context).trim()}` : ""}

${prevBlock}

${nextBlock}

THE SEGMENT TO REWRITE — #${seg.segment_number} "${seg.title}" (marketing_role: ${seg.marketing_role}, duration: ${seg.duration_seconds || 10}s, environment_ref: ${seg.environment_ref ?? "custom"}):
Current first_frame_prompt: ${seg.first_frame_prompt}
Current motion_prompt (STALE — written before the dialogue changed): ${seg.motion_prompt}

LOCKED DIALOGUE TURNS (the user's final text — copy each line VERBATIM, same speaker, same order; do NOT add, drop, reword or reassign any line):
${turnsBlock}

REWRITE RULES:
1. Re-time the turns realistically (~0.4s per word + ~0.5s beat between speakers), strictly sequential and non-overlapping, finished by ~9s. Fill "dialogue_lines" with start_s/end_s for every turn; mirror turn 1 into "dialogue" and "speaker".
2. Rewrite "motion_prompt" (70-110 words) as ONE continuous take whose physical action and camera are choreographed AROUND those timed turns: during each turn's window the camera holds the active speaker's face in medium-close/close-up with natural lip movement (gentle pan/reframe between speakers — never a hard cut), listeners keep their mouths closed and react. SPEAK-WHILE-STILL: a speaker NEVER performs a large body action (standing up, walking, turning away) during their own line — schedule big movements into the GAPS between turns, and while a line plays its speaker holds a stable pose facing camera. The motion timeline MUST use the same clock as the turn windows (the action at second X is what happens while the line at second X plays). Time left before/after/between the turns must be filled with meaningful physical action that advances the story — never dead air. CAUSAL CHAIN: write every object interaction as the full visible chain (hand reaches → fingers grip a named part → carried along one continuous path → released), never let an object appear in a hand; every effect (something falls/tips/spills) must be PRECEDED by its visible physical cause making contact; the whole clip stays in ONE location. PROP EXISTENCE: every object the motion uses must be planted in the first_frame_prompt start state (held, worn or placed) — update the first_frame_prompt if the new action needs a prop it doesn't mention. QUIET WINDOW: no line plays during a loud/major physical event — a reaction line starts only after the event has finished. Do NOT quote the spoken words inside motion_prompt.
3. Rewrite the "beats" (EXACTLY ${beatsPerSegment} beats) as the progressive camera framings of that one continuous action, aligned with the turn windows.
4. Update "first_frame_prompt" only as needed (same location/lighting; restate the present characters' looks from character_locks). Set "characters_in_scene" to the EXACT lock names visible — every speaker with a non-empty name must be included.
5. HARD CONSTRAINTS: keep "segment_number" = ${seg.segment_number}, "duration_seconds" = ${seg.duration_seconds || 10}, "marketing_role" = "${seg.marketing_role}", "environment_ref" = "${seg.environment_ref ?? "custom"}". Open from the previous segment's end state and close on the next segment's opening state (write that exact final state at the end of motion_prompt; update "continuity_note" accordingly).

Return ONLY the rewritten segment as ONE JSON object with the exact segment structure (segment_number, duration_seconds, title, marketing_role, beats[], first_frame_prompt, motion_prompt, dialogue, speaker, dialogue_lines[], characters_in_scene[], environment_ref, continuity_note) — no wrapper, no markdown, no prose.`;
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

export type RefRole = "face" | "product" | "setting" | "character_sheet" | "anchor" | "character";

export interface RefDescriptor {
  role: RefRole;
  /** Optional vision-derived description that reinforces the photo. */
  description?: string;
  /** For role "character": the exact name of the person in this photo, so the
   * model binds the right face to the right named character in a 2-3 person scene. */
  name?: string;
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
        return `• CHARACTER "${r.name ?? "person"}" — one attached portrait references the look of ${r.name ?? "this character"}${d}. Keep ${r.name ?? "their"} face, hair and skin tone consistent across every shot as an ORIGINAL FICTIONAL character (not a real or famous person). Bind this look to ${r.name ?? "this character"} ONLY — do NOT swap, merge or blend it with the other character(s).`;
      case "product":
        return `• THE PRODUCT — feature the EXACT product shown in the attached product photo${d}. Keep its EXACT shape, silhouette, colour, material, proportions, handle/parts and branding identical in every single shot. Do NOT redesign, recolour, distort, resize, age, damage or swap it for a different object.`;
      case "setting":
        return `• THE LOCATION — keep every scene in the same location shown in the attached interior photo${d}. Match its layout, colours, furniture and key props; keep it consistent across all shots.`;
      case "anchor":
        return `• WARDROBE & LOOK ANCHOR — the attached already-approved storyboard frame shows the character in the EXACT outfit, hairstyle and accessories to use. Copy the clothing (type, cut and colours) and every accessory (watch, glasses if any) EXACTLY in this board. Do NOT change the outfit — never switch to a suit, jacket, apron or a different shirt unless it appears in this anchor. It is the SAME character.`;
      default:
        return `• Reference — keep it consistent.`;
    }
  });
  return `You are given reference photos. Use them as APPEARANCE REFERENCES to build ORIGINAL FICTIONAL characters (ordinary, made-up people — NOT real, famous or recognisable public figures). Do NOT output a copy of any reference photo; RE-CREATE new cinematic scenes with a consistent look (consistent character, same product, same place). Follow them:\n${lines.join("\n")}\n\n`;
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

  return `${refBlock}Professional CHARACTER REFERENCE SHEET, single horizontal image, clean light studio background.

CHARACTER — ${c.name}: ${c.gender_age}, ${c.build} build, ${c.skin_tone} skin, ${c.hair} hair, ${c.eyes} eyes. Wearing ${c.costume}. ${c.signature_features}.
${c.dna ? `FORENSIC DNA (exact colours, keep identical everywhere): ${c.dna}.\n` : ""}${tokens ? tokens + "\n" : ""}
EXACT LAYOUT (all in one image):
■ LEFT ZONE: Large FULL BODY hero pose, ${c.default_expression} expression, head to toe.
■ CENTER: "TURNAROUND" — 4 full-body views: FRONT, 3/4, SIDE, BACK; same scale, neutral pose, evenly lit, labeled.
■ TOP-RIGHT: "EXPRESSIONS" — 6 head portraits 3×2 grid: HAPPY, CALM, SURPRISED, CONFIDENT, THOUGHTFUL, FRIENDLY.
■ BOTTOM-RIGHT: "COLOR PALETTE" — 6 circular swatches: ${colorSwatches}.

${directive}

RULES: it must be the SAME individual in every zone with identical face; small bold labels; one cohesive image. ${SHARED_NEGATIVE}`;
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

  // CHARACTER REFERENCE: the references must be LARGE and legible so an
  // image-to-video model (Veo) can actually read the identity. One full-body
  // FRONT view + waist-up (half-body) angle views — never tiny distant heads.
  const EXPRESSION_HEADS = ["calm neutral", "natural friendly smile", "confident"];
  const expCount = Math.min(3, Math.max(0, params.referenceExpressions ?? 0));
  const expClause =
    expCount > 0
      ? ` Add ${expCount} more WAIST-UP expression view${expCount > 1 ? "s" : ""} (${EXPRESSION_HEADS.slice(0, expCount).join(", ")}) with the SAME identical face — only the expression changes.`
      : ` Keep a neutral relaxed expression on every reference view; do NOT add extra emotional head shots (per-shot emotion is driven by the action captions).`;
  // CAST-SYNC: multi-character boards render one labelled reference column per
  // PRESENT character (name badge on each), and lock the panels to exactly
  // that cast — this is what stops "ghost people" and face/wardrobe swapping.
  const cast = params.presentCharacters ?? [];
  const isMultiCast = cast.length > 1;
  const refStrip = isMultiCast
    ? `reference portraits for EACH of the ${cast.length} characters in this shot, grouped per person and clearly LABELLED with their NAME: ${cast
        .map(
          (c) =>
            `— "${c.name.toUpperCase()}"${c.isChild ? " (CHILD — small child proportions, correct age)" : ""}: one FULL-BODY FRONT view + one WAIST-UP 3/4 view, face sharp and readable`
        )
        .join("; ")}. Keep every person's face/hair/wardrobe identical to their description.`
    : `LARGE, clearly-visible reference portraits of THE SAME main character — big enough that the face and clothing read clearly, NOT small distant thumbnails: (1) one FULL-BODY FRONT view, head to toe, standing naturally; and (2) two WAIST-UP (half-body) views — a 3/4 angle and a side profile — each showing the face sharply and at good size.${expClause}`;
  const castDescription = isMultiCast
    ? cast.map((c) => `${c.name}${c.isChild ? " (child)" : ""}: ${c.description}`).join(" | ")
    : params.characterDescription;
  const castLock = isMultiCast
    ? ` CAST LOCK: the scene overview and every action panel contain EXACTLY these ${cast.length} characters — ${cast
        .map((c) => c.name)
        .join(", ")} — and NOBODY else; no extra people, no duplicates of a character in the same panel; every action caption names WHO does the action; relative heights stay true (a child is clearly smaller than the adults).`
    : "";

  return `${refBlock}SHOT ${params.segmentNumber} — a complete STORYBOARD BOARD for ONE ~10 second video clip, presented as ONE single horizontal image. This board gives an image-to-video model (Veo) full context: who the character${isMultiCast ? "s are" : " is"} (from every angle), what the scene looks like${hasProduct ? ", the product" : ""}, and the ${target} actions that happen across the 10 seconds. ${params.style} style.

THE BOARD CONTAINS THESE ZONES IN ONE IMAGE:

■ TOP-LEFT — "CHARACTER REFERENCE" block (REPEAT THIS IN EVERY SHOT, make it prominent and reasonably large): ${refStrip} Label "CHARACTER REF". Character${isMultiCast ? "s" : ""}: ${castDescription}.${castLock}

■ "SCENE OVERVIEW": one larger establishing panel showing the full location/environment of this shot (wide angle)${hasProduct ? ", with the product clearly visible on a surface" : ""}. ${hasSetting ? "CRITICAL: reproduce the EXACT location from the attached interior reference photo — the SAME cabinet style & colour, wall, tiles, countertop, window, appliances and overall layout. Do NOT invent or restyle a different kitchen. Keep this SAME room even in 'before/problem' shots — only the pan/food/props state changes, never the kitchen itself. This identical location must also appear behind every action panel." : "This tells Veo the setting."}

■ RIGHT / BOTTOM — "ACTION SEQUENCE": ${target} numbered action panels (${numberLabels}) laid out left → right showing the ${target} key moments across the 10 seconds, each a small ${isPhotoStyle(params.style) ? "PHOTOGRAPHIC cinematic still (a real photo frame — not a drawing or illustration)" : `${params.style} illustration`} with a SHORT caption under it describing the action:
${panelLines}

SCENE CONTEXT for all panels: ${params.firstFramePrompt}
${params.productDna ? `PRODUCT DNA (identical in every panel, with exact colours): ${params.productDna}\n` : ""}${params.ingredients ? `NAMED INGREDIENTS (show each clearly and write its NAME label next to it): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}
${continuity}
${directive}

RULES: ONE cohesive board image; ${isMultiCast ? `each of the ${cast.length} named characters keeps an IDENTICAL face, hair and the EXACT SAME outfit + accessories everywhere they appear (ref block, scene overview, every action panel) — never re-dress or swap faces between characters, and ONLY the named cast appears` : "the SAME individual (identical face, hair, and the EXACT SAME outfit + accessories — same shirt, trousers, watch; NEVER a suit, jacket, apron or different clothes)"} AND the SAME product appear in the character-ref block, the scene overview and all ${target} action panels;${params.preserveRealFace ? " match the man's eyewear to his reference portrait EXACTLY — if he is NOT wearing glasses in the photo, do NOT add glasses anywhere; if he is, keep the same ones;" : ""} ${hasSetting ? "the SAME exact kitchen/location from the interior reference photo" : "one single consistent location"} for this whole board; thin clean dividers and small numbered badges; captions short and legible. ${SHARED_NEGATIVE}`;
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
${envBlock}${params.productDna ? `PRODUCT (exact, unchanged, with colours): ${params.productDna}\n` : ""}${params.ingredients ? `PROPS / INGREDIENTS (show clearly by name): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}${directive}

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
  style: string;
  colorPalette?: string[];
  dialogueLanguage?: string;
  /** Real reference photo governs the face — hard photoreal + identity lock. */
  preserveRealFace?: boolean;
}): string {
  const maxPanels = Math.min(params.segments.length, 12);
  const panels = params.segments.slice(0, maxPanels);
  const cols = maxPanels <= 4 ? 2 : 3;
  const rows = Math.ceil(maxPanels / cols);
  const lang = params.dialogueLanguage ?? "Vietnamese";

  const panelLines = panels
    .map((s) => {
      const action = s.action.length > 90 ? s.action.slice(0, 90) + "..." : s.action;
      const line = s.dialogue
        ? s.dialogue.length > 70
          ? s.dialogue.slice(0, 70) + "..."
          : s.dialogue
        : "—";
      return `Panel ${s.segment_number} — Action: ${action} | Dialogue (${lang}): "${line}"`;
    })
    .join("\n");

  const charDesc =
    params.characterDescription.length > 300
      ? params.characterDescription.slice(0, 300) + "..."
      : params.characterDescription;

  const colorBlock =
    params.colorPalette && params.colorPalette.length > 0
      ? params.colorPalette.slice(0, 6).join(", ")
      : "#F5E6D3, #8B4513, #2D5016, #FFFFFF, #1A1A1A";

  return `Professional production STORYBOARD DOCUMENT, ONE single horizontal image, clean white/light background, agency-quality layout with two zones:

◀ LEFT COLUMN (about 1/4 width) — "CHARACTER REFERENCE SHEET":
- Header text "CHARACTER REFERENCE SHEET".
- FULL BODY: 3 standing turnaround views (front, side, back) of the character.
- CLOSE UP / PORTRAIT: 3 head studies at different angles.
- COLOR PALETTE: small circular swatches: ${colorBlock}.
${params.characterName ? `- Small profile block with the name "${params.characterName}".` : ""}

▶ RIGHT ZONE (about 3/4 width) — "STORYBOARD — ${params.title.toUpperCase()}":
- Grid of ${maxPanels} panels, ${cols} columns × ${rows} rows, thin clean borders, numbered badge (01, 02, ...) in each panel's top-left corner.
- Each panel: a ${isPhotoStyle(params.style) ? "PHOTOGRAPHIC cinematic still of that moment (a real photo frame — NOT a drawing, NOT an illustration)" : `${params.style} illustration of that moment`}, and BELOW the picture a small white caption band with two labeled lines of text:
  "Action:" the action description, then "Lời thoại:" the spoken ${lang} line in quotes.

CHARACTER (THE SAME individual in the reference column AND every storyboard panel — identical face, hair, outfit): ${charDesc}

THE ${maxPanels} PANELS:
${panelLines}

Metadata footer: "${params.totalDuration}s • ${maxPanels} shots • ${params.moodTags.slice(0, 3).join(" • ")}".

${renderDirective(params.style, params.preserveRealFace ?? false)}

RULES: ONE cohesive document image; same character everywhere — the reference column and EVERY panel show the SAME person with an identical face (never a different face, never a redrawn/cartoon face); ${isPhotoStyle(params.style) ? "photographic realism for both the reference column and all panel stills" : `${params.style} style for the panel art`}; caption text small, clean and legible; no watermark. ${SHARED_NEGATIVE}`;
}

// ─── Step 5: Video Assembly Guide (text for Veo / Seedance) ─────────────────

/**
 * Composes the full, long, ready-to-paste Veo prompt for ONE clip:
 * reference-lock preamble + the model's motion prompt + the spoken line +
 * a negative list. Used both per-card (copy button) and in the text guide.
 */
export function buildSegmentVeoPrompt(params: {
  characterDescription: string;
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
}): string {
  const lang = params.dialogueLanguage ?? "Vietnamese";
  const clean = (s?: string) => (s ?? "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // SELF-CONTAINED prompt: repeat the FULL character + scene + style in EVERY
  // clip so Veo renders correctly from the uploaded character PHOTO — no need to
  // pre-generate a per-scene keyframe. The attached photo only locks the
  // face/wardrobe; the scene is built from the text below.
  const lead =
    "Keep the main character visually consistent across every shot, matching the attached reference photo — an ordinary, original person (not a specific real individual). Create ONE continuous, cinematic 10-second shot in the scene described below; build the described setting, do NOT copy the photo's own background. Every word of this prompt is an INTERNAL production instruction — the rendered frame must contain NO readable text of any kind (no subtitles, captions, labels, spec cards, watermarks or numbers).";
  const character = ` Main character: ${clean(params.characterDescription)}.`;
  // TẦNG 0 — the locked world every entity in this clip must belong to.
  const contextLock = worldContextLockBlock(params.worldContext);
  // The scene doubles as the clip's START STATE: planting props here is what
  // stops objects materialising mid-clip (the jacket-teleport bug).
  const setting = params.setting
    ? ` SCENE (START STATE — everything and everyone described here exists on screen from the very first frame; every object the MOTION uses must already be present — held, worn or placed — objects never appear from nowhere mid-clip): ${clean(params.setting)}.`
    : "";
  // Locked world spec (materials/Kelvin+Lux/atmosphere/imperfections) — the
  // veoflow-web environment payload that makes the SETTING render real.
  const env = resolveEnvironment(params.environmentRef, params.setting);
  const envBlock = env ? ` ${renderEnvironmentBlock(env)}` : "";
  const product = params.productDescription
    ? ` PRODUCT (keep its exact shape, colour, material and branding): ${clean(params.productDescription)}.`
    : "";
  const ing = params.ingredients ? ` INGREDIENTS (show and name each): ${clean(params.ingredients)}.` : "";
  // Style tokens are camera/render settings — flag them as internal so Veo
  // never draws "50mm / 4300K / 600 lux" as a spec card on the frame (it did).
  const tokens = params.sceneBible
    ? ` ${sceneBibleTokens(params.sceneBible)} (These style values are internal camera settings — NEVER display them as text on screen.)`
    : "";
  const palette =
    params.colorPalette && params.colorPalette.length > 0
      ? ` Colour palette: ${params.colorPalette.join(", ")}.`
      : "";
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
      ? ` ON SCREEN: exactly ${onScreen.length} character${onScreen.length > 1 ? "s" : ""} — ${onScreen.join(", ")} — and NOBODY else; no extra people in frame or background.${absent.length > 0 ? ` ${absent.join(", ")} ${absent.length > 1 ? "are" : "is"} NOT in this scene and must not appear, not even in the background or as a reflection.` : ""}`
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
    // LINE OWNERSHIP + STILLNESS: Veo reassigns a line to whichever face is
    // stable on camera if the named speaker is mid-action (standing up,
    // walking) during their window — so bind each line hard to its owner and
    // freeze the big action while the mouth moves.
    const ownership = ` LINE OWNERSHIP (STRICT): every line above belongs ONLY to its named speaker — NEVER let a different character say it, never move another character's mouth to it, and never swap voices between characters (${speakersInTurns.length > 1 ? `${speakersInTurns.join(" and ")} have different voices — each line uses its owner's voice and face` : "the line stays with its owner"}). SPEAK-WHILE-STILL RULE: during each line's time window its speaker HOLDS a stable pose, face toward camera, and delivers the line with clear lip-sync — any large body action (standing up, sitting down, walking, turning away) happens in the GAPS between lines, never during a line. If the MOTION timing and these DIALOGUE windows disagree, the DIALOGUE windows win — shift the action beats to fit around them.`;
    spoken = ` DIALOGUE (turn-taking, ONE person speaks at a time, never overlapping; the camera is on whoever is speaking, their face in medium-close, mouth moving with exact lip-sync; the others keep mouths closed): ${lines}. All lines in ${lang}, AUDIO ONLY — absolutely NO subtitles, captions or on-screen text.${listenerNote}${ownership}`;
  } else if (turns.length === 1) {
    const t = turns[0]!;
    const nm = (t.speaker ?? "").trim();
    if (!nm && !speaker) {
      // Genuine VOICEOVER clip: the line is off-screen narration — if we say
      // "the character speaks", Veo lip-syncs it through an on-screen face.
      const vt = params.speakerVoice ? ` (narrator voice: ${params.speakerVoice} — heard from off-screen only)` : "";
      spoken = ` VOICEOVER${vt}, off-screen narration in ${lang}: "${(t.text ?? "").trim()}" — NOBODY on screen moves their mouth or lips during this narration; every visible character keeps the mouth fully closed. AUDIO ONLY — absolutely NO subtitles, NO captions, NO burned-in text of these words on screen.`;
    } else {
    const label = nm || speakerLabel;
    const vt = nm ? voiceOf(nm) || (params.speakerVoice ? ` (voice: ${params.speakerVoice})` : "") : params.speakerVoice ? ` (voice: ${params.speakerVoice})` : "";
    const others = (onScreen.length > 0 ? onScreen : allNames).filter((n) => n !== nm);
    const silence =
      nm && others.length > 0
        ? ` Only ${nm} speaks; the other character${others.length > 1 ? "s" : ""} (${others.join(", ")}) stay silent and listen with mouths closed.`
        : "";
    spoken = ` ${label}${vt} speaks to camera with natural mouth movement and accurate lip-sync — the voice emanates from ${nm ? `${nm}'s` : "the speaker's"} mouth — saying in ${lang}: "${(t.text ?? "").trim()}" — delivered as AUDIO ONLY (voice + lip-sync); absolutely NO subtitles, NO captions, NO burned-in text of these words on screen.${silence} While delivering the line, ${nm || "the speaker"} HOLDS a stable pose with the face toward camera — any large body action (standing up, walking, turning away) happens before or after the line, never during it; the line is NEVER reassigned to another character.`;
    }
  }
  const audio = params.ambientAudio ? ` AMBIENT SOUND: ${clean(params.ambientAudio)}.` : "";
  return `${lead}${character}${castLine}${contextLock}${setting}${envBlock}${product}${ing}${tokens}${palette} MOTION: ${clean(params.motionPrompt)}${spoken}${audio} ${veoConciseTail(!!params.productDescription)}`;
}

export function buildVideoPromptText(params: {
  title: string;
  characterDescription: string;
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
        setting: s.setting,
        productDescription: params.productDescription,
        ingredients: params.ingredients,
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
  ▶ FULL PROMPT TO PASTE into Veo/Seedance image-to-video (attach your CHARACTER PHOTO as the reference):
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
${params.characterDescription}
Use the generated CHARACTER REFERENCE SHEET as a reference image in every clip so the appearance and wardrobe stay consistent.

## Setting
${params.setting}
Color palette: ${params.colorPalette.join(", ")}

## HOW TO BUILD THE VIDEO (seamless chaining)
Each shot has TWO images: (a) a CLEAN KEYFRAME — one single photographic scene — and (b) a multi-panel STORYBOARD BOARD (character angles + scene + captioned action sequence).
TIP: for the SHARPEST, most on-model character, feed Veo the CLEAN KEYFRAME as the start frame. The multi-panel board also works as a storyboard reference, but because the character appears small and repeated across panels the face can come out softer.
1. For each shot, upload its image (the clean keyframe is recommended) to Veo/Seedance (image-to-video) as the START frame, then paste that shot's motion prompt. Set aspect ratio ${params.aspectRatio}.
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
  "resembling a real or famous person, celebrity likeness, public-figure lookalike, real identifiable individual, morphing, warping, teleporting, floating or levitating objects, duplicated or doubled objects, extra or fused fingers, malformed or mutated hands, extra or missing limbs, limbs bending or passing through objects, the face changing, identity drift, age shifting, changed hair/wardrobe/accessories, warped or altered label/logo text, brand-colour change, extra people, objects passing through solid surfaces, deformed food or liquid, melting, jittery or stuttering motion, mid-clip jump cuts, on-screen text, captions, subtitles, burned-in dialogue text, title cards, karaoke or lyric text, translation text, camera or lens spec overlay, technical readout or HUD, info card in a corner, exposure/Kelvin/lux/timecode text, any readable letters numbers or typography anywhere in the frame, watermark, channel logo, plastic or CGI skin";

interface VeoJsonOptions {
  aspectRatio: string;
  dialogueLanguage?: string;
  /** Genre-appropriate ambient sound (kitchen sizzle, gym energy, …). */
  ambientAudio?: string;
}

/**
 * Build a structured Veo-3.1 JSON project from a finished breakdown. Returns a
 * plain object (caller serialises it). Every clip carries structured fields
 * (scene / subject / shot / timeline / dialogue / negative) PLUS a flattened
 * self-contained `prompt` string for users who paste plain text.
 */
export function buildVeoJson(
  breakdown: StoryboardGenerationOutput,
  opts: VeoJsonOptions
): Record<string, unknown> {
  const oneLine = (s?: string | null) =>
    (s ?? "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  const lang = opts.dialogueLanguage ?? "Vietnamese";
  const locks = breakdown.character_locks ?? [];
  const clipSeconds = 10;

  const characters = locks.map((l) => ({
    name: l.name,
    gender: l.gender ?? "",
    is_child: !!l.is_child,
    // TẦNG 9: full locked voice profile (never a bare reference).
    voice: oneLine(l.voice) || defaultVoiceFor(l.gender, l.is_child),
    appearance: [l.gender_age, l.build, l.skin_tone, l.hair, l.eyes]
      .map((x) => oneLine(x))
      .filter(Boolean)
      .join(", "),
    // Forensic realism locks (ported from veoflow-web) — keep skin/eyes/materials
    // real, not CGI, across every clip.
    skin_texture: oneLine(l.skin_texture),
    eye_details: oneLine(l.eye_details),
    wardrobe: oneLine(l.costume),
    wardrobe_materials: oneLine(l.wardrobe_materials),
    signature_features: oneLine(l.signature_features),
    default_expression: oneLine(l.default_expression),
    dna: oneLine(l.dna),
  }));

  const sb = breakdown.scene_bible;

  const clips = breakdown.segments.map((seg) => {
    const beats = Array.isArray(seg.beats) ? seg.beats : [];
    const n = Math.max(1, beats.length);
    // Split the 10s clip evenly across the beats so each gets a timecode.
    const timeline = beats.map((b, i) => {
      const start = Math.round((i * clipSeconds) / n);
      const end = Math.round(((i + 1) * clipSeconds) / n);
      return {
        time: `${start}-${end}s`,
        camera: oneLine(b.camera),
        action: oneLine(b.beat),
      };
    });
    const speaker = oneLine(seg.speaker) || characters[0]?.name || "";
    // Locked world spec for this clip (veoflow-web environment master_state).
    const env = resolveEnvironment(seg.environment_ref, seg.first_frame_prompt);
    const onScreen = (seg.characters_in_scene ?? []).map((n) => oneLine(n)).filter(Boolean);
    const voiceFor = (nm: string) => characters.find((c) => c.name === nm)?.voice ?? null;
    // TẦNG 9 turn-taking: timed, non-overlapping spoken turns (each with its
    // locked voice) so a short exchange fits one clip.
    const turns = (seg.dialogue_lines ?? []).filter((t) => oneLine(t.text));
    const dialogueLines =
      turns.length > 1
        ? turns.map((t) => {
            const nm = oneLine(t.speaker);
            return {
              speaker: nm || "VOICEOVER (off-screen narration — no on-screen mouth moves)",
              line: oneLine(t.text),
              start_s: t.start_s ?? null,
              end_s: t.end_s ?? null,
              voice: nm ? voiceFor(nm) : null,
            };
          })
        : null;
    return {
      id: seg.segment_number,
      role: seg.marketing_role,
      duration_seconds: seg.duration_seconds ?? clipSeconds,
      scene: oneLine(seg.first_frame_prompt),
      characters_in_scene: onScreen.length > 0 ? onScreen : null,
      environment: env ? environmentToJson(env) : null,
      subject: speaker ? `${speaker} (keep identical to continuity.characters)` : "the main character",
      shot: {
        camera_motion: "one continuous take — a single slow, smooth camera move (push-in / pan / orbit); no hard cuts",
        framing: timeline.length ? timeline.map((t) => t.camera).filter(Boolean).join(" → ") : "",
      },
      timeline,
      action: oneLine(seg.motion_prompt),
      dialogue: seg.dialogue
        ? {
            speaker,
            language: lang,
            line: oneLine(seg.dialogue),
            // TẦNG 9: bind the locked voice to the line (anti voice-swap).
            voice: voiceFor(speaker),
            // Multi-speaker turn-taking (null when the clip is single-speaker).
            turns: dialogueLines,
            turn_taking: dialogueLines
              ? "sequential, non-overlapping, camera on active speaker; STRICT line ownership — each line is spoken ONLY by its named speaker (never reassigned to another character, voices never swapped); while a line plays its speaker holds a stable pose facing camera — large body actions (standing up, walking, turning) happen in the gaps between lines, never during a line; dialogue windows override the motion timeline on any conflict"
              : null,
            lip_sync: true,
            subtitles: false,
          }
        : null,
      audio: opts.ambientAudio
        ? `${opts.ambientAudio}; plus the spoken dialogue; no on-screen text`
        : env
          ? `ambient bed (constant across clips in this location): ${env.sound_bed}; plus the spoken dialogue; no music bed drowning the voice; no on-screen text`
          : "spoken dialogue only with natural ambient sound; no music unless noted; no on-screen text",
      continuity_from_previous: oneLine(seg.continuity_note),
      negative_prompt: VEO_NEGATIVE_LIST,
      // Flattened, fully self-contained prompt (text mode fallback).
      prompt: oneLine(seg.full_prompt ?? seg.motion_prompt ?? ""),
    };
  });

  return {
    version: "veo-3.1",
    // TẦNG 0 — the locked world context every clip must belong to
    // (Context-Locked Video DNA: open during design, locked during generation).
    locked_world_context: breakdown.world_context ?? null,
    // The frozen 9-layer constitution these prompts were compiled under.
    production_laws: lawsForVeoJson(),
    output: {
      aspect_ratio: opts.aspectRatio,
      duration_seconds_per_clip: clipSeconds,
      fps: 24,
      total_clips: clips.length,
    },
    reference_image:
      "Attach the SAME uploaded character photo as the identity reference in EVERY clip. Do NOT copy the photo's own background — build each clip's scene from its `scene` field.",
    on_screen_text:
      "FORBIDDEN — the rendered frame contains ZERO readable text, letters, numbers or typography: no subtitles, captions, karaoke/lyric text, title cards, watermarks or logos. Every technical value in this JSON (lens mm, f-stop, Kelvin, lux, timecodes) is an internal camera/render setting — NEVER draw it as on-screen text, a spec card, HUD or corner overlay.",
    global_style: {
      look: oneLine(breakdown.style_guide?.art_direction) || "cinematic realistic",
      lens: oneLine(sb?.lens),
      lighting: oneLine(sb?.lighting),
      backdrop: oneLine(sb?.backdrop),
      color_grade: oneLine(sb?.color_grade),
      film_grain: oneLine(sb?.film_grain),
      color_palette: breakdown.style_guide?.color_palette ?? [],
      mood: breakdown.mood_tags ?? [],
      // Realism spine repeated into every clip's flattened prompt (anti-CGI).
      render_spec: PHOTOREAL_REALISM,
    },
    continuity: {
      characters,
      product_dna: breakdown.product_dna ? oneLine(breakdown.product_dna) : null,
    },
    negative_prompt: VEO_NEGATIVE_LIST,
    title: breakdown.title,
    synopsis: oneLine(breakdown.synopsis),
    marketing_structure: breakdown.marketing_structure ?? null,
    clips,
  };
}
