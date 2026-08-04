import type { CardTransferPayload } from "../../stores/cardTransfer";
import { submitPrivateCardFaceFeedback } from "../../package-cards/services/userContent";
import {
  clearBottomSheetGesture,
  closeBottomSheet,
  endBottomSheetDrag,
  moveBottomSheetDrag,
  resetBottomSheetGesture,
  startBottomSheetDrag,
} from "../../utils/bottomSheetGesture";

Component({
  properties: {
    open: { type: Boolean, value: false },
    payload: { type: Object, value: {} },
  },

  data: {
    cardPayload: null as CardTransferPayload | null,
    emptyCardData: {},
    closing: false,
    feedbackOpen: false,
    feedbackContent: "",
    submittingFeedback: false,
    feedbackClosing: false,
    feedbackDragging: false,
    feedbackDragSettling: false,
    feedbackDragOffset: 0,
  },

  observers: {
    "open,payload"(open: boolean, payload: CardTransferPayload | null) {
      if (!open || !payload?.front) {
        (this.selectComponent("#preview-modal-card") as any)?.pause?.();
        this.clearCloseTimer();
        this.setData({
          cardPayload: null,
          closing: false,
          feedbackOpen: false,
          feedbackContent: "",
        });
        return;
      }
      this.setData({
        cardPayload: { ...payload },
        closing: false,
      });
    },
  },

  lifetimes: {
    detached() {
      this.clearCloseTimer();
      clearBottomSheetGesture(this, "feedback");
      (this.selectComponent("#preview-modal-card") as any)?.pause?.();
    },
  },

  methods: {
    preventClose() {},

    clearCloseTimer() {
      const timer = (this as any)._closeTimer;
      if (timer) clearTimeout(timer);
      (this as any)._closeTimer = null;
    },

    close() {
      this.closeAndThen();
    },

    closeAndThen(action?: () => void) {
      if (this.data.closing || this.data.submittingFeedback) return;
      (this.selectComponent("#preview-modal-card") as any)?.pause?.();
      this.setData({ closing: true });
      this.clearCloseTimer();
      (this as any)._closeTimer = setTimeout(() => {
        (this as any)._closeTimer = null;
        this.triggerEvent("close");
        if (action) setTimeout(action, 0);
      }, 220);
    },

    openSourcePack() {
      const id = String(this.data.cardPayload?.sourcePack?.id || "");
      if (!id) return;
      this.closeAndThen(() => {
        wx.navigateTo({
          url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}`,
        });
      });
    },

    openGroupCard() {
      const frontFaceId = String(this.data.cardPayload?.privateFace?.id || "");
      if (!frontFaceId) return;
      this.closeAndThen(() => {
        wx.navigateTo({
          url: `/package-cards/pages/generate/index?frontFaceId=${encodeURIComponent(frontFaceId)}`,
        });
      });
    },

    makeSimilar() {
      const payload = this.data.cardPayload;
      const templateId = String(
        payload?.templateId || payload?.privateFace?.templateId || "",
      );
      if (!templateId) return;
      const params = payload?.genParams;
      this.closeAndThen(() => {
        wx.navigateTo({
          url:
            `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(templateId)}` +
            (params
              ? `&genParams=${encodeURIComponent(JSON.stringify(params))}`
              : ""),
        });
      });
    },

    openFeedback() {
      if (!this.data.cardPayload?.privateFace?.id) return;
      resetBottomSheetGesture(this, "feedback");
      this.setData({ feedbackOpen: true });
    },

    closeFeedback() {
      closeBottomSheet(
        this,
        "feedback",
        () => {
          this.setData({ feedbackOpen: false });
          resetBottomSheetGesture(this, "feedback");
        },
        this.data.submittingFeedback,
      );
    },

    onFeedbackDragStart(event: WechatMiniprogram.TouchEvent) {
      startBottomSheetDrag(
        this,
        event,
        "feedback",
        this.data.submittingFeedback,
      );
    },

    onFeedbackDragMove(event: WechatMiniprogram.TouchEvent) {
      moveBottomSheetDrag(this, event, "feedback");
    },

    onFeedbackDragEnd() {
      endBottomSheetDrag(this, "feedback", () => {
        this.setData({ feedbackOpen: false });
        resetBottomSheetGesture(this, "feedback");
      });
    },

    onFeedbackDragCancel() {
      this.onFeedbackDragEnd();
    },

    onFeedbackInput(event: WechatMiniprogram.Input) {
      this.setData({ feedbackContent: event.detail.value.slice(0, 2000) });
    },

    async submitFeedback() {
      const privateFace = this.data.cardPayload?.privateFace;
      const content = this.data.feedbackContent.trim();
      if (!privateFace?.id || !content || this.data.submittingFeedback) return;
      this.setData({ submittingFeedback: true });
      try {
        const result = await submitPrivateCardFaceFeedback(privateFace.id, content);
        this.setData({
          "cardPayload.privateFace.feedback": {
            status: result.status,
            content: result.content,
            adminReply: null,
          },
          feedbackContent: "",
        });
        wx.showToast({ title: "反馈已提交", icon: "success" });
      } catch (error) {
        wx.showToast({
          title: error instanceof Error ? error.message : "反馈提交失败",
          icon: "none",
        });
      } finally {
        this.setData({ submittingFeedback: false });
      }
    },
  },
});
