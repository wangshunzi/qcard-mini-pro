import { describe, expect, it } from "vitest";
import { splitTranscriptParagraphs } from "../miniprogram/cards/components/listening-comprehension-card/utils";

describe("听力文稿前端分段", () => {
  it("按中英文句末符号拆分并保留结尾引号", () => {
    expect(splitTranscriptParagraphs("他说：“出发吧！”我们走。Ready? Go!")).toEqual([
      "他说：“出发吧！”",
      "我们走。",
      "Ready?",
      "Go!",
    ]);
  });

  it("不把小数点识别为句末", () => {
    expect(splitTranscriptParagraphs("温度是 3.14 度。下一句")).toEqual([
      "温度是 3.14 度。",
      "下一句",
    ]);
  });

  it("优先尊重原始换行并过滤空段", () => {
    expect(splitTranscriptParagraphs("第一段\n\n第二段没有标点")).toEqual([
      "第一段",
      "第二段没有标点",
    ]);
  });
});
