import type { CardTransferPayload } from "../../cards/cardTransfer";

const TRANSFER_KEY = "qcard.card-transfer";

export function readCardTransfer(): CardTransferPayload | undefined {
  return wx.getStorageSync<CardTransferPayload>(TRANSFER_KEY) || undefined;
}
