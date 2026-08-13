import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("mini-program filing compliance", () => {
  it("keeps the approved mini-program filing number and official query URL together", () => {
    const filing = read("miniprogram/config/filing.ts");

    expect(filing).toContain('number: "沪ICP备2025146321号-3X"');
    expect(filing).toContain('queryUrl: "https://beian.miit.gov.cn/"');
    expect(filing).toContain("wx.setClipboardData");
  });

  it("exposes the filing query before and after login", () => {
    for (const path of [
      "miniprogram/pages/login/index.wxml",
      "miniprogram/package-settings/pages/settings/index.wxml",
    ]) {
      const template = read(path);
      expect(template, path).toContain("{{filingNumber}}");
      expect(template, path).toContain('bindtap="openFilingQuery"');
      expect(template, path).toContain("查询小程序备案信息");
    }

    for (const path of [
      "miniprogram/pages/login/index.ts",
      "miniprogram/package-settings/pages/settings/index.ts",
    ]) {
      const logic = read(path);
      expect(logic, path).toContain("MINI_PROGRAM_FILING.number");
      expect(logic, path).toContain("openMiniProgramFilingQuery()");
    }
  });

  it("does not reuse the native app filing number in the mini program", () => {
    const login = read("miniprogram/pages/login/index.wxml");
    const filing = read("miniprogram/config/filing.ts");

    expect(login).not.toContain("沪ICP备2025146321号-2A");
    expect(filing).not.toContain("沪ICP备2025146321号-2A");
  });

  it("keeps the login filing entry inside the visible bottom safe area", () => {
    const styles = read("miniprogram/pages/login/index.wxss");

    expect(styles).toMatch(
      /\.icp\s*\{[^}]*position:fixed;[^}]*bottom:calc\(12rpx \+ env\(safe-area-inset-bottom\)\);/s,
    );
    expect(styles).toMatch(
      /\.login-panel\s*\{[^}]*padding:\s*48rpx 32rpx calc\(112rpx \+ env\(safe-area-inset-bottom\)\);/s,
    );
  });
});
