const CLIENT_CARD_ASSET_BASE_URL =
  "https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/client-assets/v1";
const MINIPROGRAM_UI_ASSET_BASE_URL =
  "https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/miniprogram-ui/v1";

type ListeningPhase = "listening" | "answering";
const assetUrl = (path: string) => `${CLIENT_CARD_ASSET_BASE_URL}/${path}`;

export function resolveListeningBackground(
  _content: { lang?: string; age?: number | string } | undefined,
  phase: ListeningPhase,
): string {
  return `${MINIPROGRAM_UI_ASSET_BASE_URL}/cards/${
    phase === "answering"
      ? "listening-question-card-bg.png"
      : "listening-story-card-bg.png"
  }`;
}

export const LISTENING_QUESTION_BUBBLE = assetUrl(
  "ListeningComprehensionCard/assets/images/ui/question-bubble.png",
);

export const LISTENING_FEEDBACK_AUDIO = {
  correct: assetUrl(
    "ListeningComprehensionCard/assets/audio/feedback-correct.mp3",
  ),
  wrong: assetUrl(
    "ListeningComprehensionCard/assets/audio/feedback-wrong.mp3",
  ),
  complete: assetUrl(
    "ListeningComprehensionCard/assets/audio/feedback-complete.mp3",
  ),
} as const;

export type TraceFeedbackType = "correct" | "mistake" | "complete";

const TRACE_FEEDBACK_AUDIO: Record<TraceFeedbackType, readonly string[]> = {
  correct: [1, 2, 3, 4].map((index) =>
    assetUrl(`LiteracyCard/assets/audio/correct/correct_${index}.mp3`),
  ),
  mistake: [1, 2, 3, 4].map((index) =>
    assetUrl(`LiteracyCard/assets/audio/mistake/mistake_${index}.mp3`),
  ),
  complete: [1, 2, 3, 4].map((index) =>
    assetUrl(`LiteracyCard/assets/audio/complete/complete_${index}.mp3`),
  ),
};

export function getRandomTraceFeedbackAudio(
  type: TraceFeedbackType,
): string {
  const candidates = TRACE_FEEDBACK_AUDIO[type];
  return candidates[Math.floor(Math.random() * candidates.length)] ?? "";
}

export const LITERACY_CONVERSATION_ASSETS = {
  child: assetUrl("LiteracyCard/assets/images/child.png"),
  mama: assetUrl("LiteracyCard/assets/images/mama.png"),
  together: assetUrl("LiteracyCard/assets/images/together.png"),
} as const;
