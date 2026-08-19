import { deleteAccount } from "../../../services/auth";
import { sessionStore } from "../../../stores/session";
import { getThemePageData, syncThemePreferenceForPage } from "../../../design-system/themeBackground";

function createProblem() {
  if (Math.random() < 0.5) {
    const left = Math.floor(Math.random() * 15) + 1;
    const right = Math.floor(Math.random() * 15) + 1;
    return { expression: `${left} + ${right}`, answer: left + right };
  }
  const left = Math.floor(Math.random() * 15) + 5;
  const right = Math.floor(Math.random() * (left - 1)) + 1;
  return { expression: `${left} - ${right}`, answer: left - right };
}

Page({
  data: {
    ...getThemePageData(),
    expression: "",
    answer: 0,
    input: "",
    error: "",
    deleting: false,
    deleteDialogOpen: false,
  },

  onLoad() {
    this.resetProblem();
  },

  onShow() {
    syncThemePreferenceForPage(this);
  },

  resetProblem() {
    const problem = createProblem();
    this.setData({
      expression: problem.expression,
      answer: problem.answer,
      input: "",
      error: "",
    });
  },

  openDeleteDialog() {
    this.resetProblem();
    this.setData({ deleteDialogOpen: true });
  },

  closeDeleteDialog() {
    if (this.data.deleting) return;
    this.setData({ deleteDialogOpen: false });
  },

  preventClose() {},

  onInput(event: WechatMiniprogram.Input) {
    this.setData({
      input: event.detail.value.replace(/\D/g, "").slice(0, 4),
      error: "",
    });
  },

  confirmDelete() {
    if (Number((this.data as any).input) !== Number((this.data as any).answer)) {
      this.setData({ error: "答案不正确，请重试" });
      return;
    }
    void this.performDelete();
  },

  async performDelete() {
    if ((this.data as any).deleting) return;
    this.setData({ deleting: true, error: "" });
    try {
      await deleteAccount();
      sessionStore.clear();
      wx.showToast({ title: "账号已注销", icon: "success" });
      setTimeout(() => wx.switchTab({ url: "/pages/home/index" }), 500);
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : "注销失败，请稍后重试",
        deleting: false,
      });
    } finally {
      if (!this.data.error) this.setData({ deleting: false });
    }
  },
});
