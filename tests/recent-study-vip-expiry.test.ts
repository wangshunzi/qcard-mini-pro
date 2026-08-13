import { describe, expect, it } from "vitest";
import { isExpiredVipStudyAccess } from "../miniprogram/utils/recentStudyAccess";

describe("recent-study VIP expiry state", () => {
  it("locks a previously studied public pack after access expires", () => {
    expect(
      isExpiredVipStudyAccess(
        {
          isUnlocked: false,
          userStudyProgress: { lastStudiedAt: "2026-08-01T08:00:00.000Z" },
        },
        false,
      ),
    ).toBe(true);
  });

  it("does not lock unlocked, unstudied, or private packs", () => {
    expect(
      isExpiredVipStudyAccess(
        {
          isUnlocked: true,
          userStudyProgress: { lastStudiedAt: "2026-08-01T08:00:00.000Z" },
        },
        false,
      ),
    ).toBe(false);
    expect(isExpiredVipStudyAccess({ isUnlocked: false }, false)).toBe(false);
    expect(
      isExpiredVipStudyAccess(
        {
          isUnlocked: false,
          userStudyProgress: { lastStudiedAt: "2026-08-01T08:00:00.000Z" },
        },
        true,
      ),
    ).toBe(false);
  });
});
