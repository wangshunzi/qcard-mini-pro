import type { ThemeConfig } from "./theme";

const LOGIN_THEME_CACHE_KEY = "qcard.theme.login-backgrounds";

function readUrl(value: unknown): string {
  return typeof value === "string" && /^https:\/\//i.test(value)
    ? value
    : "";
}

export function cacheLoginThemeConfig(config: ThemeConfig | undefined) {
  const light = readUrl(config?.login_bg);
  if (!light) return;
  const cached: ThemeConfig = { login_bg: light };
  const dark = readUrl(config?.login_bg_dark);
  if (dark) cached.login_bg_dark = dark;
  try {
    wx.setStorageSync(LOGIN_THEME_CACHE_KEY, cached);
  } catch {
    // Storage failure should never block login; profile theme can still load online.
  }
}

export function getCachedLoginThemeConfig(): ThemeConfig {
  try {
    const cached = wx.getStorageSync(LOGIN_THEME_CACHE_KEY) as
      | ThemeConfig
      | undefined;
    const light = readUrl(cached?.login_bg);
    if (!light) return {};
    const config: ThemeConfig = { login_bg: light };
    const dark = readUrl(cached?.login_bg_dark);
    if (dark) config.login_bg_dark = dark;
    return config;
  } catch {
    return {};
  }
}
