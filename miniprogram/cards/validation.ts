import type { CardType } from "./types";

export interface CardValidationResult {
  valid: boolean;
  errors: string[];
}

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isMedia = (value: unknown) =>
  (typeof value === "string" && value.trim().length > 0) || typeof value === "number";
const isArray = (value: unknown) => Array.isArray(value);
function isSingleHanzi(value: unknown) {
  if (!isText(value)) return false;
  return (
    Array.from(value).length === 1 &&
    /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u.test(value)
  );
}

function validateContentItems(
  items: unknown,
  path: string,
  errors: string[],
) {
  if (!Array.isArray(items) || items.length === 0) {
    errors.push(`${path} 不能为空`);
    return new Set<string>();
  }
  const ids = new Set<string>();
  items.forEach((item, index) => {
    if (!isObject(item) || !isText(item.id)) {
      errors.push(`${path}[${index}].id 不能为空`);
      return;
    }
    if (ids.has(item.id)) errors.push(`${path} 存在重复 id: ${item.id}`);
    ids.add(item.id);
    if (!isText(item.text) && !isMedia(item.image)) {
      errors.push(`${path}[${index}] 必须包含文本或图片`);
    }
  });
  return ids;
}

function validateOptions(
  options: unknown,
  path: string,
  errors: string[],
  correctKey: "isCorrect" | "correct" = "isCorrect",
  requireId = true,
) {
  if (!Array.isArray(options) || options.length < 2) {
    errors.push(`${path} 至少需要两个选项`);
    return;
  }
  const ids = new Set<string>();
  let correctCount = 0;
  options.forEach((option, index) => {
    if (!isObject(option)) {
      errors.push(`${path}[${index}] 必须是对象`);
      return;
    }
    const id = String(option.id ?? "");
    if (requireId && !id) errors.push(`${path}[${index}].id 不能为空`);
    if (id) {
      if (ids.has(id)) errors.push(`${path} 存在重复 id: ${id}`);
      ids.add(id);
    }
    if (!isText(option.text) && !isMedia(option.image)) {
      errors.push(`${path}[${index}] 必须包含文本或图片`);
    }
    if (option[correctKey] === true || option.isCorrect === true || option.correct === true) {
      correctCount += 1;
    }
  });
  if (correctCount !== 1) errors.push(`${path} 必须且只能有一个正确选项`);
}

export function validateCardPayload(type: CardType, data: unknown): CardValidationResult {
  const errors: string[] = [];
  if (!isObject(data)) return { valid: false, errors: ["data 必须是对象"] };

  switch (type) {
    case "recognition_pic_card": {
      if (
        data.uiData !== undefined &&
        (!isObject(data.uiData) ||
          (data.uiData.langItems !== undefined && !Array.isArray(data.uiData.langItems)))
      ) {
        errors.push("uiData.langItems 必须是数组");
      }
      if (!Array.isArray(data.content) || data.content.length === 0) {
        errors.push("content 至少需要一种语言");
        break;
      }
      const languages = new Set<string>();
      data.content.forEach((item: any, index: number) => {
        if (!isObject(item)) {
          errors.push(`content[${index}] 必须是对象`);
          return;
        }
        if (!isText(item.lang)) errors.push(`content[${index}].lang 不能为空`);
        if (languages.has(item.lang)) errors.push(`content 存在重复语言: ${item.lang}`);
        languages.add(item.lang);
        if (!isText(item.subject) && !isMedia(item.mainImage)) {
          errors.push(`content[${index}] 必须包含主体文字或主图`);
        }
        if (item.pronunciation !== undefined && !isObject(item.pronunciation)) {
          errors.push(`content[${index}].pronunciation 无效`);
        }
        if (item.jingle !== undefined && !isObject(item.jingle)) {
          errors.push(`content[${index}].jingle 无效`);
        }
        if (item.actionVideos !== undefined && !isArray(item.actionVideos)) {
          errors.push(`content[${index}].actionVideos 必须是数组`);
        }
      });
      break;
    }
    case "literacy_card": {
      if (!isSingleHanzi(data.character)) errors.push("character 必须是单个汉字");
      if (!Array.isArray(data.variants) || data.variants.length === 0) {
        errors.push("variants 至少需要一个读音");
        break;
      }
      data.variants.forEach((variant: any, index: number) => {
        if (!isObject(variant) || !isText(variant.pinyin) || !isText(variant.meaning)) {
          errors.push(`variants[${index}] 必须包含 pinyin 和 meaning`);
        }
        if (
          !Array.isArray(variant?.phrases) ||
          (variant?.conversation !== undefined && !Array.isArray(variant.conversation))
        ) {
          errors.push(`variants[${index}] 的 phrases 必须是数组，conversation 必须为可选数组`);
        }
      });
      break;
    }
    case "puzzle_card": {
      if (
        data.level !== undefined &&
        (!Number.isInteger(data.level) || data.level < 2 || data.level > 4)
      ) {
        errors.push("level 必须是 2 到 4 的整数");
      }
      const content = isObject(data.content) ? data.content : {};
      const objectMedia = content.object ?? data.imageUrl;
      const backgroundMedia = content.background ?? data.background;
      if (!isMedia(objectMedia) && !isMedia(backgroundMedia)) {
        errors.push("content.object、imageUrl、content.background 或 background 至少需要一个");
      }
      break;
    }
    case "story_card": {
      if (!Array.isArray(data.content) || data.content.length === 0) errors.push("content 不能为空");
      if (!Array.isArray(data.images) || data.images.length === 0) errors.push("images 不能为空");
      if (!Array.isArray(data.roles)) errors.push("roles 必须是数组");
      if (!isObject(data.vtt) || !isMedia(data.vtt.src)) errors.push("vtt.src 不能为空");
      const imageIds = new Set((data.images ?? []).map((item: any) => item.id));
      (data.content ?? []).forEach((item: any, index: number) => {
        if (!isText(item?.text)) errors.push(`content[${index}].text 不能为空`);
        if (!imageIds.has(item?.imageId)) errors.push(`content[${index}].imageId 无对应图片`);
      });
      break;
    }
    case "sound_object_card": {
      const content = data.content;
      if (!isObject(content)) {
        errors.push("content 必须是对象");
        break;
      }
      if (!isText(content.name)) errors.push("content.name 不能为空");
      if (!isObject(content.image) || !isMedia(content.image.url)) errors.push("content.image.url 无效");
      if (!isObject(content.questionAudio) || !isMedia(content.questionAudio.url)) {
        errors.push("content.questionAudio.url 无效");
      }
      if (
        content.science !== undefined &&
        (!isObject(content.science) ||
          (content.science.audio !== undefined && !isMedia(content.science.audio)))
      ) {
        errors.push("content.science.audio 无效");
      }
      break;
    }
    case "choice_card": {
      if (!isMedia(data.backgroundImage)) errors.push("backgroundImage 无效");
      if (!isObject(data.question)) {
        errors.push("question 必须是对象");
      } else if (!isText(data.question.text) && !isMedia(data.question.image)) {
        errors.push("question 必须包含文本或图片");
      }
      validateOptions(data.options, "options", errors);
      if (Array.isArray(data.options) && data.options.length > 4) {
        errors.push("options 最多支持四个选项");
      }
      break;
    }
    case "silhouette_choice_card": {
      const content = data.content;
      if (!isObject(content)) {
        errors.push("content 必须是对象");
        break;
      }
      if (!isObject(content.question) || !isText(content.question.text) || !isMedia(content.question.url)) {
        errors.push("content.question.text/url 无效");
      }
      validateOptions(content.options, "content.options", errors, "isCorrect", false);
      if (Array.isArray(content.options) && content.options.length > 4) {
        errors.push("content.options 最多支持四个选项");
      }
      break;
    }
    case "listening_comprehension_card": {
      const content = data.content;
      if (!isObject(content)) {
        errors.push("content 必须是对象");
        break;
      }
      const audio = isObject(content.audio) ? content.audio.audio : content.audio;
      if (!isMedia(audio)) errors.push("content.audio 无效");
      if (!Array.isArray(content.questions) || content.questions.length === 0) {
        errors.push("content.questions 不能为空");
        break;
      }
      content.questions.forEach((question: any, index: number) => {
        if (!isText(question?.text)) errors.push(`questions[${index}].text 不能为空`);
        validateOptions(question?.options, `questions[${index}].options`, errors, "correct", false);
        if (Array.isArray(question?.options) && question.options.length > 4) {
          errors.push(`questions[${index}].options 最多支持四个选项`);
        }
      });
      break;
    }
    case "matching_card": {
      if (!isMedia(data.backgroundImage)) errors.push("backgroundImage 无效");
      if (!Array.isArray(data.leftItems) || !Array.isArray(data.rightItems) || !Array.isArray(data.pairs)) {
        errors.push("leftItems/rightItems/pairs 必须是数组");
        break;
      }
      const leftIds = validateContentItems(data.leftItems, "leftItems", errors);
      const rightIds = validateContentItems(data.rightItems, "rightItems", errors);
      if (data.pairs.length !== Math.min(data.leftItems.length, data.rightItems.length)) {
        errors.push("pairs 数量必须覆盖可配对项");
      }
      const pairedLeft = new Set<string>();
      const pairedRight = new Set<string>();
      data.pairs.forEach((pair: any, index: number) => {
        if (!isObject(pair) || !isText(pair.leftId) || !isText(pair.rightId)) {
          errors.push(`pairs[${index}] 的 leftId/rightId 不能为空`);
          return;
        }
        if (!leftIds.has(pair.leftId) || !rightIds.has(pair.rightId)) {
          errors.push(`pairs[${index}] 引用了不存在的选项`);
        }
        if (pairedLeft.has(pair.leftId) || pairedRight.has(pair.rightId)) {
          errors.push(`pairs[${index}] 与其他配对重复使用了选项`);
        }
        pairedLeft.add(pair.leftId);
        pairedRight.add(pair.rightId);
      });
      break;
    }
    case "classification_card": {
      if (!isMedia(data.backgroundImage)) errors.push("backgroundImage 无效");
      const itemIds = validateContentItems(data.items, "items", errors);
      if (!Array.isArray(data.rules) || data.rules.length === 0) {
        errors.push("rules 不能为空");
        break;
      }
      const ruleIds = new Set<string>();
      data.rules.forEach((rule: any, ruleIndex: number) => {
        if (!isText(rule?.id) || !isText(rule?.title)) errors.push(`rules[${ruleIndex}] id/title 不能为空`);
        if (ruleIds.has(rule?.id)) errors.push(`rules 存在重复 id: ${rule.id}`);
        if (isText(rule?.id)) ruleIds.add(rule.id);
        const bucketIds = new Set<string>();
        if (Array.isArray(rule?.buckets) && rule.buckets.length > 3) {
          errors.push(`rules[${ruleIndex}].buckets 最多支持三个分类桶`);
        }
        (rule?.buckets ?? []).forEach((bucket: any, bucketIndex: number) => {
          if (!isObject(bucket) || !isText(bucket.id) || !isText(bucket.title)) {
            errors.push(`rules[${ruleIndex}].buckets[${bucketIndex}] id/title 不能为空`);
            return;
          }
          if (bucketIds.has(bucket.id)) {
            errors.push(`rules[${ruleIndex}].buckets 存在重复 id: ${bucket.id}`);
          }
          bucketIds.add(bucket.id);
        });
        if (!bucketIds.size) errors.push(`rules[${ruleIndex}].buckets 不能为空`);
        const answered = new Set<string>();
        (rule?.answers ?? []).forEach((answer: any, answerIndex: number) => {
          if (!isObject(answer) || !isText(answer.itemId) || !isText(answer.bucketId)) {
            errors.push(`rules[${ruleIndex}].answers[${answerIndex}] itemId/bucketId 不能为空`);
            return;
          }
          if (!itemIds.has(answer.itemId) || !bucketIds.has(answer.bucketId)) {
            errors.push(`rules[${ruleIndex}].answers[${answerIndex}] 引用无效`);
          }
          if (answered.has(answer.itemId)) {
            errors.push(`rules[${ruleIndex}] 对物品 ${answer.itemId} 提供了重复答案`);
          }
          answered.add(answer.itemId);
        });
        if (
          answered.size !== itemIds.size ||
          (rule?.answers ?? []).length !== itemIds.size
        ) {
          errors.push(`rules[${ruleIndex}] 必须为每个物品提供且仅提供一个答案`);
        }
      });
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}
