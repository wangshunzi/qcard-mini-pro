import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("cross-client behavior parity", () => {
  it("supports interactive favorite study and in-study favorite actions", () => {
    const profile = read("miniprogram/pages/profile/index.ts");
    const study = read("miniprogram/package-cards/pages/study/index.ts");
    const template = read("miniprogram/package-cards/pages/study/index.wxml");
    expect(profile).toContain("favorite=1&favoritePage=");
    expect(study).toContain("async loadFavoriteStudy()");
    expect(study).toContain("loadMoreFavoriteStudyIfNeeded");
    expect(study).toContain("async toggleFavorite()");
    expect(study).toContain("await favoriteCard(card.id, cardPackId)");
    expect(study).toContain("await unfavoriteCard(card.id)");
    expect(template).toContain('bindtap="toggleFavorite"');
  });

  it("resumes packs and challenges at their expected card", () => {
    for (const path of [
      "miniprogram/pages/home/index.ts",
      "miniprogram/pages/profile/index.ts",
      "miniprogram/package-cards/pages/teacher/index.ts",
      "miniprogram/package-cards/pages/my-learning/index.ts",
      "miniprogram/package-cards/pages/pack-detail/index.ts",
      "miniprogram/package-cards/pages/private-pack/index.ts",
    ]) {
      expect(read(path), path).toContain("lastStudiedCardId");
    }
    const home = read("miniprogram/pages/home/index.ts");
    expect(home).toContain("challenge.cards.find((item) => !item.isCompleted)");
    expect(home).toContain("challenge.cards[0]?.id");
  });

  it("paginates reviews, profile panels, and experience history", () => {
    const pack = read("miniprogram/package-cards/pages/pack-detail/index.ts");
    const profile = read("miniprogram/pages/profile/index.ts");
    const level = read("miniprogram/package-settings/pages/level-detail/index.ts");
    expect(pack).toContain("loadMoreReviews()");
    expect(pack).toContain("toggleReviewLike");
    expect(pack).toContain("toggleReviewDislike");
    expect(profile).toContain("loadMoreFeedbackCards()");
    expect(profile).toContain("loadMoreFavorites()");
    expect(profile).toContain("_feedbackPanelCache");
    expect(level).toContain("async loadMoreHistory()");
    expect(level).toContain("getExperienceHistory(page, 50)");
  });

  it("keeps personal-content lifecycle actions available", () => {
    const privatePack = read("miniprogram/package-cards/pages/private-pack/index.ts");
    const challenge = read("miniprogram/package-settings/pages/challenge-config/index.ts");
    expect(privatePack).toContain("deletePrivateCard(id)");
    expect(privatePack).toContain("toggleEditMode()");
    expect(challenge).toContain("resetChallengeConfig()");
  });

  it("preserves generation parameters across every personal-card entry", () => {
    for (const path of [
      "miniprogram/pages/home/index.ts",
      "miniprogram/pages/profile/index.ts",
      "miniprogram/package-cards/pages/my-generation/index.ts",
    ]) {
      const source = read(path);
      expect(source, path).toContain("genParams: card.genParams");
      expect(source, path).toContain("JSON.stringify(card.genParams)");
    }
  });

  it("uses measured profile spacing and the user avatar for recent private packs", () => {
    const profileLogic = read("miniprogram/pages/profile/index.ts");
    const profileTemplate = read("miniprogram/pages/profile/index.wxml");
    const homeTemplate = read("miniprogram/pages/home/index.wxml");
    expect(profileTemplate).toContain('bind:metrics="onNavigationMetrics"');
    expect(profileLogic).toContain("profileHeaderTop");
    expect(profileLogic).toContain("event.detail?.totalHeight");
    expect(profileLogic).toContain("PROFILE_HEADER_CONTENT_OFFSET_PX = 20");
    const profileStyles = read("miniprogram/pages/profile/index.wxss");
    expect(profileStyles).toContain("min-height: 596rpx");
    expect(profileStyles).toMatch(
      /\.profile-content\s*\{[^}]*min-height:\s*100vh;[^}]*margin-top:\s*-52rpx;/s,
    );
    expect(profileStyles).toMatch(
      /\.profile-page\s*\{[^}]*background:\s*var\(--color-card\);/s,
    );
    expect(homeTemplate).toContain("<study-pack-list-item");
    expect(homeTemplate).toContain('is-private="{{item.isPrivate}}"');
    const studyPackItem = read("miniprogram/components/study-pack-list-item/index.wxml");
    expect(studyPackItem).toContain('wx:if="{{isPrivate}}"');
    expect(studyPackItem).toContain(
      '<private-pack-cover avatar="{{privateCover}}" variant="home" />',
    );
    expect(read("miniprogram/package-cards/pages/my-learning/index.wxml")).toContain(
      '<private-pack-cover avatar="{{item.author.avatar || userAvatar}}" variant="list" />',
    );
    expect(read("miniprogram/package-cards/pages/private-pack/index.wxml")).toContain(
      '<private-pack-cover avatar="{{authorAvatar}}" variant="detail" />',
    );
    expect(read("miniprogram/pages/home/index.ts")).toContain("hasPrivatePackShape");
  });
});
