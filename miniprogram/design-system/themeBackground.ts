import type {
  ThemeBackgroundKey,
  ThemeConfig,
  ThemeMode,
} from "./theme";
import { readSystemThemeMode } from "./theme";

interface ThemePage {
  setData(data: Record<string, unknown>): void;
}

type BackgroundBindings = Record<string, ThemeBackgroundKey>;

interface Binding {
  config: ThemeConfig;
  fields: BackgroundBindings;
}

let mode: ThemeMode = readSystemThemeMode();
const bindings = new Map<ThemePage, Binding>();

export function getThemeMode(): ThemeMode {
  return mode;
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
  return Object.fromEntries(
    Object.entries(binding.fields).map(([field, key]) => [
      field,
      resolveThemeBackground(binding.config, key),
    ]),
  );
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
  const activePages = new Set(getCurrentPages() as unknown as ThemePage[]);
  for (const [page, binding] of bindings) {
    if (!activePages.has(page)) {
      bindings.delete(page);
      continue;
    }
    page.setData(buildPageData(binding));
  }
}
