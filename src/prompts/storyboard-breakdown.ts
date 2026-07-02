import type {
  StoryboardGenerationInput,
  StoryboardGenerationOutput,
  VideoGoal,
  SceneBible,
  AspectRatio,
} from "@/types";

// Forbidden in every generated image/clip (the brief's negative list).
// Phrased as plain descriptors (no instructive "no/don't") — Veo/Kling read the
// negative list as nouns/adjectives to avoid, and "no X" phrasing can backfire.
const SHARED_NEGATIVE =
  "NEGATIVE (avoid — plain descriptors): warped or altered label/logo text, logo change, brand-colour change, extra products, duplicated or doubled objects (e.g. two pans / two of the same item), floating or levitating objects, objects passing through solid surfaces, physically impossible actions (e.g. lifting/holding a pan with a spatula), sudden appearing or disappearing objects, teleporting, morphing, warping, melting, distorting, deforming, object/container morphing, inconsistent physics, unnatural motion, jittery or stuttering movement, frame skipping, mid-clip jump cuts, extra people, changed hair/wardrobe/accessories, identity drift, face morphing, changing facial features, age shifting, extra or missing limbs, extra or fused fingers, mutated or malformed hands, human hands when the action does not require them, deformed liquid, floating ingredients, melted food, warping plate, liquid flowing upward, on-screen text overlays, captions, subtitles, watermark, duplicate subject, plastic/CGI skin.";

// Positive realism directive — reproduced in every motion/video prompt. Models
// respond better to explicit positive physics cues than to negatives alone, so
// we state what the clip MUST do, not only what to avoid.
// Concise anti-artifact tail for IMAGE-LED Veo prompts. When a clean keyframe
// is attached as the start frame it already carries the identity, wardrobe,
// setting, lens and colour — so the prompt must NOT re-describe them (that
// bloat is exactly what makes Veo drift/morph). We keep only the motion plus a
// short physics + negative cue.
const VEO_CONCISE_TAIL =
  "Natural, physically realistic motion — real weight, gravity and momentum; one continuous shot, no hard cuts. Avoid: morphing, warping, teleporting, floating or duplicated objects, extra or fused fingers, malformed hands, the face changing, deformed food or liquid, on-screen text, subtitles, watermark, plastic/CGI skin.";

/** One-line "Scene Bible" style tokens, reproduced verbatim in every image. */
function sceneBibleTokens(sb?: SceneBible): string {
  if (!sb) return "";
  return `STYLE TOKENS (reproduce these EXACTLY in every keyframe — same lens, light, backdrop, grade): ${sb.lens}; ${sb.lighting}; backdrop ${sb.backdrop}; ${sb.color_grade}.`;
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
  health:
    "Health / wellness education short. ONE relatable character living the health problem. 5-beat arc: Hook (name the symptom/fear) → Problem (how it disrupts daily life) → Insight (the real root cause, explained simply) → Solution (the habit/remedy/product that helps) → CTA (save/follow/try). Trustworthy, empathetic, clear — evidence-based, not alarmist.",
};

// Rich framework for topic-driven numerology / self-development shorts, modelled
// on the proven "Số Chủ Đạo" script shape. Injected into the user prompt when
// video_goal is "numerology" so the AI writes in this exact winning structure.
const NUMEROLOGY_FRAMEWORK = `
NUMEROLOGY SCRIPT FRAMEWORK (follow this EXACTLY — it is the proven winning shape):
- SUBJECT: a numerology profile (e.g. "Số Chủ Đạo 5, Sứ Mệnh 9"). Use the topic content provided as the source of truth for meanings; NEVER invent contradictory numerology.
- NGŨ HÀNH (Five-Elements): if the numbers map to elements, state the relationship (tương sinh / tương khắc) and derive ONE clear CORE MESSAGE from it (e.g. "tự do của bạn không phải để chạy trốn — mà để mang cảm hứng đi cho đời"). Put this core message in "synopsis".

- CHARACTER = THE NUMBER MADE HUMAN: invent ONE persona whose name, age, wardrobe, signature prop, posture, energy AND colour tone ALL express this number's archetype, and keep this EXACT character_lock identical across every segment. Derive the look from THIS number's traits in the topic content. (Archetype→look examples: Số 1 leader/pioneer = decisive stance, worn leather jacket, cool steel-blue grade; Số 5 freedom/adventure = faded backpack, warm golden 35mm, restless eyes; Số 9 humanitarian = soft warm light, giving hands.) LOCK a signature PROP that symbolises the number (e.g. Số 5 = backpack/map) and never introduce new unrelated props. Source the pain in beats 1-2 from this number's SHADOW ("bóng tối"), and the payoff in beat 4 from its MISSION line.

- CHARACTER ↔ SETTING SYNCHRONISATION (this is what makes it feel "chuẩn" — DO NOT skip):
  · Every scene's SETTING, props, lighting, weather, camera and the character's action must SYMBOLICALLY embody the number's core trait AND the emotion of that beat. The environment is a METAPHOR for the number, never a random backdrop, and it must match the character's personality in that moment.
  · Choose ONE controlling visual metaphor for the number and vary it across the 5 beats. Examples: Số 5 (tự do) → crossroads at dusk (hook) → packing up / leaving many rooms (pain) → a cliff over the open sea (insight) → giving water among strangers round a fire (payoff) → an endless open road (CTA). Số 1 (mở đường) → walking far ahead of a crowd on a misty ridge (hook) → carrying everything alone, last light on in the office (pain) → an untrodden trail at dawn (insight) → the first footprint on a new path, sun bursting behind (payoff) → others starting to follow his steps (CTA).
  · The environment must EVOLVE with the emotion: cold / lost / cluttered at the pain beat → warm / open / "home" at the payoff — while the SAME character DNA (face, wardrobe) stays identical throughout.
  · SHOW, DON'T TELL: each scene tells its beat through ONE striking visual metaphor + the character's action, NOT a lecturing voiceover. FREELY CHANGE the location each scene (street, cliff, rooftop, café, moving train…) to serve the metaphor — never lock everything to one office/room.
  · Add ONE relatable, lightly humorous everyday detail so it feels human (e.g. a Số 5 who swears "lần này nghiêm túc" then grabs the backpack 3 seconds later; a Số 1 who directs the whole team then carries every box himself "để tao làm cho nhanh").
  · Write each segment's setting + lighting explicitly in "first_frame_prompt". The BACKDROP changes per scene (the metaphor), but keep the lens + colour grade in "scene_bible" cinematic and coherent so the clips still feel like one film.

- THE 5-BEAT ARC (map onto the segments in order; scale to the requested segment count; each beat's SETTING follows the metaphor above):
  1) HOOK — talk to the viewer, name their number, tease an uncomfortable truth ("sự thật phũ phàng"). Close-up to camera, in a location that instantly signals the number's essence.
  2) PAIN / NỖI ĐAU — dramatize the misunderstood struggle drawn from the number's SHADOW ("bóng tối") as a metaphor scene; voice the viewer's self-doubt as a question.
  3) INSIGHT / GIẢI MÃ — the reframe "Không phải bạn [flaw]… mà là [deeper truth]", in a spacious, contemplative setting that visually opens up (a reveal, slow camera pull-back).
  4) PAYOFF / SỨ MỆNH — land the number's MISSION as the gift; a warm, human, giving moment; the character finally looks "at home" in a setting that rewards the number's nature.
  5) CTA — a one-line takeaway + a loop-friendly comment prompt (e.g. "thả số chủ đạo của bạn ở comment"). Open, walk-away framing that loops back to the hook.
- DIALOGUE = SHORT VOICEOVER: warm second-person Vietnamese, ONE punchy "đắt giá" line per scene, MAX 16 words (ideal 8-14) — show, don't tell; let the image carry the rest. BAD (long, dull): "Bạn khao khát được công nhận, được dẫn dắt, nhưng lại sợ cô đơn…". GOOD (short, sharp): "Đứng đầu thì oai. Nhưng đỉnh núi nào mà chẳng lạnh." Never lecture or list.
- Fill "marketing_structure" (hook = beat 1, problem = beat 2, solution = beat 3, cta = beat 5). Put a ready-to-post social caption + 4-6 hashtags at the END of "synopsis".`;

// Health / wellness education framework (same 5-beat shape, health-flavoured).
const HEALTH_FRAMEWORK = `
HEALTH / WELLNESS SCRIPT FRAMEWORK (follow this EXACTLY):
- SUBJECT: a specific health topic (e.g. "gan nhiễm mỡ", "mất ngủ"). Use the topic content provided as the source of truth; be accurate and empathetic, NOT alarmist, and avoid over-claiming cures.
- CHARACTER: ONE relatable persona living this problem (name, age, everyday setting), kept identical across all segments so the clips chain seamlessly. Warm, trustworthy, real-life tone.
- THE 5-BEAT ARC (map onto the segments in order; scale to the requested segment count):
  1) HOOK — name the symptom/worry directly to the viewer ("Bạn hay [triệu chứng]?"). Close-up.
  2) PROBLEM — show how it quietly disrupts daily life (a relatable everyday moment).
  3) INSIGHT — explain the REAL root cause simply and correctly (one clear idea).
  4) SOLUTION — the habit / remedy / product that helps, shown in use (if a product is provided, feature it accurately).
  5) CTA — save/follow/try line, gentle and caring.
- Put ONE clear takeaway/core message in "synopsis". Fill "marketing_structure" (hook/problem/solution/cta) from beats 1/2/3-4/5. Add a ready-to-post caption + 4-6 hashtags at the END of "synopsis".
- DIALOGUE: warm, second-person Vietnamese, ~5-12 words per segment. Clear and caring — not a hard sell.`;

// ─── Stage 1: Script writer (Claude) — creative script ONLY ─────────────────
// When the user splits the pipeline (e.g. Claude writes the script, Gemini
// builds the storyboard), Claude produces just the creative script text; the
// storyboard model then expands it into the full JSON verbatim.

export function buildScriptWriterSystemPrompt(): string {
  return `You are a world-class short-form video SCRIPTWRITER for viral social media (TikTok / Reels / YouTube Shorts). You write ONLY the creative script — NOT the technical storyboard or JSON (a separate tool turns your script into the visual storyboard).

Write in the language the user asks for. Nail a 3-second HOOK, build emotion, and end with a CTA. Dialogue must be SHORT, punchy, natural spoken lines (not literary), about 8-16 words each — ONE "đắt giá" line per segment.

Output PLAIN TEXT in EXACTLY this shape (no markdown, no JSON):
TITLE: <catchy title>
CORE MESSAGE: <one-line takeaway>
CHARACTER: <ONE consistent persona — name, age, signature look/prop, tone — that embodies the topic; keep the SAME person across all segments>
SEGMENT 1 [HOOK]:
  ACTION: <one vivid thing we SEE — a visual metaphor for this beat>
  DIALOGUE: "<the exact spoken line>"
SEGMENT 2 [PROBLEM]:
  ACTION: ...
  DIALOGUE: "..."
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
  const framework = isNumerology ? NUMEROLOGY_FRAMEWORK : isHealth ? HEALTH_FRAMEWORK : "";

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
- If there is a hero PRODUCT, write "product_dna": exact shape, material, colours WITH RGB hex, label/logo text+colour, cap/parts — repeated verbatim.
- Build a "scene_bible" (lens, lighting with Kelvin temps, backdrop with hex, colour grade) — the style fingerprint reused VERBATIM so lens, lighting, backdrop and tone never change.
- One single set/location per segment; only camera framing and the action change.
- A generated CHARACTER REFERENCE SHEET image (front / 3-4 / side / back + expressions) is attached as a reference to every shot — match it precisely.

PHYSICAL REALISM (every clip must look real, not "AI" — this is what eliminates the broken, impossible-motion look):
- ONE primary physical action per 10s clip, performed SLOWLY and DELIBERATELY. Never stack multiple simultaneous or sequential actions into one clip — that is the #1 cause of morphing, teleporting, duplicated limbs and objects passing through each other.
- Write SPECIFIC motion: name the body part + the verb + the manner (e.g. "her right hand slowly lifts the pan by its handle"), never vague verbs like "moving", "doing" or "interacting".
- State physics explicitly in the motion_prompt: real-world weight, gravity, momentum and balance; objects keep one solid form (object permanence); hands make real contact with props and never pass through them; liquids and food obey gravity.
- Every motion_prompt must include a positive realism clause, e.g.: "single continuous motion, natural movement obeying real-world physics, consistent weight and gravity, stable identity, object permanence".
- Camera moves are smooth and minimal (a slow push-in or gentle pan). Avoid combining a big camera move with big subject motion — that compounding warps the image.

NEGATIVE (forbidden in every image/clip — plain descriptors): warped/changed label or logo text, brand-colour change, extra products or extra people, changed hair/wardrobe/accessories, human hands when the script does not call for them, on-screen text overlays, object/container morphing, teleporting, floating or levitating objects, objects passing through surfaces, deformed liquid, melted food, extra or fused fingers, malformed hands, face morphing, identity drift, plastic/CGI skin.

DIALOGUE (spoken audio in Veo 3):
- Veo 3 generates real spoken audio. Each segment's "dialogue" is the exact line the on-screen character (or voiceover) speaks.
- Write dialogue in the language requested by the user. Keep each line SHORT (about 5-12 words, ~3-6 seconds) so lip-sync stays natural.
- Put the spoken line ONLY in the "dialogue" field. Do NOT quote or embed the spoken line inside the "motion_prompt" — the system appends it automatically exactly once, so repeating it makes the character say it twice. In the motion_prompt just note WHEN the character speaks and that the lips move naturally (e.g. "around 6-10s he speaks his line with natural lip movement"), without quoting the words.
- SPEAKER (critical when there are 2+ characters): ONLY ONE character may speak per 10s segment. Set "speaker" to that character's EXACT name from character_locks. The other characters stay silent and listen (mouths closed) in that clip. For a conversation, ALTERNATE the speaker across consecutive segments (character A speaks in one clip, character B replies in the next) — never have two people talk in the same clip, because the video model cannot reliably lip-sync two speakers at once. If the line is a voiceover with no on-screen speaker, set "speaker" to "".

Camera codes: [EYE] eye-level, [LOW] low, [HIGH] high, [OVH] overhead, [DUTCH] dutch, [OTS] over-shoulder, [POV] first-person, [CLOSE] close-up, [SIDE] side profile.

Output MUST be valid JSON only — no markdown, no code fences, no text outside the JSON.`;
}

export function buildStoryboardUserPrompt(
  input: StoryboardGenerationInput
): string {
  const characterBlock =
    input.character_descriptions && input.character_descriptions.length > 0
      ? `\n\nCharacters:\n${input.character_descriptions.map((c) => `- ${c.name}: ${c.appearance}. Personality: ${c.personality}. Role: ${c.role}`).join("\n")}`
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
    ? `\n\n=== APPROVED SCRIPT (Stage 1) — EXPAND THIS VERBATIM ===\nA scriptwriter already wrote the creative script below. Your job is ONLY to turn it into the technical storyboard JSON. Follow it FAITHFULLY:\n- Keep the SAME character (name, look, persona) across every segment.\n- Map each SEGMENT in the script to one 10s storyboard segment IN ORDER (same count, same beats/roles).\n- Use each segment's DIALOGUE line VERBATIM as that segment's "dialogue" (do not rewrite, translate, or shorten it beyond natural lip-sync length).\n- Turn each segment's ACTION into the first_frame_prompt + motion_prompt (one continuous action per clip).\n- Do NOT add, drop, reorder, or invent segments or lines. This script is final.\n\n${input.source_script}\n=== END APPROVED SCRIPT ===`
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
  const numerologyBlock = isNumerology
    ? `\n${NUMEROLOGY_FRAMEWORK}`
    : isHealth
      ? `\n${HEALTH_FRAMEWORK}`
      : "";

  const dialogueLanguage = input.dialogue_language ?? "Vietnamese";
  const dialogueBlock =
    input.force_dialogue === false
      ? `\nDialogue: optional. When a segment has a spoken line, write it in ${dialogueLanguage}.`
      : `\nDialogue: REQUIRED. EVERY segment MUST have a non-empty "dialogue" line spoken in ${dialogueLanguage} (natural, conversational ${dialogueLanguage} — not translated word-for-word). Keep each line short (about 5-12 words). Put the line ONLY in the "dialogue" field — do NOT quote it inside the "motion_prompt" (the system appends it once; repeating it makes the character say it twice).`;

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
      "gender_age": "string — e.g. 'male, ~35 years old'",
      "build": "string",
      "skin_tone": "string",
      "hair": "string",
      "eyes": "string",
      "costume": "string",
      "signature_features": "string",
      "default_expression": "string",
      "render_style": "${input.style}",
      "dna": "string — ONE verbatim forensic-DNA line with RGB HEX codes for skin/hair/eyes/wardrobe/brand colours, e.g. 'navy polo #1F2A44, light-blue tee #A9C7E8, matte steel watch #8A8D91, short black side-part hair #14110F, warm tan skin #C8956A, rectangular tortoise glasses'"
    }
  ],
  "scene_bible": {
    "lens": "string — e.g. '85mm lens, f/1.8' or '100mm macro, f/5.6'",
    "lighting": "string — with Kelvin temps, e.g. 'softbox key 4500K + strip rim light 5500K'",
    "backdrop": "string — with hex when relevant, e.g. 'modern kitchen, soft window daylight' or 'seamless gradient #40E0D0 to #008080'",
    "color_grade": "string — e.g. 'neutral Rec.709, photoreal premium commercial'"
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
      "first_frame_prompt": "string — describe the SHARED scene/setting of this 10s segment (location, lighting, EXACT character appearance from character_locks, product if any). It is used as the scene-overview context for the shot board, so describe the environment and the character clearly.",
      "motion_prompt": "string — a focused 70-110 word image-to-video ACTION prompt for Omni Flash / Veo describing ONE continuous take. IMPORTANT: the system automatically wraps this text with the full character + product description, the style tokens (lens/light/backdrop/grade), a physics directive and a negative list — so DO NOT repeat identity attributes, style tokens, a physics clause or a negative list here; describe only what HAPPENS. Order: (1) a SHORT anchor that it is the same man and same product from the attached references, rendered as a slightly younger, more attractive version (one phrase — do NOT re-list every attribute); (2) ONE single continuous primary action across the 10s with rough timing ('0-3s ...; 3-6s ...; 6-10s ...') using slow, deliberate, specific motion verbs (body part + verb + manner) — no hard cuts, no second simultaneous action; (3) camera (shot size + SMOOTH minimal movement); (4) a brief mood/light accent only if it changes; (5) note WHEN the character speaks with natural lip movement, but DO NOT quote the spoken words (the dialogue line is appended automatically exactly once); (6) finish with the exact final state so it leads into the next segment.",
      "dialogue": "string — the spoken line in ${dialogueLanguage} (short, natural)",
      "speaker": "string — the EXACT character_locks name of who speaks this line. ONE speaker per segment; the others stay silent. Empty string \\"\\" if it is a voiceover with no on-screen speaker.",
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
    return `Photorealistic, lifelike, real human, cinematic photography quality — NOT a cartoon, NOT an illustration.${
      preserveRealFace
        ? ` CRITICAL: preserve the EXACT real face, skin tone, hairstyle and likeness from the attached reference photo — same real person, never stylized into a cartoon. ${BEAUTIFY_DIRECTIVE}`
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
        return `• THE CHARACTER — the attached CHARACTER REFERENCE SHEET (turnaround + expressions)${d} defines the main character's exact face, hair, body and costume. Reproduce the SAME individual identically in every shot — same face, same wardrobe, same proportions — rendered as a slightly younger, more attractive version of himself. Do NOT invent a different person.`;
      case "face":
        return `• THE PERSON — use the exact man shown in the attached portrait photo${d}. Keep his real face, hairstyle, facial hair and skin tone CLEARLY recognizable and identical in every shot; render him as a tasteful, slightly younger and more handsome version of himself (light natural retouch, same identity). Match his eyewear EXACTLY to the photo — if he is NOT wearing glasses in the photo, do NOT add glasses; if he IS, keep the same glasses — and keep this consistent across every shot. He is the main character. Do NOT invent a different face.`;
      case "character":
        return `• CHARACTER "${r.name ?? "person"}" — one of the attached portrait photos shows ${r.name ?? "this person"}${d}. Keep ${r.name ?? "their"} real face, hair and skin tone clearly recognizable and identical in every shot, rendered as a tasteful slightly younger version of themselves. Bind this face to ${r.name ?? "this character"} ONLY — do NOT swap, merge or blend it with the other character(s) in the scene.`;
      case "product":
        return `• THE PRODUCT — feature the EXACT product shown in the attached product photo${d}. Keep its EXACT shape, silhouette, colour, material, proportions, handle/parts and branding identical in every single shot. Do NOT redesign, recolour, distort, resize, age, damage or swap it for a different object.`;
      case "setting":
        return `• THE LOCATION — keep every scene in the same location shown in the attached interior photo${d}. Match its layout, colours, furniture and key props; keep it consistent across all shots.`;
      case "anchor":
        return `• WARDROBE & LOOK ANCHOR — the attached already-approved storyboard frame shows the main character in the EXACT outfit, hairstyle and accessories to use. Copy the clothing (type, cut and colours) and every accessory (watch, glasses if any, etc.) EXACTLY in this board. Do NOT change the outfit — never switch to a suit, jacket, apron or a different shirt unless it appears in this anchor. It is the SAME person as the portrait photo.`;
      default:
        return `• Reference — keep it consistent.`;
    }
  });
  return `You are given reference photos. RE-CREATE new cinematic scenes using these real subjects — do NOT simply output a copy of any reference photo, but match them PRECISELY (same identity, same product, same place). Follow them exactly:\n${lines.join("\n")}\n\n`;
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
  const refStrip =
    `LARGE, clearly-visible reference portraits of THE SAME main character — big enough that the face and clothing read clearly, NOT small distant thumbnails: (1) one FULL-BODY FRONT view, head to toe, standing naturally; and (2) two WAIST-UP (half-body) views — a 3/4 angle and a side profile — each showing the face sharply and at good size.${expClause}`;

  return `${refBlock}SHOT ${params.segmentNumber} — a complete STORYBOARD BOARD for ONE ~10 second video clip, presented as ONE single horizontal image. This board gives an image-to-video model (Veo) full context: who the character is (from every angle), what the scene looks like${hasProduct ? ", the product" : ""}, and the ${target} actions that happen across the 10 seconds. ${params.style} style.

THE BOARD CONTAINS THESE ZONES IN ONE IMAGE:

■ TOP-LEFT — "CHARACTER REFERENCE" block (REPEAT THIS IN EVERY SHOT, make it prominent and reasonably large): ${refStrip} Label "CHARACTER REF". Character: ${params.characterDescription}.

■ "SCENE OVERVIEW": one larger establishing panel showing the full location/environment of this shot (wide angle)${hasProduct ? ", with the product clearly visible on a surface" : ""}. ${hasSetting ? "CRITICAL: reproduce the EXACT location from the attached interior reference photo — the SAME cabinet style & colour, wall, tiles, countertop, window, appliances and overall layout. Do NOT invent or restyle a different kitchen. Keep this SAME room even in 'before/problem' shots — only the pan/food/props state changes, never the kitchen itself. This identical location must also appear behind every action panel." : "This tells Veo the setting."}

■ RIGHT / BOTTOM — "ACTION SEQUENCE": ${target} numbered action panels (${numberLabels}) laid out left → right showing the ${target} key moments across the 10 seconds, each a small illustration with a SHORT caption under it describing the action:
${panelLines}

SCENE CONTEXT for all panels: ${params.firstFramePrompt}
${params.productDna ? `PRODUCT DNA (identical in every panel, with exact colours): ${params.productDna}\n` : ""}${params.ingredients ? `NAMED INGREDIENTS (show each clearly and write its NAME label next to it): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}
${continuity}
${directive}

RULES: ONE cohesive board image; the SAME individual (identical face, hair, and the EXACT SAME outfit + accessories — same shirt, trousers, watch; NEVER a suit, jacket, apron or different clothes) AND the SAME product appear in the character-ref block, the scene overview and all ${target} action panels;${params.preserveRealFace ? " match the man's eyewear to his reference portrait EXACTLY — if he is NOT wearing glasses in the photo, do NOT add glasses anywhere; if he is, keep the same ones;" : ""} ${hasSetting ? "the SAME exact kitchen/location from the interior reference photo" : "one single consistent location"} for this whole board; thin clean dividers and small numbered badges; captions short and legible. ${SHARED_NEGATIVE}`;
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
}): string {
  const directive = renderDirective(params.style, params.preserveRealFace ?? false);
  const refBlock = buildReferenceInstructions(params.references ?? []);
  const tokens = sceneBibleTokens(params.sceneBible);
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
SUBJECT — keep this exact forensic identity: ${params.characterDescription}
${prominence}${lipSync}
${params.productDna ? `PRODUCT (exact, unchanged, with colours): ${params.productDna}\n` : ""}${params.ingredients ? `PROPS / INGREDIENTS (show clearly by name): ${params.ingredients}\n` : ""}${tokens ? tokens + "\n" : ""}${directive}

RENDER RULES: a SINGLE static frame; the subject is sharp and frozen in the STARTING posture for the upcoming action (no motion blur, no camera-movement effect); ${ratioWord} aspect ratio, 1080p quality. Do NOT include timeline markers, multiple panels, split-screens, reference thumbnails, captions, subtitles, on-screen text or speech bubbles. ${grade} ${SHARED_NEGATIVE}`;
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
- Each panel: a ${params.style} illustration of that moment, and BELOW the picture a small white caption band with two labeled lines of text:
  "Action:" the action description, then "Lời thoại:" the spoken ${lang} line in quotes.

CHARACTER (THE SAME individual in the reference column AND every storyboard panel — identical face, hair, outfit): ${charDesc}

THE ${maxPanels} PANELS:
${panelLines}

Metadata footer: "${params.totalDuration}s • ${maxPanels} shots • ${params.moodTags.slice(0, 3).join(" • ")}".

RULES: ONE cohesive document image; same character everywhere; ${params.style} style for the panel art; caption text small, clean and legible; no watermark.`;
}

// ─── Step 5: Video Assembly Guide (text for Veo / Seedance) ─────────────────

/**
 * Composes the full, long, ready-to-paste Veo prompt for ONE clip:
 * reference-lock preamble + the model's motion prompt + the spoken line +
 * a negative list. Used both per-card (copy button) and in the text guide.
 */
export function buildSegmentVeoPrompt(params: {
  characterDescription: string;
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
}): string {
  const lang = params.dialogueLanguage ?? "Vietnamese";
  const clean = (s?: string) => (s ?? "").replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  // SELF-CONTAINED prompt: repeat the FULL character + scene + style in EVERY
  // clip so Veo renders correctly from the uploaded character PHOTO — no need to
  // pre-generate a per-scene keyframe. The attached photo only locks the
  // face/wardrobe; the scene is built from the text below.
  const lead =
    "Use the ATTACHED photo as the reference for the main character — keep the SAME face, hair and wardrobe identical. Create ONE continuous, cinematic 10-second shot of that same person in the scene described below; do NOT copy the photo's own background — build the new setting.";
  const character = ` CHARACTER (keep identical every clip): ${clean(params.characterDescription)}.`;
  const setting = params.setting ? ` SCENE: ${clean(params.setting)}.` : "";
  const product = params.productDescription
    ? ` PRODUCT (keep its exact shape, colour, material and branding): ${clean(params.productDescription)}.`
    : "";
  const ing = params.ingredients ? ` INGREDIENTS (show and name each): ${clean(params.ingredients)}.` : "";
  const tokens = params.sceneBible ? ` ${sceneBibleTokens(params.sceneBible)}` : "";
  const palette =
    params.colorPalette && params.colorPalette.length > 0
      ? ` Colour palette: ${params.colorPalette.join(", ")}.`
      : "";
  // Multi-character: name WHO speaks and keep everyone else silent, so Veo
  // never lip-syncs the line on the wrong person.
  const speaker = (params.speaker ?? "").trim();
  const others = (params.characterNames ?? []).filter(
    (n) => n && n.trim() && n.trim() !== speaker
  );
  const speakerLabel = speaker || "The character";
  const silence =
    speaker && others.length > 0
      ? ` Only ${speaker} speaks; the other character${others.length > 1 ? "s" : ""} (${others.join(", ")}) stay silent and listen with mouths closed.`
      : "";
  const spoken = params.dialogue
    ? ` ${speakerLabel} speaks to camera with natural mouth movement and accurate lip-sync, saying in ${lang}: "${params.dialogue}" — spoken audio only, no on-screen subtitles or captions.${silence}`
    : "";
  return `${lead}${character}${setting}${product}${ing}${tokens}${palette} MOTION: ${clean(params.motionPrompt)}${spoken} ${VEO_CONCISE_TAIL}`;
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
  marketing: { hook: string; problem: string; solution: string; cta: string };
  segments: {
    segment_number: number;
    title: string;
    role: string;
    duration_seconds: number;
    motion_prompt: string;
    dialogue?: string | null;
    speaker?: string | null;
    setting?: string;
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
        characterNames: params.characterNames,
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
  "morphing, warping, teleporting, floating or levitating objects, duplicated or doubled objects, extra or fused fingers, malformed or mutated hands, extra or missing limbs, the face changing, identity drift, age shifting, changed hair/wardrobe/accessories, warped or altered label/logo text, brand-colour change, extra people, objects passing through solid surfaces, deformed food or liquid, melting, jittery or stuttering motion, mid-clip jump cuts, on-screen text, captions, subtitles, watermark, plastic or CGI skin";

interface VeoJsonOptions {
  aspectRatio: string;
  dialogueLanguage?: string;
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
    appearance: [l.gender_age, l.build, l.skin_tone, l.hair, l.eyes]
      .map((x) => oneLine(x))
      .filter(Boolean)
      .join(", "),
    wardrobe: oneLine(l.costume),
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
    return {
      id: seg.segment_number,
      role: seg.marketing_role,
      duration_seconds: seg.duration_seconds ?? clipSeconds,
      scene: oneLine(seg.first_frame_prompt),
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
            lip_sync: true,
            subtitles: false,
          }
        : null,
      audio: "spoken dialogue only with natural ambient sound; no music unless noted; no on-screen text",
      continuity_from_previous: oneLine(seg.continuity_note),
      negative_prompt: VEO_NEGATIVE_LIST,
      // Flattened, fully self-contained prompt (text mode fallback).
      prompt: oneLine(seg.full_prompt ?? seg.motion_prompt ?? ""),
    };
  });

  return {
    version: "veo-3.1",
    output: {
      aspect_ratio: opts.aspectRatio,
      duration_seconds_per_clip: clipSeconds,
      fps: 24,
      total_clips: clips.length,
    },
    reference_image:
      "Attach the SAME uploaded character photo as the identity reference in EVERY clip. Do NOT copy the photo's own background — build each clip's scene from its `scene` field.",
    global_style: {
      look: oneLine(breakdown.style_guide?.art_direction) || "cinematic realistic",
      lens: oneLine(sb?.lens),
      lighting: oneLine(sb?.lighting),
      backdrop: oneLine(sb?.backdrop),
      color_grade: oneLine(sb?.color_grade),
      color_palette: breakdown.style_guide?.color_palette ?? [],
      mood: breakdown.mood_tags ?? [],
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
