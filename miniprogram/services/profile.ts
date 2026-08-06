import { request } from "./http";
import type { Paginated } from "./discovery";
import { ENV } from "../config/env";
import { resolveApiMediaUrl, resolveCardDataMedia } from "../utils/mediaUrl";
import {
  invalidateData,
  trackVipExpiry,
} from "../stores/dataInvalidation";

export interface UserProfile {
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
    config?: {
      home_bg?: string;
      explore_bg?: string;
      resource_bg?: string;
      profile_bg?: string;
      login_bg?: string;
      learning_bg?: string;
      detail_bg?: string;
      gen_bg?: string;
    };
  };
  vip?: {
    isVip: boolean;
    vipExpireAt: string | null;
    dailyRewardClaimed: boolean;
    dailyRewardAmount?: number;
  };
}

export type FeedbackStatus = "processing" | "resolved" | "rejected";

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
  feedback?: PrivateCardFaceFeedback | null;
  displayFeedbackStatus?: FeedbackStatus;
  createdAt: string;
}

export function getProfile() {
  return request<UserProfile>({ path: "/api/client/profile" }).then((profile) => {
    trackVipExpiry(profile.vip?.isVip === true, profile.vip?.vipExpireAt);
    return {
      ...profile,
      avatar: profile.avatar ? resolveApiMediaUrl(profile.avatar) : undefined,
      grade: profile.grade
        ? { ...profile.grade, icon: profile.grade.icon ? resolveApiMediaUrl(profile.grade.icon) : undefined }
        : undefined,
      currentTheme: profile.currentTheme
        ? {
            ...profile.currentTheme,
            config: Object.fromEntries(
              Object.entries(profile.currentTheme.config ?? {}).map(([key, value]) => [
                key,
                key.endsWith("_bg") && typeof value === "string" && value
                  ? resolveApiMediaUrl(value)
                  : value,
              ]),
            ),
          }
        : undefined,
    };
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
) {
  return request<Paginated<PrivateCardFace>, {
    page: number;
    limit: number;
    hasFeedback?: boolean;
    feedbackStatus?: FeedbackStatus;
  }>({
    path: "/api/client/user-private-card-faces",
    data: { page: 1, limit, ...filters },
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
