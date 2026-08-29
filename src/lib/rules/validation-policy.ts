import type {
  ActiveStoryboardRulePacket,
  DialogueAuthorityMode,
  HookSelectionMode,
  VisibleTextMode,
} from "./active-packet.ts";

export interface StoryboardValidationPolicy {
  packet_version: ActiveStoryboardRulePacket["version"];
  hook_selection_mode: HookSelectionMode;
  dialogue_mode: DialogueAuthorityMode;
  dialogue_mutation_allowed: boolean;
  visible_text_mode: VisibleTextMode;
  physics_mode: string;
  intentional_physics_exceptions: string[];
  active_rule_ids: string[];
}

/** One small adapter prevents downstream validators from re-interpreting menu
 * values or Context IR independently of the already-resolved packet. */
export function buildStoryboardValidationPolicy(
  packet: ActiveStoryboardRulePacket
): StoryboardValidationPolicy {
  return {
    packet_version: packet.version,
    hook_selection_mode: packet.hook.mode,
    dialogue_mode: packet.dialogue.mode,
    dialogue_mutation_allowed:
      packet.stage === "generation" &&
      (packet.dialogue.mode === "editorial_polish" || packet.dialogue.mode === "generate"),
    visible_text_mode: packet.visible_text.mode,
    physics_mode: packet.physical_interaction.physics_mode,
    intentional_physics_exceptions: [...packet.physical_interaction.intentional_exceptions],
    active_rule_ids: [...packet.active_rule_ids],
  };
}

