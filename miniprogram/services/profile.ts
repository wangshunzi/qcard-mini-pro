import { request } from "./http";
import type { Paginated } from "./discovery";
import { ENV } from "../config/env";
import { resolveApiMediaUrl, resolveCardDataMedia } from "../utils/mediaUrl";
import {
  invalidateData,
  trackVipExpiry,
} from "../stores/dataInvalidation";
import type { ThemeConfig } from "../design-system/theme";
import { cacheLoginThemeConfig } from "../design-system/loginTheme";

export interface UserProfile {
  isGuest?: boolean;
  id: string;
  shortId: string;
  phoneNumber?: string;
  nickname?: string;
  avatar?: string;
  bio?: string;
  defaultAvatarId?: string;
  gender?: string;
  birthday?: string;
  balance: number;
  frozenBalance: number;
  totalStudyTime: number;
  unlockedCardPackCount: number;
  grade?: { id: string; code: string; name: string; icon?: string };
  experience?: {
    level: number;
    experience: number;
    nextLevelRequiredExp: number;
    unlockDiscount?: number;
  };
  currentTheme?: {
    id?: string;
    name?: string;
    config?: ThemeConfig;
  };
  vip?: {
    isVip: boolean;
    vipExpireAt: string | null;
    dailyRewardClaimed: boolean;
    dailyRewardAmount?: number;
  };
}

export type FeedbackStatus = "processing" | "resolved" | "rejected";

function resolveThemeConfig(config: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      /_bg(?:_dark)?$/.test(key) && typeof value === "string" && value
        ? resolveApiMediaUrl(value)
        : value,
    ]),
  ) as ThemeConfig;
}

export interface PrivateCardFaceFeedback {
  status: FeedbackStatus;
  content?: string;
  adminReply?: string | null;
}

export interface PrivateCardFace {
  id: string;
  name: string;
  type: string;
  data?: Record<string, unknown>;
  status: "pending" | "processing" | "success" | "failed";
  thumbnailUrl?: string | null;
  templateId?: string;
  genParams?: Record<string, unknown>;
  feedback?: PrivateCardFaceFeedback | null;
  displayFeedbackStatus?: FeedbackStatus;
  createdAt: string;
}

export function getProfile() {
  return request<UserProfile>({ path: "/api/client/profile" }).then((profile) => {
    trackVipExpiry(profile.vip?.isVip === true, profile.vip?.vipExpireAt);
    const resolvedProfile = {
      ...profile,
      avatar: profile.avatar ? resolveApiMediaUrl(profile.avatar) : undefined,
      grade: profile.grade
        ? { ...profile.grade, icon: profile.grade.icon ? resolveApiMediaUrl(profile.grade.icon) : undefined }
        : undefined,
      currentTheme: profile.currentTheme
        ? {
            ...profile.currentTheme,
            config: resolveThemeConfig(profile.currentTheme.config ?? {}),
          }
        : undefined,
    };
    cacheLoginThemeConfig(resolvedProfile.currentTheme?.config);
    return resolvedProfile;
  });
}

export function updateProfile(data: {
  nickname?: string;
  defaultAvatarId?: string;
  gender?: string;
  birthday?: string;
  bio?: string;
}) {
  return request<UserProfile, typeof data>({
    path: "/api/client/profile",
    method: "PUT",
    data,
  }).then((profile) => {
    invalidateData("account");
    return profile;
  });
}

export function getDefaultAvatars() {
  return request<{
    items?: Array<{
      id: string;
      name?: string;
      imagePath?: string;
      imageUrl?: string;
    }>;
  }>({
    path: "/api/client/default-avatars",
  }).then((result) => ({
    items: (result.items ?? []).map((item) => {
      const path = String(item.imageUrl || item.imagePath || "");
      return {
        id: item.id,
        name: item.name || "",
        url: /^https?:\/\//i.test(path)
          ? path
          : `${ENV.apiBaseUrl}/${path.replace(/^\/+/, "")}`,
        imagePath: path,
      };
    }),
  }));
}

export function getRecentPrivateCardFaces(
  limit = 6,
  filters: {
    hasFeedback?: boolean;
    feedbackStatus?: FeedbackStatus;
  } = {},
  page = 1,
) {
  return request<Paginated<PrivateCardFace>, {
    page: number;
    limit: number;
    hasFeedback?: boolean;
    feedbackStatus?: FeedbackStatus;
  }>({
    path: "/api/client/user-private-card-faces",
    data: { page, limit, ...filters },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      thumbnailUrl: item.thumbnailUrl ? resolveApiMediaUrl(item.thumbnailUrl) : item.thumbnailUrl,
      data: item.data ? resolveCardDataMedia(item.data) : item.data,
      displayFeedbackStatus:
        item.feedback?.status ?? filters.feedbackStatus ?? "processing",
    })),
  }));
}

export interface FavoriteCard {
  id: string;
  name: string;
  isFavorited: boolean;
  frontFace: {
    id?: string;
    name?: string;
    type: string;
    data: Record<string, unknown>;
  };
  cardPack: {
    id: string;
    title: string;
    cover?: string;
    subject?: { id: string; name: string };
  };
}

export function favoriteCard(cardId: string, cardPackId: string) {
  return request<unknown, { cardId: string; cardPackId: string }>({
    path: "/api/client/card-favorites",
    method: "POST",
    data: { cardId, cardPackId },
  }).then((result) => {
    invalidateData("favorites");
    return result;
  });
}

export function unfavoriteCard(cardId: string) {
  return request<{ success?: boolean; message?: string }, Record<string, never>>({
    path: `/api/client/card-favorites/${encodeURIComponent(cardId)}`,
    method: "DELETE",
    data: {},
  }).then((result) => {
    invalidateData("favorites");
    return result;
  });
}

export function getFavoriteCards(page = 1, limit = 10) {
  return request<Paginated<FavoriteCard>, {
    page: number;
    limit: number;
    sortField: "createdAt";
    sortOrder: "DESC";
  }>({
    path: "/api/client/card-favorites",
    data: { page, limit, sortField: "createdAt", sortOrder: "DESC" },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      frontFace: {
        ...item.frontFace,
        data: resolveCardDataMedia(item.frontFace.data),
      },
      cardPack: {
        ...item.cardPack,
        cover: item.cardPack.cover
          ? resolveApiMediaUrl(item.cardPack.cover)
          : undefined,
      },
    })),
  }));
}

export function claimDailyReward() {
  return request<{ rewardAmount: number; claimedAt: string }, Record<string, never>>({
    path: "/api/client/vip/daily-reward",
    method: "POST",
    data: {},
  }).then((result) => {
    invalidateData("wallet");
    return result;
  });
}
