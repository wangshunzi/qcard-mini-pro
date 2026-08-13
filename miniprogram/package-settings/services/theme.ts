import { request } from "../../services/http";
import { invalidateData } from "../../stores/dataInvalidation";
import type { ThemeConfig } from "../../design-system/theme";
import { cacheLoginThemeConfig } from "../../design-system/loginTheme";

export interface Theme {
  id: string;
  name: string;
  description?: string;
  config: ThemeConfig;
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
  }).then((theme) => {
    cacheLoginThemeConfig(theme.config);
    invalidateData("account");
    return theme;
  });
}
