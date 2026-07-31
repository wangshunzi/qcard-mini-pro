import { sessionStore } from "../../../stores/session";

Page({
  data: {
    soundEnabled: wx.getStorageSync("qcard.sound-enabled") !== false,
    version: "",
  },
  onLoad() {
    const account = wx.getAccountInfoSync?.();
    this.setData({
      version: account?.miniProgram?.version || "开发版",
    });
  },
  toggleSound(event: WechatMiniprogram.SwitchChange) {
    wx.setStorageSync("qcard.sound-enabled", event.detail.value);
    this.setData({ soundEnabled: event.detail.value });
  },
  clearCache() {
    const keys = wx.getStorageInfoSync().keys.filter((key) => key.startsWith("qcard.hanzi."));
    wx.showModal({
      title: "清除汉字缓存",
      content: keys.length
        ? `将清除 ${keys.length} 项汉字书写数据，下次使用时会自动重新下载。`
        : "当前没有可清理的汉字数据。",
      confirmText: keys.length ? "清除" : "知道了",
      showCancel: keys.length > 0,
      success: (result) => {
        if (!result.confirm || !keys.length) return;
        keys.forEach((key) => wx.removeStorageSync(key));
        wx.showToast({ title: "缓存已清理" });
      },
    });
  },
  openAgreement() {
    wx.navigateTo({ url: "/package-settings/pages/web-doc/index?doc=user_agreement" });
  },
  openPrivacy() {
    wx.navigateTo({ url: "/package-settings/pages/web-doc/index?doc=privacy_policy" });
  },
  openAccount() {
    wx.navigateTo({ url: "/package-settings/pages/account/index" });
  },
  openTheme() {
    wx.navigateTo({ url: "/package-settings/pages/theme/index" });
  },
  openChallengeConfig() {
    wx.navigateTo({ url: "/package-settings/pages/challenge-config/index" });
  },
  openFeedback() {
    wx.navigateTo({ url: "/package-settings/pages/feedback/index" });
  },
  openVirtualOrders() {
    wx.navigateTo({ url: "/package-settings/pages/virtual-orders/index" });
  },
  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确认退出当前账号？",
      confirmText: "退出",
      confirmColor: "#bd554f",
      success: (result) => {
        if (!result.confirm) return;
        sessionStore.clear();
        wx.reLaunch({ url: "/pages/login/index" });
      },
    });
  },
});
