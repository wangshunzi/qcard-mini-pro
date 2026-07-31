import { request } from "./http";

export interface Theme {
  id: string;
  name: string;
  description?: string;
  config: {
    home_bg?: string;
    explore_bg?: string;
    resource_bg?: string;
    profile_bg?: string;
    login_bg?: string;
  };
  isDefault: boolean;
  sort: number;
}

export function getAvailableThemes() {
  return request<Theme[]>({ path: "/api/client/themes/available" });
}

export function getCurrentTheme() {
  return request<Theme>({ path: "/api/client/themes/current" });
}

export function selectTheme(themeId: string) {
  return request<Theme>({
    path: `/api/client/themes/select/${encodeURIComponent(themeId)}`,
    method: "POST",
  });
}
