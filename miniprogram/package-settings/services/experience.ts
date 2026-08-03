import { request } from "../../services/http";

export interface ExperienceLevel {
  level: number;
  name?: string;
  minExperience?: number;
  requiredExperience?: number;
  unlockDiscount?: number;
  benefits?: Record<string, unknown>;
  icon?: string;
}

export interface ExperienceHistory {
  id: string;
  amount: number;
  reason?: string;
  description?: string;
  createdAt: string;
}

export function getExperienceLevels() {
  return request<Array<ExperienceLevel & { requiredExp?: number }>>({
    path: "/api/client/experience/levels",
  }).then((levels) =>
    (levels ?? []).map((level) => ({
      ...level,
      requiredExperience: level.requiredExperience ?? level.requiredExp ?? 0,
    })),
  );
}

export function getExperienceHistory(page = 1, limit = 20) {
  return request<{
    records: Array<Omit<ExperienceHistory, "amount"> & { experienceChange: number }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }, { page: number; limit: number }>({
    path: "/api/client/experience/history",
    data: { page, limit },
  }).then((result) => ({
    ...result,
    items: (result.records ?? []).map((item) => ({
      ...item,
      amount: item.experienceChange,
      description: item.description ?? item.reason,
    })),
  }));
}

export function getUnlockDiscount() {
  return request<{ unlockDiscount?: number }>({
    path: "/api/client/experience/discount",
  }).then((result) => ({
    discount: Number(result.unlockDiscount ?? 0),
  }));
}
