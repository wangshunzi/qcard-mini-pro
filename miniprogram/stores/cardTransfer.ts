import type { CardData } from "../cards/types";

const TRANSFER_KEY = "qcard.card-transfer";

export interface CardTransferPayload {
  front: CardData;
  back?: CardData;
  title?: string;
  templateId?: string;
  genParams?: Record<string, unknown>;
  privateFace?: {
    id: string;
    templateId?: string;
    feedback?: {
      status: "processing" | "resolved" | "rejected";
      content?: string;
      adminReply?: string | null;
    } | null;
  };
  sourcePack?: {
    id: string;
    title: string;
    cover?: string;
    subjectName?: string;
    knowledgePointName?: string;
    isUnlocked?: boolean;
    basePrice?: number;
    finalPrice?: number;
  };
}

export function saveCardTransfer(payload: CardTransferPayload) {
  wx.setStorageSync(TRANSFER_KEY, payload);
}

export function readCardTransfer(): CardTransferPayload | undefined {
  return wx.getStorageSync<CardTransferPayload>(TRANSFER_KEY) || undefined;
}

export function clearCardTransfer() {
  wx.removeStorageSync(TRANSFER_KEY);
}
