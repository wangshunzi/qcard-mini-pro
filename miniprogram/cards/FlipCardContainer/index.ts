import { mediaCoordinator } from "../../services/MediaCoordinator";
import { validateCardData } from "../CardTypeConfig";

Component({
  properties: {
    frontCardData: { type: Object, value: {} },
    backCardData: { type: Object, value: {} },
    aspectRatio: { type: String, value: "portrait" },
    hideFlipButton: { type: Boolean, value: false },
    fillContainer: { type: Boolean, value: false },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },

  data: {
    isFlipped: false,
    frontValid: true,
    backValid: true,
    hasBack: false,
    aspectStyle: "width:100%;height:auto;aspect-ratio:9/16;max-height:100%;",
    displaySide: "front" as "front" | "back",
    flipPhase: "" as "" | "flip-out" | "flip-in",
  },

  observers: {
    "frontCardData,backCardData"(front: any, back: any) {
      const hasBack = !!back?.type;
      this.setData({
        frontValid: !!front && validateCardData(front.type, front.data),
        backValid: !hasBack || validateCardData(back.type, back.data),
        hasBack,
        isFlipped: false,
        displaySide: "front",
        flipPhase: "",
      });
      this.clearFlipTimers();
      this.measureCard();
    },
    isVisible(visible: boolean) {
      if (!visible) this.pause();
    },
    aspectRatio(value: string) {
      // 卡片数据契约固定为 9:16。保留属性只为兼容已有调用方。
      void value;
      this.measureCard();
    },
    fillContainer() {
      this.measureCard();
    },
  },

  lifetimes: {
    ready() {
      this.measureCard();
    },
    detached() {
      this.clearFlipTimers();
      this.pause();
    },
  },

  methods: {
    clearFlipTimers() {
      const swapTimer = (this as any)._flipSwapTimer;
      const endTimer = (this as any)._flipEndTimer;
      if (swapTimer) clearTimeout(swapTimer);
      if (endTimer) clearTimeout(endTimer);
      (this as any)._flipSwapTimer = null;
      (this as any)._flipEndTimer = null;
    },
    measureCard() {
      if (this.properties.fillContainer) {
        this.setData({ aspectStyle: "width:100%;height:100%;" });
        return;
      }
      wx.nextTick(() => {
        this.createSelectorQuery()
          .select(".flip-bounds")
          .boundingClientRect((rect) => {
            if (!rect?.width || !rect?.height) {
              this.setData({
                aspectStyle: "width:100%;height:auto;aspect-ratio:9/16;max-height:100%;",
              });
              return;
            }
            const width = Math.min(rect.width, rect.height * 9 / 16);
            const height = width * 16 / 9;
            this.setData({
              aspectStyle: `width:${width.toFixed(2)}px;height:${height.toFixed(2)}px;`,
            });
          })
          .exec();
      });
    },
    flip() {
      const state = this.data as any;
      if (!state.hasBack || state.flipPhase) return;
      const isFlipped = !state.isFlipped;
      mediaCoordinator.pauseAll();
      this.clearFlipTimers();
      this.setData({ flipPhase: "flip-out" });
      (this as any)._flipSwapTimer = setTimeout(() => {
        (this as any)._flipSwapTimer = null;
        this.setData({
          isFlipped,
          displaySide: isFlipped ? "back" : "front",
          flipPhase: "flip-in",
        });
        this.triggerEvent("flip", { isFlipped });
        (this as any)._flipEndTimer = setTimeout(() => {
          (this as any)._flipEndTimer = null;
          this.setData({ flipPhase: "" });
        }, 210);
      }, 210);
    },
    showFront() {
      if (this.data.isFlipped) this.flip();
    },
    showBack() {
      if (!this.data.isFlipped && (this.data as any).hasBack) this.flip();
    },
    pause() {
      mediaCoordinator.pauseAll();
      this.selectAllComponents(".card-renderer").forEach((component: any) =>
        component.pause?.(),
      );
    },
    reset() {
      this.clearFlipTimers();
      this.pause();
      this.setData({
        isFlipped: false,
        displaySide: "front",
        flipPhase: "",
      });
      this.selectAllComponents(".card-renderer").forEach((component: any) =>
        component.reset?.(),
      );
    },
    onCardEvent(event: WechatMiniprogram.CustomEvent) {
      this.triggerEvent("cardevent", event.detail);
    },
  },
});
