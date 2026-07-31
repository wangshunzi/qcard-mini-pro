export interface NormalizedPuzzleCardData {
  objectUrl: string;
  backgroundUrl: string;
  videoUrl: string;
  previewLevel: number;
  gameLevel: 2 | 3 | 4;
}

export function puzzleMediaUrl(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return String((value as any).url ?? (value as any).src ?? "");
  }
  return "";
}

export function normalizePuzzleCardData(value: any): NormalizedPuzzleCardData {
  const content = value?.content ?? {};
  const configuredLevel = Math.floor(Number(value?.level ?? content?.level));
  const gameLevel = ([2, 3, 4].includes(configuredLevel) ? configuredLevel : 3) as
    | 2
    | 3
    | 4;
  const previewLevel =
    Number.isFinite(configuredLevel) && configuredLevel > 0
      ? Math.min(4, configuredLevel)
      : 1;
  const objectUrl =
    puzzleMediaUrl(content.object) ||
    puzzleMediaUrl(content.image) ||
    puzzleMediaUrl(value?.imageUrl) ||
    puzzleMediaUrl(content.background) ||
    puzzleMediaUrl(value?.background);
  const backgroundUrl =
    puzzleMediaUrl(content.background) ||
    puzzleMediaUrl(value?.background) ||
    puzzleMediaUrl(content.object) ||
    puzzleMediaUrl(value?.imageUrl);

  return {
    objectUrl,
    backgroundUrl,
    videoUrl: puzzleMediaUrl(content.video),
    previewLevel,
    gameLevel,
  };
}
