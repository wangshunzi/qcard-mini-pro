import { describe, expect, it } from "vitest";
import {
  CardTypeConfig,
  isSupportedCardType,
  validateCardData,
} from "../miniprogram/cards/CardTypeConfig";
import { CARD_TYPES } from "../miniprogram/cards/types";
import { isMiniProgramSchemaSupported } from "../miniprogram/services/ai";
import { resolveCardDataMedia } from "../miniprogram/utils/mediaUrl";

const fixtures: Record<(typeof CARD_TYPES)[number], Record<string, unknown>> = {
  recognition_pic_card: {
    uiData: { langItems: [{ label: "中", value: "zh-CN" }] },
    content: [{
      lang: "zh-CN",
      subject: "苹果",
      pronunciation: { text: "píng guǒ", audio: "https://cdn.example.com/pronunciation.mp3" },
      jingle: { text: "红红苹果真香甜", audio: "https://cdn.example.com/jingle.mp3" },
      mainImage: "https://cdn.example.com/apple.jpg",
      actionVideos: [],
    }],
    theme: "#4f8fec",
    environmentTheme: "#fff",
  },
  literacy_card: {
    character: "叩",
    isPolyphone: false,
    variants: [{
      pinyin: "kòu",
      meaning: "敲击",
      phrases: [{ word: "叩门", pinyin: "kòu mén" }],
      conversation: [],
    }],
  },
  puzzle_card: {
    content: {
      background: "https://cdn.example.com/background.jpg",
      object: "https://cdn.example.com/object.png",
    },
    level: 3,
  },
  story_card: {
    content: [{ imageId: 1, role: 0, startTime: 0, text: "故事开始了", voice: { id: "narrator", name: "旁白" } }],
    images: [{ id: 1, prompt: "", roles: [], url: "https://cdn.example.com/story.jpg" }],
    roles: [],
    vtt: { src: "https://cdn.example.com/story.mp3" },
  },
  sound_object_card: {
    content: {
      image: { url: "https://cdn.example.com/cat.jpg" },
      name: "小猫",
      questionAudio: { url: "https://cdn.example.com/meow.mp3" },
      science: { audio: "https://cdn.example.com/cat-science.mp3", script: "猫的听觉很灵敏。" },
    },
  },
  choice_card: {
    backgroundImage: "https://cdn.example.com/choice.jpg",
    question: { mode: "text", text: "哪个是水果？" },
    options: [
      { id: "a", mode: "text", text: "苹果", isCorrect: true },
      { id: "b", mode: "text", text: "石头", isCorrect: false },
    ],
  },
  silhouette_choice_card: {
    content: {
      question: { text: "猜猜它是谁", url: "https://cdn.example.com/elephant.png" },
      options: [
        { id: "a", text: "大象", isCorrect: true },
        { id: "b", text: "小猫", isCorrect: false },
      ],
    },
  },
  listening_comprehension_card: {
    content: {
      audio: "https://cdn.example.com/listening.mp3",
      questions: [{
        id: "q1",
        text: "故事里是谁？",
        options: [
          { id: "a", text: "小兔", correct: true },
          { id: "b", text: "小鱼", correct: false },
        ],
      }],
    },
  },
  matching_card: {
    backgroundImage: "https://cdn.example.com/matching.jpg",
    leftItems: [{ id: "l1", mode: "text", text: "苹果" }],
    rightItems: [{ id: "r1", mode: "text", text: "水果" }],
    pairs: [{ leftId: "l1", rightId: "r1" }],
  },
  classification_card: {
    backgroundImage: "https://cdn.example.com/classification.jpg",
    items: [{ id: "apple", mode: "text", text: "苹果" }],
    rules: [{
      id: "kind",
      title: "按类别分",
      buckets: [{ id: "fruit", title: "水果" }],
      answers: [{ itemId: "apple", bucketId: "fruit" }],
    }],
  },
};

describe("native card registry", () => {
  it("registers exactly the ten client card types", () => {
    expect(Object.keys(CardTypeConfig).sort()).toEqual([...CARD_TYPES].sort());
  });

  it.each(CARD_TYPES)("accepts the shared fixture for %s", (type) => {
    expect(isSupportedCardType(type)).toBe(true);
    expect(validateCardData(type, fixtures[type])).toBe(true);
  });

  it("rejects unsupported and malformed generated data", () => {
    expect(isSupportedCardType("web_card")).toBe(false);
    expect(validateCardData("web_card", {})).toBe(false);
    expect(validateCardData("literacy_card", { character: "叩" })).toBe(false);
  });

  it.each(CARD_TYPES)("rejects an empty payload for %s", (type) => {
    expect(validateCardData(type, {})).toBe(false);
  });

  it("rejects ambiguous answers and broken cross references", () => {
    const choice = structuredClone(fixtures.choice_card) as any;
    choice.options[1].isCorrect = true;
    expect(validateCardData("choice_card", choice)).toBe(false);

    const matching = structuredClone(fixtures.matching_card) as any;
    matching.pairs[0].rightId = "missing";
    expect(validateCardData("matching_card", matching)).toBe(false);

    const classification = structuredClone(fixtures.classification_card) as any;
    classification.rules[0].answers = [];
    expect(validateCardData("classification_card", classification)).toBe(false);
  });

  it("rejects duplicate interactive mappings and multi-character literacy data", () => {
    const matching = structuredClone(fixtures.matching_card) as any;
    matching.leftItems.push({ id: "l2", mode: "text", text: "香蕉" });
    matching.rightItems.push({ id: "r2", mode: "text", text: "黄色" });
    matching.pairs.push({ leftId: "l1", rightId: "r2" });
    expect(validateCardData("matching_card", matching)).toBe(false);

    const classification = structuredClone(fixtures.classification_card) as any;
    classification.rules[0].answers.push({
      itemId: "apple",
      bucketId: "fruit",
    });
    expect(validateCardData("classification_card", classification)).toBe(false);

    const literacy = structuredClone(fixtures.literacy_card) as any;
    literacy.character = "叩咔";
    expect(validateCardData("literacy_card", literacy)).toBe(false);
  });

  it("allows only schema controls implemented by the native renderer", () => {
    expect(
      isMiniProgramSchemaSupported({
        type: "object",
        properties: {
          title: { type: "string", widget: "textArea" },
          style: {
            type: "string",
            widget: "radio",
            props: { options: [{ label: "童趣", value: "child" }] },
          },
        },
      }),
    ).toBe(true);
    expect(
      isMiniProgramSchemaSupported({
        type: "object",
        properties: {
          object_name: {
            title: "物体名称",
            type: "string",
            widget: "input",
            required: true,
          },
          card_size: {
            title: "卡片大小",
            type: "number",
            widget: "stepper",
            props: { min: 1, max: 10, step: 1 },
          },
          enable_sound: {
            title: "启用声音",
            type: "bool",
            widget: "switch",
          },
        },
      }),
    ).toBe(true);
    expect(
      isMiniProgramSchemaSupported({
        type: "object",
        properties: {
          photo: { type: "string", widget: "upload" },
        },
      }),
    ).toBe(false);
    expect(
      isMiniProgramSchemaSupported({
        type: "object",
        properties: {
          tags: { type: "array" },
        },
      }),
    ).toBe(false);
  });

  it("accepts optional fields that the H5 renderers support", () => {
    expect(validateCardData("recognition_pic_card", {
      content: [{ lang: "zh-CN", subject: "苹果" }],
    })).toBe(true);

    expect(validateCardData("literacy_card", {
      character: "叩",
      variants: [{ pinyin: "kòu", meaning: "敲击", phrases: [] }],
    })).toBe(true);

    expect(validateCardData("puzzle_card", {
      imageUrl: "https://cdn.example.com/object.png",
      level: 2,
    })).toBe(true);

    expect(validateCardData("sound_object_card", {
      content: {
        name: "小猫",
        image: { url: "https://cdn.example.com/cat.jpg" },
        questionAudio: { url: "https://cdn.example.com/meow.mp3" },
      },
    })).toBe(true);

    expect(validateCardData("silhouette_choice_card", {
      content: {
        question: { text: "猜猜它是谁", url: "https://cdn.example.com/cat.png" },
        options: [
          { text: "小猫", isCorrect: true },
          { text: "小狗", isCorrect: false },
        ],
      },
    })).toBe(true);

    expect(validateCardData("listening_comprehension_card", {
      content: {
        title: "Tom's Sunny Morning",
        audio: {
          title: "Tom's Sunny Morning",
          transcript: "Tom is in the park.",
          audio: "https://cdn.example.com/listening.mp3",
        },
        questions: [{
          text: "故事里是谁？",
          options: [
            { text: "小兔", isCorrect: true },
            { text: "小鱼", isCorrect: false },
          ],
        }],
      },
    })).toBe(true);
  });

  it("resolves legacy relative media without changing card copy or colors", () => {
    expect(resolveCardDataMedia({
      image: "uploads/cards/apple.png",
      audio: "/uploads/audio/apple.mp3",
      text: "苹果",
      color: "#529917",
    })).toEqual({
      image: "https://staging.kolka.cn/uploads/cards/apple.png",
      audio: "https://staging.kolka.cn/uploads/audio/apple.mp3",
      text: "苹果",
      color: "#529917",
    });
  });
});
