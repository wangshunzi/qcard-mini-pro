import { getImmersiveNavigationMetrics } from "../../utils/navigationMetrics";

Component({
  options: {
    multipleSlots: true,
  },

  properties: {
    title: { type: String, value: "" },
    back: { type: Boolean, value: false },
    overlay: { type: Boolean, value: false },
    light: { type: Boolean, value: false },
    background: { type: String, value: "#ffffff" },
    border: { type: Boolean, value: false },
    customBack: { type: Boolean, value: false },
    scrollTop: { type: Number, value: 0 },
  },

  data: {
    statusBarHeight: 20,
    navigationHeight: 44,
    controlRowTop: 26,
    controlRowHeight: 32,
    totalHeight: 64,
    controlsMaxWidth: 260,
    capsuleReservedWidth: 104,
    navBackground: "rgba(255,255,255,0)",
    navShadow: "0 0 0 rgba(15,15,15,0)",
    navBlur: 0,
    navTitleOpacity: 0,
    navTitleColor: "#172019",
  },

  observers: {
    "scrollTop, overlay"(scrollTop: number, overlay: boolean) {
      const progress = overlay
        ? Math.max(0, Math.min(1, Number(scrollTop || 0) / 96))
        : 1;
      const eased = progress * progress * (3 - 2 * progress);
      this.setData({
        navBackground: overlay
          ? `rgba(255,255,255,${(eased * 0.94).toFixed(3)})`
          : this.data.background,
        navShadow: `0 4rpx 22rpx rgba(15,15,15,${(eased * 0.1).toFixed(3)})`,
        navBlur: Math.round(eased * 24),
        navTitleOpacity: overlay
          ? Math.max(0, Math.min(1, (progress - 0.48) / 0.42))
          : 1,
        navTitleColor: "#172019",
      });
    },
  },

  lifetimes: {
    attached() {
      const metrics = getImmersiveNavigationMetrics();
      this.setData(metrics);
      this.triggerEvent("metrics", metrics);
    },
  },

  methods: {
    goBack() {
      if (!this.data.back) return;
      if (this.data.customBack) {
        this.triggerEvent("back");
        return;
      }
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({ url: "/pages/home/index" });
      }
    },
  },
});
