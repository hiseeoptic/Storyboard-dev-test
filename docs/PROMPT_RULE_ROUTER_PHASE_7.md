# Prompt Rule Router — Phase 7

Phase 7 replaces the monolithic generation system prompt at runtime with a
small, auditable module manifest. The legacy prompt remains in source and is
still the exact rollback path.

## Rollout boundary

`PROMPT_RULE_ROUTER_V7=true` enables the modular generation compiler. Older
flags continue to behave as before:

- V6 keeps compact `segment_rewrite` and `repair` prompts;
- V5/V6 generation keeps the legacy prompt plus exact rule-owned pruning;
- no router flag keeps the original system and user prompts unchanged.

V7 also routes the generation user prompt through the packet's resolved hook
mode. Therefore `required_by_menu` and `intent_gated` cannot be contradicted by
an older universal 3–5 second hook sentence. This user-prompt change activates
only with the V7 flag.

## Eleven single-owner modules

The V7 compiler emits exactly one module for each responsibility:

1. authority resolution and Active Rule Packet;
2. clip execution and action capacity;
3. Scene Intent, hook and story causality;
4. uploaded-reference binding or generated-identity DNA;
5. world/entity/state-ledger continuity;
6. environment archetype routing;
7. spatial and physical continuity;
8. camera, lighting and performance;
9. dialogue preservation or bounded dialogue authorship;
10. render/safety and visible-text policy;
11. JSON output and final audit.

Alternative modules are mutually exclusive. A preserve/current-script packet
cannot load dialogue authorship; a polish/generate packet cannot load dialogue
preservation. Reference binding replaces generated-identity instructions only
when the input contains an actual uploaded/approved reference.

## Laws retained

The compact prompt keeps the production invariants that prevent broken video:

- one continuous generated take per clip;
- declared transitions at clip boundaries;
- causal state ledger and persistent entities;
- obstacle-clear routes around furniture and architecture;
- named hand occupancy and reach/contact/grip/use/release chains;
- support continuity for tools and receivers, including a pan while an egg is
  cracked into it;
- gravity, collision, containment and cause-before-effect;
- intentional physics exceptions limited to their named entity/event;
- camera-zone, axis, lighting and acoustic continuity;
- exact reference, speaker, text and JSON authority.

The environment catalog remains available as its own module. An archetype may
be selected only when compatible with locked Context IR; otherwise the model
must use `custom`, so catalog convenience cannot redesign the user's location.

## Size and structural audit

The old monolithic system-prompt source section is approximately 41,000
characters before runtime interpolation. With the current 18-entry environment
catalog, representative V7 prompts measure:

- preserve/reference generation: approximately 15,476 characters;
- polish/reference generation: approximately 15,659 characters.

This is roughly a 62% reduction while retaining the essential production laws.
Tests keep a normal prompt below 16,000 characters. Runtime has a 20,000
character fail-safe ceiling to leave room for explicit user camera grammar and
named universe exceptions without silently truncating higher-authority input.

The compiler fails closed on duplicate module ids, duplicate responsibility
owners, missing required responsibilities, empty modules, and a prompt above
the fail-safe ceiling.

## Files

- `src/lib/rules/generation-prompt.ts`: module manifest, variants, audit and
  compiler.
- `src/services/ai-engine.ts`: V7-only runtime route and reference/catalog
  inputs.
- `src/prompts/storyboard-breakdown.ts`: hook directive consumes the resolved
  packet mode while legacy fallback remains unchanged.
- `src/lib/rules/generation-prompt.test.ts`: module, conflict, size, hook,
  reference and physics regression coverage.
