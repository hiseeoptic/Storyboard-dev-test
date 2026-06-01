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

  const colorSwatches =
    params.colorPalette && params.colorPalette.length > 0
      ? params.colorPalette.slice(0, 6).join(", ")
      : "#F5E6D3, #8B4513, #2D5016, #FFFFFF, #1A1A1A, #D4A574";

  // Keep prompt concise but highly specific to match example layouts
  return `Professional CHARACTER REFERENCE SHEET, single horizontal 16:9 image, clean cream/off-white paper background.

CHARACTER — ${c.name}: ${c.gender_age}, ${c.build} build, ${c.skin_tone} skin, ${c.hair} hair, ${c.eyes} eyes. Wearing ${c.costume}. ${c.signature_features}. Style: ${c.render_style}.

EXACT LAYOUT (all in one image):

■ TOP-LEFT CORNER: Bold header text "CHARACTER REFERENCE SHEET". Below it: character name "${c.name}" in large decorative font. Below that: 2-line character bio text.

■ LEFT ZONE (30% width): Single large FULL BODY illustration of the character in a dynamic hero pose, showing personality through body language and ${c.default_expression} expression. Full body visible head to toe.

■ CENTER ZONE: Section labeled "TURNAROUND" — exactly 4 full-body orthographic views of the SAME character side by side: FRONT view, 3/4 VIEW, SIDE view, BACK view. All same scale, neutral pose, same outfit, evenly lit on white background. Small labels below each view.

■ TOP-RIGHT ZONE: Section labeled "EXPRESSIONS" — exactly 6 head-and-shoulder portraits in a 3×2 grid showing different emotions. Each labeled: HAPPY, WORRIED, SURPRISED, DETERMINED, SAD, PROUD. Same hair, same costume neckline visible in each.

■ BOTTOM-LEFT: Section labeled "PROPS" — 4-6 individual object illustrations relevant to the character's story (tools, accessories, items they use), each rendered separately on white background.

■ BOTTOM-RIGHT: Section labeled "COLOR PALETTE" — row of 6 circular color swatches: ${colorSwatches}.

CRITICAL RULES:
- The character must look IDENTICAL in every zone (turnaround, expressions, hero pose)
- Clean infographic layout with thin dividing lines between sections
- All text labels in bold sans-serif font
- Professional character design sheet quality
- NO photographs — this is ${c.render_style} style illustration
- Single cohesive image, not separate images`;
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
  // Limit scene descriptions to keep under DALL-E's 4000 char limit
  const maxScenes = Math.min(params.scenes.length, 12);
  const truncatedScenes = params.scenes.slice(0, maxScenes);

  const cols = maxScenes <= 6 ? 3 : 4;
  const rows = Math.ceil(maxScenes / cols);

  // Build compact panel descriptions (max ~60 chars each)
  const panelLines = truncatedScenes
    .map((s) => {
      const shortDesc = s.description.length > 50
        ? s.description.slice(0, 50) + "..."
        : s.description;
      return `[${s.scene_number}] "${s.title}": ${shortDesc}`;
    })
    .join("\n");

  // Truncate character description to save prompt space
  const charDesc =
    params.characterDescription.length > 300
      ? params.characterDescription.slice(0, 300) + "..."
      : params.characterDescription;

  const moodLine = params.moodTags.slice(0, 4).join(" • ");

  return `Professional STORYBOARD poster, single horizontal 16:9 image, clean white/cream paper background.

CHARACTER (must look identical in EVERY panel): ${charDesc}

EXACT LAYOUT:

■ HEADER BAR (top): Large bold title "STORYBOARD" on left. Subtitle "TIÊU ĐỀ: ${params.title}" centered. Right side metadata: "${params.totalDuration}s • ${maxScenes} SHOTS • ${moodLine}".

■ PANEL GRID: ${cols} columns × ${rows} rows of equally-sized rectangular panels with thin black borders. Each panel contains:
  - NUMBERED BADGE: Bold number (1, 2, 3...) in colored square, top-left corner of each panel
  - SCENE ILLUSTRATION: The main ${params.style}-style artwork showing the action described
  - CAPTION: 1-line italic text below each panel describing the action

PANEL CONTENTS:
${panelLines}

■ FOOTER BAR (bottom): Decorative divider line, then a thematic tagline or director's note in italic, centered.

CRITICAL RULES:
- This is ONE single image containing ALL ${maxScenes} panels in a grid layout
- The same character must be recognizable across ALL panels (same hair, skin, costume, features)
- Each panel is a distinct scene with different composition, camera angle, and action
- ${params.style} visual style throughout
- Clean professional storyboard design — like a film production document
- NO photographs — this is ${params.style} style illustration
- Panel numbers are clearly visible as colored badges
- Brief text captions below each panel summarize the action`;
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
