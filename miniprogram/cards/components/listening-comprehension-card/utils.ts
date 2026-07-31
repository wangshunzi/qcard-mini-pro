const SENTENCE_END_MARKS = new Set(["。", "！", "!", "？", "?", "；", ";", "."]);
const CLOSING_QUOTE_MARKS = new Set(["”", "’", "\"", "'", "」", "』", "）", ")"]);

export function splitTranscriptParagraphs(text?: string): string[] {
  const normalized = text?.trim();
  if (!normalized) return ["暂无听力材料文案"];

  const paragraphs: string[] = [];
  normalized
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .forEach((block) => {
      let current = "";
      for (let index = 0; index < block.length; index += 1) {
        const char = block[index];
        current += char;
        if (!SENTENCE_END_MARKS.has(char)) continue;
        if (
          char === "." &&
          /\d/.test(block[index - 1] ?? "") &&
          /\d/.test(block[index + 1] ?? "")
        ) continue;
        while (index + 1 < block.length && CLOSING_QUOTE_MARKS.has(block[index + 1])) {
          index += 1;
          current += block[index];
        }
        if (current.trim()) paragraphs.push(current.trim());
        current = "";
      }
      if (current.trim()) paragraphs.push(current.trim());
    });

  return paragraphs;
}
