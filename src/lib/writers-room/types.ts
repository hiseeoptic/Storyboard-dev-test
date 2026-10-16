// ============================================================
// WRITERS' ROOM — shared data model.
// A room holds the source (book pages read by OCR, or a typed idea), the AI's
// analysis, the video plan options, the shot-by-shot script (one row = one
// 10-second Omni Flash clip), its evaluation, the version history and the
// chat transcript. The whole room lives on the client and travels to the
// server action on each turn (no server-side storage).
// ============================================================

export type Faithfulness = "faithful" | "condensed" | "reimagined";

export interface BookPage {
  index: number;
  text: string;
}

export interface RoomCharacter {
  name: string;
  age?: string;
  gender?: string;
  appearance?: string;
  personality?: string;
  role?: string;
  wardrobe?: string;
  /** Source pages that describe this character (1-based). */
  pages?: number[];
}

export interface RoomSetting {
  name: string;
  description?: string;
  era?: string;
}

export interface BookAnalysis {
  book_type: "fiction" | "self_help" | "kids" | "history" | "knowledge" | "review" | "other";
  title_guess?: string;
  summary: string;
  themes: string[];
  message?: string;
  characters: RoomCharacter[];
  settings: RoomSetting[];
  key_quotes?: string[];
}

export interface PlanOption {
  id: string;
  title: string;
  /** adaptation | explainer | kids | documentary | review | other */
  format: string;
  logline: string;
  shot_count: number;
  episodes: number;
  structure: string[];
  /** App visual style id (cinematic, anime, 3d_render, watercolor…). */
  visual_style?: string;
  /** App character representation id (generated_human, illustrated_2d, stick_figure…). */
  character_representation?: string;
  /** App genre id (drama, kids, education, life_wisdom…). */
  genre?: string;
  voice_over: boolean;
  dialogue: boolean;
  camera?: string;
  why: string;
}

export interface ShotLine {
  /** Exact character name, or "" / "Lời dẫn" for the narrator. */
  speaker: string;
  text: string;
  start_s?: number;
  end_s?: number;
}

export interface ScriptShot {
  n: number;
  duration_s: number;
  location: string;
  characters: string[];
  /** Where every visible person and key object is when the shot opens (room terms). */
  start?: string;
  /** ONE continuous primary action for the whole clip. */
  action: string;
  dialogue: ShotLine[];
  voice_over?: ShotLine | null;
  camera?: string;
  transition?: string;
  /** Book pages this shot adapts (1-based). */
  pages?: number[];
}

export interface RoomScript {
  title: string;
  logline?: string;
  characters: RoomCharacter[];
  shots: ScriptShot[];
  episode?: number;
}

export interface EvaluationIssue {
  shot?: number;
  severity: "error" | "warning" | "info";
  message: string;
  /** Instruction the writer model can apply with one click. */
  fix?: string;
  source: "rules" | "ai";
  /** Rule identifier for findings the room can repair automatically. */
  code?: "no_speech" | "thin_speech" | "no_hook_line" | "no_start" | "unclear_path" | "blocking_overload";
}

export interface ScriptEvaluation {
  scores: Record<string, number>;
  overall: number;
  issues: EvaluationIssue[];
  /** Suggested next moves shown as one-click options. */
  options: Array<{ label: string; instruction: string }>;
  summary?: string;
}

export type ChatKind = "text" | "analysis" | "options" | "script" | "evaluation" | "error";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  kind?: ChatKind;
  at: number;
}

export interface RoomState {
  version: 1;
  faithfulness: Faithfulness;
  idea?: string;
  pages: BookPage[];
  analysis?: BookAnalysis;
  options?: PlanOption[];
  chosenOptionId?: string;
  script?: RoomScript;
  evaluation?: ScriptEvaluation;
  /** Earlier script versions, newest last (undo). */
  history: RoomScript[];
  messages: ChatMessage[];
}

export type RoomAction =
  | { type: "analyze" }
  | { type: "choose"; optionId: string }
  | { type: "revise"; instruction: string }
  | { type: "evaluate" }
  | { type: "chat"; message: string };

export function emptyRoom(faithfulness: Faithfulness = "condensed"): RoomState {
  return { version: 1, faithfulness, pages: [], history: [], messages: [] };
}
