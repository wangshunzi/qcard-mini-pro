import type { CardData } from "./types";

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
