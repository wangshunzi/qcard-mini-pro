import {
  clearBottomSheetGesture,
  closeBottomSheet,
  endBottomSheetDrag,
  moveBottomSheetDrag,
  resetBottomSheetGesture,
  startBottomSheetDrag,
} from "../../utils/bottomSheetGesture";

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
    dragging: false,
    dragSettling: false,
    dragOffset: 0,
  },

  observers: {
    "open, cardPackInfo, userBalance"(open: boolean, cardPackInfo: any, userBalance: number) {
      if (!open) {
        resetBottomSheetGesture(this);
        return;
      }
      resetBottomSheetGesture(this);
      const priceInfo = (cardPackInfo?.priceInfo ?? {}) as PriceInfo;
      const basePrice = amount(cardPackInfo?.basePrice);
      const currentPrice = amount(priceInfo.finalPrice ?? basePrice);
      const discountAmount = amount(priceInfo.discountAmount);
      const levelDiscountAmount = amount(priceInfo.levelDiscountAmount);
      const balanceFloor = Math.floor(amount(userBalance));
      this.setData({
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
      clearBottomSheetGesture(this);
    },
  },

  methods: {
    close() {
      closeBottomSheet(
        this,
        "",
        () => this.triggerEvent("close"),
        Boolean((this.data as any).isLoading),
      );
    },

    preventClose() {},

    onDragStart(event: WechatMiniprogram.TouchEvent) {
      startBottomSheetDrag(
        this,
        event,
        "",
        Boolean((this.data as any).isLoading),
      );
    },

    onDragMove(event: WechatMiniprogram.TouchEvent) {
      moveBottomSheetDrag(this, event);
    },

    onDragEnd() {
      endBottomSheetDrag(this, "", () => this.triggerEvent("close"));
    },

    onDragCancel() {
      this.onDragEnd();
    },

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
