# Prompt Rule Router — Phase 6

Phase 6 separates storyboard system-prompt responsibility by operation. It does
not delete or flatten the full generation prompt.

## Runtime routing

With `PROMPT_RULE_ROUTER_V6=true`:

- `generation` keeps the complete director/storyboard system prompt. The V5
  conflict compiler and Active Rule Packet still remove only precisely owned
  contradictory legacy clauses.
- `segment_rewrite` receives a compact technical-editor system prompt. It may
  change only the requested segment's staging, timing, camera coverage, action
  clarity, and physical continuity.
- `repair` receives a compact validator-bounded system prompt. It may change
  only requested targets and supplied findings; clean targets and neighbours
  remain read-only.

When the router is disabled, all three operations continue to use the unchanged
legacy system prompt. `PROMPT_RULE_ROUTER_V5`, V4, V3, and V2 remain temporary
compatibility fallbacks.

## Authority preserved in bounded edits

Both compact prompts retain only the rules required to safely edit existing
state:

1. input, menu, reference, Context IR, Production State, and Scene Intent
   authority;
2. exact edit scope and JSON output contract;
3. current dialogue, speaker, language, order, and hook-state locks;
4. visible-text policy;
5. clip-boundary continuity and selected camera grammar;
6. action budget;
7. collision, obstacle clearance, hand/contact chain, object support, and
   explicitly named physics exceptions.

They explicitly reject global story authorship, dialogue rewriting, hook
invention/removal, project redesign, and changes outside the requested target.
The detailed target objects, neighbouring state, findings, and response schema
remain in each operation's user prompt, where they were already owned.

## Prompt-size and responsibility guard

`STORYBOARD_STAGE_PROMPT_CONTRACTS` declares the allowed and forbidden
responsibilities for each bounded stage. Tests require duplicate-free module
ownership and cap each compact system prompt below 6,000 characters. They also
assert that legacy authoring doctrines, marketing/thumbnail roles, and other
global responsibilities do not leak into rewrite or repair.

## Compatibility and rollout

The Active Rule Packet is version `6.0`. The safe rollout sequence is:

1. enable `PROMPT_RULE_ROUTER_V6` in a test environment;
2. compare complete generation output against V5;
3. exercise per-scene regenerate and semantic repair;
4. inspect dialogue, hook, neighbour, and physical-state preservation;
5. disable the flag for immediate legacy rollback if needed.

Phase 7 can modularize the large generation prompt itself. That higher-risk
change is deliberately outside Phase 6.
