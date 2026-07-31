import { request } from "./http";
import type { Paginated } from "./discovery";
import { resolveApiMediaUrl, resolveCardDataMedia } from "../utils/mediaUrl";

export interface PublicCardFaceSummary {
  id: string;
  name: string;
  type: string;
  thumbnailUrl?: string | null;
  templateId?: string;
  schemaVersion?: number;
  supportedPlatforms?: string[];
  data?: Record<string, unknown>;
  genParams?: Record<string, unknown>;
  previewTitle?: string;
  previewQuestionCount?: number;
  createdAt: string;
}

export interface PublicCardFaceDetail extends PublicCardFaceSummary {
  data: Record<string, unknown>;
}

export function getPublicCardFaces(params: {
  page?: number;
  limit?: number;
  name?: string;
  templateId?: string;
}) {
  return request<Paginated<PublicCardFaceSummary>, Record<string, unknown>>({
    path: "/api/client/exploration/card-faces",
    data: {
      page: params.page ?? 1,
      limit: params.limit ?? 12,
      name: params.name || undefined,
      templateId: params.templateId || undefined,
    },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => {
      const data = item.data ? resolveCardDataMedia(item.data) : item.data;
      const content = (data?.content ?? {}) as Record<string, unknown>;
      return {
        ...item,
        thumbnailUrl: item.thumbnailUrl ? resolveApiMediaUrl(item.thumbnailUrl) : item.thumbnailUrl,
        data,
        previewTitle:
          typeof content.title === "string" && content.title.trim()
            ? content.title
            : item.name,
        previewQuestionCount: Array.isArray(content.questions)
          ? content.questions.length
          : 0,
      };
    }),
  }));
}

export function getPublicCardFace(id: string) {
  return request<PublicCardFaceDetail>({
    path: `/api/client/exploration/card-faces/${encodeURIComponent(id)}`,
  }).then((item) => ({ ...item, data: resolveCardDataMedia(item.data) }));
}
