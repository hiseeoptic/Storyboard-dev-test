import type {
  AudienceGoal,
  CharacterRepresentation,
  DirectingProfileId,
  StoryFormat,
  VisualInterpretation,
} from "@/types";
import {
  REFERENCE_CHARACTER_ANTI_PLASTIC,
  REFERENCE_CHARACTER_APPEARANCE_LOCK,
} from "@/lib/character-realism";

export interface CreativeOption<T extends string> {
  value: T;
  label_vi: string;
  label_en: string;
  description_vi: string;
  description_en: string;
}

export const AUDIENCE_GOAL_OPTIONS: CreativeOption<AudienceGoal>[] = [
  { value: "attention", label_vi: "Thu hút chú ý", label_en: "Attention", description_vi: "Dừng lướt và nhận biết chủ đề trong 3–5 giây đầu.", description_en: "Stop the scroll and establish the subject in the first 3–5 seconds." },
  { value: "retention", label_vi: "Giữ chân / giải trí", label_en: "Retention / entertainment", description_vi: "Duy trì tò mò bằng tiến triển và phần thưởng thị giác.", description_en: "Sustain curiosity through progression and visual payoff." },
  { value: "empathy", label_vi: "Đồng cảm / kết nối", label_en: "Empathy / connection", description_vi: "Giúp người xem nhận ra trải nghiệm và cảm xúc của mình.", description_en: "Help viewers recognise their own experience and feelings." },
  { value: "explain", label_vi: "Giải thích / hiểu rõ", label_en: "Explain / understand", description_vi: "Biến điều phức tạp thành chuỗi nguyên nhân–kết quả dễ hiểu.", description_en: "Turn complexity into a clear cause-and-effect sequence." },
  { value: "reflection", label_vi: "Suy ngẫm / nhìn lại", label_en: "Reflection / reframe", description_vi: "Đưa người xem tới một góc nhìn mới, không áp đặt phán xét.", description_en: "Lead viewers to a new perspective without moralising at them." },
  { value: "trust", label_vi: "Tin tưởng / cân nhắc", label_en: "Trust / consideration", description_vi: "Tạo độ tin cậy bằng bằng chứng, tính nhất quán và trải nghiệm thật.", description_en: "Build credibility through evidence, consistency and lived detail." },
  { value: "engagement", label_vi: "Thảo luận / cộng đồng", label_en: "Engagement / community", description_vi: "Gợi phản hồi chân thành hoặc một câu hỏi có hai góc nhìn.", description_en: "Invite a genuine response or a question with more than one valid view." },
  { value: "action", label_vi: "Hành động / chuyển đổi", label_en: "Action / conversion", description_vi: "Dẫn tới một hành động rõ ràng sau khi đã tạo đủ lý do.", description_en: "Lead to one clear action after earning the reason to act." },
];

export const STORY_FORMAT_OPTIONS: CreativeOption<StoryFormat>[] = [
  { value: "auto", label_vi: "Tự động theo chủ đề", label_en: "Auto by topic", description_vi: "Hệ thống chọn cấu trúc phù hợp nhất nhưng không đổi chủ đề.", description_en: "Choose the best structure without changing the subject." },
  { value: "short_insight", label_vi: "Một nhận định ngắn", label_en: "Short insight", description_vi: "Hook → quan sát → góc nhìn mới → câu kết.", description_en: "Hook → observation → reframe → closing thought." },
  { value: "micro_story", label_vi: "Câu chuyện cực ngắn", label_en: "Micro story", description_vi: "Nhân vật → lựa chọn → hệ quả → thay đổi.", description_en: "Character → choice → consequence → change." },
  { value: "explainer", label_vi: "Giải thích trực quan", label_en: "Visual explainer", description_vi: "Câu hỏi → cơ chế → ví dụ → đúc kết.", description_en: "Question → mechanism → example → takeaway." },
  { value: "parable", label_vi: "Ngụ ngôn / ẩn dụ", label_en: "Parable / fable", description_vi: "Tình huống biểu tượng có logic nội tại và bài học được khám phá.", description_en: "A symbolic situation with internal logic and a discovered lesson." },
  { value: "observational", label_vi: "Quan sát đời thật", label_en: "Observational", description_vi: "Hành vi và chi tiết thật tự kể chuyện; hạn chế dàn dựng lộ liễu.", description_en: "Real behaviour and detail carry the story with minimal visible staging." },
  { value: "visual_poem", label_vi: "Thơ bằng hình ảnh", label_en: "Visual poem", description_vi: "Nhịp, ánh sáng, chất liệu và âm thanh dẫn cảm xúc.", description_en: "Rhythm, light, texture and sound lead the emotion." },
  { value: "episodic", label_vi: "Chuỗi nhiều tập", label_en: "Episodic series", description_vi: "Mỗi video tự hoàn chỉnh nhưng giữ một hệ nhân vật và quy tắc chung.", description_en: "Each video is complete while preserving a shared cast and rules." },
];

export const VISUAL_INTERPRETATION_OPTIONS: CreativeOption<VisualInterpretation>[] = [
  { value: "auto", label_vi: "Tự động, bám sát ý", label_en: "Auto, faithful to idea", description_vi: "Chọn cách thể hiện ít suy diễn nhất.", description_en: "Choose the least speculative useful interpretation." },
  { value: "literal", label_vi: "Diễn tả trực tiếp", label_en: "Literal", description_vi: "Cho thấy đúng hành động, địa điểm và hệ quả được nói tới.", description_en: "Show the stated action, place and consequence directly." },
  { value: "symbolic_metaphor", label_vi: "Ẩn dụ biểu tượng", label_en: "Symbolic metaphor", description_vi: "Một ẩn dụ trung tâm nhất quán xuyên suốt video.", description_en: "One coherent central metaphor across the video." },
  { value: "nature_analogy", label_vi: "Liên tưởng từ thiên nhiên", label_en: "Nature analogy", description_vi: "Dùng một quá trình tự nhiên có thật để soi chiếu ý tưởng.", description_en: "Use a real natural process to illuminate the idea." },
  { value: "parable_fable", label_vi: "Ngụ ngôn / nhân hoá", label_en: "Fable / personification", description_vi: "Đồ vật hoặc sinh vật có vai trò nhân vật nhưng vẫn giữ luật thế giới riêng.", description_en: "Objects or animals act as characters while obeying a coherent world." },
];

export const CHARACTER_REPRESENTATION_OPTIONS: CreativeOption<CharacterRepresentation>[] = [
  { value: "auto", label_vi: "Tự động theo kịch bản", label_en: "Auto by script", description_vi: "Ưu tiên nhân vật cần thiết nhất; không tự thêm nếu câu chuyện không cần.", description_en: "Use only the characters the story needs; do not add them by habit." },
  { value: "uploaded_photoreal", label_vi: "Người thật từ ảnh tải lên", label_en: "Uploaded real person", description_vi: "Khóa tuyệt đối danh tính và ảnh thật; tự bật khi có ảnh nhân vật.", description_en: "Strict identity and photographic lock; enabled automatically with character photos." },
  { value: "generated_human", label_vi: "Người thật do AI dựng", label_en: "AI-generated human", description_vi: "Nhân vật quang thực có Character DNA ổn định.", description_en: "A photoreal person with stable Character DNA." },
  { value: "stick_figure", label_vi: "Người que tối giản", label_en: "Minimal stick figure", description_vi: "Hình học tối giản, biểu cảm rõ, nhất quán nét vẽ.", description_en: "Minimal geometry, readable emotion and consistent line language." },
  { value: "illustrated_2d", label_vi: "Minh hoạ 2D", label_en: "2D illustrated character", description_vi: "Nhân vật minh hoạ có bảng màu, đường nét và tỷ lệ được khóa.", description_en: "An illustrated character with locked palette, line and proportions." },
  { value: "stylized_3d", label_vi: "Nhân vật 3D cách điệu", label_en: "Stylized 3D character", description_vi: "Hình khối 3D nhất quán, không trượt sang người thật.", description_en: "Consistent 3D form without drifting into live action." },
  { value: "anthropomorphic_animal", label_vi: "Động vật nhân hoá", label_en: "Anthropomorphic animal", description_vi: "Giữ nhận dạng loài và đặc điểm giải phẫu cốt lõi.", description_en: "Preserve species identity and essential anatomy." },
  { value: "anthropomorphic_object", label_vi: "Đồ vật nhân hoá", label_en: "Anthropomorphic object", description_vi: "Giữ công năng và vật liệu của đồ vật dù có biểu cảm.", description_en: "Preserve object function and material even when expressive." },
  { value: "none", label_vi: "Không nhân vật / chỉ cảnh vật", label_en: "No character / environment only", description_vi: "Cảnh vật, vật liệu và quá trình tự nhiên là chủ thể.", description_en: "Place, material and natural process are the subjects." },
];

export const DIRECTING_PROFILE_OPTIONS: CreativeOption<DirectingProfileId>[] = [
  { value: "auto", label_vi: "Tự động theo nội dung", label_en: "Auto by content", description_vi: "Chọn ngôn ngữ quay phù hợp, không trộn profile chuyên ngành.", description_en: "Choose a fitting camera grammar without mixing specialist profiles." },
  { value: "everyday_naturalism", label_vi: "Đời thường chân thật", label_en: "Everyday naturalism", description_vi: "Ánh sáng có nguồn thật, máy quay ở vị trí một người có thể đứng.", description_en: "Motivated light and a camera placed where a person could physically stand." },
  { value: "observational_documentary", label_vi: "Tài liệu quan sát", label_en: "Observational documentary", description_vi: "Quan sát hành vi, không tô bóng quảng cáo hay diễn xuất quá mức.", description_en: "Observe behaviour without commercial polish or overstated acting." },
  { value: "natural_history", label_vi: "Thiên nhiên chân thực", label_en: "Natural history", description_vi: "Hệ sinh thái, loài, thời tiết và chuyển động vi mô có căn cứ.", description_en: "Grounded ecosystem, species, weather and micro-motion." },
  { value: "poetic_nature", label_vi: "Thiên nhiên giàu chất thơ", label_en: "Poetic nature", description_vi: "Vẫn đúng sinh học và vật lý nhưng nhịp, khung hình giàu cảm xúc.", description_en: "Biologically and physically credible, with lyrical rhythm and framing." },
  { value: "psychological_metaphor", label_vi: "Ẩn dụ tâm lý", label_en: "Psychological metaphor", description_vi: "Một ẩn dụ thị giác nhất quán; không chẩn đoán hay gắn nhãn con người.", description_en: "One coherent visual metaphor without diagnosing or labelling people." },
  { value: "anthropomorphic_fable", label_vi: "Ngụ ngôn nhân hoá", label_en: "Anthropomorphic fable", description_vi: "Thế giới cách điệu có luật vật liệu, không gian và hậu quả rõ ràng.", description_en: "A stylized world with clear material, spatial and consequence rules." },
  { value: "creator_ugc", label_vi: "Người sáng tạo / UGC", label_en: "Creator / UGC", description_vi: "Máy quay điện thoại có chủ ý, gần gũi nhưng không cẩu thả.", description_en: "Intentional phone-camera intimacy without careless continuity." },
  { value: "cinematic_drama", label_vi: "Chính kịch điện ảnh", label_en: "Cinematic drama", description_vi: "Blocking, nhịp và ánh sáng phục vụ xung đột nhân vật.", description_en: "Blocking, rhythm and light serve character conflict." },
  { value: "premium_commercial", label_vi: "Quảng cáo cao cấp", label_en: "Premium commercial", description_vi: "Kiểm soát phản xạ, vật liệu, chuyển động sản phẩm và CTA.", description_en: "Controlled reflections, materials, product motion and CTA." },
  { value: "explainer_clarity", label_vi: "Giải thích rõ ràng", label_en: "Explainer clarity", description_vi: "Mỗi hình chỉ giải thích một ý, dùng sơ đồ khi thực sự cần.", description_en: "Each visual explains one idea; diagrams appear only when useful." },
];

export const GOAL_LAWS: Record<AudienceGoal, string[]> = {
  attention: ["The first 3–5 seconds must present a legible subject, tension, surprise or sensory payoff; never spend the hook on generic setup.", "The hook must truthfully belong to the later story and cannot promise a different outcome."],
  retention: ["Create an unanswered question or visible progression, then pay it off before the end.", "Every segment must add new information, state change or sensory reward; no recap loops."],
  empathy: ["Begin with an observable human situation before explaining it.", "Use specific behaviour, silence and reaction rather than telling the audience what to feel."],
  explain: ["Use one causal step per visual beat: question → mechanism → example → takeaway.", "Never replace an explanation with decorative symbolism."],
  reflection: ["Move from familiar situation → consequence → reframe → open reflective question.", "Let the insight be discovered through events; avoid scolding or superior moral narration."],
  trust: ["Show verifiable use, limitation, process or evidence; do not manufacture authority.", "Maintain restrained performance and consistent physical detail."],
  engagement: ["End with one specific, non-leading question that permits more than one honest answer.", "Do not use rage bait, false binaries or fabricated controversy."],
  action: ["Earn one clear action through demonstrated value before the CTA.", "The CTA must be specific, feasible and consistent with what was shown."],
};

export const FORMAT_LAWS: Record<StoryFormat, string[]> = {
  auto: ["Select one story structure that fits the topic and audience goal; never blend several formats merely because they exist."],
  short_insight: ["Use hook → concrete observation → reframe → memorable closing thought."],
  micro_story: ["Use character need → choice → consequence → realisation/change; every event must cause the next."],
  explainer: ["Use question → causal mechanism → concrete example → takeaway, with one concept per beat."],
  parable: ["Build a self-contained symbolic situation whose action proves the lesson; state the principle only after the consequence is visible."],
  observational: ["Let behaviour, place and natural sound carry meaning; narration cannot describe what the image already shows."],
  visual_poem: ["Use motif progression, material change, light and sound as an emotional arc; preserve causal continuity despite lyrical pacing."],
  episodic: ["Give this episode its own beginning, change and payoff while preserving the established world and character bible."],
};

export const INTERPRETATION_LAWS: Record<VisualInterpretation, string[]> = {
  auto: ["Prefer a direct, culturally legible interpretation; introduce metaphor only when it clarifies the idea."],
  literal: ["Depict the stated place, actions and consequences directly without inventing symbolic substitutes."],
  symbolic_metaphor: ["Define exactly one metaphor bible: source, target meaning, visual rules, progression and resolution.", "Never change metaphor families mid-video or decorate every sentence with a different symbol."],
  nature_analogy: ["Use one real natural process whose causal behaviour genuinely parallels the idea.", "Do not invent false biology, impossible seasons or incompatible species merely for symbolism."],
  parable_fable: ["Give personified beings stable capabilities and limits; their choices must have visible consequences inside the same world rules."],
};

export const CHARACTER_LAWS: Record<CharacterRepresentation, string[]> = {
  auto: ["Choose one character medium from the script and keep it stable; do not add a presenter or mascot without narrative need."],
  uploaded_photoreal: [
    `UPLOADED CHARACTER REFERENCE: ${REFERENCE_CHARACTER_APPEARANCE_LOCK}`,
    `Photographic live action; the only character-surface exclusions are: ${REFERENCE_CHARACTER_ANTI_PLASTIC}.`,
  ],
  generated_human: ["Create one stable photoreal Character DNA covering facial topology/asymmetry, age, build, living skin microtexture, eyes/eyelids, individual eyebrows and upper/lower eyelashes, nose/lips, hairline/density/strand texture, wardrobe materials and scale; reuse it exactly."],
  stick_figure: ["Use a locked minimal graphic DNA: stroke weight, head/body ratio, joint grammar, face marks, palette and background style.", "Express acting through pose, spacing and a small stable symbol vocabulary; do not drift into detailed anatomy or live action."],
  illustrated_2d: ["Lock line quality, proportions, palette, shading method and texture across every frame; no style drift between panels."],
  stylized_3d: ["Lock mesh proportions, material shader, eye scale, surface roughness and render language; never morph toward photoreal humans."],
  anthropomorphic_animal: ["Preserve species markers, anatomy, coat/feather/scales and locomotion; human expression cannot erase the animal identity."],
  anthropomorphic_object: ["Preserve the object's material, construction, scale and function; face/limbs cannot make it physically become a different object."],
  none: ["Do not introduce humans, mascots, faces or personified objects; environment, material and process carry the narrative."],
};

export const DIRECTING_LAWS: Record<Exclude<DirectingProfileId, "auto">, string[]> = {
  everyday_naturalism: [
    "Camera height, distance and line of sight must correspond to a physically reachable observer position; no impossible wall, railing or doorway geometry.",
    "Use motivated available light from real windows, practical fixtures and bounced surfaces; retain gentle exposure variation, natural skin and plausible shadow direction.",
    "Homes must show functional architecture, credible clearances, joints, wear and material response—not showroom perfection unless the script specifies it.",
  ],
  observational_documentary: [
    "Observe complete actions with patient handheld/locked framing; do not stage repeated glamour inserts that contradict documentary presence.",
    "Use available light, location sound and imperfect but controlled reframing; preserve factual sequence and spatial geography.",
  ],
  natural_history: [
    "Create a Nature DNA before shots: ecosystem/geography, season, time, weather, actual species, plant morphology, substrate, moisture, atmosphere and soundscape.",
    "Plant colour comes from species, age, chlorophyll state, sun exposure, moisture and camera white balance—not generic saturated green; preserve leaf shape, venation, translucency and irregularity.",
    "Wind, water, insects, clouds, pollen, fur and foliage move at different mass-appropriate speeds; no synchronized decorative motion.",
    "Use establishing habitat → organism/subject → behaviour/process → macro detail → environmental consequence; never assemble incompatible habitats or seasons.",
  ],
  poetic_nature: [
    "Obey the full Natural History reality laws, then create poetry through shot duration, scale changes, sound and light—not false species behaviour or fantasy colour.",
    "Choose one natural motif and let it evolve; do not create a montage of unrelated pretty landscapes.",
  ],
  psychological_metaphor: [
    "Define one metaphor bible and show its state changes gradually; every symbolic action must map to a specific psychological idea.",
    "Describe observable experiences and coping choices; never diagnose, stigmatise or claim treatment outcomes.",
  ],
  anthropomorphic_fable: [
    "Define the world's scale, locomotion, object affordances, material rules and social rules before action; personification does not suspend causality.",
    "Keep one graphic/animation language and one stable cast; the moral must emerge from choice and consequence.",
  ],
  creator_ugc: [
    "Use plausible phone lens, arm/tripod height, autofocus response, practical light and direct performance while keeping faces and products readable.",
    "Natural does not mean random: each camera reposition must have a reason and preserve screen direction and location continuity.",
  ],
  cinematic_drama: [
    "Block characters by objective, distance and eyeline; camera changes only when power, information or emotion changes.",
    "Motivate key, fill and practical sources within the location; stylisation may shape contrast but cannot contradict the set geometry.",
  ],
  premium_commercial: [
    "Treat product geometry, branding, material roughness, reflection and scale as locked reference facts.",
    "Use controlled camera motion and light sweeps only to reveal a real feature; no floating, teleporting or impossible liquid/material behaviour.",
  ],
  explainer_clarity: [
    "Assign one visual job to each beat; keep labels, arrows and diagrams out unless they materially clarify an invisible relation.",
    "Maintain a stable visual grammar for colour, shape, scale and transitions; examples must be concrete and causally accurate.",
  ],
};

export const REAL_WORLD_MATERIAL_LAWS = [
  "REAL-WORLD MATERIAL AUTHENTICITY: describe and render material-specific structure, scale, roughness, reflectance, wear, gravity and contact rather than generic 'cinematic texture'.",
  "Wood has species/plank logic, grain direction, end grain, joints, finish and wear; metal has fabrication, edge, oxidation and reflections; stone has mineral variation and mass; glass has thickness, refraction and real reflections; fabric has weave, drape and compression.",
  "Architecture must be buildable: connected floors/walls/openings, plausible thickness, load/support, thresholds, railings, circulation clearance and consistent inside/outside topology.",
  "Light must come from declared sources and interact with actual surface orientation, weather, time, exposure and white balance; colour is a property of material under light, not an arbitrary filter.",
];

export const TOPIC_LAWS: Partial<Record<string, string[]>> = {
  life_wisdom: [
    "LIFE-WISDOM ARC: familiar situation → meaningful choice → visible consequence → realisation → concise principle → open reflective question.",
    "Do not lecture, shame or present one character as morally superior; let behaviour and consequence earn the lesson.",
    "Keep the original proverb/teaching's meaning intact. A metaphor may clarify it but cannot replace it with a different doctrine.",
  ],
  psychology: [
    "PSYCHOLOGY ARC: recognisable experience → observable pattern → accessible mechanism → compassionate reframe → practical reflection.",
    "Use non-stigmatising language. Do not diagnose a person from behaviour, invent prevalence claims or promise clinical outcomes.",
  ],
  cooking: ["Activate Cooking DNA only. Never import cooking props, kitchen ambience, ingredients or food actions into another topic."],
  numerology: ["Activate Numerology DNA only when the selected topic is numerology; do not introduce numbers as mystical props in unrelated videos."],
  health: ["Separate general education from diagnosis or treatment advice and avoid unsupported medical certainty."],
};
