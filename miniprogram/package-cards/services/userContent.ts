import type { CardData } from "../../cards/types";
import { request } from "../../services/http";
import type { Paginated } from "../../services/discovery";
import type { PrivateCardFace } from "../../services/profile";
import { resolveApiMediaUrl, resolveCardDataMedia } from "../../utils/mediaUrl";

export interface PrivateCardPack {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  tag?: string;
  cardCount?: number;
  isActive?: boolean;
  createdAt?: string;
  author?: { id: string; name: string; avatar?: string };
  userStudyProgress?: {
    progress?: number;
    completedCards?: number;
    totalStudyTime?: number;
    lastStudiedAt?: string;
    lastStudiedCardId?: string;
  };
}

export interface PrivateCard {
  id: string;
  name: string;
  sort?: number;
  frontFace: { id: string; name: string; type: string; data: Record<string, unknown> };
  backFace?: { id: string; name: string; type: string; data: Record<string, unknown> };
  frontCardData?: CardData;
}

export function getPrivateCardPacks(page = 1, limit = 20, title = "") {
  return request<Paginated<PrivateCardPack>, { page: number; limit: number; title?: string }>({
    path: "/api/client/user-private-card-packs",
    data: { page, limit, title: title || undefined },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      cover: item.cover ? resolveApiMediaUrl(item.cover) : undefined,
    })),
  }));
}

export function deletePrivateCardPack(id: string) {
  return request<{ success?: boolean }, Record<string, never>>({
    path: `/api/client/user-private-card-packs/${encodeURIComponent(id)}`,
    method: "DELETE",
    data: {},
  });
}

export function createPrivateCardPack(title: string, description: string) {
  return request<
    PrivateCardPack,
    { title: string; description: string; isActive: boolean }
  >({
    path: "/api/client/user-private-card-packs",
    method: "POST",
    data: { title, description, isActive: true },
  });
}

export function getPrivateCardPack(id: string) {
  return request<PrivateCardPack>({
    path: `/api/client/user-private-card-packs/${encodeURIComponent(id)}`,
  }).then((item) => ({
    ...item,
    cover: item.cover ? resolveApiMediaUrl(item.cover) : undefined,
    author: item.author
      ? {
          ...item.author,
          avatar: item.author.avatar ? resolveApiMediaUrl(item.author.avatar) : undefined,
        }
      : undefined,
  }));
}

export function getPrivateCardCatalogue(id: string) {
  return request<PrivateCard[]>({
    path: `/api/client/user-private-card-packs/${encodeURIComponent(id)}/card-catalogue`,
  }).then((items) =>
    (items ?? []).map((item) => ({
      ...item,
      frontFace: {
        ...item.frontFace,
        data: resolveCardDataMedia(item.frontFace.data),
      },
      frontCardData: {
        type: item.frontFace.type as CardData["type"],
        data: resolveCardDataMedia(item.frontFace.data),
      },
      backFace: item.backFace
        ? { ...item.backFace, data: resolveCardDataMedia(item.backFace.data) }
        : undefined,
    })),
  );
}

export function getPrivateCardDetails(id: string, cardIds: string[]) {
  return request<Array<PrivateCard & { cardPackId?: string }>, { cardIds: string[] }>({
    path: `/api/client/user-private-card-packs/${encodeURIComponent(id)}/card-details`,
    method: "POST",
    data: { cardIds },
  });
}

export function recordPrivateCardStudy(cardPackId: string, cardId: string) {
  return request<{ success?: boolean; message?: string }, Record<string, never>>({
    path: `/api/client/user-private-card-packs/${encodeURIComponent(cardPackId)}/record/${encodeURIComponent(cardId)}`,
    method: "POST",
    data: {},
  });
}

export function createPrivateCard(data: {
  name: string;
  userPrivateCardPackId: string;
  frontFaceId: string;
  backFaceId?: string;
}) {
  return request<PrivateCard, typeof data>({
    path: "/api/client/user-private-cards",
    method: "POST",
    data,
  });
}

export function getPrivateCardFaces(params: {
  page?: number;
  limit?: number;
  name?: string;
  type?: string;
}) {
  return request<Paginated<PrivateCardFace>, Record<string, unknown>>({
    path: "/api/client/user-private-card-faces",
    data: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      name: params.name || undefined,
      type: params.type || undefined,
    },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl ? resolveApiMediaUrl(item.thumbnailUrl) : item.thumbnailUrl,
      data: item.data ? resolveCardDataMedia(item.data) : item.data,
    })),
  }));
}

export function deletePrivateCardFace(id: string) {
  return request<{ success?: boolean }, Record<string, never>>({
    path: `/api/client/user-private-card-faces/${encodeURIComponent(id)}`,
    method: "DELETE",
    data: {},
  });
}

export function submitPrivateCardFaceFeedback(id: string, content: string) {
  return request<{
    id: string;
    status: "processing";
    content: string;
    createdAt: string;
  }, { content: string }>({
    path: `/api/client/user-private-card-faces/${encodeURIComponent(id)}/feedback`,
    method: "POST",
    data: { content },
  });
}

export function toPrivateCardData(
  face?: { type?: string; data?: Record<string, unknown> },
): CardData | undefined {
  if (!face?.type || !face.data) return undefined;
  return { type: face.type as CardData["type"], data: resolveCardDataMedia(face.data) };
}
