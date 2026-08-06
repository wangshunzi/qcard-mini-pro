import { request } from "./http";
import { resolveCardDataMedia } from "../utils/mediaUrl";
import { invalidateData } from "../stores/dataInvalidation";
export {
  getMiniProgramSchemaIssues,
  isMiniProgramSchemaSupported,
  normalizeSchemaWidget,
  type MiniProgramSchemaIssue,
} from "../utils/schemaCompatibility";

export interface AiTemplate {
  id: string;
  name: string;
  type: string;
  description?: string;
  price: number;
  sort?: number;
  vipRequired?: boolean;
  params: Record<string, unknown>;
  exampleData?: Record<string, unknown>;
  schemaVersion?: number;
  supportedPlatforms?: string[];
}

export interface AiGenerationTask {
  taskId: string;
  status: "pending" | "processing" | "success" | "failed";
  cardFaceId: string | null;
  cardFace?: {
    id: string;
    name: string;
    type: string;
    data: Record<string, unknown>;
    status: "pending" | "processing" | "success" | "failed";
  };
  message?: string;
}

export function getMiniProgramTemplates() {
  return request<AiTemplate[]>({
    path: "/api/client/ai-card-generation/available-types/compact",
  });
}

export function getMiniProgramTemplateDetails(ids: string[]) {
  return request<AiTemplate[], { ids: string[] }>({
    path: "/api/client/ai-card-generation/available-types/details",
    method: "POST",
    data: { ids },
  }).then((items) =>
    (items ?? []).map((item) => ({
      ...item,
      exampleData: item.exampleData
        ? resolveCardDataMedia(item.exampleData)
        : item.exampleData,
    })),
  );
}

export function generateCard(
  templateId: string,
  params: Record<string, unknown>,
  requestId: string,
) {
  return request<{ taskId: string; cardFaceId?: string }, Record<string, unknown>>({
    path: "/api/client/ai-card-generation/generate-async",
    method: "POST",
    idempotent: true,
    timeoutMs: 30_000,
    data: {
      templateId,
      params,
      requestId,
    },
  }).then((result) => {
    invalidateData("content");
    return result;
  });
}

export function getGenerationTask(taskId: string) {
  return request<AiGenerationTask>({
    path: `/api/client/ai-card-generation/tasks/${encodeURIComponent(taskId)}`,
  }).then((task) => ({
    ...task,
    cardFace: task.cardFace
      ? {
          ...task.cardFace,
          data: resolveCardDataMedia(task.cardFace.data),
        }
      : undefined,
  }));
}
