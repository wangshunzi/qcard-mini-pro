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
    background: { type: String, value: "var(--color-surface-translucent)" },
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
    navShadow: "0 0 0 rgba(15,15,15,0)",
    navBlur: 0,
    navSurfaceOpacity: 0,
    navScrolled: false,
    navTitleOpacity: 0,
    navForeground: "var(--color-text)",
  },

  observers: {
    "scrollTop, overlay, light"(
      scrollTop: number,
      overlay: boolean,
      light: boolean,
    ) {
      const progress = overlay
        ? Math.max(0, Math.min(1, Number(scrollTop || 0) / 96))
        : 1;
      const eased = progress * progress * (3 - 2 * progress);
      const navScrolled = !overlay || progress >= 0.58;
      this.setData({
        navShadow: `0 4rpx 22rpx rgba(15,15,15,${(eased * 0.1).toFixed(3)})`,
        navBlur: Math.round(eased * 24),
        navSurfaceOpacity: overlay ? Number((eased * 0.94).toFixed(3)) : 1,
        navScrolled,
        navTitleOpacity: overlay
          ? Math.max(0, Math.min(1, (progress - 0.48) / 0.42))
          : 1,
        navForeground:
          light && !navScrolled
            ? "var(--color-text-inverse)"
            : "var(--color-text)",
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
