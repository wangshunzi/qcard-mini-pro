import {
  getAvailableThemes,
  getCurrentTheme,
  selectTheme,
  type Theme,
} from "../../services/theme";

Page({
  data: {
    themes: [] as Theme[],
    currentTheme: null as Theme | null,
    currentThemeId: "",
    loading: true,
    selectingId: "",
    error: "",
  },
  onLoad() {
    void this.load();
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
});
