import { describe, expect, it } from "vitest";
import {
  createRenderRows,
  initializeFormData,
  resolveExpression,
  validateRows,
  type FormSchema,
} from "../miniprogram/components/schema-form/runtime";
import {
  getMiniProgramSchemaIssues,
  isMiniProgramSchemaSupported,
} from "../miniprogram/utils/schemaCompatibility";

const clientSchema: FormSchema = {
  type: "object",
  properties: {
    name: {
      type: "string",
      title: "主题",
      widget: "input",
      required: true,
      max: 8,
      props: { placeholder: "请输入主题" },
    },
    prompt: {
      type: "string",
      title: "补充描述",
      widget: "textArea",
      default: "童趣风格",
    },
    language: {
      type: "string",
      title: "语言",
      widget: "selector",
      default: "zh-CN",
      props: {
        options: [
          { label: "中文", value: "zh-CN" },
          { label: "英文", value: "en-US" },
        ],
      },
    },
    tags: {
      type: "array",
      title: "标签",
      widget: "selector",
      props: {
        multiple: true,
        options: [
          { label: "自然", value: "nature" },
          { label: "科学", value: "science" },
        ],
      },
    },
    count: {
      type: "number",
      title: "数量",
      widget: "stepper",
      default: 2,
      props: { min: 1, max: 5, step: 1 },
    },
    sound: {
      type: "boolean",
      title: "声音",
      widget: "switch",
      default: true,
    },
    birthday: {
      type: "string",
      title: "日期",
      widget: "datePicker",
    },
    score: {
      type: "number",
      title: "评分",
      widget: "rate",
      props: { count: 5, allowHalf: false },
    },
    difficulty: {
      type: "number",
      title: "难度",
      widget: "slider",
      props: { min: 0, max: 10, step: 2 },
      disabled: "{{ formData.sound === false }}",
    },
  },
};

describe("native schema form compatibility", () => {
  it("supports every widget and property used by the Client renderer", () => {
    expect(getMiniProgramSchemaIssues(clientSchema as any)).toEqual([]);
    expect(isMiniProgramSchemaSupported(clientSchema as any)).toBe(true);
  });

  it("normalizes Client widget casing and applies defaults without retaining stale fields", () => {
    const data = initializeFormData(clientSchema, { stale: true } as any);
    expect(data).toMatchObject({
      prompt: "童趣风格",
      language: "zh-CN",
      count: 2,
      sound: true,
    });
    expect(data).not.toHaveProperty("stale");
    const rows = createRenderRows(clientSchema, data);
    expect(rows.find((row) => row.id === "prompt")?.normalizedWidget).toBe("textarea");
    expect(rows.find((row) => row.id === "birthday")?.normalizedWidget).toBe("datepicker");
    expect(rows.find((row) => row.id === "difficulty")?.stepValue).toBe(2);
  });

  it("can reset to a truly empty form for Client's continue-generation action", () => {
    expect(initializeFormData(clientSchema, {}, false)).toEqual({});
    expect(initializeFormData(clientSchema, {}, true)).toMatchObject({
      prompt: "童趣风格",
      language: "zh-CN",
      count: 2,
      sound: true,
    });
  });

  it("matches Client required, max-length, hidden and disabled behavior", () => {
    const data = initializeFormData(clientSchema, {
      name: "这是一个超过限制的主题",
      sound: false,
    });
    const rows = createRenderRows(clientSchema, data);
    expect(rows.find((row) => row.id === "difficulty")?.controlDisabled).toBe(true);
    expect(validateRows(rows, data).name).toContain("最多8个字符");

    const missing = initializeFormData(clientSchema, {});
    expect(validateRows(createRenderRows(clientSchema, missing), missing).name).toBe("请填写主题");
  });

  it("evaluates Client-style conditional expressions", () => {
    const data = { enabled: true, count: 3, mode: "child" };
    expect(resolveExpression("{{ formData.enabled && formData.count >= 2 }}", data)).toBe(true);
    expect(resolveExpression("{{ formData.mode === 'adult' || formData.count < 5 }}", data)).toBe(true);
    expect(resolveExpression("{{ !formData.enabled }}", data)).toBe(false);
  });

  it("reports the exact unsupported custom control", () => {
    const issues = getMiniProgramSchemaIssues({
      type: "object",
      properties: {
        photo: { title: "参考图片", type: "string", widget: "customUpload" },
      },
    });
    expect(issues).toEqual([
      expect.objectContaining({
        field: "photo",
        title: "参考图片",
        widget: "customupload",
      }),
    ]);
  });
});
