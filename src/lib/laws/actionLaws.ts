// TẦNG 5 — ACTION CONTINUITY (luật hành động: state → state, cấm teleport).
// The #1 defence against morphing/teleporting: every motion is a continuous
// path from a declared start-state to a declared end-state.

export const actionLaws = {
  __layer: "ACTION_CONTINUITY",
  id: "action_continuity_v1",
  laws: [
    "ONE continuous primary action per clip, performed slowly and deliberately — never multiple simultaneous or stacked actions",
    "Every action travels state → state: an explicit START pose and an explicit END pose, connected by an unbroken physical path with real duration",
    "NO teleporting: nobody and nothing changes position, pose or state without visibly moving through the space between",
    "Motion verbs are specific: name the body part + verb + manner ('her right hand slowly lifts the pan by its handle'), never vague 'moving/doing/interacting'",
    "Chained continuity: the END state of clip N (pose, position, expression, props) EQUALS the START state of clip N+1 — clips join seamlessly",
    "A character entering or leaving the frame does so by walking through real space, described explicitly in the motion",
  ],
} as const;
