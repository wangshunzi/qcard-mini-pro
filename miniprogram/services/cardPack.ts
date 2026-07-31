import type { CardData } from "../cards/types";
import { isMiniProgramCardType } from "../config/cardTypes";
import { request } from "./http";
import { normalizeCardPack, type CardPackSummary } from "./discovery";
import { resolveApiMediaUrl, resolveCardDataMedia } from "../utils/mediaUrl";

export interface CardFace {
  id: string;
  name: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface CardCatalogue {
  id: string;
  name: string;
  sort: number;
  isStudied: boolean;
  isPreview: boolean;
  isFavorited?: boolean;
  frontFace: CardFace;
  frontCardData?: CardData;
  createdAt?: string;
}

export interface CardDetail extends CardCatalogue {
  cardPackId: string;
  backFace?: CardFace;
}

export interface CardPackDetail extends CardPackSummary {
  tag?: string;
  estimatedDuration?: string;
  averageRating?: string;
  reviewCount?: number;
  studentCount?: number;
  highlights?: Array<{
    id: string;
    icon?: string;
    color?: string;
    title: string;
    description?: string;
  }>;
  learningOutcomes?: Array<{ id: string; description: string }>;
  isFavorited?: boolean;
  hasReviewed?: boolean;
  isBestSeller?: boolean;
  unlockType?: string;
}

export function getCardPackDetail(id: string) {
  return request<CardPackDetail>({
    path: `/api/client/card-packs/${encodeURIComponent(id)}`,
  }).then(normalizeCardPack);
}

export function getCardPackCatalogue(id: string) {
  return request<CardCatalogue[]>({
    path: `/api/client/card-packs/${encodeURIComponent(id)}/card-catalogue`,
  }).then((items) =>
    (items ?? []).map((item) => ({
      ...item,
      frontFace: {
        ...item.frontFace,
        data: item.frontFace.data ? resolveCardDataMedia(item.frontFace.data) : item.frontFace.data,
      },
      frontCardData: item.frontFace?.data && isMiniProgramCardType(item.frontFace.type)
        ? {
            type: item.frontFace.type,
            data: resolveCardDataMedia(item.frontFace.data),
          }
        : undefined,
    })),
  );
}

export function getUnlockedCardPacks(params: {
  page?: number;
  limit?: number;
  keyword?: string;
  gradeId?: string;
  subjectId?: string;
  knowledgePointId?: string;
}) {
  return request<{
    items: CardPackSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }, Record<string, unknown>>({
    path: "/api/client/card-packs/unlocked",
    data: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      keyword: params.keyword || undefined,
      gradeId: params.gradeId || undefined,
      subjectId: params.subjectId || undefined,
      knowledgePointId: params.knowledgePointId || undefined,
      sortField: "lastStudied",
      sortOrder: "desc",
    },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map(normalizeCardPack),
  }));
}

export function getFavoriteCardPacks(page = 1, limit = 10) {
  return request<{
    items: CardPackSummary[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }, {
    page: number;
    limit: number;
    sortField: "createdAt";
    sortOrder: "desc";
  }>({
    path: "/api/client/card-packs/favorites",
    data: { page, limit, sortField: "createdAt", sortOrder: "desc" },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map(normalizeCardPack),
  }));
}

export function getTeacherCardPacks(teacherId: string) {
  return request<{
    teacher: {
      id: string;
      avatar?: string;
      name: string;
      title?: string;
      bio?: string;
      detail?: string;
      rating?: number;
    };
    cardPacks: CardPackSummary[];
  }>({
    path: `/api/client/card-packs/teacher/${encodeURIComponent(teacherId)}/card-packs`,
  }).then((result) => ({
    teacher: {
      ...result.teacher,
      avatar: result.teacher.avatar ? resolveApiMediaUrl(result.teacher.avatar) : undefined,
    },
    cardPacks: (result.cardPacks ?? []).map(normalizeCardPack),
  }));
}

export function getCardDetails(cardPackId: string, cardIds: string[]) {
  return request<CardDetail[], { cardIds: string[] }>({
    path: `/api/client/card-packs/${encodeURIComponent(cardPackId)}/card-details`,
    method: "POST",
    data: { cardIds },
  });
}

export function unlockCardPack(id: string) {
  return request<{ success: boolean; message?: string }, { paymentMethod: string }>({
    path: `/api/client/card-packs/${encodeURIComponent(id)}/unlock`,
    method: "POST",
    data: { paymentMethod: "balance" },
  });
}

export interface CardPackReview {
  id: string;
  rating: number;
  comment: string;
  studiedCards?: number;
  createdAt: string;
  createdAtText?: string;
  user: {
    id: string;
    nickname: string;
    avatar?: string;
  };
}

export function getCardPackReviews(id: string, page = 1, limit = 20) {
  return request<{
    items: CardPackReview[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }, { page: number; limit: number }>({
    path: `/api/client/card-packs/${encodeURIComponent(id)}/reviews`,
    data: { page, limit },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      createdAtText: item.createdAt
        ? new Date(item.createdAt).toLocaleDateString("zh-CN")
        : "",
      user: {
        ...item.user,
        avatar: item.user.avatar ? resolveApiMediaUrl(item.user.avatar) : undefined,
      },
    })),
  }));
}

export function createCardPackReview(id: string, rating: number, comment: string) {
  return request<CardPackReview, { rating: number; comment: string }>({
    path: `/api/client/card-packs/${encodeURIComponent(id)}/reviews`,
    method: "POST",
    data: { rating, comment },
  });
}

export function setCardPackFavorite(id: string, favorited: boolean) {
  return request<{ success?: boolean; message?: string }, Record<string, never>>({
    path: `/api/client/card-packs/${encodeURIComponent(id)}/favorite`,
    method: favorited ? "DELETE" : "POST",
    data: {},
  });
}

export function recordCardStudy(
  cardPackId: string,
  cardId: string,
  studyTime: number,
  requestId: string,
) {
  return request<
    { success: boolean; message?: string },
    { studyTime: number; requestId: string }
  >({
    path: `/api/client/user-study/record/${encodeURIComponent(cardPackId)}/${encodeURIComponent(cardId)}`,
    method: "POST",
    data: { studyTime, requestId },
  });
}

export function toCardData(face?: CardFace): CardData | undefined {
  if (!face?.data || !isMiniProgramCardType(face.type)) return undefined;
  return { type: face.type, data: resolveCardDataMedia(face.data) };
}
