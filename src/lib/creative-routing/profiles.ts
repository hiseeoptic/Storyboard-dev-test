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
} from "../character-realism.ts";

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
  { value: "whiteboard_stick_figure", label_vi: "01 · Người que nét trắng", label_en: "01 · Whiteboard-line stick figure", description_vi: "Người que nét đen tối giản, điểm màu nhỏ; toàn bộ địa điểm và đạo cụ do kịch bản yêu cầu được minh hoạ bằng cùng ngôn ngữ nét vẽ trên nền sáng.", description_en: "Minimal black-line stick figures with small colour accents; every script-required location and prop is illustrated in the same line language on a clean light canvas." },
  { value: "hand_drawn_doodle", label_vi: "02 · Doodle phác tay", label_en: "02 · Hand-drawn doodle", description_vi: "Nhân vật, địa điểm và đạo cụ trong kịch bản cùng được phác bằng bút chì/bút mực giàu nét tay và điểm màu có chủ ý.", description_en: "Script-defined characters, locations and props share one expressive pencil-and-ink sketch language with purposeful colour accents." },
  { value: "flat_2d_cartoon", label_vi: "03 · Hoạt hình 2D phẳng", label_en: "03 · Flat 2D cartoon", description_vi: "Nhân vật 2D sạch, hình khối bo tròn và màu phẳng; bối cảnh minh hoạ gọn, sáng, ít chi tiết và bóng mềm.", description_en: "Clean 2D character with rounded shapes and flat colours in a bright, uncluttered illustrated setting with restrained soft shading." },
  { value: "chibi_illustration", label_vi: "04 · Chibi đáng yêu", label_en: "04 · Cute chibi illustration", description_vi: "Nhân vật chibi đầu lớn, mắt to, thân nhỏ, biểu cảm đáng yêu; bối cảnh pastel ấm, mềm và đồng bộ tỷ lệ.", description_en: "Cute chibi character with a large head, large expressive eyes and small body in a warm pastel environment that shares the same stylised scale." },
  { value: "cinematic_cartoon", label_vi: "05 · Hoạt hình điện ảnh", label_en: "05 · Cinematic cartoon", description_vi: "Nhân vật hoạt hình 2D/2.5D rõ nét với tỷ lệ thân thiện; bối cảnh kể chuyện nhiều lớp, ánh sáng điện ảnh ấm và chiều sâu rõ.", description_en: "Polished 2D/2.5D cartoon character with friendly proportions in a layered story setting with warm cinematic light and clear depth." },
  { value: "comic_book", label_vi: "06 · Truyện tranh / Pop-art", label_en: "06 · Comic-book / pop art", description_vi: "Nhân vật viền mực đậm, màu mạnh và chấm halftone; bối cảnh truyện tranh có phối cảnh năng động, hatch và texture in.", description_en: "Bold ink-outlined character, saturated colour and halftone dots in a dynamic comic-book setting with hatching and print texture." },
  { value: "layered_paper_cut", label_vi: "07 · Cắt giấy nhiều lớp", label_en: "07 · Layered paper cut", description_vi: "Nhân vật và bối cảnh đều ghép từ giấy màu nhiều lớp, mép cắt hữu hình, texture sợi giấy và bóng đổ thủ công.", description_en: "Character and environment built from layered coloured paper with visible cut edges, paper fibres and handcrafted cast shadows." },
  { value: "claymation", label_vi: "08 · Đất nặn Claymation", label_en: "08 · Claymation", description_vi: "Nhân vật đất nặn 3D bo tròn, dấu tay và bề mặt lì; bối cảnh mô hình thu nhỏ cùng vật liệu, ánh sáng studio ấm.", description_en: "Rounded 3D clay character with subtle fingerprints and matte handmade surfaces in a matching miniature clay set under warm studio light." },
  { value: "low_poly_3d", label_vi: "09 · 3D Low-poly", label_en: "09 · Low-poly 3D", description_vi: "Nhân vật 3D cấu thành từ các mặt đa giác rõ; bối cảnh low-poly đồng nhất, hình học góc cạnh và ánh sáng khối sạch.", description_en: "Faceted low-poly 3D character in a consistently polygonal environment with angular geometry and clean geometric lighting." },
  { value: "semi_realistic_3d", label_vi: "10 · 3D bán hiện thực", label_en: "10 · Semi-realistic 3D", description_vi: "Nhân vật 3D bán hiện thực, gương mặt thân thiện và vật liệu chi tiết; bối cảnh điện ảnh chân thực vừa phải, ánh sáng ấm và chiều sâu tự nhiên.", description_en: "Friendly semi-realistic 3D character with detailed materials in a moderately realistic cinematic environment with warm light and natural depth." },
  { value: "none", label_vi: "Không nhân vật / chỉ cảnh vật", label_en: "No character / environment only", description_vi: "Cảnh vật, vật liệu và quá trình tự nhiên là chủ thể.", description_en: "Place, material and natural process are the subjects." },
];

/** Every non-photographic representation that must keep the character, setting,
 * props, thumbnail, storyboard and video inside one coherent visual medium. */
export const STYLIZED_CHARACTER_REPRESENTATIONS: readonly CharacterRepresentation[] = [
  "stick_figure",
  "illustrated_2d",
  "stylized_3d",
  "anthropomorphic_animal",
  "anthropomorphic_object",
  "whiteboard_stick_figure",
  "hand_drawn_doodle",
  "flat_2d_cartoon",
  "chibi_illustration",
  "cinematic_cartoon",
  "comic_book",
  "layered_paper_cut",
  "claymation",
  "low_poly_3d",
  "semi_realistic_3d",
];

export function isStylizedCharacterRepresentation(
  value: CharacterRepresentation | string | null | undefined
): value is CharacterRepresentation {
  return STYLIZED_CHARACTER_REPRESENTATIONS.includes(value as CharacterRepresentation);
}

export const SCRIPT_DERIVED_STYLE_WORLD_LAW =
  "SCRIPT-DERIVED WORLD AUTHORITY: the script decides the actual location, terrain or architecture, time, weather, spatial anchors, props and actions in every scene; the selected visual style decides only how that complete story world is rendered. Build every required setting in full inside the same medium as the characters—never replace the scripted place with a blank board, studio backdrop, generic room or decorative template.";

export function characterWorldStylePrompt(
  representation: CharacterRepresentation
): string {
  const laws = CHARACTER_LAWS[representation] ?? [];
  return [
    ...(isStylizedCharacterRepresentation(representation)
      ? [SCRIPT_DERIVED_STYLE_WORLD_LAW]
      : []),
    ...laws,
  ].join(" ");
}

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
  whiteboard_stick_figure: ["WHITEBOARD-LINE STICK-FIGURE STYLE LOCK: draw every character with the same clean black stroke weight, circular head, minimal face marks, thin limbs and tiny controlled colour accents.", "Translate the complete script-derived location—indoor or outdoor, terrain or architecture, spatial anchors and story props—into the same economical black-line illustration language on a clean light canvas. The canvas is a medium, never a literal blank whiteboard or empty studio; no textured skin, live action, 3D volume or painterly drift."],
  hand_drawn_doodle: ["HAND-DRAWN DOODLE STYLE LOCK: use lively pencil-and-ink construction, visible scribble/hatching, simplified anatomy and stable character proportions; reserve colour for a few purposeful accents.", "Translate the complete script-derived location, terrain, architecture and props into the same tactile hand-drawn paper language; arrows or icons appear only when the story needs them. Never replace the real story setting with blank paper, and never drift into polished vector art, photorealism or 3D."],
  flat_2d_cartoon: ["FLAT 2D CARTOON STYLE LOCK: use clean rounded silhouettes, stable 2D proportions, crisp shapes, flat colour fills and only restrained soft cel shading.", "Render props and locations in the same simplified illustrated grammar with a limited harmonious palette, uncluttered geometry and no photoreal textures or 3D materials."],
  chibi_illustration: ["CHIBI STYLE LOCK: preserve the same large-head/small-body ratio, oversized expressive eyes, tiny nose/mouth, rounded hands and cute readable expressions in every shot.", "The environment uses the same soft pastel illustration language, rounded props and miniature scale; no realistic adult anatomy, live-action skin or gritty photographic detail."],
  cinematic_cartoon: ["CINEMATIC CARTOON STYLE LOCK: preserve a polished 2D/2.5D animated character design with friendly proportions, clean contours, controlled cel shading and stable facial features.", "Build layered storybook-like locations with coherent perspective, richer production detail, warm motivated cinematic light and depth, while remaining unmistakably animated rather than photographic."],
  comic_book: ["COMIC-BOOK STYLE LOCK: use bold black ink contours, expressive anatomy, saturated controlled colours, halftone dots, cross-hatching and stable graphic facial design.", "Stage each environment as one coherent comic panel with dynamic perspective and print texture; no speech bubbles, captions or sound-effect text unless explicitly requested, and no photoreal/3D drift."],
  layered_paper_cut: ["LAYERED PAPER-CUT STYLE LOCK: construct the character from stacked coloured-paper shapes with visible cut edges, fibre texture, limited articulation and soft physical layer shadows.", "Construct the full environment from the same layered paper material and handcrafted scale; no plastic, clay, smooth CGI, photographic foliage or live-action surfaces."],
  claymation: ["CLAYMATION STYLE LOCK: model the character from rounded stop-motion clay with stable proportions, matte tactile surfaces, slight handmade imperfections and subtle fingerprints.", "All props and scenery belong to one miniature clay set with consistent scale, warm studio/practical lighting and real contact shadows; no glossy plastic, live-action person or paper-cut drift."],
  low_poly_3d: ["LOW-POLY 3D STYLE LOCK: build the character from clearly faceted polygonal planes with stable mesh proportions, simplified facial planes and a controlled palette.", "The entire set, furniture, plants and props use the same low-poly geometry, angular surfaces and clean geometric light; never mix in smooth photoreal skin or high-detail live-action assets."],
  semi_realistic_3d: ["SEMI-REALISTIC 3D STYLE LOCK: preserve a friendly stylised character with believable anatomy, expressive but controlled eyes, detailed hair/cloth materials and stable face/body proportions.", "Use a moderately realistic cinematic 3D environment with coherent physical materials, warm motivated light and natural depth; keep it visibly rendered and never drift to live-action photography or exaggerated chibi anatomy."],
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
