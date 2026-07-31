Component({
  properties: {
    open: { type: Boolean, value: false },
    title: { type: String, value: "" },
    subtitle: { type: String, value: "" },
    items: { type: Array, value: [] },
    selectedId: { type: String, value: "" },
    triggerIcon: { type: String, value: "menu" },
    showAll: { type: Boolean, value: false },
    allLabel: { type: String, value: "全部" },
  },

  data: {
    safeTopPx: 96,
  },

  lifetimes: {
    attached() {
      this.measureSafeTop();
    },
    detached() {
      wx.showTabBar({ animation: false });
    },
  },

  observers: {
    open(open: boolean) {
      if (!open) return;
      this.measureSafeTop();
      wx.hideTabBar({ animation: false });
    },
  },

  methods: {
    measureSafeTop() {
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

    preventClose() {},

    close() {
      wx.showTabBar({ animation: false });
      this.triggerEvent("close");
    },

    selectItem(event: WechatMiniprogram.TouchEvent) {
      const id = String(event.currentTarget.dataset.id ?? "");
      wx.showTabBar({ animation: false });
      this.triggerEvent("select", { id });
    },
  },
});
