import { CARD_TYPES, type CardDefinition, type CardType } from "./types/index";
import { validateCardPayload } from "./validation";

const labels: Record<CardType, string> = {
  recognition_pic_card: "认知卡",
  literacy_card: "识字卡",
  puzzle_card: "拼图卡",
  story_card: "故事卡",
  sound_object_card: "听音识物卡",
  choice_card: "选择卡",
  silhouette_choice_card: "轮廓识别卡",
  listening_comprehension_card: "听力卡",
  matching_card: "连线卡",
  classification_card: "分类卡",
};

const capabilities: Record<CardType, CardDefinition["capabilities"]> = {
  recognition_pic_card: ["audio", "video"],
  literacy_card: ["audio", "canvas"],
  puzzle_card: ["drag", "video", "timer"],
  story_card: ["audio"],
  sound_object_card: ["audio", "canvas"],
  choice_card: ["audio"],
  silhouette_choice_card: ["audio", "canvas"],
  listening_comprehension_card: ["audio"],
  matching_card: ["drag", "canvas"],
  classification_card: ["drag"],
};

const definitions: CardDefinition[] = CARD_TYPES.map((type) => ({
  type,
  label: labels[type],
  validate: (data) => validateCardPayload(type, data).valid,
  capabilities: capabilities[type],
}));

export const CardTypeConfig = Object.fromEntries(
  definitions.map((definition) => [definition.type, definition]),
) as Record<CardType, CardDefinition>;

export function isSupportedCardType(type: string): type is CardType {
  return (CARD_TYPES as readonly string[]).includes(type);
}

export function validateCardData(type: string, data: unknown) {
  return isSupportedCardType(type) && CardTypeConfig[type].validate(data);
}
