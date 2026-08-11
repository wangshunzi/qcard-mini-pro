import { request } from "../../services/http";
import { invalidateData } from "../../stores/dataInvalidation";

export type LearningIntensity = "light" | "moderate" | "intensive";
export type LearningStrategy = "balanced" | "focus" | "explore";

export interface ChallengeConfig {
  learningIntensity: LearningIntensity;
  learningStrategy: LearningStrategy;
  autoAdjust: boolean;
  systemConfig: {
    targetDailyCards: number;
    minDailyCards: number;
    newCardPercentage: number;
    maxNewCardsPerDay: number;
    fillStrategy: "balanced" | "review_first" | "new_first";
    nearDueWindowDays: number;
  };
}

export function getChallengeConfig() {
  return request<ChallengeConfig>({ path: "/api/client/challenge-config" });
}

export function updateChallengeConfig(data: ChallengeConfig) {
  return request<ChallengeConfig, ChallengeConfig>({
    path: "/api/client/challenge-config",
    method: "PUT",
    data,
  }).then((config) => {
    invalidateData("challenge");
    return config;
  });
}

export function resetChallengeConfig() {
  return request<ChallengeConfig, Record<string, never>>({
    path: "/api/client/challenge-config/reset",
    method: "POST",
    data: {},
  }).then((config) => {
    invalidateData("challenge");
    return config;
  });
}
