import type {
  ThemeBackgroundKey,
  ThemeConfig,
  ThemeMode,
  ThemePreference,
} from "./theme";
import {
  readSystemThemeMode,
  readThemePreference,
  getThemePageStyle,
  resolveThemeMode,
  saveThemePreference,
} from "./theme";

interface ThemePage {
  setData(data: Record<string, unknown>): void;
}

type BackgroundBindings = Record<string, ThemeBackgroundKey>;

interface Binding {
  config: ThemeConfig;
  fields: BackgroundBindings;
}

let mode: ThemeMode = resolveThemeMode();
const bindings = new WeakMap<ThemePage, Binding>();

export function getThemePageData() {
  return {
    themeMode: mode,
    themePageStyle: getThemePageStyle(mode),
  };
}

export function resolveThemeBackground(
  config: ThemeConfig | undefined,
  key: ThemeBackgroundKey,
  targetMode: ThemeMode = mode,
): string {
  if (!config) return "";
  const darkValue = config[`${key}_dark`];
  if (targetMode === "dark" && typeof darkValue === "string" && darkValue) {
    return darkValue;
  }
  const lightValue = config[key];
  return typeof lightValue === "string" ? lightValue : "";
}

function buildPageData(binding: Binding) {
  return {
    ...getThemePageData(),
    ...Object.fromEntries(
      Object.entries(binding.fields).map(([field, key]) => [
        field,
        resolveThemeBackground(binding.config, key),
      ]),
    ),
  };
}

export function bindThemeBackgrounds(
  page: ThemePage,
  config: ThemeConfig | undefined,
  fields: BackgroundBindings,
) {
  const binding = { config: config ?? {}, fields };
  bindings.set(page, binding);
  page.setData(buildPageData(binding));
}

export function refreshThemeBackgrounds(nextMode: ThemeMode) {
  mode = nextMode;
  applyNativeTheme(nextMode);
  const activePages = getCurrentPages() as unknown as ThemePage[];
  for (const page of activePages) {
    const binding = bindings.get(page);
    page.setData(binding ? buildPageData(binding) : getThemePageData());
  }
}

function applyNativeTheme(nextMode: ThemeMode) {
  const dark = nextMode === "dark";
  if (typeof wx.setTabBarStyle === "function") {
    wx.setTabBarStyle({
      color: dark ? "#8f96a3" : "#5d5d5d",
      selectedColor: dark ? "#4fbf6b" : "#529917",
      backgroundColor: dark ? "#0b0e16" : "#ffffff",
      borderStyle: dark ? "black" : "white",
      fail: () => undefined,
    });
  }
  if (typeof wx.setNavigationBarColor === "function") {
    wx.setNavigationBarColor({
      frontColor: dark ? "#ffffff" : "#000000",
      backgroundColor: dark ? "#05060a" : "#ffffff",
      animation: { duration: 180, timingFunc: "easeIn" },
      fail: () => undefined,
    });
  }
  if (typeof wx.setBackgroundColor === "function") {
    wx.setBackgroundColor({
      backgroundColor: dark ? "#05060a" : "#ffffff",
      backgroundColorTop: dark ? "#05060a" : "#ffffff",
      backgroundColorBottom: dark ? "#05060a" : "#ffffff",
      fail: () => undefined,
    });
  }
}

export function applyThemePreference(preference: ThemePreference) {
  saveThemePreference(preference);
  const nextMode = resolveThemeMode(preference);
  refreshThemeBackgrounds(nextMode);
  return nextMode;
}

export function refreshThemePreference() {
  const nextMode = resolveThemeMode(readThemePreference(), readSystemThemeMode());
  refreshThemeBackgrounds(nextMode);
  return nextMode;
}

export function syncThemePreferenceForPage(page: ThemePage) {
  const nextMode = resolveThemeMode(readThemePreference(), readSystemThemeMode());
  mode = nextMode;
  applyNativeTheme(nextMode);
  const binding = bindings.get(page);
  page.setData(binding ? buildPageData(binding) : getThemePageData());
  return nextMode;
}
