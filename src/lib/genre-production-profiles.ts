import type {
  DirectingProfileId,
  Genre,
  StoryboardGenerationInput,
} from "@/types";
import type { LockedGenreProductionProfile } from "@/lib/video-context/types";

export type DialogueStyleId =
  | "auto"
  | "direct"
  | "everyday"
  | "witty"
  | "subtext"
  | "intense"
  | "expert"
  | "inspirational"
  | "poetic"
  | "live_commentary"
  | "commercial"
  | "custom";

export type NarratorVoiceStyleId =
  | "auto"
  | "warm"
  | "reflective"
  | "documentary"
  | "inspirational"
  | "dramatic"
  | "expert"
  | "commercial"
  | "poetic"
  | "sports"
  | "custom";

export interface GenreProductionProfile {
  genre: Genre;
  default_dialogue_style: DialogueStyleId;
  allowed_dialogue_styles: DialogueStyleId[];
  default_narrator_style: NarratorVoiceStyleId;
  allowed_narrator_styles: NarratorVoiceStyleId[];
  default_camera_profile: DirectingProfileId;
  allowed_camera_profiles: DirectingProfileId[];
  content_subtypes?: string[];
  script_profile: string;
  voice_performance_profile: string;
  camera_profile: string;
  edit_rhythm: string;
  sound_profile: string;
  forbidden_patterns: string[];
}

const DIALOGUE: Record<Exclude<DialogueStyleId, "auto" | "custom">, string> = {
  direct: "short direct sentences; one idea per turn; concrete verbs; decisive emphasis",
  everyday: "natural everyday phrasing; short-to-medium turns; believable hesitation and response",
  witty: "setup, misdirection and payoff through character-specific wording; hold space for reaction",
  subtext: "restrained lines whose meaning sits in avoidance, reply choice and silence; never narrate visible action",
  intense: "turns shorten as pressure rises; consequential verbs; a brief pause before decisive information; no constant shouting",
  expert: "precise terminology and clear cause-to-mechanism-to-result explanation; state limits and avoid unsupported certainty",
  inspirational: "clear active language, earned emotional lift and memorable emphasis without empty slogans",
  poetic: "image-rich but concise phrasing, spacious cadence and one coherent motif; no decorative abstraction pile-up",
  live_commentary: "track the action in real time, name the decisive change accurately and raise intensity only at real peaks",
  commercial: "one benefit-led message, clear USP/brand/CTA timing, short claims and no feature-list recital",
};

const VOICE: Record<Exclude<NarratorVoiceStyleId, "auto" | "custom">, string> = {
  warm: "warm low-mid register, natural pace, gentle emphasis and welcoming pauses",
  reflective: "restrained low-mid register, measured pace, meaningful pauses and quiet emotional emphasis",
  documentary: "credible neutral register, steady pace, crisp diction and factual emphasis",
  inspirational: "moderate pace with earned rising energy and emphasis on action or possibility",
  dramatic: "controlled intensity, varied pace and a pause before consequential words; never continuous shouting",
  expert: "calm authoritative register, medium pace, exact terminology and careful pronunciation",
  commercial: "confident concise delivery with benefit-led emphasis and exact brand, USP and CTA pronunciation",
  poetic: "soft expressive cadence, spacious pauses and image-led phrasing without melodrama",
  sports: "responsive energetic cadence, accurate names/scores and pitch rise only at genuine peaks",
};

const CAMERA: Partial<Record<DirectingProfileId, string>> = {
  everyday_naturalism: "human-height motivated coverage, readable eyelines, practical light and gentle movement",
  observational_documentary: "patient observational coverage, complete real actions, controlled handheld or locked frames",
  natural_history: "habitat establishing, subject behaviour, macro evidence and patient biologically credible observation",
  poetic_nature: "patient scale changes and one evolving natural motif while preserving real behaviour",
  psychological_metaphor: "one coherent visual metaphor, restrained reaction details and no diagnostic imagery",
  anthropomorphic_fable: "clear silhouettes, stable world scale and consequence-led staging in one graphic grammar",
  creator_ugc: "intentional phone-camera intimacy, controlled handheld, plausible autofocus and practical light",
  cinematic_drama: "objective-led blocking, stable eyelines, reaction close-ups and camera changes only on emotional turns",
  premium_commercial: "controlled product geometry, reflection, material light and precise hero movement",
  explainer_clarity: "one visual job per beat, stable orientation and readable demonstration coverage",
  immersive_action: "clear screen direction, readable threat distance, causal attack-defence-consequence units and kinetic but legible camera",
  reaction_comedy: "stable two-shots/mediums, hold for reaction, one motivated push-in and never cut across the punchline",
  subjective_horror: "negative space, subjective reveal, narrow controlled movement and geography that preserves unseen threat direction",
  soft_romance: "gentle close coverage of eyes/hands, soft motivated light, slow movement and intact eyelines",
  interview_expert: "clean interview axis, readable presenter/expert coverage, evidence inserts and stable eye line",
  product_commercial: "problem/product/benefit proof/hero frame with macro inserts and controlled camera motion",
  luxury_commercial: "clean negative space, macro material detail, controlled reflections and exceptionally smooth slow movement",
  technical_demo: "stable wide-to-insert operation coverage, exact hand-product contact and before/after proof",
  broadcast_sports: "wide tactical geography, tracking action, reaction close-ups and replay only when it clarifies a decisive event",
  cinematic_sports: "athlete-scale movement, spatially readable tracking and selective close detail around a real performance peak",
  rhythmic_music_video: "camera and cut points follow musical structure, recurring visual motif and minimal spoken coverage",
  animation_kids: "clear silhouettes, readable poses, friendly screen direction and simple non-disorienting camera moves",
};

const ALL_DIALOGUE: DialogueStyleId[] = [
  "auto", "direct", "everyday", "witty", "subtext", "intense", "expert",
  "inspirational", "poetic", "live_commentary", "commercial", "custom",
];
const ALL_VOICE: NarratorVoiceStyleId[] = [
  "auto", "warm", "reflective", "documentary", "inspirational", "dramatic",
  "expert", "commercial", "poetic", "sports", "custom",
];

function profile(
  genre: Genre,
  values: Partial<GenreProductionProfile> & Pick<GenreProductionProfile, "script_profile" | "voice_performance_profile" | "camera_profile">
): GenreProductionProfile {
  return {
    genre,
    default_dialogue_style: values.default_dialogue_style ?? "everyday",
    allowed_dialogue_styles: values.allowed_dialogue_styles ?? ["auto", "direct", "everyday", "subtext", "custom"],
    default_narrator_style: values.default_narrator_style ?? "warm",
    allowed_narrator_styles: values.allowed_narrator_styles ?? ["auto", "warm", "reflective", "documentary", "custom"],
    default_camera_profile: values.default_camera_profile ?? "cinematic_drama",
    allowed_camera_profiles: values.allowed_camera_profiles ?? ["auto", "cinematic_drama", "everyday_naturalism"],
    content_subtypes: values.content_subtypes,
    script_profile: values.script_profile,
    voice_performance_profile: values.voice_performance_profile,
    camera_profile: values.camera_profile,
    edit_rhythm: values.edit_rhythm ?? "cut only when information, action or emotion changes; preserve continuity and screen direction",
    sound_profile: values.sound_profile ?? "location ambience and action-led foley support speech; music ducks under every spoken line",
    forbidden_patterns: values.forbidden_patterns ?? ["generic exposition", "camera movement without story purpose"],
  };
}

const AD_SUBTYPES = [
  "affiliate_short",
  "problem_solution", "product_demonstration", "testimonial", "product_lifestyle",
  "emotional_brand_film", "luxury_commercial", "direct_response", "fast_promo", "ugc_unboxing",
];

export const GENRE_PRODUCTION_PROFILES: Record<Genre, GenreProductionProfile> = {
  advertising: profile("advertising", { content_subtypes: AD_SUBTYPES, default_dialogue_style: "commercial", allowed_dialogue_styles: ["auto", "commercial", "direct", "everyday", "expert", "inspirational", "custom"], default_narrator_style: "commercial", allowed_narrator_styles: ["auto", "commercial", "warm", "expert", "inspirational", "custom"], default_camera_profile: "product_commercial", allowed_camera_profiles: ["auto", "product_commercial", "luxury_commercial", "creator_ugc", "premium_commercial"], script_profile: "persuasion follows one audience problem, one provable benefit, one proof moment and one earned CTA", voice_performance_profile: "confident benefit-led delivery with exact brand and CTA pronunciation", camera_profile: CAMERA.product_commercial!, edit_rhythm: "hook immediately, prove the benefit before the CTA, reveal brand assets at a memorable point", sound_profile: "clean dialogue, product foley, controlled music ducking and optional sonic-logo space", forbidden_patterns: ["unsupported claim", "feature-list recital", "brand-name repetition", "product geometry drift"] }),
  product_demo: profile("product_demo", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "direct", "expert", "commercial", "custom"], default_narrator_style: "expert", default_camera_profile: "technical_demo", allowed_camera_profiles: ["auto", "technical_demo", "product_commercial", "explainer_clarity"], script_profile: "state the task, demonstrate exact operation, show observable result and name limits", voice_performance_profile: "clear medium-paced instructional delivery with exact terminology", camera_profile: CAMERA.technical_demo!, forbidden_patterns: ["hidden operation", "impossible hand contact", "unproved result"] }),
  brand_film: profile("brand_film", { default_dialogue_style: "poetic", allowed_dialogue_styles: ["auto", "subtext", "inspirational", "poetic", "custom"], default_narrator_style: "poetic", allowed_narrator_styles: ["auto", "warm", "reflective", "inspirational", "poetic", "custom"], default_camera_profile: "cinematic_drama", allowed_camera_profiles: ["auto", "cinematic_drama", "luxury_commercial", "premium_commercial"], script_profile: "few words, human value and an emotional brand memory; brand meaning is earned by the story", voice_performance_profile: "restrained emotional cadence with space after meaningful words", camera_profile: "cinematic human-scale images, deliberate slow movement and one memorable brand reveal", edit_rhythm: "patient emotional build; no premature sales cadence", forbidden_patterns: ["constant product pushing", "unearned slogan", "generic stock montage"] }),
  luxury: profile("luxury", { default_dialogue_style: "subtext", allowed_dialogue_styles: ["auto", "subtext", "poetic", "commercial", "custom"], default_narrator_style: "reflective", allowed_narrator_styles: ["auto", "reflective", "commercial", "poetic", "custom"], default_camera_profile: "luxury_commercial", allowed_camera_profiles: ["auto", "luxury_commercial", "premium_commercial"], script_profile: "minimal precise language communicates craft, provenance and desire without shouting status", voice_performance_profile: "low-to-mid restrained delivery, slower pace and long controlled pauses", camera_profile: CAMERA.luxury_commercial!, edit_rhythm: "slow precise reveals and clean holds", sound_profile: "tactile material foley, sparse score and silence around the hero moment", forbidden_patterns: ["hard sell", "busy frame", "fast random cuts", "exaggerated claim"] }),
  promo: profile("promo", { default_dialogue_style: "direct", allowed_dialogue_styles: ["auto", "direct", "commercial", "custom"], default_narrator_style: "commercial", default_camera_profile: "product_commercial", allowed_camera_profiles: ["auto", "product_commercial", "creator_ugc"], script_profile: "offer, value, deadline and action are stated quickly in a single hierarchy", voice_performance_profile: "bright fast but intelligible delivery with exact price, date and CTA", camera_profile: CAMERA.product_commercial!, edit_rhythm: "fast readable cuts with the CTA early enough to act", forbidden_patterns: ["buried offer", "unreadable price hierarchy", "false urgency"] }),
  unboxing: profile("unboxing", { default_dialogue_style: "everyday", allowed_dialogue_styles: ["auto", "everyday", "witty", "direct", "commercial", "custom"], default_narrator_style: "warm", default_camera_profile: "creator_ugc", allowed_camera_profiles: ["auto", "creator_ugc", "technical_demo", "product_commercial"], script_profile: "curiosity, package detail, reveal, genuine first reaction and practical observation", voice_performance_profile: "conversational spontaneous delivery with natural reaction pauses", camera_profile: CAMERA.creator_ugc!, edit_rhythm: "follow the physical unboxing order; never reveal the product before the opening action", forbidden_patterns: ["scripted fake amazement", "missing package continuity", "product mismatch"] }),

  drama: profile("drama", { default_dialogue_style: "subtext", allowed_dialogue_styles: ["auto", "everyday", "subtext", "intense", "witty", "custom"], default_narrator_style: "reflective", default_camera_profile: "cinematic_drama", script_profile: "relationship objectives, subtext and a consequential turn drive each exchange", voice_performance_profile: "natural variation, restrained emotion and character-specific rhythm", camera_profile: CAMERA.cinematic_drama!, forbidden_patterns: ["on-the-nose emotion", "empty reaction", "camera change without power shift"] }),
  action: profile("action", { default_dialogue_style: "direct", allowed_dialogue_styles: ["auto", "direct", "intense", "custom"], default_narrator_style: "dramatic", allowed_narrator_styles: ["auto", "dramatic", "documentary", "custom"], default_camera_profile: "immersive_action", allowed_camera_profiles: ["auto", "immersive_action", "cinematic_drama"], script_profile: "dialogue is sparse and tactical; visible objective, threat, counteraction and consequence carry the scene", voice_performance_profile: "short breath-aware lines, controlled urgency and no explanatory combat chatter", camera_profile: CAMERA.immersive_action!, edit_rhythm: "one readable confrontation unit per clip; accelerate only with the danger", sound_profile: "distance-specific impacts, breath, foot contact and environment response; music never hides causality", forbidden_patterns: ["pose-only combat", "attackers waiting turns", "four simultaneous moves", "hero glamour without stakes"] }),
  comedy: profile("comedy", { default_dialogue_style: "witty", allowed_dialogue_styles: ["auto", "everyday", "witty", "direct", "custom"], default_narrator_style: "warm", default_camera_profile: "reaction_comedy", allowed_camera_profiles: ["auto", "reaction_comedy", "everyday_naturalism"], script_profile: "setup, misread or reversal, then a character-specific payoff with reaction space", voice_performance_profile: "quick natural rhythm with a clean pause before or after the punchline", camera_profile: CAMERA.reaction_comedy!, forbidden_patterns: ["explaining the joke", "cutting off reaction", "same joke repeated"] }),
  sitcom: profile("sitcom", { default_dialogue_style: "everyday", allowed_dialogue_styles: ["auto", "everyday", "witty", "subtext", "custom"], default_camera_profile: "reaction_comedy", allowed_camera_profiles: ["auto", "reaction_comedy", "everyday_naturalism"], script_profile: "repeatable relationship dynamics, conversational turns and a reaction line land the scene", voice_performance_profile: "steady conversational rhythm with distinct character timing", camera_profile: "stable medium/two-shot coverage, clear eyelines and reaction inserts", forbidden_patterns: ["single-person monologue replacing exchange", "lost eyeline"] }),
  horror: profile("horror", { default_dialogue_style: "subtext", allowed_dialogue_styles: ["auto", "subtext", "direct", "intense", "custom"], default_narrator_style: "dramatic", default_camera_profile: "subjective_horror", allowed_camera_profiles: ["auto", "subjective_horror", "cinematic_drama"], script_profile: "withhold information, use sparse uncertain speech and let space/sound create dread", voice_performance_profile: "low restrained delivery, uneven breath and meaningful silence", camera_profile: CAMERA.subjective_horror!, edit_rhythm: "slow reveal before any acceleration; jumps only when causally earned", sound_profile: "negative space, directional ambience and precise off-screen cues", forbidden_patterns: ["constant jumpscare", "monster exposition", "random darkness"] }),
  romance: profile("romance", { default_dialogue_style: "subtext", allowed_dialogue_styles: ["auto", "everyday", "subtext", "poetic", "custom"], default_narrator_style: "warm", default_camera_profile: "soft_romance", allowed_camera_profiles: ["auto", "soft_romance", "cinematic_drama"], script_profile: "intimacy grows through specific attention, avoidance and small reciprocal choices", voice_performance_profile: "soft close delivery, natural breath and gentle emotional variation", camera_profile: CAMERA.soft_romance!, forbidden_patterns: ["generic love declaration", "forced physical intimacy", "eyeline mismatch"] }),
  thriller: profile("thriller", { default_dialogue_style: "intense", allowed_dialogue_styles: ["auto", "direct", "subtext", "intense", "custom"], default_narrator_style: "dramatic", default_camera_profile: "subjective_horror", allowed_camera_profiles: ["auto", "subjective_horror", "cinematic_drama", "immersive_action"], script_profile: "short lines conceal information and each reveal changes risk or choice", voice_performance_profile: "controlled tension, clipped phrases and pauses before withheld facts", camera_profile: "tight obstructed framing, motivated push-ins and preserved threat direction", forbidden_patterns: ["premature explanation", "random twist", "geography loss"] }),
  "sci-fi": profile("sci-fi", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "direct", "expert", "subtext", "custom"], default_narrator_style: "documentary", default_camera_profile: "cinematic_drama", script_profile: "use exact world terminology through character need; explain only what changes the current decision", voice_performance_profile: "clear terminology and controlled wonder without lecture cadence", camera_profile: "precise scale, internally consistent technology light and readable spatial systems", forbidden_patterns: ["technology lecture", "rule-breaking gadget", "random neon"] }),
  fantasy: profile("fantasy", { default_dialogue_style: "poetic", allowed_dialogue_styles: ["auto", "subtext", "poetic", "inspirational", "custom"], default_narrator_style: "poetic", default_camera_profile: "cinematic_drama", script_profile: "image-rich but socially grounded language reveals world rules through choice and cost", voice_performance_profile: "measured expressive delivery with clear invented-name pronunciation", camera_profile: "world discovery, scale and tactile internal physics with cinematic movement", forbidden_patterns: ["modern slang without cause", "magic without cost", "world-rule drift"] }),
  historical: profile("historical", { default_dialogue_style: "subtext", allowed_dialogue_styles: ["auto", "subtext", "direct", "poetic", "custom"], default_narrator_style: "documentary", default_camera_profile: "cinematic_drama", script_profile: "speech reflects period, rank and relationship without sounding like a modern paraphrase", voice_performance_profile: "measured diction and socially appropriate restraint", camera_profile: "formal blocking, period-valid material detail and no modern camera-language intrusion in the world", forbidden_patterns: ["anachronistic words", "modern prop", "rank-insensitive address"] }),
  mythology: profile("mythology", { default_dialogue_style: "poetic", allowed_dialogue_styles: ["auto", "poetic", "inspirational", "direct", "custom"], default_narrator_style: "dramatic", default_camera_profile: "cinematic_drama", script_profile: "elevated concise language connects symbol, vow, trial and consequence", voice_performance_profile: "resonant decisive cadence with controlled epic emphasis", camera_profile: "large-scale symbolic compositions and purposeful low angles", forbidden_patterns: ["constant grandstanding", "symbol without consequence"] }),
  animation: profile("animation", { default_dialogue_style: "witty", allowed_dialogue_styles: ["auto", "direct", "everyday", "witty", "inspirational", "custom"], default_narrator_style: "warm", default_camera_profile: "animation_kids", allowed_camera_profiles: ["auto", "animation_kids", "reaction_comedy", "cinematic_drama"], script_profile: "clear emotional intent and character-specific rhythm support readable poses and visual timing", voice_performance_profile: "wider but controlled emotional variation and crisp diction", camera_profile: CAMERA.animation_kids!, forbidden_patterns: ["style drift", "muddy silhouette", "photoreal insert"] }),
  documentary: profile("documentary", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "expert", "direct", "everyday", "custom"], default_narrator_style: "documentary", default_camera_profile: "observational_documentary", allowed_camera_profiles: ["auto", "observational_documentary", "interview_expert", "natural_history"], script_profile: "separate observation, evidence and inference; narration adds context instead of describing the image", voice_performance_profile: "neutral credible delivery with exact names, dates and terms", camera_profile: CAMERA.observational_documentary!, forbidden_patterns: ["staged glamour posing", "unsupported fact", "narrating visible action"] }),
  mockumentary: profile("mockumentary", { default_dialogue_style: "everyday", allowed_dialogue_styles: ["auto", "everyday", "witty", "subtext", "custom"], default_narrator_style: "documentary", default_camera_profile: "creator_ugc", allowed_camera_profiles: ["auto", "creator_ugc", "observational_documentary", "reaction_comedy"], script_profile: "natural hesitation, unreliable self-presentation and reaction-based humour", voice_performance_profile: "conversational imperfection without losing intelligibility", camera_profile: "controlled handheld, reaction zooms and motivated looks to camera", forbidden_patterns: ["sitcom laugh-track writing", "random shaky camera"] }),
  music_video: profile("music_video", { default_dialogue_style: "poetic", allowed_dialogue_styles: ["auto", "poetic", "direct", "custom"], default_narrator_style: "poetic", default_camera_profile: "rhythmic_music_video", allowed_camera_profiles: ["auto", "rhythmic_music_video", "cinematic_drama"], script_profile: "lyrics/music own the emotional arc; spoken text is minimal and never competes with the track", voice_performance_profile: "when speech exists, fit it between musical phrases without changing song identity", camera_profile: CAMERA.rhythmic_music_video!, edit_rhythm: "cuts and movement follow musical sections, not arbitrary beat spam", forbidden_patterns: ["dialogue over every lyric", "unrelated visual motif"] }),
  kids: profile("kids", { default_dialogue_style: "direct", allowed_dialogue_styles: ["auto", "direct", "everyday", "witty", "inspirational", "custom"], default_narrator_style: "warm", default_camera_profile: "animation_kids", allowed_camera_profiles: ["auto", "animation_kids", "everyday_naturalism"], script_profile: "simple concrete sentences, positive energy and one understandable cause per beat", voice_performance_profile: "warm clear diction, moderate pace and expressive but non-shouting energy", camera_profile: CAMERA.animation_kids!, forbidden_patterns: ["adult abstraction", "frightening disorientation", "rapid unreadable action"] }),

  numerology: profile("numerology", { default_dialogue_style: "inspirational", allowed_dialogue_styles: ["auto", "inspirational", "expert", "everyday", "custom"], default_narrator_style: "warm", default_camera_profile: "explainer_clarity", script_profile: "connect the selected number to a recognisable situation without manufacturing scientific authority", voice_performance_profile: "approachable analytical delivery with accurate number pronunciation", camera_profile: "clear symbolic illustration and one idea per image", forbidden_patterns: ["medical or scientific certainty", "unrelated mystical props"] }),
  health: profile("health", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "expert", "direct", "everyday", "custom"], default_narrator_style: "expert", default_camera_profile: "interview_expert", allowed_camera_profiles: ["auto", "interview_expert", "technical_demo", "explainer_clarity"], script_profile: "state evidence, mechanism, limits and when professional help matters; avoid diagnosis", voice_performance_profile: "calm exact delivery with careful medical pronunciation and no alarmism", camera_profile: CAMERA.interview_expert!, forbidden_patterns: ["unsupported cure", "diagnosis from appearance", "authority theatre"] }),
  psychology: profile("psychology", { default_dialogue_style: "subtext", allowed_dialogue_styles: ["auto", "everyday", "subtext", "expert", "inspirational", "custom"], default_narrator_style: "reflective", default_camera_profile: "psychological_metaphor", script_profile: "empathetic non-judgmental language moves from observable pattern to compassionate reframe", voice_performance_profile: "gentle measured pace with natural pauses and no diagnostic certainty", camera_profile: CAMERA.psychological_metaphor!, forbidden_patterns: ["diagnosing viewer", "shaming label", "fake prevalence"] }),
  life_wisdom: profile("life_wisdom", { default_dialogue_style: "inspirational", allowed_dialogue_styles: ["auto", "everyday", "subtext", "inspirational", "poetic", "custom"], default_narrator_style: "reflective", default_camera_profile: "anthropomorphic_fable", allowed_camera_profiles: ["auto", "anthropomorphic_fable", "psychological_metaphor", "cinematic_drama"], script_profile: "a familiar choice creates a visible consequence; state the lesson only after the action proves it", voice_performance_profile: "warm moderate pace with a reflective pause before the earned conclusion", camera_profile: CAMERA.anthropomorphic_fable!, forbidden_patterns: ["opening lecture", "moral superiority", "unrelated metaphor"] }),
  education: profile("education", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "expert", "direct", "everyday", "custom"], default_narrator_style: "expert", default_camera_profile: "explainer_clarity", script_profile: "question, mechanism, concrete example and takeaway; one concept at a time", voice_performance_profile: "clear medium pace with exact term emphasis and pronunciation", camera_profile: CAMERA.explainer_clarity!, forbidden_patterns: ["concept pile-up", "decorative diagram", "undefined jargon"] }),
  finance: profile("finance", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "expert", "direct", "custom"], default_narrator_style: "expert", default_camera_profile: "explainer_clarity", script_profile: "define numbers, assumptions, downside and uncertainty before any conclusion", voice_performance_profile: "calm precise delivery with exact numbers, currencies and risk terms", camera_profile: "purposeful comparison and chart logic with no get-rich imagery", forbidden_patterns: ["guaranteed return", "missing risk", "wealth fantasy"] }),
  tech: profile("tech", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "expert", "direct", "commercial", "custom"], default_narrator_style: "expert", default_camera_profile: "technical_demo", script_profile: "explain the user problem, function, mechanism and observable result without jargon dumping", voice_performance_profile: "clean modern delivery with exact product and technical pronunciation", camera_profile: CAMERA.technical_demo!, forbidden_patterns: ["feature dump", "fake interface", "mispronounced acronym"] }),

  cooking: profile("cooking", { default_dialogue_style: "direct", allowed_dialogue_styles: ["auto", "direct", "expert", "everyday", "custom"], default_narrator_style: "warm", default_camera_profile: "technical_demo", allowed_camera_profiles: ["auto", "technical_demo", "everyday_naturalism"], script_profile: "explain only the necessary step, sensory cue and transformation; ASMR modes stay wordless", voice_performance_profile: "clear step guidance or intentional silence; never talk over key cooking sounds", camera_profile: "macro ingredient evidence, exact hand-tool contact and continuous food transformation", sound_profile: "close tactile cutting, sizzling, bubbling and room/outdoor ambience; music ducks or stays absent", forbidden_patterns: ["missing ingredient transition", "impossible utensil action", "speech over ASMR"] }),
  fitness: profile("fitness", { default_dialogue_style: "direct", allowed_dialogue_styles: ["auto", "direct", "expert", "inspirational", "custom"], default_narrator_style: "inspirational", default_camera_profile: "technical_demo", script_profile: "cue one movement objective, form checkpoint and safe progression at a time", voice_performance_profile: "clear coaching energy, count rhythm and exact anatomical cue pronunciation", camera_profile: "full-body form visibility plus joint-specific insert without hiding alignment", forbidden_patterns: ["unsafe promise", "hidden joint", "random motivational shouting"] }),
  lifestyle: profile("lifestyle", { default_dialogue_style: "everyday", allowed_dialogue_styles: ["auto", "everyday", "witty", "subtext", "commercial", "custom"], default_narrator_style: "warm", default_camera_profile: "everyday_naturalism", script_profile: "friendly situational language and believable use; never read like a feature list", voice_performance_profile: "approachable conversational delivery with natural pauses", camera_profile: CAMERA.everyday_naturalism!, forbidden_patterns: ["forced influencer enthusiasm", "showroom-perfect life"] }),
  travel: profile("travel", { default_dialogue_style: "poetic", allowed_dialogue_styles: ["auto", "everyday", "inspirational", "poetic", "expert", "custom"], default_narrator_style: "documentary", default_camera_profile: "poetic_nature", allowed_camera_profiles: ["auto", "poetic_nature", "observational_documentary", "everyday_naturalism"], script_profile: "place-specific sensory observation, local context and journey change; avoid generic superlatives", voice_performance_profile: "curious grounded delivery with exact local-name pronunciation", camera_profile: "establish geography, local detail and movement through the place", forbidden_patterns: ["generic paradise copy", "culture mismatch", "location-name error"] }),
  nature: profile("nature", { default_dialogue_style: "expert", allowed_dialogue_styles: ["auto", "expert", "poetic", "custom"], default_narrator_style: "documentary", default_camera_profile: "natural_history", allowed_camera_profiles: ["auto", "natural_history", "poetic_nature"], script_profile: "observe real behaviour and ecological cause without anthropomorphic certainty", voice_performance_profile: "restrained patient narration with exact species/place pronunciation", camera_profile: CAMERA.natural_history!, sound_profile: "real habitat ambience and subject-scale foley; music remains secondary", forbidden_patterns: ["false biology", "incompatible habitat", "human-like motive claim"] }),
  sports: profile("sports", { default_dialogue_style: "live_commentary", allowed_dialogue_styles: ["auto", "live_commentary", "direct", "expert", "inspirational", "custom"], default_narrator_style: "sports", allowed_narrator_styles: ["auto", "sports", "documentary", "inspirational", "custom"], default_camera_profile: "broadcast_sports", allowed_camera_profiles: ["auto", "broadcast_sports", "cinematic_sports", "immersive_action"], script_profile: "follow actual play, tactical change and consequence; reserve elevated language for the genuine peak", voice_performance_profile: "accurate names, scores and terminology with energy tracking real action", camera_profile: CAMERA.broadcast_sports!, edit_rhythm: "wide tactical context, action tracking, reaction and replay only when it clarifies", forbidden_patterns: ["invented score", "mispronounced athlete", "constant climax"] }),
  other: profile("other", { default_dialogue_style: "everyday", allowed_dialogue_styles: ALL_DIALOGUE, default_narrator_style: "auto", allowed_narrator_styles: ALL_VOICE, default_camera_profile: "cinematic_drama", script_profile: "derive sentence craft from the approved intent and cast without importing an unrelated genre formula", voice_performance_profile: "derive relative delivery from role, emotion and platform while preserving voice identity", camera_profile: "choose one coherent grammar from the story and preserve screen direction", forbidden_patterns: ["mixed incompatible genre grammar", "generic default country or setting"] }),
};

export const ADVERTISING_SUBTYPE_LABELS: Record<string, { vi: string; en: string }> = {
  affiliate_short: { vi: "Affiliate 15–30s từ ảnh sản phẩm", en: "15–30s affiliate from product images" },
  problem_solution: { vi: "TVC vấn đề → giải pháp", en: "Problem → solution TVC" },
  product_demonstration: { vi: "Trình diễn sản phẩm", en: "Product demonstration" },
  testimonial: { vi: "Testimonial / trải nghiệm", en: "Testimonial / experience" },
  product_lifestyle: { vi: "Lifestyle có sản phẩm", en: "Product lifestyle" },
  emotional_brand_film: { vi: "Phim thương hiệu cảm xúc", en: "Emotional brand film" },
  luxury_commercial: { vi: "Quảng cáo cao cấp", en: "Luxury commercial" },
  direct_response: { vi: "Direct response / chốt đơn", en: "Direct response" },
  fast_promo: { vi: "Khuyến mãi nhanh", en: "Fast promotion" },
  ugc_unboxing: { vi: "UGC / unboxing", en: "UGC / unboxing" },
};

const ADVERTISING_SUBTYPE_DIRECTIONS: Record<string, Partial<LockedGenreProductionProfile>> = {
  affiliate_short: {
    script_direction: "open on one recognisable user problem, reveal the product by 3-5 seconds, demonstrate one real operation, show an observable result, state only a human-approved claim and close on one exact CTA",
    voice_direction: "fast clear benefit-led delivery with exact product and CTA pronunciation; no unsupported superlatives or feature-list recital",
    camera_direction: "problem evidence, canonical product reveal, exact hand-to-product operation, visible result and a clean conversion frame; product geometry and branding remain image-locked",
    edit_rhythm: "15s = two ordered clips; 20s = two clips; 30s = three clips; every cut advances problem, operation, proof or CTA",
    sound_direction: "tactile product-operation foley and clean speech; music ducks under every claim and CTA",
  },
  problem_solution: {
    script_direction: "open on a recognisable problem, show the mechanism of relief, prove one benefit and end on an earned CTA",
    voice_direction: "empathetic problem recognition, then confident benefit emphasis without alarmism",
    camera_direction: "problem hook, product interaction, observable before/after proof and a clean hero frame",
  },
  product_demonstration: {
    script_direction: "state one task, demonstrate exact operation and name the observable result and limit",
    voice_direction: "clear precise instructional delivery with exact feature and control pronunciation",
    camera_direction: CAMERA.technical_demo,
  },
  testimonial: {
    script_direction: "use specific first-person experience, one credible detail and one bounded result; never fabricate universal proof",
    voice_direction: "natural conversational delivery with believable hesitation and no polished announcer cadence",
    camera_direction: "human-height interview or UGC coverage with evidence inserts tied to the claim",
  },
  product_lifestyle: {
    script_direction: "show the product solving a real routine need; dialogue stays natural and the benefit emerges through use",
    voice_direction: "friendly everyday delivery, no feature-list rhythm",
    camera_direction: "motivated lifestyle coverage with one readable use moment and restrained product emphasis",
  },
  emotional_brand_film: {
    script_direction: "build one human value and emotional consequence before a concise brand meaning reveal",
    voice_direction: "restrained warm cadence with meaningful pauses and no hard sell",
    camera_direction: "cinematic human-scale story images and one memorable brand reveal",
    edit_rhythm: "patient emotional build with room for reaction",
  },
  luxury_commercial: {
    script_direction: "use minimal precise language about craft, material or provenance; desire comes from detail, not claim volume",
    voice_direction: "low-to-mid restrained delivery, slow pace and long controlled pauses",
    camera_direction: CAMERA.luxury_commercial,
    edit_rhythm: "slow precise material reveals and clean holds",
  },
  direct_response: {
    script_direction: "state one pain, one differentiated benefit, one proof and one specific action without detours",
    voice_direction: "fast confident delivery with crisp benefit and CTA emphasis, still fully intelligible",
    camera_direction: "immediate problem/product readability, proof insert, offer hierarchy and CTA frame",
    edit_rhythm: "fast causal sequence; CTA appears early and repeats only if the brief requires it",
  },
  fast_promo: {
    script_direction: "offer, value, deadline and action follow one short hierarchy",
    voice_direction: "bright quick delivery with exact price, date and condition pronunciation",
    camera_direction: "fast readable product cuts, ordered offer information and an early CTA",
    edit_rhythm: "quick but legible; never sacrifice offer comprehension",
  },
  ugc_unboxing: {
    script_direction: "curiosity, package detail, reveal, genuine reaction and one practical observation",
    voice_direction: "conversational spontaneous delivery with natural reveal pauses",
    camera_direction: CAMERA.creator_ugc,
    edit_rhythm: "follow the physical opening order and hold the real reaction",
  },
};

export function genreProductionProfile(genre: Genre): GenreProductionProfile {
  return GENRE_PRODUCTION_PROFILES[genre] ?? GENRE_PRODUCTION_PROFILES.other;
}

function compactCustom(value: string | null | undefined, max = 480): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function compactUnique(parts: Array<string | null | undefined>, max = 720): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const clean = compactCustom(part, max);
    const key = clean.toLowerCase().replace(/[.;]+$/g, "");
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
  }
  return unique.join("; ").slice(0, max).replace(/[;, ]+$/g, "");
}

function voiceSettingsText(input: StoryboardGenerationInput): string {
  const v = input.voice_performance;
  if (!v) return "";
  return [
    v.role && v.role !== "auto" ? `role=${v.role}` : "",
    v.relative_pitch && v.relative_pitch !== "auto" ? `relative_pitch=${v.relative_pitch}` : "",
    v.pace && v.pace !== "auto" ? `pace=${v.pace}` : "",
    v.target_wpm ? `target_wpm=${v.target_wpm}` : "",
    v.energy && v.energy !== "auto" ? `energy=${v.energy}` : "",
    v.variation && v.variation !== "auto" ? `variation=${v.variation}` : "",
    v.articulation && v.articulation !== "auto" ? `articulation=${v.articulation}` : "",
    v.pause_style && v.pause_style !== "auto" ? `pauses=${v.pause_style}` : "",
    v.emphasis && v.emphasis !== "auto" ? `emphasis=${v.emphasis}` : "",
    compactCustom(v.pronunciation_guide, 600) ? `pronunciation=${compactCustom(v.pronunciation_guide, 600)}` : "",
  ].filter(Boolean).join(", ");
}

export function lockGenreProductionProfile(
  input: StoryboardGenerationInput
): LockedGenreProductionProfile {
  const profile = genreProductionProfile(input.genre);
  const requestedDialogueStyle = input.dialogue_style_id as DialogueStyleId | undefined;
  const requestedNarratorStyle = input.narrator_voice_style_id as NarratorVoiceStyleId | undefined;
  const dialogueStyleId = !requestedDialogueStyle || requestedDialogueStyle === "auto"
    ? profile.default_dialogue_style
    : requestedDialogueStyle;
  const narratorStyleId = !requestedNarratorStyle || requestedNarratorStyle === "auto"
    ? profile.default_narrator_style
    : requestedNarratorStyle;
  const cameraProfileId = input.directing_profile && input.directing_profile !== "auto"
    ? input.directing_profile
    : profile.default_camera_profile;
  const customVoice = compactCustom(input.narrator_voice_style);
  const customDialogue = compactCustom(input.character_dialogue_style);
  const subtypeDirection = input.genre === "advertising" && input.content_subtype
    ? ADVERTISING_SUBTYPE_DIRECTIONS[input.content_subtype]
    : undefined;
  const dialogueDirection = DIALOGUE[dialogueStyleId as keyof typeof DIALOGUE];
  const narratorDirection = VOICE[narratorStyleId as keyof typeof VOICE];
  const selectedCameraDirection = CAMERA[cameraProfileId];
  return {
    registry_version: "1.0",
    genre: input.genre,
    content_subtype: input.content_subtype || undefined,
    dialogue_style_id: dialogueStyleId,
    narrator_voice_style_id: narratorStyleId,
    camera_profile_id: cameraProfileId,
    script_direction: compactUnique([
      profile.script_profile,
      subtypeDirection?.script_direction,
      dialogueDirection,
      dialogueStyleId === "custom" ? customDialogue : "",
    ]),
    voice_direction: compactUnique([
      profile.voice_performance_profile,
      subtypeDirection?.voice_direction,
      narratorDirection,
      narratorStyleId === "custom" ? customVoice : "",
      voiceSettingsText(input),
    ]),
    camera_direction: compactUnique([
      profile.camera_profile,
      subtypeDirection?.camera_direction,
      selectedCameraDirection,
      compactCustom(input.camera_profile_custom),
    ]),
    edit_rhythm: subtypeDirection?.edit_rhythm || profile.edit_rhythm,
    sound_direction: subtypeDirection?.sound_direction || profile.sound_profile,
    forbidden_patterns: profile.forbidden_patterns,
    voice_performance: input.voice_performance as LockedGenreProductionProfile["voice_performance"],
  };
}

export function compactGenreScriptDirective(input: StoryboardGenerationInput): string {
  const p = lockGenreProductionProfile(input);
  return `GENRE SCRIPT PROFILE (${p.genre}${p.content_subtype ? `/${p.content_subtype}` : ""}): ${p.script_direction}. Preserve individual character voice; this profile controls sentence craft, not identity.`;
}

export function compactGenreStoryboardDirective(input: StoryboardGenerationInput): string {
  const p = lockGenreProductionProfile(input);
  return `GENRE DIRECTION (${p.camera_profile_id}): camera=${p.camera_direction}; edit=${p.edit_rhythm}; sound=${p.sound_direction}; avoid=${p.forbidden_patterns.join(", ")}.`;
}
