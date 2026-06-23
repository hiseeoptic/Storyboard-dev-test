/**
 * Prompts for reverse-engineering a reference video into a reusable storyboard.
 * Input = ORDERED frames sampled from the video + (optionally) the extracted
 * audio track for speech transcription. The model infers motion/pacing from the
 * change between consecutive frames and reads dialogue from the audio.
 */

export function buildVideoAnalysisSystemPrompt(): string {
  return `You are a senior video ad director, editor and storyboard analyst.

You receive:
- An ORDERED sequence of still frames sampled at regular intervals from a
  reference marketing/product video (frame 1 = start, last frame = end).
- Optionally the video's AUDIO track for transcribing what the person says.

Reconstruct the video's storyboard by reasoning about what happens BETWEEN
consecutive frames (camera movement, subject motion, pacing) AND aligning the
spoken audio to the right moments.

For each SCENE describe framing, camera motion, action, how the product appears,
the spoken dialogue, and whether the scene is a hard CUT or a seamless
CONTINUATION of the previous shot. Then provide prompts to recreate it.

KEY — continuity (this is critical for a professional, non-stitched result):
- "cut": a real shot change (different angle/location/time, hard edit).
- "continuous": the SAME ongoing shot as the previous scene (camera and subject
  flow without an edit) — these should be produced with Veo's "Extend" feature,
  NOT as a separate clip, so the final video feels like one seamless take.
- The FIRST scene is always "cut".

Rules:
- Group frames into 3-10 coherent scenes. Never one scene per frame.
- "generationPrompt": ENGLISH, 30-80 words — to generate this scene fresh
  (use for "cut" scenes / the first clip of a continuous run).
- "extendPrompt": ENGLISH, 20-50 words — ONLY for "continuous" scenes: describe
  what KEEPS happening, to type into Veo "Extend" (which continues from the last
  second of the previous clip — no image upload needed). Empty "" for cut scenes.
- "dialogue": transcribe the spoken line VERBATIM in its original language from
  the audio. Empty "" if the scene has no speech or no audio was provided.
- Be concrete about MOTION ("slow push-in", "hand swipes left", "whip pan").
- Describe the product faithfully; do NOT invent unreadable brand names.
- Output STRICT JSON only (no markdown, no trailing commas).`;
}

export function buildVideoAnalysisUserPrompt(opts: {
  frameCount: number;
  hasAudio: boolean;
  productName?: string;
  notes?: string;
  lang?: "vi" | "en";
}): string {
  const lang = opts.lang ?? "vi";
  const langName = lang === "vi" ? "Vietnamese" : "English";

  const context: string[] = [];
  if (opts.productName?.trim()) {
    context.push(`The user's product to feature in the recreated prompts: "${opts.productName.trim()}".`);
  }
  if (opts.notes?.trim()) {
    context.push(`Extra instructions from the user: ${opts.notes.trim()}`);
  }

  return `Here are ${opts.frameCount} frames sampled in order from the reference video${
    opts.hasAudio ? ", plus the video's audio track for dialogue transcription" : " (no audio provided)"
  }.
${context.length ? context.join("\n") : ""}

Return STRICT JSON with this exact shape:

{
  "title": "short title of the video",
  "summary": "1-2 sentence overview of the ad",
  "product": "what product/subject the video is about",
  "totalScenes": <number>,
  "scenes": [
    {
      "index": 1,
      "durationSec": <estimated seconds>,
      "continuity": "cut" | "continuous",
      "shot": "framing/shot type",
      "cameraMotion": "camera movement",
      "action": "what happens / the movement",
      "productNote": "how the product appears",
      "dialogue": "verbatim spoken line in original language, or empty string",
      "dialogueTone": "tone/emotion of the speech, or empty string",
      "generationPrompt": "ENGLISH prompt (30-80 words) to generate this scene fresh",
      "extendPrompt": "ENGLISH continuation prompt (20-50 words) for Veo Extend, only if continuity is continuous, else empty string"
    }
  ]
}

Write "summary", "product", "shot", "cameraMotion", "action", "productNote", "dialogueTone" in ${langName}.
Keep "dialogue" in its ORIGINAL spoken language.
Keep "generationPrompt" and "extendPrompt" in English. Output JSON only.`;
}
