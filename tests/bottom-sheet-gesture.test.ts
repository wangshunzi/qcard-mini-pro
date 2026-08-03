import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bottomSheetDragOffset,
  shouldDismissBottomSheet,
} from "../miniprogram/utils/bottomSheetGesture";

declare const process: { cwd(): string };

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const bottomSheets = [
  [
    "miniprogram/components/app-purchase-guide/index.wxml",
    "miniprogram/components/app-purchase-guide/index.wxss",
  ],
  [
    "miniprogram/components/coin-history-drawer/index.wxml",
    "miniprogram/components/coin-history-drawer/index.wxss",
  ],
  [
    "miniprogram/components/unlock-confirm-drawer/index.wxml",
    "miniprogram/components/unlock-confirm-drawer/index.wxss",
  ],
  [
    "miniprogram/package-settings/pages/profile-edit/index.wxml",
    "miniprogram/package-settings/pages/profile-edit/index.wxss",
  ],
  [
    "miniprogram/package-cards/pages/generate/index.wxml",
    "miniprogram/package-cards/pages/generate/index.wxss",
  ],
  [
    "miniprogram/package-cards/pages/preview/index.wxml",
    "miniprogram/package-cards/pages/preview/index.wxss",
  ],
] as const;

describe("bottom-sheet gestures", () => {
  it("only follows downward movement and caps the visual offset", () => {
    expect(bottomSheetDragOffset(200, 150, 800)).toBe(0);
    expect(bottomSheetDragOffset(200, 260, 800)).toBe(60);
    expect(bottomSheetDragOffset(200, 1200, 800)).toBe(800);
  });

  it("dismisses on sufficient distance or a short downward flick", () => {
    expect(shouldDismissBottomSheet(88, 500)).toBe(true);
    expect(shouldDismissBottomSheet(40, 260)).toBe(true);
    expect(shouldDismissBottomSheet(40, 261)).toBe(false);
    expect(shouldDismissBottomSheet(39, 100)).toBe(false);
  });

  it("wires drag, scroll isolation, rebound and close states on every bottom sheet", () => {
    for (const [templatePath, stylePath] of bottomSheets) {
      const template = read(templatePath);
      const styles = read(stylePath);
      expect(template, templatePath).toContain("catchtouchmove=");
      expect(template, templatePath).toContain("bindtouchstart=");
      expect(template, templatePath).toContain("bindtouchend=");
      expect(template, templatePath).toContain("bindtouchcancel=");
      expect(styles, stylePath).toContain(".dragging");
      expect(styles, stylePath).toContain(".drag-settling");
      expect(styles, stylePath).toContain("translateY");
    }
  });
});
