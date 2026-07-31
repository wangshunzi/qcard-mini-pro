import { describe, expect, it } from "vitest";

import {
  LITERACY_CONVERSATION_ASSETS,
  LISTENING_FEEDBACK_AUDIO,
  LISTENING_QUESTION_BUBBLE,
  getRandomTraceFeedbackAudio,
  resolveListeningBackground,
} from "../miniprogram/cards/assets/client-card-assets";

const ASSET_BASE =
  "https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/client-assets/v1";

describe("Client 卡片素材映射", () => {
  it("听力卡使用与 H5 相同的听读和答题背景", () => {
    expect(resolveListeningBackground({ lang: "zh-CN", age: "5" }, "listening")).toBe(
      "https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/miniprogram-ui/v1/cards/listening-story-card-bg.png",
    );
    expect(resolveListeningBackground({ lang: "zh-CN", age: "5" }, "answering")).toBe(
      "https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/miniprogram-ui/v1/cards/listening-question-card-bg.png",
    );
  });

  it("所有固定素材只使用自有 HTTPS OSS", () => {
    const urls = [
      ...Object.values(LISTENING_FEEDBACK_AUDIO),
      ...Object.values(LITERACY_CONVERSATION_ASSETS),
      LISTENING_QUESTION_BUBBLE,
    ];
    expect(urls).toHaveLength(7);
    urls.forEach((url) => expect(url.startsWith(`${ASSET_BASE}/`)).toBe(true));
  });

  it.each(["correct", "mistake", "complete"] as const)(
    "描字反馈 %s 始终落在对应的四个 Client 原始音频内",
    (type) => {
      for (let index = 0; index < 30; index += 1) {
        expect(getRandomTraceFeedbackAudio(type)).toMatch(
          new RegExp(
            `^${ASSET_BASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/LiteracyCard/assets/audio/${type}/` +
              `${type}_[1-4]\\.mp3$`,
          ),
        );
      }
    },
  );
});
