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
    "EVERYDAY BODY MECHANICS: sitting, standing, entering, leaving, walking to a chair, turning, opening a door, carrying or repositioning an object or piece of furniture, reaching and setting an object down all follow real weight transfer — feet plant or step, hips/knees/torso change in order, balance shifts to counter any load, hands brace or grip only when natural, a door's handle is gripped and its hinge/leaf visibly moves before the body crosses the threshold, then the body settles or continues moving with plausible momentum",
    "OBJECT-INTERACTION CAUSAL CHAIN (mandatory for every touch): reach (the hand travels visibly to the object) → contact (fingers close around a named part of it) → transfer (lift/carry/hang along one continuous path) → release (placed/hung, the hand withdraws empty). An object NEVER appears in a hand, leaves a hand, or changes place without this full chain shown on screen",
    "PROP EXISTENCE (START STATE): every object the motion uses must already exist ON SCREEN at second 0 — declared in the clip's start state as held, worn, or placed in the scene (or visibly carried in by a character who walks in with it). An object that was not planted in the start state can never be introduced mid-clip; a character can only take off a garment they are declared to be wearing or carrying",
    "CAUSE BEFORE EFFECT: nothing happens by itself — if anything falls, tips, spills, swings, opens or breaks, its visible physical cause (a gripping hand, a bump, a sleeve catching, transferred weight) must make contact FIRST, in frame, and the effect follows with believable physics timing (a knocked coat rack leans, then topples — it never simply drops on its own)",
    "ONE LOCATION PER CLIP: the entire clip lives in ONE continuous space — the room/backdrop never switches or 'jumps' mid-clip; any change of position happens by the character physically walking there inside the same visible space",
    "SPATIAL TOPOLOGY BEFORE MOTION: for every multi-zone scene, freeze an ordered physical map of walkable zones, connectors (door/threshold/stairs), fixed architecture, exposed boundaries, character occupancy and camera position BEFORE choreographing action; every beat obeys that one map",
    "OPENINGS STAY OPEN: a doorway or threshold is an unobstructed connector in a wall — no railing, wall, counter, furniture, prop or body may cross it, seal it, or appear between two characters conversing across it unless the scripted action explicitly closes the real door",
    "BOUNDARIES STAY ON TRUE EDGES: railings, parapets and guards follow the actual exposed perimeter only; they never migrate into the middle of a floor, cross a doorway, divide a walking route, or place a person/camera outside the protected walkable surface",
    "ZONE CROSSING IS VISIBLE: every person and carried object starts in one declared zone and may enter another only by travelling through the declared real connector along an unobstructed load-bearing path — never through a wall, railing, closed door, void or solid prop",
    "Chained continuity: the END state of clip N (pose, position, expression, props) EQUALS the START state of clip N+1 — clips join seamlessly",
    "PEOPLE NEVER TELEPORT: every person visible during the clip is either placed in the START STATE from second 0, or ENTERS by visibly walking through a real entrance as an explicitly described action — no one pops into frame, materialises in the background, or appears behind another character mid-clip",
    "A character entering or leaving the frame does so by walking through real space, described explicitly in the motion",
  ],
} as const;
