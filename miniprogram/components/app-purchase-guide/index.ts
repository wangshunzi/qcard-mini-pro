Component({
  properties: {
    open: { type: Boolean, value: false },
    mode: { type: String, value: "vip" },
    reason: { type: String, value: "" },
  },

  data: {
    closing: false,
  },

  observers: {
    open(open: boolean) {
      if (!open) {
        this.clearCloseTimer();
        this.setData({ closing: false });
      }
    },
  },

  lifetimes: {
    detached() {
      this.clearCloseTimer();
    },
  },

  methods: {
    clearCloseTimer() {
      const timer = (this as any)._closeTimer;
      if (timer) clearTimeout(timer);
      (this as any)._closeTimer = null;
    },

    close() {
      if ((this.data as any).closing) return;
      this.clearCloseTimer();
      this.setData({ closing: true });
      (this as any)._closeTimer = setTimeout(() => {
        (this as any)._closeTimer = null;
        this.triggerEvent("close");
      }, 220);
    },

    preventClose() {},

    downloadApp() {
      this.triggerEvent("close");
      setTimeout(() => {
        wx.navigateTo({
          url: "/package-settings/pages/web-doc/index?doc=app_download",
        });
      }, 60);
    },

    contactOpened() {
      this.triggerEvent("close");
    },
  },
});
