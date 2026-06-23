/**
 * Prompts for reverse-engineering a reference video into a reusable storyboard.
 * Input is an ORDERED sequence of frames sampled from the video (the model
 * infers motion/pacing from the change between consecutive frames).
 */

export function buildVideoAnalysisSystemPrompt(): string {
  return `You are a senior video ad director and storyboard analyst.

You will receive an ORDERED sequence of still frames sampled at regular
intervals from a reference marketing/product video (frame 1 = start,
last frame = end). Reconstruct the video's storyboard by reasoning about
what happens BETWEEN consecutive frames (camera movement, subject motion,
pacing, transitions).

Your job: break the video into distinct SCENES (a scene = a continuous shot
or beat). For each scene describe the framing, the camera motion, the action/
movement, and exactly how the product appears. Then write a ready-to-use
generation prompt so the user can recreate a SIMILAR scene with their own
product/character using an AI video model (Veo / Omni Flash).

Rules:
- Group frames into 3-10 coherent scenes. Do not output one scene per frame.
- "generationPrompt" MUST be in ENGLISH (video models perform best in English),
  30-80 words, describing subject, action, camera motion, lighting, mood.
- All other descriptive fields follow the requested output language.
- Be concrete about MOTION (e.g. "slow push-in", "product rotates 360°",
  "hand swipes left", "whip pan to the right").
- Describe the product faithfully (shape, color, label position) but do NOT
  invent brand names you cannot read.
- Output STRICT JSON only, no markdown, matching the schema given.`;
}

export function buildVideoAnalysisUserPrompt(opts: {
  frameCount: number;
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

  return `Here are ${opts.frameCount} frames sampled in order from the reference video.
${context.length ? context.join("\n") : ""}

Analyze them and return STRICT JSON with this exact shape:

{
  "title": "short title of the video",
  "summary": "1-2 sentence overview of the ad",
  "product": "what product/subject the video is about",
  "totalScenes": <number>,
  "scenes": [
    {
      "index": 1,
      "durationSec": <estimated seconds for this scene>,
      "shot": "framing/shot type (e.g. close-up, wide establishing)",
      "cameraMotion": "camera movement (e.g. slow push-in, static, whip pan)",
      "action": "what happens / the movement in this scene",
      "productNote": "how the product appears in this scene",
      "generationPrompt": "ENGLISH prompt (30-80 words) to recreate a similar scene"
    }
  ]
}

Write "summary", "product", "shot", "cameraMotion", "action", "productNote" in ${langName}.
Keep "generationPrompt" in English. Output JSON only.`;
}
