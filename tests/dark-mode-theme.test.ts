import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, any>;
}

function listFiles(extension: string, directory = "miniprogram"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(extension, path);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

describe("mini program dark mode architecture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("declares native dark mode and a symmetric native palette", () => {
    const app = readJson("miniprogram/app.json");
    const theme = readJson("miniprogram/theme.json");

    expect(app.darkmode).toBe(true);
    expect(app.themeLocation).toBe("theme.json");
    expect(Object.keys(theme.light).sort()).toEqual(
      Object.keys(theme.dark).sort(),
    );
    expect(app.window.navigationBarBackgroundColor).toBe(
      "@navigationBarBackgroundColor",
    );
    expect(app.window.backgroundColorTop).toBe("@backgroundColorTop");
    expect(app.window.backgroundColorBottom).toBe("@backgroundColorBottom");
    expect(app.tabBar.backgroundColor).toBe("@tabBarBackgroundColor");
  });

  it("provides semantic tokens and dark overrides for every UI layer", () => {
    const theme = readFileSync(
      "miniprogram/design-system/theme.wxss",
      "utf8",
    );
    const app = readFileSync("miniprogram/app.wxss", "utf8");
    const requiredTokens = [
      "--color-background",
      "--color-surface",
      "--color-card",
      "--color-input",
      "--color-text",
      "--color-text-secondary",
      "--color-text-muted",
      "--color-text-on-warning",
      "--color-border",
      "--color-divider",
      "--color-primary",
      "--color-progress-track",
      "--color-skeleton-base",
      "--color-skeleton-highlight",
      "--color-success-soft",
      "--color-error-soft",
      "--color-warning-soft",
      "--color-glass",
      "--shadow-card",
    ];

    expect(app).toContain('@import "/design-system/theme.wxss"');
    expect(theme).toContain("@media (prefers-color-scheme: dark)");
    requiredTokens.forEach((token) => {
      expect(theme.match(new RegExp(token, "g"))?.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("injects the resolved palette on the real page node for every styled page", () => {
    const pageTemplates = listFiles(".wxml")
      .filter((file) => file.includes("/pages/"))
      .filter((file) => !file.endsWith("/web-doc/index.wxml"));

    expect(pageTemplates).toHaveLength(22);
    pageTemplates.forEach((file) => {
      const template = readFileSync(file, "utf8");
      const logic = readFileSync(file.replace(/\.wxml$/, ".ts"), "utf8");
      expect(template, file).toMatch(
        /^<page-meta page-style="\{\{themePageStyle\}\}/,
      );
      expect(logic, file).toContain("...getThemePageData()");
      expect(logic, file).toContain("syncThemePreferenceForPage(this)");
    });
  });

  it("resyncs a stale page instance from the persisted preference on show", async () => {
    const setTabBarStyle = vi.fn();
    const setNavigationBarColor = vi.fn();
    const setBackgroundColor = vi.fn();
    vi.stubGlobal("wx", {
      getSystemInfoSync: () => ({ theme: "light" }),
      getStorageSync: () => "dark",
      setTabBarStyle,
      setNavigationBarColor,
      setBackgroundColor,
    });
    const { syncThemePreferenceForPage } = await import(
      "../miniprogram/design-system/themeBackground"
    );
    const setData = vi.fn();

    expect(syncThemePreferenceForPage({ setData })).toBe("dark");
    expect(setData).toHaveBeenCalledWith(expect.objectContaining({
      themeMode: "dark",
      themePageStyle: expect.stringContaining("--color-background:#05060a"),
    }));
    expect(setTabBarStyle).toHaveBeenCalledWith(expect.objectContaining({
      backgroundColor: "#0b0e16",
    }));
    expect(setNavigationBarColor).toHaveBeenCalledWith(expect.objectContaining({
      frontColor: "#ffffff",
    }));
    expect(setBackgroundColor).toHaveBeenCalledWith(expect.objectContaining({
      backgroundColor: "#05060a",
    }));
  });

  it("resyncs the active theme artwork together with the page palette", async () => {
    let preference = "light";
    vi.stubGlobal("wx", {
      getSystemInfoSync: () => ({ theme: "light" }),
      getStorageSync: () => preference,
    });
    const { bindThemeBackgrounds, syncThemePreferenceForPage } = await import(
      "../miniprogram/design-system/themeBackground"
    );
    const setData = vi.fn();
    const page = { setData };

    bindThemeBackgrounds(page, {
      home_bg: "day-home.webp",
      home_bg_dark: "night-home.webp",
    }, { homeBackground: "home_bg" });
    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
      themeMode: "light",
      homeBackground: "day-home.webp",
    }));

    preference = "dark";
    syncThemePreferenceForPage(page);
    expect(setData).toHaveBeenLastCalledWith(expect.objectContaining({
      themeMode: "dark",
      themePageStyle: expect.stringContaining("--color-background:#05060a"),
      homeBackground: "night-home.webp",
    }));
  });

  it("restores the saved appearance selection whenever theme settings reopens", () => {
    const source = readFileSync(
      "miniprogram/package-settings/pages/theme/index.ts",
      "utf8",
    );

    expect(source).toMatch(
      /onShow\(\)\s*\{[\s\S]*?syncThemePreferenceForPage\(this\);[\s\S]*?themePreference:\s*readThemePreference\(\)/,
    );
    expect(source).toContain(
      "this.setData({ themePreference: preference, ...getThemePageData() })",
    );
  });

  it("lets a manual light preference override a dark system palette", async () => {
    vi.stubGlobal("wx", {
      getSystemInfoSync: () => ({ theme: "dark" }),
      getStorageSync: () => "light",
    });
    const { resolveThemeMode, getThemePageStyle } = await import(
      "../miniprogram/design-system/theme"
    );

    const mode = resolveThemeMode();
    const pageStyle = getThemePageStyle(mode);
    expect(mode).toBe("light");
    expect(pageStyle).toContain("--color-background:#ffffff");
    expect(pageStyle).toContain("--color-card:#ffffff");
    expect(pageStyle).toContain("--color-text:#0f0f0f");
    expect(pageStyle).not.toContain("--color-background:#05060a");
  });

  it("keeps media copy, warning actions and portal drawers legible", () => {
    const homeStyles = readFileSync(
      "miniprogram/pages/home/index.wxss",
      "utf8",
    );
    const coinTemplate = readFileSync(
      "miniprogram/components/coin-history-drawer/index.wxml",
      "utf8",
    );
    const coinStyles = readFileSync(
      "miniprogram/components/coin-history-drawer/index.wxss",
      "utf8",
    );
    const sideTemplate = readFileSync(
      "miniprogram/components/side-drawer-menu/index.wxml",
      "utf8",
    );
    const sideStyles = readFileSync(
      "miniprogram/components/side-drawer-menu/index.wxss",
      "utf8",
    );

    expect(homeStyles).toMatch(
      /\.welcome-name\s*\{[^}]*color:#fff[^}]*background:transparent[^}]*text-shadow:/,
    );
    expect(coinTemplate).toContain('color="var(--color-text-on-warning)"');
    expect(coinStyles).toMatch(
      /\.recharge-button\s*\{[^}]*color:var\(--color-text-on-warning\)/,
    );
    expect(sideTemplate).toContain("<root-portal>");
    expect(sideStyles).toContain(
      "--side-menu-panel-background:#141821",
    );
    expect(sideStyles).toContain(
      "background-color:var(--side-menu-panel-background)",
    );
  });

  it("keeps preview actions legible on dark surfaces", () => {
    const modalTemplate = readFileSync(
      "miniprogram/components/card-preview-modal/index.wxml",
      "utf8",
    );
    const modalStyles = readFileSync(
      "miniprogram/components/card-preview-modal/index.wxss",
      "utf8",
    );
    const previewTemplate = readFileSync(
      "miniprogram/package-cards/pages/preview/index.wxml",
      "utf8",
    );
    const previewStyles = readFileSync(
      "miniprogram/package-cards/pages/preview/index.wxss",
      "utf8",
    );

    expect(modalTemplate).toContain(
      'class="preview-text-action group-card"',
    );
    expect(modalTemplate).toContain(
      'name="view-grid-outline" size="{{28}}" color="currentColor"',
    );
    expect(modalStyles).toMatch(
      /\.preview-text-action\.group-card\s*\{[^}]*color:var\(--color-primary\)[^}]*background:var\(--color-card\)/,
    );
    expect(previewTemplate).toContain(
      'name="view-grid-outline" size="{{29}}" color="currentColor"',
    );
    expect(previewStyles).toMatch(
      /\.preview-actions \.group-entry\s*\{[^}]*color:var\(--color-primary\)[^}]*border-color:var\(--color-primary\)/,
    );
  });

  it("keeps commerce drawer footers and primary actions legible in dark mode", () => {
    const purchaseTemplate = readFileSync(
      "miniprogram/components/app-purchase-guide/index.wxml",
      "utf8",
    );
    const purchaseStyles = readFileSync(
      "miniprogram/components/app-purchase-guide/index.wxss",
      "utf8",
    );
    const unlockTemplate = readFileSync(
      "miniprogram/components/unlock-confirm-drawer/index.wxml",
      "utf8",
    );
    const unlockStyles = readFileSync(
      "miniprogram/components/unlock-confirm-drawer/index.wxss",
      "utf8",
    );

    expect(purchaseStyles).toMatch(
      /\.purchase-footer\s*\{[^}]*border-top:1rpx solid var\(--color-border\)[^}]*background:var\(--color-card-elevated\)/,
    );
    expect(purchaseStyles).toMatch(
      /\.vip-primary\s*\{[^}]*color:var\(--color-text-on-warning\)[^}]*background:var\(--color-warning\)/,
    );
    expect(purchaseStyles).toMatch(
      /\.coin-primary\s*\{[^}]*color:var\(--color-text-on-accent\)[^}]*background:var\(--color-primary\)/,
    );
    expect(purchaseTemplate).toContain(
      'name="crown" size="{{34}}" color="var(--color-text-on-warning)"',
    );
    expect(unlockStyles).toMatch(
      /\.unlock-action\.confirm\s*\{[^}]*color:var\(--color-text-on-warning\)[^}]*background:var\(--color-warning\)/,
    );
    expect(unlockTemplate).toContain(
      'name="lock-open-outline" size="{{30}}" color="var(--color-text-on-warning)"',
    );
    expect(`${purchaseStyles}\n${unlockStyles}`).not.toMatch(
      /background:\s*rgba\(248,250,248,\.98\)|border(?:-top|-color)?:\s*[^;]*(?:#e3e8e3|#e0e7df|#dde3dd|#dde2dd)/,
    );
  });

  it("keeps card-pack unlock icons legible on warning actions", () => {
    const resourceTemplate = readFileSync(
      "miniprogram/pages/resource/index.wxml",
      "utf8",
    );
    const profileTemplate = readFileSync(
      "miniprogram/pages/profile/index.wxml",
      "utf8",
    );

    for (const template of [resourceTemplate, profileTemplate]) {
      expect(template).toContain(
        "var(--color-text-on-warning)",
      );
    }
  });

  it("preserves theme artwork proportions at every mini program slot", () => {
    const coverStyleFiles = [
      "miniprogram/pages/home/index.wxss",
      "miniprogram/pages/explore/index.wxss",
      "miniprogram/pages/resource/index.wxss",
      "miniprogram/pages/profile/index.wxss",
      "miniprogram/package-cards/pages/my-learning/index.wxss",
      "miniprogram/package-cards/pages/my-generation/index.wxss",
      "miniprogram/package-cards/pages/pack-detail/index.wxss",
      "miniprogram/package-cards/pages/private-pack/index.wxss",
      "miniprogram/package-cards/pages/generate/index.wxss",
    ];

    coverStyleFiles.forEach((file) => {
      expect(readFileSync(file, "utf8"), file).toMatch(
        /background-size:\s*cover/,
      );
    });

    expect(
      readFileSync(
        "miniprogram/package-cards/pages/ai-generate/index.wxml",
        "utf8",
      ),
    ).toContain('class="page-background" src="{{pageBackground}}" mode="aspectFill"');
    expect(
      readFileSync("miniprogram/pages/login/index.wxml", "utf8"),
    ).toContain('class="login-background" src="{{loginBackground}}" mode="aspectFill"');
  });

  it("themes native and immersive navigation without fixed light colors", () => {
    const theme = readJson("miniprogram/theme.json");
    const navTs = readFileSync(
      "miniprogram/components/immersive-nav/index.ts",
      "utf8",
    );
    const navWxml = readFileSync(
      "miniprogram/components/immersive-nav/index.wxml",
      "utf8",
    );
    const navWxss = readFileSync(
      "miniprogram/components/immersive-nav/index.wxss",
      "utf8",
    );

    expect(theme.dark.navigationBarBackgroundColor).toBe("#0b0e16");
    expect(theme.dark.backgroundColor).toBe("#05060a");
    expect(navTs).toContain('value: "var(--color-surface-translucent)"');
    expect(navTs).toContain('"var(--color-text-inverse)"');
    expect(navTs).toContain('"var(--color-text)"');
    expect(navWxml).toContain('class="nav-surface"');
    expect(navWxss).toContain("background:var(--nav-background");
    expect(`${navTs}\n${navWxml}\n${navWxss}`).not.toMatch(
      /(?:#fff(?:fff)?|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i,
    );
  });

  it("keeps loading and skeleton visuals on semantic theme tokens", () => {
    const homeConfig = readJson("miniprogram/pages/home/index.json");
    const homeTemplate = readFileSync(
      "miniprogram/pages/home/index.wxml",
      "utf8",
    );
    expect(homeConfig.initialRenderingCache).toBe("static");
    expect(homeTemplate).toContain('class="startup-loading-screen theme-{{themeMode}}"');

    const fixedLoadingNeutral =
      /#(?:dce5da|e6eae6|ecefeb|f8f9f7|e8ece8|f6f8f5|edf1ed|dbe5dd|e7ebe8|f5f7f5)\b/i;
    const malformedToken = /var\(--[^)]+\)[0-9a-f]+/i;
    const violations = listFiles(".wxss").flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const loadingRules = [
        ...source.matchAll(
          /[^{}]*(?:loading|spinner|skeleton|shimmer|orbit)[^{}]*\{[^{}]*\}/gi,
        ),
      ].map(([rule]) => rule);
      return [
        ...loadingRules
          .filter((rule) => fixedLoadingNeutral.test(rule))
          .map((rule) => ({ file, rule })),
        ...(malformedToken.test(source)
          ? [{ file, rule: "malformed semantic token value" }]
          : []),
      ];
    });

    expect(violations).toEqual([]);
  });

  it("prevents structural UI from reintroducing fixed light surfaces", () => {
    const forbiddenSurface =
      /background(?:-color)?\s*:\s*#(?:fff(?:fff)?|f[0-9a-f]{5}|e[0-9a-f]{5})\b/i;
    const forbiddenOpaqueWhite =
      /background(?:-color)?\s*:\s*rgba?\(\s*255\s*,\s*255\s*,\s*255(?:\s*,\s*(?:0?\.[5-9]\d*|1(?:\.0+)?))?\s*\)/i;
    const forbiddenText =
      /color\s*:\s*#(?:0f0f0f|111|222|303630|3f3f3f|5d5d5d|657065|a9a9a9)\b/i;
    const violations = listFiles(".wxss")
      .filter((file) => file !== "miniprogram/design-system/theme.wxss")
      // Card artwork owns its authored palette. Shells, controls and modals do not.
      .filter((file) => !file.startsWith("miniprogram/cards/components/"))
      .flatMap((file) => {
        const source = readFileSync(file, "utf8");
        return source
          .split("\n")
          .map((line, index) => ({
            file,
            line,
            declarations: line.replace(/--[\w-]+\s*:[^;]+;?/g, ""),
            lineNumber: index + 1,
          }))
          .filter(({ declarations }) =>
            forbiddenSurface.test(declarations) ||
            forbiddenOpaqueWhite.test(declarations) ||
            forbiddenText.test(declarations),
          );
      });

    expect(violations).toEqual([]);
  });

  it("keeps icon colors on semantic tokens", () => {
    const violations = listFiles(".wxml").flatMap((file) => {
      const source = readFileSync(file, "utf8");
      return [...source.matchAll(/<ui-icon\b[\s\S]*?(?:\/>|<\/ui-icon>)/g)]
        .filter(([tag]) => /color="(?:#[0-9a-f]{3,8}|\{\{[^}]*#[0-9a-f])/i.test(tag))
        .map(([tag]) => ({ file, tag }));
    });

    expect(violations).toEqual([]);
  });

  it("switches bound theme artwork immediately at runtime", async () => {
    vi.stubGlobal("wx", {
      getSystemInfoSync: () => ({ theme: "light" }),
    });
    const page = {
      data: {} as Record<string, unknown>,
      setData(update: Record<string, unknown>) {
        Object.assign(this.data, update);
      },
    };
    vi.stubGlobal("getCurrentPages", () => [page]);
    const { bindThemeBackgrounds, refreshThemeBackgrounds } = await import(
      "../miniprogram/design-system/themeBackground"
    );

    bindThemeBackgrounds(
      page,
      { home_bg: "light.jpg", home_bg_dark: "dark.jpg" },
      { heroBackground: "home_bg" },
    );
    expect(page.data.heroBackground).toBe("light.jpg");

    refreshThemeBackgrounds("dark");
    expect(page.data.heroBackground).toBe("dark.jpg");

    refreshThemeBackgrounds("light");
    expect(page.data.heroBackground).toBe("light.jpg");
  });

  it("keeps background bindings for cached tab pages outside the active stack", async () => {
    let preference = "dark";
    let activePages: Array<{
      data: Record<string, unknown>;
      setData(update: Record<string, unknown>): void;
    }> = [];
    vi.stubGlobal("wx", {
      getSystemInfoSync: () => ({ theme: "light" }),
      getStorageSync: () => preference,
    });
    vi.stubGlobal("getCurrentPages", () => activePages);
    const page = {
      data: {} as Record<string, unknown>,
      setData(update: Record<string, unknown>) {
        Object.assign(this.data, update);
      },
    };
    const {
      bindThemeBackgrounds,
      refreshThemeBackgrounds,
      syncThemePreferenceForPage,
    } = await import("../miniprogram/design-system/themeBackground");

    bindThemeBackgrounds(
      page,
      { explore_bg: "day.jpg", explore_bg_dark: "night.jpg" },
      { exploreBackground: "explore_bg" },
    );
    expect(page.data.exploreBackground).toBe("night.jpg");

    // A cached tab is not returned by getCurrentPages() while another tab or
    // subpackage page is active. Refreshing must not discard its binding.
    refreshThemeBackgrounds("dark");
    preference = "light";
    activePages = [page];
    syncThemePreferenceForPage(page);

    expect(page.data.themeMode).toBe("light");
    expect(page.data.exploreBackground).toBe("day.jpg");
  });

  it("persists manual light, dark and system appearance preferences", async () => {
    let stored: unknown;
    const setTabBarStyle = vi.fn();
    const page = {
      data: {} as Record<string, unknown>,
      setData(update: Record<string, unknown>) {
        Object.assign(this.data, update);
      },
    };
    vi.stubGlobal("getCurrentPages", () => [page]);
    vi.stubGlobal("wx", {
      getSystemInfoSync: () => ({ theme: "light" }),
      getStorageSync: () => stored,
      setStorageSync: (_key: string, value: unknown) => {
        stored = value;
      },
      setNavigationBarColor: vi.fn(),
      setBackgroundColor: vi.fn(),
      setTabBarStyle,
    });
    const { applyThemePreference } = await import(
      "../miniprogram/design-system/themeBackground"
    );

    expect(applyThemePreference("dark")).toBe("dark");
    expect(stored).toBe("dark");
    expect(page.data.themeMode).toBe("dark");
    expect(page.data.themePageStyle).toContain("--color-card:#141821");
    expect(setTabBarStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ backgroundColor: "#0b0e16" }),
    );

    expect(applyThemePreference("system")).toBe("light");
    expect(stored).toBe("system");
    expect(page.data.themeMode).toBe("light");
    expect(page.data.themePageStyle).toContain("--color-card:#ffffff");
    expect(setTabBarStyle).toHaveBeenLastCalledWith(
      expect.objectContaining({ backgroundColor: "#ffffff" }),
    );
  });

  it("caches login artwork only from the active theme config", async () => {
    let stored: unknown;
    vi.stubGlobal("wx", {
      getStorageSync: () => stored,
      setStorageSync: (_key: string, value: unknown) => {
        stored = value;
      },
    });
    const { cacheLoginThemeConfig, getCachedLoginThemeConfig } = await import(
      "../miniprogram/design-system/loginTheme"
    );

    expect(getCachedLoginThemeConfig()).toEqual({});

    cacheLoginThemeConfig({
      login_bg: "https://assets.example/light.jpg",
      login_bg_dark: "https://assets.example/dark.jpg",
    });
    expect(getCachedLoginThemeConfig()).toEqual({
      login_bg: "https://assets.example/light.jpg",
      login_bg_dark: "https://assets.example/dark.jpg",
    });
  });
});
