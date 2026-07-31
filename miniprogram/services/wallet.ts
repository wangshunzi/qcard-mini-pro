import { request } from "./http";
import { resolveApiMediaUrl } from "../utils/mediaUrl";

export type BalanceChangeType =
  | "recharge"
  | "reward"
  | "unlock"
  | "free_unlock"
  | "ai_generation"
  | "card_pack_creation"
  | "refund"
  | "system_adjustment";

export interface BalanceHistoryItem {
  id: string;
  createdAt: string;
  changeType: BalanceChangeType;
  amount: number;
  balanceAfter: number;
  reason?: string;
  cardPack?: {
    id: string;
    title: string;
    cover?: string;
    subject?: string;
    knowledgePoint?: string;
  };
}

export interface BalanceHistoryResponse {
  items: BalanceHistoryItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function getBalanceHistory(params: {
  page?: number;
  limit?: number;
  changeType?: BalanceChangeType;
}) {
  return request<BalanceHistoryResponse, Record<string, unknown>>({
    path: "/api/client/wallet/balance-history",
    data: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      changeType: params.changeType,
    },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map((item) => ({
      ...item,
      cardPack: item.cardPack
        ? {
            ...item.cardPack,
            cover: item.cardPack.cover
              ? resolveApiMediaUrl(item.cardPack.cover)
              : undefined,
          }
        : undefined,
    })),
  }));
}
