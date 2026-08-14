import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("AI generated content labels", () => {
  it("keeps the AI identity visible throughout the generation flow", () => {
    const template = read(
      "miniprogram/package-cards/pages/ai-generate/index.wxml",
    );

    expect(template).toContain('title="AI 生成卡面"');
    expect(template).toContain("开始 AI 生成");
    expect(template).toContain("内容由 AI 生成，请核对后使用");
  });

  it("labels generated cards in lists and previews", () => {
    const listItem = read(
      "miniprogram/components/private-card-face-item/index.wxml",
    );
    const preview = read(
      "miniprogram/components/card-preview-modal/index.wxml",
    );

    expect(listItem).toContain('class="ai-generated-badge">AI 生成</view>');
    expect(preview).toContain(
      'wx:if="{{cardPayload.privateFace}}" class="ai-generated-badge">AI 生成</view>',
    );
  });
});
