export const CARD_TYPES = [
  "recognition_pic_card",
  "literacy_card",
  "puzzle_card",
  "story_card",
  "sound_object_card",
  "choice_card",
  "silhouette_choice_card",
  "listening_comprehension_card",
  "matching_card",
  "classification_card",
] as const;

export type CardType = (typeof CARD_TYPES)[number];
export type CardAspectRatio =
  | "square"
  | "portrait"
  | "landscape"
  | "auto"
  | string;

export interface CardData<T = Record<string, unknown>> {
  type: CardType;
  data: T;
  schemaVersion?: number;
}

export interface CardInteractionEvent {
  type:
    | "answer"
    | "correct"
    | "wrong"
    | "complete"
    | "reset"
    | "media";
  cardType: CardType;
  payload?: Record<string, unknown>;
}

export interface CardDefinition {
  type: CardType;
  label: string;
  validate(data: unknown): boolean;
  capabilities: Array<"audio" | "video" | "drag" | "canvas" | "timer">;
}
