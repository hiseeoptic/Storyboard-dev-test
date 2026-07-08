// TẦNG 6 — SCENE INTENT (luật ý đồ cảnh: xu hướng & nhịp, không phải hành động).
// Scene intent steers probability inside what the world allows — it never
// commands actions, dialogue, camera or lighting directly.

export const sceneIntentLaws = {
  __layer: "SCENE_INTENT",
  id: "scene_intent_v1",
  laws: [
    "Each clip serves EXACTLY ONE intent (hook / escalate / reveal / soothe / cta) with one emotional trajectory (flat / rising / falling)",
    "Pacing serves the spoken line: leave breathing room before and after dialogue — never cram actions to 'fill' the clip",
    "Emotion changes gradually between chained clips (max ~20% shift) — no expression resets, no mood teleports",
    "The topic's spirit (numerology, health, comedy…) is expressed through setting, light, rhythm, voice and silence — NEVER by breaking physics",
  ],
} as const;
