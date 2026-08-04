import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("unified Mini Program product surfaces", () => {
  it("uses the shared segmented selector and accessible boolean toggle", () => {
    const globalStyles = read("miniprogram/app.wxss");
    const toggleTemplate = read("miniprogram/components/app-toggle/index.wxml");
    const toggleStyles = read("miniprogram/components/app-toggle/index.wxss");

    expect(globalStyles).toContain(".app-segmented");
    expect(globalStyles).toContain("align-items:stretch");
    expect(globalStyles).toContain(".app-segmented-option");
    expect(globalStyles).toContain("height:100%");
    expect(toggleTemplate).toContain('aria-role="switch"');
    expect(toggleTemplate).toContain('aria-checked="{{checked}}"');
    expect(toggleStyles).toContain(".toggle.checked .toggle-thumb");

    for (const template of [
      "miniprogram/components/schema-form/index.wxml",
      "miniprogram/package-settings/pages/challenge-config/index.wxml",
    ]) {
      const source = read(template);
      expect(source, template).toContain("<app-toggle");
      expect(source, template).not.toContain("<switch");
    }
  });

  it("renders teacher card packs with the shared visual hierarchy", () => {
    const template = read("miniprogram/package-cards/pages/teacher/index.wxml");
    const styles = read("miniprogram/package-cards/pages/teacher/index.wxss");

    expect(template).toContain('class="pack-cover-wrap"');
    expect(template).toContain('class="pack-title-row"');
    expect(template).toContain('class="subject-badge"');
    expect(template).toContain('class="access-copy ');
    expect(template).toContain('class="card-action ');
    expect(styles).toContain(".pack-description");
    expect(styles).toContain("-webkit-line-clamp:2");
  });

  it("opens the same frosted card-detail modal from every preview surface", () => {
    const modalTemplate = read("miniprogram/components/card-preview-modal/index.wxml");
    const modalLogic = read("miniprogram/components/card-preview-modal/index.ts");
    const modalStyles = read("miniprogram/components/card-preview-modal/index.wxss");

    expect(modalTemplate).toContain('class="preview-modal-backdrop"');
    expect(modalTemplate).toContain('class="preview-modal-close"');
    expect(modalTemplate).toContain("<flip-card");
    expect(modalTemplate).toContain('bindtap="openSourcePack"');
    expect(modalTemplate).toContain('bindtap="openGroupCard"');
    expect(modalTemplate).toContain('bindtap="makeSimilar"');
    expect(modalLogic).toContain("submitPrivateCardFaceFeedback");
    expect(modalLogic).toContain("closeAndThen");
    expect(modalStyles).toContain("backdrop-filter:blur(18rpx)");
    expect(modalStyles).toContain("position:fixed");

    for (const page of [
      "miniprogram/pages/explore/index",
      "miniprogram/pages/resource/index",
      "miniprogram/package-cards/pages/my-generation/index",
      "miniprogram/package-cards/pages/pack-detail/index",
      "miniprogram/package-cards/pages/private-pack/index",
      "miniprogram/pages/home/index",
      "miniprogram/pages/profile/index",
    ]) {
      const template = read(`${page}.wxml`);
      const logic = read(`${page}.ts`);
      const config = read(`${page}.json`);
      expect(template, page).toContain("<card-preview-modal");
      expect(template, page).toContain("cardPreviewOpen");
      expect(logic, page).toContain("cardPreviewPayload");
      expect(logic, page).not.toContain("/package-cards/pages/preview/index");
      expect(config, page).toContain('"card-preview-modal"');
    }
  });
});
