# Prompt Rule Router — Phase 4

Phase 4 adds a Physical Interaction Contract without replacing the existing
storyboard schema or the user's menu-driven creative choices.

## Scope

- `storyboard.spatial.obstacle_clearance`: movement must use a connected,
  load-bearing route around solid furniture, people and architecture.
- `storyboard.manipulation.contact_chain`: manipulation follows ordered reach,
  contact, grip, transfer/use and supported release with a named free hand.
- `storyboard.object.support_continuity`: every visible material object retains
  a holder or support; receiving objects remain supported during indirect
  actions (for example, a pan stays on the hob/counter or in a hand while an egg
  is cracked into it).
- `storyboard.physics.locked_mode`: Context IR owns the universe physics.
  Levitation, phasing or telekinesis is valid only when it is a declared
  intentional exception and remains causally consistent.

## Deterministic findings

- `PATH_INTERSECTS_SOLID_OBSTACLE` (critical)
- `ACTION_ROUTE_BLOCKED` (critical)
- `PATH_CLEARANCE_UNPROVEN` (high)
- `HELD_OBJECT_HAND_UNASSIGNED` (high)
- `HOLDER_LIMB_MISMATCH` (critical)
- `INVALID_HOLD_BODY_PART` (critical)
- `RELEASE_WITHOUT_SUPPORT` (critical)
- `RECEIVER_SUPPORT_MISSING` (critical)

The legacy physical compiler still infers ordinary support for positioned
objects to avoid false blockers, but it no longer invents support when the
source explicitly says an object floats, hovers or is unsupported.

## Rollout

The packet is version `4.0`. Enable it with `PROMPT_RULE_ROUTER_V4`; the helper
still accepts the V3 and V2 flags for staged backward compatibility. The flag is
off by default.

