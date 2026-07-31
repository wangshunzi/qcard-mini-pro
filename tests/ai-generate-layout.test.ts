import { describe, expect, it } from "vitest";

import { computeAiGenerateLayout } from "../miniprogram/package-cards/pages/ai-generate/layout";

describe("AI generate responsive layout", () => {
  it.each([
    { windowWidth: 375, windowHeight: 667, statusBarHeight: 20, navigationHeight: 44, safeInsetBottom: 0 },
    { windowWidth: 375, windowHeight: 812, statusBarHeight: 44, navigationHeight: 44, safeInsetBottom: 34 },
    { windowWidth: 390, windowHeight: 844, statusBarHeight: 47, navigationHeight: 44, safeInsetBottom: 34 },
    { windowWidth: 430, windowHeight: 932, statusBarHeight: 47, navigationHeight: 44, safeInsetBottom: 34 },
  ])("keeps the 9:16 carousel inside the available content on $windowWidth x $windowHeight", (input) => {
    const layout = computeAiGenerateLayout(input);
    const expectedContent =
      input.windowHeight -
      input.statusBarHeight -
      input.navigationHeight -
      layout.bottomBarHeight;

    expect(layout.contentHeight).toBeCloseTo(expectedContent, 0);
    expect(layout.carouselHeight).toBeLessThan(layout.contentHeight);
    expect(layout.carouselHeight * (9 / 16)).toBeLessThanOrEqual(input.windowWidth * 0.75 + 1);
    expect(layout.carouselSideMargin).toBeGreaterThanOrEqual(20);
  });

  it("never returns a non-positive layout for an unusually short viewport", () => {
    const layout = computeAiGenerateLayout({
      windowWidth: 320,
      windowHeight: 360,
      statusBarHeight: 44,
      navigationHeight: 44,
      safeInsetBottom: 34,
    });

    expect(layout.contentHeight).toBeGreaterThan(0);
    expect(layout.carouselHeight).toBeGreaterThan(0);
    expect(layout.carouselHeight).toBeLessThanOrEqual(layout.contentHeight);
  });
});
