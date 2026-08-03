import { readCardTransfer } from "../../../stores/cardTransfer";
import { submitPrivateCardFaceFeedback } from "../../services/userContent";

Page({
  data: {
    payload: null as any,
    emptyCardData: {},
    feedbackOpen: false,
    feedbackContent: "",
    submittingFeedback: false,
  },
  onLoad() {
    const payload = readCardTransfer();
    if (!payload) {
      wx.showToast({ title: "预览数据已失效", icon: "none" });
      setTimeout(() => wx.navigateBack(), 500);
      return;
    }
    this.setData({
      payload: {
        ...payload,
        back: payload.back ?? {},
      },
    });
    if (payload.title) wx.setNavigationBarTitle({ title: payload.title });
  },
  onHide() {
    (this.selectComponent("#card") as any)?.pause?.();
  },
  onUnload() {
    (this.selectComponent("#card") as any)?.pause?.();
  },
  openSourcePack() {
    const id = String((this.data as any).payload?.sourcePack?.id ?? "");
    if (!id) return;
    wx.redirectTo({
      url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}`,
    });
  },

  toggleFeedback() {
    this.setData({ feedbackOpen: !this.data.feedbackOpen });
  },

  closeFeedback() {
    this.setData({ feedbackOpen: false });
  },

  preventClose() {},

  onFeedbackInput(event: WechatMiniprogram.Input) {
    this.setData({ feedbackContent: event.detail.value.slice(0, 2000) });
  },

  async submitFeedback() {
    const privateFace = this.data.payload?.privateFace;
    const content = this.data.feedbackContent.trim();
    if (!privateFace?.id || !content || this.data.submittingFeedback) return;
    this.setData({ submittingFeedback: true });
    try {
      const result = await submitPrivateCardFaceFeedback(privateFace.id, content);
      this.setData({
        "payload.privateFace.feedback": {
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

  openGroupCard() {
    const frontFaceId = String(this.data.payload?.privateFace?.id || "");
    wx.navigateTo({
      url: `/package-cards/pages/generate/index${
        frontFaceId ? `?frontFaceId=${encodeURIComponent(frontFaceId)}` : ""
      }`,
    });
  },

  makeSimilar() {
    const templateId = String(this.data.payload?.privateFace?.templateId || "");
    if (!templateId) {
      wx.showToast({ title: "该卡面缺少模板信息", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(templateId)}`,
    });
  },
});
