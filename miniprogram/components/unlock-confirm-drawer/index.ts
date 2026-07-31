type PriceInfo = {
  finalPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  levelDiscountAmount?: number;
  levelDiscountPercent?: number;
};

function amount(value: unknown) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}

Component({
  properties: {
    open: { type: Boolean, value: false },
    cardPackInfo: { type: Object, value: {} },
    userBalance: { type: Number, value: 0 },
    isLoading: { type: Boolean, value: false },
  },

  data: {
    closing: false,
    currentPrice: 0,
    basePrice: 0,
    discountAmount: 0,
    discountPercent: 0,
    levelDiscountAmount: 0,
    levelDiscountPercent: 0,
    hasDiscount: false,
    hasLevelDiscount: false,
    balanceFloor: 0,
    canAfford: true,
    shortageText: "0",
  },

  observers: {
    "open, cardPackInfo, userBalance"(open: boolean, cardPackInfo: any, userBalance: number) {
      if (!open) {
        this.clearCloseTimer();
        this.setData({ closing: false });
        return;
      }
      const priceInfo = (cardPackInfo?.priceInfo ?? {}) as PriceInfo;
      const basePrice = amount(cardPackInfo?.basePrice);
      const currentPrice = amount(priceInfo.finalPrice ?? basePrice);
      const discountAmount = amount(priceInfo.discountAmount);
      const levelDiscountAmount = amount(priceInfo.levelDiscountAmount);
      const balanceFloor = Math.floor(amount(userBalance));
      this.setData({
        closing: false,
        currentPrice,
        basePrice,
        discountAmount,
        discountPercent: amount(priceInfo.discountPercent),
        levelDiscountAmount,
        levelDiscountPercent: amount(priceInfo.levelDiscountPercent),
        hasDiscount: discountAmount > 0,
        hasLevelDiscount: levelDiscountAmount > 0,
        balanceFloor,
        canAfford: balanceFloor >= currentPrice,
        shortageText: Math.max(0, currentPrice - balanceFloor).toFixed(1),
      });
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
      if ((this.data as any).isLoading || (this.data as any).closing) return;
      this.clearCloseTimer();
      this.setData({ closing: true });
      (this as any)._closeTimer = setTimeout(() => {
        (this as any)._closeTimer = null;
        this.triggerEvent("close");
      }, 220);
    },

    preventClose() {},

    confirm() {
      const state = this.data as any;
      if (state.isLoading || !state.canAfford) return;
      this.triggerEvent("confirm");
    },

    recharge() {
      if ((this.data as any).isLoading) return;
      this.triggerEvent("recharge", {
        shortage: Number((this.data as any).shortageText),
      });
    },
  },
});
