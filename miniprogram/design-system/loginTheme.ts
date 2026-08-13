import type { ThemeConfig } from "./theme";

const LOGIN_THEME_CACHE_KEY = "qcard.theme.login-backgrounds";

export const DEFAULT_LOGIN_THEME_CONFIG: ThemeConfig = {
  login_bg:
    "https://kolka-public.oss-cn-shanghai.aliyuncs.com/theme-images/forest-creative-20260811-v2/login_bg.jpg",
  login_bg_dark:
    "https://kolka-public.oss-cn-shanghai.aliyuncs.com/theme-images/forest-creative-20260811-v2/login_bg_dark.jpg",
};

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
    // Storage failure should never block login; the default theme remains usable.
  }
}

export function getCachedLoginThemeConfig(): ThemeConfig {
  try {
    const cached = wx.getStorageSync(LOGIN_THEME_CACHE_KEY) as
      | ThemeConfig
      | undefined;
    const light = readUrl(cached?.login_bg);
    if (!light) return DEFAULT_LOGIN_THEME_CONFIG;
    const config: ThemeConfig = { login_bg: light };
    const dark = readUrl(cached?.login_bg_dark);
    if (dark) config.login_bg_dark = dark;
    return config;
  } catch {
    return DEFAULT_LOGIN_THEME_CONFIG;
  }
}
