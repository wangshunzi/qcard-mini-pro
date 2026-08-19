import {
  getAvailableThemes,
  getCurrentTheme,
  selectTheme,
  type Theme,
} from "../../services/theme";
import {
  readThemePreference,
  type ThemePreference,
} from "../../../design-system/theme";
import {
  applyThemePreference,
  getThemePageData,
  syncThemePreferenceForPage,
} from "../../../design-system/themeBackground";

const appearanceOptions = [
  {
    key: "light",
    title: "浅色模式",
    description: "始终使用浅色主题",
    icon: "weather-sunny",
  },
  {
    key: "dark",
    title: "暗黑模式",
    description: "始终使用暗黑主题",
    icon: "weather-night",
  },
  {
    key: "system",
    title: "跟随系统",
    description: "根据系统外观自动切换",
    icon: "theme-light-dark",
  },
] as const;

Page({
  data: {
    themes: [] as Theme[],
    currentTheme: null as Theme | null,
    currentThemeId: "",
    loading: true,
    selectingId: "",
    error: "",
    appearanceOptions,
    themePreference: readThemePreference(),
    ...getThemePageData(),
  },
  onLoad() {
    void this.load();
  },
  onShow() {
    syncThemePreferenceForPage(this);
    this.setData({ themePreference: readThemePreference() });
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },
  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const [themes, current] = await Promise.all([
        getAvailableThemes(),
        getCurrentTheme(),
      ]);
      this.setData({
        themes,
        currentThemeId: current?.id || "",
        currentTheme: current ?? null,
      });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "主题加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },
  async chooseTheme(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id || id === (this.data as any).currentThemeId || (this.data as any).selectingId) return;
    this.setData({ selectingId: id });
    wx.showNavigationBarLoading();
    try {
      await selectTheme(id);
      this.setData({
        currentThemeId: id,
        currentTheme: this.data.themes.find((item) => item.id === id) ?? null,
      });
      wx.showToast({ title: "主题已切换", icon: "success" });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "切换主题失败",
        icon: "none",
      });
    } finally {
      this.setData({ selectingId: "" });
      wx.hideNavigationBarLoading();
    }
  },
  chooseAppearance(event: WechatMiniprogram.TouchEvent) {
    const preference = String(event.currentTarget.dataset.mode ?? "system") as ThemePreference;
    if (!appearanceOptions.some((option) => option.key === preference)) return;
    applyThemePreference(preference);
    this.setData({ themePreference: preference, ...getThemePageData() });
  },
});
