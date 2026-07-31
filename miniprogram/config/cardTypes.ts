export const MINI_PROGRAM_CARD_TYPES = [
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

export const CARD_TYPE_LABELS: Record<string, string> = {
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

const typeSet = new Set<string>(MINI_PROGRAM_CARD_TYPES);

export function isMiniProgramCardType(type: unknown): type is CardType {
  return typeof type === "string" && typeSet.has(type);
}
import type { CardType } from "../cards/types";
