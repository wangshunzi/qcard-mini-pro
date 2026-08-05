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
    expect(modalTemplate).toContain('class="preview-modal-backdrop" aria-label="关闭卡片详情" bindtap="close"');
    expect(modalTemplate).toContain('style="top: {{modalTop}}px; width: {{modalWidth}}px;" bindtap="close"');
    expect(modalTemplate).toContain('class="preview-card-stage" catchtap="preventClose"');
    expect(modalTemplate).not.toContain("preview-modal-dismiss-target");
    expect(modalTemplate).not.toContain('class="preview-modal-dock" catchtap');
    expect(modalTemplate).not.toContain("preview-modal-header");
    expect(modalTemplate).not.toContain("preview-modal-title");
    expect(modalTemplate).toContain("<flip-card");
    expect(modalTemplate).toContain('fill-container="{{true}}"');
    expect(modalTemplate).toContain('style="width:100%;height:100%;overflow:hidden;border-radius:34rpx;"');
    expect(modalTemplate).toContain('catchtap="openSourcePack"');
    expect(modalTemplate).toContain('catchtap="openGroupCard"');
    expect(modalTemplate).toContain('catchtap="makeSimilar"');
    expect(modalLogic).toContain("submitPrivateCardFaceFeedback");
    expect(modalLogic).toContain('../../services/privateCardFeedback');
    expect(modalLogic).not.toContain("package-cards/services");
    expect(modalLogic).toContain('triggerEvent("shown")');
    expect(modalLogic).toContain("closeAndThen");
    expect(modalLogic).toContain("getImmersiveNavigationMetrics");
    expect(modalLogic).toContain("metrics.totalHeight + 12");
    expect(modalLogic).toContain("modalWidth: 344");
    expect(modalLogic).toContain("windowInfo.windowWidth || 375) - 28");
    expect(modalStyles).toContain("backdrop-filter:blur(24rpx)");
    expect(modalStyles).not.toContain("preview-backdrop-in");
    expect(modalStyles).not.toContain("preview-backdrop-out");
    expect(modalStyles).toContain("position:fixed");
    expect(modalStyles).toContain("background:transparent");
    expect(modalStyles).toContain("aspect-ratio:9/16");
    expect(modalStyles).toContain("min-width:100%");
    expect(modalStyles).toContain("min-height:100%");
    expect(modalStyles).toContain("overflow:hidden; border-radius:34rpx");
    expect(modalStyles).toContain(".preview-modal-dock { width:100%");
    expect(modalStyles).toContain("padding:0");
    expect(modalStyles).toContain("box-shadow:none");
    expect(modalStyles).toContain("preview-panel-out");

    for (const page of [
      "miniprogram/pages/explore/index",
      "miniprogram/pages/resource/index",
      "miniprogram/package-cards/pages/my-generation/index",
      "miniprogram/pages/home/index",
      "miniprogram/pages/profile/index",
    ]) {
      const template = read(`${page}.wxml`);
      const logic = read(`${page}.ts`);
      const config = read(`${page}.json`);
      expect(template, page).toContain("<card-preview-modal");
      expect(template, page).toContain("cardPreviewOpen");
      expect(template, page).toContain('bind:shown="onCardPreviewShown"');
      expect(logic, page).toContain("cardPreviewPayload");
      expect(logic, page).toContain("cardPreviewVisible");
      expect(logic, page).toContain("onCardPreviewShown()");
      expect(logic, page).not.toContain("/package-cards/pages/preview/index");
      expect(config, page).toContain('"card-preview-modal"');
    }
  });

  it("opens tapped public and private pack cards directly in study", () => {
    const publicTemplate = read(
      "miniprogram/package-cards/pages/pack-detail/index.wxml",
    );
    const publicLogic = read(
      "miniprogram/package-cards/pages/pack-detail/index.ts",
    );
    const publicConfig = read(
      "miniprogram/package-cards/pages/pack-detail/index.json",
    );
    const privateTemplate = read(
      "miniprogram/package-cards/pages/private-pack/index.wxml",
    );
    const privateLogic = read(
      "miniprogram/package-cards/pages/private-pack/index.ts",
    );
    const privateConfig = read(
      "miniprogram/package-cards/pages/private-pack/index.json",
    );

    expect(publicTemplate).toContain("卡片列表");
    expect(publicLogic).toContain("/package-cards/pages/study/index?packId=");
    expect(publicLogic).toContain("&cardId=");
    expect(privateLogic).toContain("/package-cards/pages/study/index?private=1&packId=");
    expect(privateLogic).toContain("&cardId=");
    for (const source of [publicTemplate, privateTemplate]) {
      expect(source).not.toContain("<card-preview-modal");
    }
    for (const source of [publicConfig, privateConfig]) {
      expect(source).not.toContain('"card-preview-modal"');
    }
  });
});
