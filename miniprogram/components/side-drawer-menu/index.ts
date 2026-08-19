import { UI_ASSETS } from "../../config/uiAssets";

function formatVipExpireAt(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}/${month}/${day}`;
}

Component({
  properties: {
    mode: { type: String, value: "profile" },
    profile: { type: Object, value: {} },
    light: { type: Boolean, value: false },
    themeMode: { type: String, value: "light" },
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
    isVip: false,
    vipExpireText: "未开通 VIP",
    assets: UI_ASSETS,
  },

  observers: {
    profile(profile: Record<string, any>) {
      const isVip = profile?.vip?.isVip === true;
      const expireAt = formatVipExpireAt(profile?.vip?.vipExpireAt);
      this.setData({
        isVip,
        vipExpireText: isVip
          ? expireAt
            ? `VIP 有效期至 ${expireAt}`
            : "VIP 权益已生效"
          : "未开通 VIP",
      });
    },
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

    openVip() {
      this.setData({ open: false });
      this.triggerEvent("vip");
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
