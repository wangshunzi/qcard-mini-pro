export interface StoryRoleViewModel {
  id: number;
  name: string;
  avatar: string;
  [key: string]: unknown;
}

export function storyMediaUrl(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    return String((value as any).url ?? (value as any).src ?? "");
  }
  return "";
}

export function normalizeStoryRoles(value: unknown): StoryRoleViewModel[] {
  if (!Array.isArray(value)) return [];
  return value.map((role: any) => ({
    ...role,
    id: Number(role?.id ?? 0),
    name: String(role?.name ?? ""),
    avatar: storyMediaUrl(role?.avatar),
  }));
}

export function previewStoryRoles(roles: StoryRoleViewModel[]): StoryRoleViewModel[] {
  return roles.filter((role) => role.id !== 0).slice(0, 4);
}
