import { request } from "./http";
import { resolveApiMediaUrl, resolveCardDataMedia } from "../utils/mediaUrl";

export interface StudyProgress {
  progress?: number;
  completedCards?: number;
  lastStudiedCardId?: string;
  lastStudiedAt?: string;
  totalStudyTime?: number;
}

export interface CardPackSummary {
  id: string;
  title: string;
  description?: string;
  cover?: string;
  cardCount?: number;
  previewCardCount?: number;
  isUnlocked?: boolean;
  isHot?: boolean;
  isNew?: boolean;
  isBestSeller?: boolean;
  difficulty?: string;
  unlockType?: "free" | "paid" | "vip" | string;
  basePrice?: number;
  priceInfo?: {
    finalPrice?: number;
    discountAmount?: number;
    discountPercent?: number;
    levelDiscountAmount?: number;
    levelDiscountPercent?: number;
    calculationReason?: string;
  };
  userStudyProgress?: StudyProgress;
  subject?: { id: string; name: string; code?: string };
  knowledgePoint?: { id: string; name: string; code?: string };
  author?: {
    id: string;
    name: string;
    avatar?: string;
    title?: string;
    bio?: string;
    rating?: number;
  };
}

export interface KnowledgePoint {
  id: string;
  name: string;
  icon?: string;
  cardPacks: CardPackSummary[];
}

export interface Subject {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  knowledgePoints: KnowledgePoint[];
}

export interface Grade {
  id: string;
  name: string;
  icon?: string;
  subjects: Subject[];
}

export interface DiscoveryData {
  grades: Grade[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DiscoveryCard {
  id: string;
  name: string;
  frontFace: {
    id: string;
    name: string;
    type: string;
    data: Record<string, unknown>;
  };
  cardPack: CardPackSummary & {
    cover: string;
    grade?: { id: string; name: string };
  };
}

export function normalizeCardPack<T extends CardPackSummary>(item: T): T {
  return {
    ...item,
    cover: item.cover ? resolveApiMediaUrl(item.cover) : undefined,
    author: item.author
      ? { ...item.author, avatar: item.author.avatar ? resolveApiMediaUrl(item.author.avatar) : undefined }
      : undefined,
  };
}

export function getDiscoveryData() {
  return request<DiscoveryData>({ path: "/api/client/discovery" }).then((result) => ({
    grades: (result.grades ?? []).map((grade) => ({
      ...grade,
      icon: grade.icon ? resolveApiMediaUrl(grade.icon) : undefined,
      subjects: (grade.subjects ?? []).map((subject) => ({
        ...subject,
        icon: subject.icon ? resolveApiMediaUrl(subject.icon) : undefined,
        knowledgePoints: (subject.knowledgePoints ?? []).map((point) => ({
          ...point,
          icon: point.icon ? resolveApiMediaUrl(point.icon) : undefined,
          cardPacks: (point.cardPacks ?? []).map(normalizeCardPack),
        })),
      })),
    })),
  }));
}

export function searchCardPacks(keyword: string, page = 1, limit = 12) {
  return request<Paginated<CardPackSummary>, {
    keyword: string;
    page: number;
    limit: number;
  }>({
    path: "/api/client/discovery/search/card-packs",
    data: { keyword, page, limit },
  }).then((result) => ({ ...result, items: (result.items ?? []).map(normalizeCardPack) }));
}

export function getDiscoveryCards(params: {
  gradeId?: string;
  cardName?: string;
  page?: number;
  pageSize?: number;
}) {
  return request<Paginated<DiscoveryCard>, Record<string, unknown>>({
    path: "/api/client/discovery/cards",
    data: {
      gradeId: params.gradeId || undefined,
      cardName: params.cardName || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
    },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      frontFace: { ...item.frontFace, data: resolveCardDataMedia(item.frontFace.data) },
      cardPack: normalizeCardPack(item.cardPack),
    })),
  }));
}
