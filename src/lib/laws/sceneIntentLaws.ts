// TẦNG 6 — SCENE INTENT (luật ý đồ cảnh: xu hướng & nhịp, không phải hành động).
// Scene intent steers probability inside what the world allows — it never
// commands actions, dialogue, camera or lighting directly.
//
// IMPORTANT: the four original short-form laws are preserved verbatim under
// `legacy_laws`. They are now a CONDITIONAL marketing profile, not universal
// laws for documentary, narrative, atmosphere, education, fantasy, etc.

import {
  SCENE_INTENT_ABSTRACT_LAWS,
  SCENE_INTENT_LEGACY_MARKETING_LAWS,
} from "@/lib/scene-intent";

export const sceneIntentLaws = {
  __layer: "SCENE_INTENT",
  id: "scene_intent_v2",
  laws: SCENE_INTENT_ABSTRACT_LAWS,
  legacy_profile: "short_form_marketing",
  legacy_laws: SCENE_INTENT_LEGACY_MARKETING_LAWS,
} as const;
