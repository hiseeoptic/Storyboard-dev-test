import type { StoryboardGenerationInput } from "@/types";

// ─── Step 1: Scene Breakdown + Character Lock ───────────────────────────────

export function buildStoryboardSystemPrompt(): string {
  return `You are a world-class storyboard artist and film director specializing in short-form video content (under 60 seconds). You create production-ready storyboard breakdowns with strong character consistency.

Your output MUST be valid JSON matching the exact schema provided. Do not include markdown, code blocks, or any text outside the JSON.

Core principles:
- CHARACTER CONSISTENCY: Build a detailed "character_lock" for each character — this description will be restated word-for-word in every image generation call
- Each scene has specific camera angle codes: [EYE] eye-level, [LOW] low angle, [HIGH] high angle, [OVH] overhead/bird's-eye, [DUTCH] dutch angle, [OTS] over-the-shoulder, [POV] first-person, [CLOSE] tight close-up, [SIDE] side profile
- Shot types: extreme_wide, wide, medium, medium_close_up, close_up, extreme_close_up, establishing, two_shot, insert
- Mark the climactic/hero scene with a ★ symbol in its title
- Visual prompts must be self-contained and include full character descriptions for AI image generation
- Dialogue should be natural and concise
- Duration per scene: 2-5 seconds for short video, totaling under 60 seconds`;
}

export function buildStoryboardUserPrompt(
  input: StoryboardGenerationInput
): string {
  const characterBlock =
    input.character_descriptions && input.character_descriptions.length > 0
      ? `\n\nCharacters:\n${input.character_descriptions.map((c) => `- ${c.name}: ${c.appearance}. Personality: ${c.personality}. Role: ${c.role}`).join("\n")}`
      : "";

  const settingBlock = input.setting
    ? `\nPrimary Setting: ${input.setting}`
    : "";

  const toneBlock = input.tone ? `\nTone: ${input.tone}` : "";

  const customBlock = input.custom_instructions
    ? `\nAdditional Instructions: ${input.custom_instructions}`
    : "";

  return `Create a detailed storyboard breakdown for this short video concept:

Story Idea: ${input.story_idea}
Genre: ${input.genre}
Visual Style: ${input.style}
Number of Scenes: ${input.scene_count}${characterBlock}${settingBlock}${toneBlock}${customBlock}

Return a JSON object with this EXACT structure:
{
  "title": "string — compelling title",
  "synopsis": "string — 2-3 sentence synopsis",
  "total_duration_seconds": number,
  "mood_tags": ["array of 3-4 mood keywords like epic, emotional, dramatic"],
  "character_locks": [
    {
      "name": "string — character name",
      "gender_age": "string — e.g. Male, late 20s",
      "build": "string — body type description",
      "skin_tone": "string",
      "hair": "string — color, length, style",
      "eyes": "string — color, shape",
      "costume": "string — detailed outfit description",
      "signature_features": "string — identifying marks, accessories",
      "default_expression": "string — resting expression",
      "render_style": "${input.style}"
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "title": "string — short scene title (mark climactic scene with ★)",
      "description": "string — detailed scene description",
      "visual_prompt": "string — complete visual description for image generation. MUST include full character appearance description, environment, lighting, composition, camera angle. Self-contained.",
      "dialogue": "string or null",
      "action_notes": "string — physical actions: use specific verbs (lifts, turns, glances, reaches)",
      "camera_code": "string — e.g. [CLOSE], [LOW], [OVH], [SIDE], [EYE], [POV]",
      "camera_movement": "string — e.g. static, slow zoom in, pan left, tracking shot, dolly forward",
      "shot_type": "extreme_wide|wide|medium|medium_close_up|close_up|extreme_close_up|establishing|two_shot|insert",
      "mood": "string",
      "lighting": "string — e.g. warm golden hour, soft studio light, dramatic rim light",
      "location": "string",
      "characters": ["array of character names"],
      "duration_seconds": number,
      "transition": "cut|fade|dissolve|wipe|zoom|match_cut|smash_cut",
      "continuity_notes": "string"
    }
  ],
  "timeline": [
    {
      "scene_number": 1,
      "start_time": 0,
      "end_time": 3,
      "description": "string"
    }
  ],
  "style_guide": {
    "color_palette": ["array of 5-7 hex colors"],
    "art_direction": "string",
    "visual_references": "string",
    "consistency_notes": "string"
  }
}`;
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
  };
  props?: string[];
  colorPalette?: string[];
}): string {
  const c = params.characterLock;
  const propsBlock = params.props && params.props.length > 0
    ? `Props zone at bottom-left showing: ${params.props.join(", ")}, each item rendered individually with clean background.`
    : "";

  const colorBlock = params.colorPalette && params.colorPalette.length > 0
    ? `Color palette strip at bottom-right showing ${params.colorPalette.length} circular swatches: ${params.colorPalette.join(", ")}.`
    : "";

  return `Create a single horizontal CHARACTER REFERENCE SHEET poster (16:9 ratio) on warm cream/white paper background with thin black border.

CHARACTER: ${c.name}
- ${c.gender_age}, ${c.build} build
- Skin: ${c.skin_tone}
- Hair: ${c.hair}
- Eyes: ${c.eyes}
- Costume: ${c.costume}
- Signature features: ${c.signature_features}
- Default expression: ${c.default_expression}
- Render style: ${c.render_style}

LAYOUT — All zones visible in one image:

TOP-LEFT: Title "CHARACTER REFERENCE SHEET" in bold sans-serif. Character name large below. Brief description text.

LEFT ZONE — HERO POSE: Large character portrait (about 40% of width), full body, slight 3/4 angle, ${c.default_expression} expression, holding or interacting with relevant prop.

CENTER — TURNAROUND: 3-4 orthographic full-body views labeled "FRONT", "3/4 VIEW", "SIDE", "BACK". Same pose, neutral expression, evenly lit, no perspective distortion.

TOP-RIGHT — EXPRESSIONS: 6 head-and-shoulder expression studies in a 3x2 grid, each labeled. Show range: happy, worried, surprised, determined, sad, proud. Same hair, same costume neckline visible.

${propsBlock}
${colorBlock}

STYLE: Clean infographic layout, ${c.render_style} render quality, professional character sheet design. No real photographs. Consistent character across all zones. Thin divider lines between sections. Labels in bold sans-serif font.`;
}

// ─── Step 3: Storyboard Poster Image Prompt ─────────────────────────────────

export function buildStoryboardPosterPrompt(params: {
  title: string;
  totalDuration: number;
  sceneCount: number;
  moodTags: string[];
  scenes: {
    scene_number: number;
    title: string;
    description: string;
    camera_code: string;
    dialogue?: string | null;
    characters: string[];
  }[];
  characterDescription: string;
  style: string;
  colorPalette?: string[];
}): string {
  const panelDescriptions = params.scenes
    .map((s) => {
      const dialogueLine = s.dialogue ? ` Dialogue: "${s.dialogue}"` : "";
      return `Panel ${s.scene_number} — "${s.title}" ${s.camera_code}: ${s.description}${dialogueLine}`;
    })
    .join("\n");

  const cols = params.sceneCount <= 6 ? 3 : 4;
  const rows = Math.ceil(params.sceneCount / cols);

  const colorBlock = params.colorPalette && params.colorPalette.length > 0
    ? `Color palette: ${params.colorPalette.join(", ")}.`
    : "";

  return `Create a single 16:9 horizontal STORYBOARD POSTER infographic on white/cream paper background.

CHARACTER (restate in every panel): ${params.characterDescription}

HEADER ZONE:
- Large bold title: "STORYBOARD" on the left
- Subtitle: "TIÊU ĐỀ: ${params.title}"
- Right side: Total ${params.totalDuration}s · ${params.sceneCount} shots · ${params.moodTags.join(" · ")}

PANEL GRID: ${cols} columns × ${rows} rows of equally-sized panels, thin black borders:
${panelDescriptions}

Each panel contains:
- Large number badge (top-left corner)
- The scene illustration matching the description above
- Below each panel: 1-line italic caption summarizing the action/dialogue

CHARACTER CONSISTENCY: The same character appearance must be maintained across ALL panels — same hair, skin, costume, features.

STYLE: ${params.style} render quality. Clean infographic design. ${colorBlock}

FOOTER: Decorative line with a motivational tagline or director's note related to the story theme.

IMPORTANT: This must be ONE single image containing ALL panels arranged in a grid. Not individual images.`;
}

// ─── Step 4: Video Prompt for Flowveo / Seedance / Kling ────────────────────

export function buildVideoPromptText(params: {
  title: string;
  characterDescription: string;
  setting: string;
  style: string;
  colorPalette: string[];
  scenes: {
    scene_number: number;
    title: string;
    camera_code: string;
    camera_movement: string;
    action_notes: string;
    dialogue?: string | null;
    mood: string;
    duration_seconds: number;
  }[];
}): string {
  const sceneLines = params.scenes
    .map((s) => {
      return `Scene ${s.scene_number} — "${s.title}" (${s.duration_seconds}s)
  Camera: ${s.camera_code} · ${s.camera_movement}
  Action: ${s.action_notes}${s.dialogue ? `\n  Dialogue: "${s.dialogue}"` : ""}
  Mood: ${s.mood}`;
    })
    .join("\n\n");

  return `# VIDEO PROMPT — ${params.title}

## Character Note
${params.characterDescription}

## Style & Setting
Style: ${params.style}
Setting: ${params.setting}
Color palette: ${params.colorPalette.join(", ")}

## Scenes

${sceneLines}

---
Compatible with: Flowveo, Seedance, Kling, Runway, Pika`;
}
