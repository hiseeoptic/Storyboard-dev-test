// TẦNG 7 — CAMERA (luật máy quay: nhân chứng, không phải người kể chuyện).
// "Camera không được kể chuyện. Camera không được sáng tác.
//  Camera chỉ được phép chứng kiến những gì đã được điều phối."

export const cameraLaws = {
  __layer: "CAMERA",
  id: "camera_witness_v1",
  laws: [
    "The camera is a physical observer standing in the space: state its position concretely (angle + distance + height) and append the marker '(thats where the camera is)' after the position",
    "ONE smooth, motivated camera move per clip (slow push-in, gentle pan, slow orbit) — never combine a big camera move with big subject motion",
    "NO camera teleports, NO mid-clip hard cuts: the camera travels continuously, like a real operator's body",
    "Lens continuity: ONE lens for the whole video (from STYLE TOKENS); focal length never changes between clips without a narrative reason",
    "Horizon locked within ±3°; default height is human eye-level (~1.6m) unless a coded angle ([LOW]/[HIGH]/[OVH]) says otherwise",
    "Framing grammar resets attention: progress establish → medium → close within and across clips; the speaker's face is in medium-close or close-up during their line",
    "Depth of field is natural and consistent with the declared aperture — subject tack-sharp, background falls off realistically",
  ],
} as const;
