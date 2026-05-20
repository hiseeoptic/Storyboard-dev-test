import type { StoryboardGenerationInput } from "@/types";

export function buildStoryboardSystemPrompt(): string {
  return `You are a world-class storyboard artist and film director with decades of experience in visual storytelling. You create detailed, production-ready storyboard breakdowns.

Your output MUST be valid JSON matching the exact schema provided. Do not include markdown formatting, code blocks, or any text outside the JSON object.

Guidelines:
- Each scene must have a clear visual composition with specific camera angles and shot types
- Maintain character consistency across scenes (same clothing, features, positioning logic)
- Ensure timeline continuity — scenes must flow logically with proper transitions
- Visual prompts must be detailed enough for AI image generation (describe lighting, colors, composition, character positions)
- Dialogue should feel natural and serve the story
- Action notes describe physical movement and blocking
- Continuity notes track what carries over between scenes (props, character state, time of day)
- Duration should reflect the content density of each scene`;
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

  return `Create a detailed storyboard breakdown for the following:

Story Idea: ${input.story_idea}
Genre: ${input.genre}
Visual Style: ${input.style}
Number of Scenes: ${input.scene_count}${characterBlock}${settingBlock}${toneBlock}${customBlock}

Return a JSON object with this exact structure:
{
  "title": "string — compelling title for the storyboard",
  "synopsis": "string — 2-3 sentence synopsis",
  "scenes": [
    {
      "scene_number": 1,
      "title": "string — short scene title",
      "description": "string — detailed scene description (2-3 sentences)",
      "visual_prompt": "string — detailed visual description for image generation, include composition, colors, lighting, character positions, environment details. Must be self-contained and specific enough to generate a consistent image.",
      "dialogue": "string or null — character dialogue if any",
      "action_notes": "string or null — physical actions and blocking",
      "camera_angle": "eye_level|low_angle|high_angle|birds_eye|dutch_angle|over_the_shoulder|pov|worms_eye",
      "shot_type": "extreme_wide|wide|medium_wide|medium|medium_close_up|close_up|extreme_close_up|establishing|two_shot|insert|aerial",
      "mood": "string — emotional tone of the scene",
      "lighting": "string — lighting description (e.g., 'warm golden hour', 'harsh overhead fluorescent')",
      "location": "string — specific location",
      "characters": ["array of character names present"],
      "duration_seconds": number,
      "transition": "cut|fade|dissolve|wipe|zoom|match_cut|smash_cut",
      "continuity_notes": "string — what carries over from previous scene or needs to be maintained"
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
    "color_palette": ["array of hex colors that define the visual palette"],
    "art_direction": "string — overall art direction notes",
    "visual_references": "string — reference styles or films",
    "consistency_notes": "string — notes for maintaining visual consistency across scenes"
  }
}`;
}
