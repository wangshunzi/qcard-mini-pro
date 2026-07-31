import { UI_ASSETS } from "../../config/uiAssets";

Component({
  properties: {
    mode: { type: String, value: "profile" },
    profile: { type: Object, value: {} },
    light: { type: Boolean, value: false },
    title: { type: String, value: "" },
    subtitle: { type: String, value: "" },
    items: { type: Array, value: [] },
    selectedId: { type: String, value: "" },
    selectedLabel: { type: String, value: "全部" },
    selectedIcon: { type: String, value: "" },
    triggerIcon: { type: String, value: "menu" },
    showAll: { type: Boolean, value: false },
    allLabel: { type: String, value: "全部" },
  },

  data: {
    open: false,
    safeTopPx: 96,
    assets: UI_ASSETS,
  },

  lifetimes: {
    attached() {
      const windowInfo = wx.getWindowInfo();
      let capsule: WechatMiniprogram.ClientRect | undefined;
      try {
        capsule = wx.getMenuButtonBoundingClientRect();
      } catch {
        capsule = undefined;
      }
      const statusBarHeight = Number(windowInfo.statusBarHeight || 20);
      this.setData({
        safeTopPx: Math.max(
          statusBarHeight + 52,
          Number(capsule?.bottom || statusBarHeight + 44) + 14,
        ),
      });
    },
  },

  methods: {
    openMenu() {
      this.setData({ open: true });
      wx.hideTabBar({ animation: false });
      this.triggerEvent("open");
    },

    closeMenu() {
      this.setData({ open: false });
      wx.showTabBar({ animation: false });
      this.triggerEvent("close");
    },

    preventClose() {},

    openWallet() {
      this.setData({ open: false });
      this.triggerEvent("wallet");
    },

    navigate(url: string) {
      this.setData({ open: false });
      wx.showTabBar({ animation: false });
      wx.navigateTo({ url });
    },

    openMyLearning() {
      this.navigate("/package-cards/pages/my-learning/index");
    },

    openMyCards() {
      this.navigate("/package-cards/pages/my-generation/index");
    },

    openTheme() {
      this.navigate("/package-settings/pages/theme/index");
    },

    openChallengeConfig() {
      this.navigate("/package-settings/pages/challenge-config/index");
    },

    closeForContact() {
      this.setData({ open: false });
      wx.showTabBar({ animation: false });
      this.triggerEvent("close");
    },

    selectItem(event: WechatMiniprogram.TouchEvent) {
      const id = String(event.currentTarget.dataset.id ?? "");
      this.setData({ open: false });
      wx.showTabBar({ animation: false });
      this.triggerEvent("select", { id });
    },
  },
});
