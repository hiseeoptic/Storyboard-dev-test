import type { ActiveStoryboardRulePacket } from "./active-packet.ts";

export type GenerationPromptResponsibility =
  | "authority_resolution"
  | "clip_execution"
  | "scene_intent"
  | "identity_and_references"
  | "world_and_state_continuity"
  | "environment_routing"
  | "spatial_and_physical_continuity"
  | "camera_light_and_performance"
  | "dialogue_and_audio"
  | "render_safety"
  | "output_contract";

export interface GenerationPromptModule {
  id: string;
  responsibility: GenerationPromptResponsibility;
  content: string;
}

export interface CompiledGenerationSystemPrompt {
  prompt: string;
  module_ids: string[];
  character_count: number;
}

export interface GenerationPromptOptions {
  has_any_uploaded_references?: boolean;
  environment_catalog?: string;
}

/** Typical V7 output stays below 16k; this fail-safe ceiling leaves room for
 * explicit user camera grammar and named universe exceptions without silently
 * truncating higher-authority input. */
export const GENERATION_PROMPT_MAX_CHARS = 20_000;

export const REQUIRED_GENERATION_RESPONSIBILITIES: readonly GenerationPromptResponsibility[] = [
  "authority_resolution",
  "clip_execution",
  "scene_intent",
  "identity_and_references",
  "world_and_state_continuity",
  "environment_routing",
  "spatial_and_physical_continuity",
  "camera_light_and_performance",
  "dialogue_and_audio",
  "render_safety",
  "output_contract",
] as const;

export function buildRoutedStoryboardStructureDirective(
  hookMode: ActiveStoryboardRulePacket["hook"]["mode"] | undefined,
  legacyHardMarketingArc: boolean
): string {
  if (hookMode === "required_by_menu") {
    return "The resolved menu authority requires an attention-opening first segment. Its exact hook form and any final CTA must still follow the approved script, selected format, Project Intent and story logic.";
  }
  if (hookMode === "intent_gated") {
    return "No universal Hook Window applies. Preserve the approved opening; enable a formal hook only when Project Intent, Scene Intent or the current script requires it. Never add a generic CTA to an ending whose function is emotional, informational, observational or atmospheric.";
  }
  return legacyHardMarketingArc
    ? "This project intent requires an attention-opening first segment and an earned CTA in the final segment; their exact form must still follow the approved script and story logic."
    : "The first segment still requires an intent-appropriate 3-5 second Hook Window, but do NOT turn it into generic marketing clickbait and do NOT automatically add a CTA. The final segment performs only the ending function justified by the approved script.";
}

function module(
  id: string,
  responsibility: GenerationPromptResponsibility,
  content: string
): GenerationPromptModule {
  return { id, responsibility, content: content.trim() };
}

function identityModule(
  packet: ActiveStoryboardRulePacket,
  options: GenerationPromptOptions
): GenerationPromptModule {
  if (options.has_any_uploaded_references) {
    return module("reference_binding", "identity_and_references", `REFERENCE AUTHORITY:
- Uploaded character, product, ingredient/object, and location images outrank prose and invention for the surfaces they actually show. Bind every reference to its exact menu name/group; never merge, swap, omit, redesign, or let a generated anchor override it.
- For an uploaded character, the image alone owns face, anatomy, hair, age appearance, and body. Do not infer or serialize those traits. Use the exact name plus role, position, action, expression, and one context-derived wardrobe lock; never copy clothing from reference pixels.
- A verified product keeps exact category, geometry, material, colour, parts, and legible branding. Never substitute a related object type. An uploaded location keeps its real topology, landmarks, materials, and light; stage only actions its affordances permit.
- Write each static identity once in character_locks/product_dna/scene_bible. Scene fields refer to canonical names and changing state only; repeated paraphrases are conflicting authorities.
- Reference truth never licenses unrelated readable text. Visible text remains governed by mode=${packet.visible_text.mode}.`);
  }
  return module("generated_identity", "identity_and_references", `GENERATED IDENTITY AUTHORITY:
- Create only the cast, products, props, and locations justified by the approved script and menu. Closed user-cast names are fixed tokens; never add a default/example person, merge roles, create a lookalike, or reference a real public figure.
- Define each text-only character once in character_locks with stable casting, distinguishing visual DNA, context-appropriate wardrobe/materials, expression baseline, and voice. Define product_dna and scene_bible once when applicable.
- Scene fields use exact canonical names plus current position, pose, action, expression, holder, and prop state. Do not restate or paraphrase static DNA throughout the JSON.`);
}

function dialogueModule(packet: ActiveStoryboardRulePacket): GenerationPromptModule {
  const preserve = [
    "preserve_user_verbatim",
    "use_editorial_revision",
    "use_generated_script",
    "preserve_current_edit",
  ].includes(packet.dialogue.mode);
  const authority = preserve
    ? "The current script version is creative authority. Preserve every enabled spoken line, language, order, speaker ownership, and causal meaning; do not run another editorial pass."
    : packet.dialogue.mode === "editorial_polish"
      ? "The menu explicitly authorizes one creative polish pass. Improve only enabled speech channels and the opening when justified, while preserving cast, relationships, world, plot facts, props, causal reveals, meaning, and ending. Give speakers distinct voice and subtext; do not replace the premise."
      : "No approved dialogue wording is locked. Author speech only when enabled and justified by Scene Intent; intentional wordless storytelling remains valid.";
  return module(
    preserve ? "dialogue_preservation" : "dialogue_authoring",
    "dialogue_and_audio",
    `DIALOGUE AND AUDIO:
- ${authority}
- The user prompt owns speech-channel selection, language, voice profiles, music, ambience, and foley. A disabled channel stays empty; never invent narration to fill silence or turn action directions/titles into spoken lines.
- dialogue_lines is the only numeric clock. Turns are sequential and non-overlapping; one mouth moves at a time. Use at most three turns and normally two speakers per clip, with on-screen speakers bound to a beat that shows them. Off-screen and voice-over delivery retain their declared visibility rules.
- Assign natural delivery windows and leave breathing/reaction room. Never speed up a voice, overlap speakers, duplicate a line in motion_prompt, or silently reassign a speaker to make text fit. Move only a whole authorized thought to an adjacent compatible clip when the selected dialogue authority permits redistribution.
- Foley follows visible contact and effect; loud impacts do not overlap speech. Continuous locations preserve their acoustic bed, while declared location/time cuts reset only the named audio dimensions.`
  );
}

function intentModule(packet: ActiveStoryboardRulePacket): GenerationPromptModule {
  const hook = packet.hook.mode === "required_by_menu"
    ? `The explicit menu requires an immediate, honest opening promise (${packet.hook.evidence.join(", ") || "selected project intent"}). Choose its form from the approved format and story; never force generic clickbait.`
    : "No universal hook recipe applies. Enable a formal hook only when Project Intent, Scene Intent, or the approved script requires it; preserve a legitimate observational, atmospheric, or gradual opening.";
  return module("scene_intent_router", "scene_intent", `SCENE INTENT AND STORY CAUSALITY:
- Project Intent and the approved/current script decide structure. Marketing, narrative, documentary, education, atmosphere, comedy, music-driven, symbolic, and experimental work must not be forced into one template.
- ${hook}
- Every segment has one primary function, an observable before→trigger→after change, proof that must be shown/heard, and entry/exit state. Every later event must be enabled by an earlier cause or a declared edit transition; do not write disconnected "then...then" activity.
- "marketing_role" is compatibility metadata, not authority to invent a sales arc or CTA. A CTA, reversal, payoff, silence, or unresolved ending appears only when supported by the selected goal and script.`);
}

function visibleTextLine(packet: ActiveStoryboardRulePacket): string {
  switch (packet.visible_text.mode) {
    case "verified_brand_only":
      return "Preserve only verified branding on its referenced product surface. No other readable text or graphics.";
    case "contextual_diegetic_with_verified_brand":
      return `Obey locked policy ${JSON.stringify(packet.visible_text.locked_policy)} and preserve only verified product branding; invent no wording.`;
    case "contextual_diegetic":
      return `Obey locked policy ${JSON.stringify(packet.visible_text.locked_policy)} exactly; invent no wording or overlay outside it.`;
    case "overlay_allowed":
      return `Obey explicit overlay policy ${JSON.stringify(packet.visible_text.locked_policy)} exactly; add nothing beyond that authority.`;
    default:
      return "Video frames contain zero readable text, logo, label, caption, title, HUD, technical readout, or overlay. Dialogue is audio only.";
  }
}

export function buildGenerationPromptModules(
  packet: ActiveStoryboardRulePacket,
  options: GenerationPromptOptions = {}
): GenerationPromptModule[] {
  if (packet.stage !== "generation") {
    throw new Error(`Generation prompt compiler cannot compile stage=${packet.stage}`);
  }

  const camera = packet.camera.mode === "derive_without_forced_recipe"
    ? "Derive shot size, angle, movement, and stillness from Scene Intent and the selected genre; do not force smoothness, movement, or variety."
    : `Use selected camera profile=${JSON.stringify(packet.camera.selected_profile_id)}, grammar=${JSON.stringify(packet.camera.locked_grammar)}, edit rhythm=${JSON.stringify(packet.camera.edit_rhythm)}. Never replace it with a generic recipe.`;
  const action = packet.action.mode === "locked_context_budget"
    ? `Exact Context action budget: ${JSON.stringify(packet.action.locked_budget)}.`
    : "Use only the minimum causally necessary, physically feasible action; intentional stillness is valid.";

  return [
    module("authority_router", "authority_resolution", `ACTIVE GENERATION PROMPT V7 — MODULAR DIRECTOR
You are the technical director and continuity architect for AI image-to-video production. Obey the exact JSON schema in the user prompt.
Authority order: current user instruction and explicit menu choices → uploaded references → approved/current script → locked Context IR and Product/Recipe IR → Production State and Scene Intent → derived directing choices → defaults. Lower authority may fill a true gap but never contradict or overwrite higher authority.
${packet.prompt_digest}`),
    module("clip_execution", "clip_execution", `CLIP EXECUTION:
- One generated segment is one physically continuous take driven by its keyframe and one motion prompt. Beats are chronological reframings of the same ongoing action, never hidden cuts or separate scenes. Use exactly the beat count requested by the user prompt.
- ${action} A dialogue-heavy clip has at most three production-changing atomic transitions; otherwise at most five. A reach/contact/grip/use/release chain is one ordered manipulation. Finish one state change before beginning the next.
- transition_in is the boundary authority. Only continuous mode inherits the previous complete end state. Location/time/scene/montage/parallel/dream/symbolic cuts open from their declared state and preserve only named anchors.
- Camera/action prose has no numeric seconds. dialogue_lines owns the only timeline. End each clip in an observable, chainable freeze state.`),
    intentModule(packet),
    identityModule(packet, options),
    module("world_state_ledger", "world_and_state_continuity", `WORLD AND STATE CONTINUITY:
- Locked Context IR defines universe, geography, culture, era, technology, social layer, locations, reality/physics, light motivation, sound, transition grammar, and intentional exceptions. Do not re-infer it or import an incompatible preset.
- Maintain one canonical entity registry. Track every visible character, every manipulated/salient object, and persistent off-focus entities in state_ledger. Separate intrinsic state, position, holder, orientation, and traces.
- Every start→end difference requires an ordered visible cause in changes[]. Continuous segment N+1 starts from segment N's complete end state exactly. Occlusion never deletes an entity; omission never teleports, duplicates, swaps, or resets it.
- Wardrobe, damage, wetness, opened/closed state, consumption, residue, and other irreversible traces persist until a visible event changes them. Intentional exceptions apply only to their named entity/event and remain causally consistent.`),
    module("environment_router", "environment_routing", `ENVIRONMENT ROUTING:
- Project-local location_id always comes from locked Context IR. environment_ref is only a rendering archetype, never permission to replace the project's actual place, topology, culture, era, materials, weather, lighting, or sound.
- Select an archetype only when it is semantically compatible with the resolved location; otherwise use "custom" and express the locked world's physical materials, motivated Kelvin/Lux light, imperfections, and ambient bed. Reuse the same compatible id across segments in the same place.
${options.environment_catalog?.trim() ? `AVAILABLE ARCHETYPE IDS:\n${options.environment_catalog.trim()}` : "No archetype catalog was supplied for this call; use environment_ref=\"custom\" rather than inventing an id."}`),
    module("spatial_physics", "spatial_and_physical_continuity", `SPATIAL AND PHYSICAL CONTINUITY:
- Physics mode=${JSON.stringify(packet.physical_interaction.physics_mode)}; intentional exceptions=${JSON.stringify(packet.physical_interaction.intentional_exceptions)}.
- ${packet.physical_interaction.obstacle_clearance} A character or camera never crosses a table, chair, wall, railing, glass, person, closed door, or non-load-bearing surface. A zone change names a real connector and shows the continuous route.
- ${packet.physical_interaction.manipulation_chain} One occupied hand cannot perform a second incompatible task. A prop used in motion already exists in the start frame or is visibly introduced.
- ${packet.physical_interaction.support_continuity} A pan stays on a burner/counter or in a named gripping hand while an egg is cracked into it; the ingredient does not replace the receiver's support. No object floats, tunnels, interpenetrates, morphs, appears, vanishes, changes category, or moves before its cause.
- Sitting, standing, stairs, doors, mechanisms, spills, impacts, tools, liquids, and food obey contact, weight transfer, collision, gravity, containment, and cause-before-effect in the declared universe.`),
    module("camera_light_performance", "camera_light_and_performance", `CAMERA, LIGHT, AND PERFORMANCE:
- ${camera} Every camera instruction names shot size, height/angle, visible subject, screen relationship/facing, focus target, and any move's start/end framing. Camera occupies a valid zone and respects architecture, axis, line of sight, and safety barriers.
- Scene Bible is the single lens/light/grade authority. Preserve motivated key direction, time-of-day, Kelvin/Lux logic, reflections, shadows, and colour continuity unless a declared transition resets them.
- ${action} Every gesture serves Scene Intent, a causal state change, or a specific line/subtext. Use observable body mechanics and micro-reactions; never force generic smiles, idle hand business, exaggerated acting, or camera motion merely for variety.
- Multiple characters may act in parallel only when each individual action remains continuous, readable, collision-free, and within the clip budget.`),
    dialogueModule(packet),
    module("render_safety", "render_safety", `RENDER AND SAFETY:
- Respect the selected visual interpretation and character representation; never force photorealism onto an explicitly stylized medium. Within that medium, materials, weight, contact, anatomy, fabric, liquid, food, hair, light, and surface response remain coherent and non-plastic.
- Keep the same wholesome, PG, non-sexual story intent. Stage sensitive health, fitness, family, children, conflict, impact, or body contact safely and unambiguously without changing the plot's causal meaning.
- Negative constraints target actual risks only: duplicate identities/objects, anatomy failure, morphing, teleportation, floating, impossible contact, state drift, unwanted readable text, broken lip-sync, and incompatible world elements. Do not add negative appearance descriptions for uploaded characters.
- ${visibleTextLine(packet)}`),
    module("json_output", "output_contract", `OUTPUT CONTRACT:
- Return one valid JSON object only: no markdown, code fence, prose, comments, or fields outside the exact user schema. Populate every required field; omit only fields the schema marks optional.
- Use canonical character/entity/location ids and exact name spelling everywhere. Do not copy rule examples, placeholders, schema descriptions, production instructions, or internal authority prose into creative output.
- Before returning, audit: input/menu fidelity; cast/reference binding; required segment/beat counts; Scene Intent; dialogue mode/timing; transition and state-ledger equality; routes/collisions/support/hand occupancy; camera/light/audio continuity; visible-text policy; and JSON validity.`),
  ];
}

export function auditGenerationPromptModules(modules: readonly GenerationPromptModule[]): string[] {
  const findings: string[] = [];
  const ids = new Set<string>();
  const responsibilities = new Set<GenerationPromptResponsibility>();
  for (const entry of modules) {
    if (ids.has(entry.id)) findings.push(`duplicate module id: ${entry.id}`);
    if (responsibilities.has(entry.responsibility)) findings.push(`duplicate responsibility: ${entry.responsibility}`);
    if (!entry.content.trim()) findings.push(`empty module: ${entry.id}`);
    ids.add(entry.id);
    responsibilities.add(entry.responsibility);
  }
  for (const required of REQUIRED_GENERATION_RESPONSIBILITIES) {
    if (!responsibilities.has(required)) findings.push(`missing responsibility: ${required}`);
  }
  return findings;
}

export function compileGenerationSystemPrompt(
  packet: ActiveStoryboardRulePacket,
  options: GenerationPromptOptions = {}
): CompiledGenerationSystemPrompt {
  const modules = buildGenerationPromptModules(packet, options);
  const findings = auditGenerationPromptModules(modules);
  if (findings.length > 0) {
    throw new Error(`Invalid generation prompt modules: ${findings.join("; ")}`);
  }
  const prompt = modules.map((entry) => `## ${entry.id}\n${entry.content}`).join("\n\n");
  if (prompt.length > GENERATION_PROMPT_MAX_CHARS) {
    throw new Error(`Generation system prompt exceeds ${GENERATION_PROMPT_MAX_CHARS} characters: ${prompt.length}`);
  }
  return { prompt, module_ids: modules.map((entry) => entry.id), character_count: prompt.length };
}
