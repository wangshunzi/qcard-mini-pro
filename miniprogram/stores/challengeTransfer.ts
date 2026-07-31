import type { DailyChallenge } from "../services/home";

const KEY = "qcard.challenge-transfer.v1";

export function saveChallengeTransfer(challenge: DailyChallenge) {
  wx.setStorageSync(KEY, challenge);
}

export function readChallengeTransfer(): DailyChallenge | null {
  const value = wx.getStorageSync(KEY);
  return value && typeof value === "object" ? value as DailyChallenge : null;
}
