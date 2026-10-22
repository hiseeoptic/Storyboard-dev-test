// ============================================================
// HUMAN PERFORMANCE — what makes people on screen read as real people and
// not as AI: eyes that lead, reactions before lines, asymmetric weight
// shifts, motivated hands, expressions that change inside the clip, alive
// listeners and dialogue that sounds spoken. One doctrine for the writers
// (script + storyboard), a compact law and an "AI look" blacklist for the
// video model, and a candid-frame note for keyframes.
// ============================================================

/** For the script writer and the storyboard writer. */
export const HUMAN_PERFORMANCE_DOCTRINE = `HUMAN PERFORMANCE DOCTRINE — MANDATORY (the video must feel like real people caught on camera, never like AI):
- REACT, THEN ACT: every line and every move starts from a visible reaction to what just happened — a glance, a breath, a half-second pause, a brow flick — and only then the line or action.
- EYES LEAD: eyes move first, then the head, then the body. People look at things for a reason (the object they talk about, the other person's face, away when embarrassed); never a vacant stare into space.
- EXPRESSIONS CHANGE INSIDE THE CLIP: each character's face travels from one specific feeling to the next within the 10 seconds (suspicion → a held-back smile; hurt → pretending not to care). Use micro-expressions: a quick brow raise, eyes narrowing, a smile fighting to stay hidden, a glance away and back, a nose scrunch, a slow blink. Never one fixed smile or a frozen face.
- REAL BODIES: weight shifts to one leg, shoulders drop or lift, people lean in when interested and back when defensive; posture is relaxed and asymmetric, never a symmetric pose for the camera.
- HANDS HAVE BUSINESS: real people touch things while they talk — turning a cup, fixing a sleeve, tucking hair, scratching the neck, tapping the table, a small gesture that lands on the stressed word. One or two motivated pieces of business per character per clip, not constant fidgeting.
- LISTENERS ARE ALIVE: whoever is not speaking reacts the whole time — a nod, a suppressed laugh, eyes rolling, an eyebrow, looking at the speaker's hands — with the mouth closed.
- DIRECT EVERY TURN: the number of dialogue turns is never fixed; use however many the dramatic beat can perform naturally inside the clip. For EACH turn, stage an ordered acting chain — visible trigger/reaction before speech, the speaker's eyes/face/posture/gesture and vocal attitude during it, every listener's simultaneous silent response, then an after-beat that motivates the next turn. Nobody freezes while waiting to speak.
- REAL TIMING: natural speed with tiny hesitations; a gesture begins before the line and settles after it; movements accelerate and settle like real weight, never floaty, robotic or perfectly synchronised between people.
- SPOKEN, NOT WRITTEN: lines sound like real speech — fragments, everyday particles (à, ừ, nhỉ, nhé, chứ, cơ, đấy, mà, hả), a self-correction, an unfinished sentence, a short laugh or sigh in the line, quick reactions such as "Hả?", "Thật á?", "Thôi đi!". Never textbook-complete sentences, speeches or lines that announce a feeling.`;

/** For every structured video clip: how the people must move and act. */
export const HUMAN_PERFORMANCE_LAW =
  "REAL-PEOPLE PERFORMANCE: everyone visible is alive and specific for the whole clip — natural blinking and breathing; eyes lead, then head, then body; a visible reaction before each line; expressions change during the clip with micro-expressions (brow flicks, narrowing eyes, a held-back smile, a glance away and back); relaxed asymmetric posture with small weight shifts; hands do one or two motivated things (touch a prop, adjust clothing or hair, a gesture landing on the stressed word); listeners react with nods, smiles and eyebrows while their mouths stay closed. Real-speed movement with natural acceleration and settling, slight human imperfection, never posed for the camera.";

/** The tell-tale signs of AI video, for the negative prompt. */
export const AI_LOOK_NEGATIVE =
  "mannequin-still body, frozen idle pose, vacant or unfocused stare, one fixed smile for the whole clip, a dead face while talking with only the mouth moving, robotic or perfectly symmetrical gestures, people moving in sync, floaty slow-motion movement, sliding feet, rubbery or melting facial features, posing or looking into the lens without a reason, characters standing stiffly waiting for their turn";

/** For keyframes: the opening frame is a candid moment, not a pose. */
export const KEYFRAME_CANDID_NOTE =
  "CANDID MOMENT: every visible person is caught mid-moment like a frame from real footage — a specific, readable expression that fits this beat (not a posed or fixed smile), eyes focused on something real in the scene, relaxed asymmetric posture, hands in the middle of a natural action.";

/** The performance block of one clip: the writer's acting notes plus the law. */
export function performanceDirection(acting: string | undefined | null): { acting?: string; realism: string } {
  const text = String(acting ?? "").replace(/\s+/g, " ").trim();
  return text ? { acting: text, realism: HUMAN_PERFORMANCE_LAW } : { realism: HUMAN_PERFORMANCE_LAW };
}
