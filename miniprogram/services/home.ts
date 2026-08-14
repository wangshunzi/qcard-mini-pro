import { normalizeCardPack, type CardPackSummary } from "./discovery";
import { request } from "./http";
import { resolveCardDataMedia } from "../utils/mediaUrl";

export interface ChallengeCard {
  id: string;
  name: string;
  isCompleted: boolean;
  isFavorited: boolean;
  cardPack: {
    id: string;
    title: string;
    cover?: string;
  };
  frontFace: {
    id: string;
    name: string;
    type: string;
    data: Record<string, unknown>;
  };
}

export interface DailyChallenge {
  id: string;
  newCardCount: number;
  reviewCardCount: number;
  completedNewCards: number;
  completedReviewCards: number;
  isCompleted: boolean;
  cards: ChallengeCard[];
}

export interface Promotion {
  id: string;
  name: string;
  description?: string;
  endTime: string;
  cardPacks: CardPackSummary[];
}

export interface HomeData {
  dailyChallenge?: DailyChallenge;
  recentStudy: CardPackSummary[];
  promotions: Promotion[];
  featuredCardPacks: CardPackSummary[];
}

export function getHomeData() {
  return request<HomeData>({ path: "/api/client/home" }).then((result) => ({
    ...result,
    recentStudy: (result.recentStudy ?? []).map(normalizeCardPack),
    featuredCardPacks: (result.featuredCardPacks ?? []).map(normalizeCardPack),
    promotions: (result.promotions ?? []).map((promotion) => ({
      ...promotion,
      cardPacks: (promotion.cardPacks ?? []).map(normalizeCardPack),
    })),
    dailyChallenge: result.dailyChallenge
      ? {
          ...result.dailyChallenge,
          cards: (result.dailyChallenge.cards ?? []).map((card) => ({
            ...card,
            cardPack: normalizeCardPack(card.cardPack),
            frontFace: { ...card.frontFace, data: resolveCardDataMedia(card.frontFace.data) },
          })),
        }
      : undefined,
  }));
}
