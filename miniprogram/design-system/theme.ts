export const THEME_BACKGROUND_KEYS = [
  "home_bg",
  "explore_bg",
  "resource_bg",
  "profile_bg",
  "login_bg",
  "learning_bg",
  "detail_bg",
  "gen_bg",
  "search_bg",
] as const;

export type ThemeMode = "light" | "dark";
export type ThemeBackgroundKey = (typeof THEME_BACKGROUND_KEYS)[number];
export type ThemeBackgroundConfigKey =
  | ThemeBackgroundKey
  | `${ThemeBackgroundKey}_dark`;

export type ThemeConfig = Partial<Record<ThemeBackgroundConfigKey, string>> &
  Record<string, unknown>;

export function readSystemThemeMode(): ThemeMode {
  try {
    return wx.getSystemInfoSync().theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
