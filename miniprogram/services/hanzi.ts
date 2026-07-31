import { request } from "./http";

export interface HanziCharacterData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

export function getHanziCharacterData(character: string) {
  return request<HanziCharacterData>({
    path: `/api/client/hanzi-data/${encodeURIComponent(character)}`,
    auth: false,
  });
}
