# Prompt Rule Router — Phase 5

Phase 5 makes the Active Rule Packet executable throughout prompt compilation
and validation. A suppressed legacy rule is now removed before the system
prompt reaches the model instead of remaining earlier in the prompt and being
contradicted by a final digest.

## Exact rule-owned pruning

`compileStoryboardSystemPrompt` applies narrow, line-scoped transforms keyed by
rule id. It currently removes only legacy clauses owned by:

- `storyboard.hook.always_first_clip`
- `storyboard.visible_text.forbid_all`
- `storyboard.camera.smooth_minimal`
- `storyboard.camera.forced_variety`
- `storyboard.performance.forced_business`
- `storyboard.dialogue.reauthor`

No neighbouring production law is removed. With no suppressed ids, the legacy
prompt remains byte-identical. This preserves rollback and makes later prompt
decomposition incremental rather than destructive.

## Validation policy adapter

`buildStoryboardValidationPolicy` carries the already-resolved hook, dialogue,
visible-text and universe-physics decisions downstream. Validators do not
reinterpret menu values independently.

- An observational/intent-gated opening may disable its Hook Window.
- A menu-required hook, or a scene whose primary function is `hook`, must still
  provide the complete 3–5 second contract.
- Segment rewrite and repair never receive permission to mutate current
  dialogue; generation may re-author only in `editorial_polish` or generative
  mode.
- Named levitation/zero-gravity exceptions suppress support findings only for
  the named object (or for all objects when the exception is explicitly
  universal). Unrelated floating objects still fail.

## Rollout

The packet is version `5.0`. `PROMPT_RULE_ROUTER_V5` is the new opt-in flag;
V4, V3 and V2 remain compatibility fallbacks. When every flag is unset, the
original legacy system prompt path is unchanged.

