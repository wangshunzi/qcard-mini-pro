import {
  createFeedback,
  getFeedbackDetail,
  getMyFeedbacks,
  uploadFeedbackImage,
  type FeedbackStatus,
  type FeedbackType,
  type UserFeedback,
} from "../../services/feedback";

Page({
  data: {
    mode: "list" as "list" | "submit",
    status: "all" as "all" | FeedbackStatus,
    items: [] as UserFeedback[],
    selected: null as UserFeedback | null,
    loading: true,
    loadingMore: false,
    detailLoading: false,
    page: 1,
    totalPages: 1,
    content: "",
    contact: "",
    imagePath: "",
    submitting: false,
    type: "product" as FeedbackType,
    contentLength: 0,
    contentRemaining: 5,
    canSubmit: false,
    types: [
      { value: "account", label: "账号" },
      { value: "subscription", label: "订阅" },
      { value: "coins", label: "咔豆" },
      { value: "content", label: "内容" },
      { value: "product", label: "产品建议" },
      { value: "other", label: "其他" },
    ],
    statuses: [
      { value: "all", label: "全部" },
      { value: "pending", label: "待处理" },
      { value: "processing", label: "处理中" },
      { value: "resolved", label: "已解决" },
      { value: "closed", label: "已关闭" },
    ],
  },

  onLoad() {
    void this.load(true);
  },

  async onPullDownRefresh() {
    if (this.data.mode === "list") await this.load(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.mode === "list" && !this.data.selected) void this.load(false);
  },

  loadMore() {
    void this.load(false);
  },

  switchMode(event: WechatMiniprogram.TouchEvent) {
    const mode = String(event.currentTarget.dataset.mode) as "list" | "submit";
    if (mode === this.data.mode) return;
    this.setData({ mode, selected: null });
    if (mode === "list" && !this.data.items.length) void this.load(true);
  },

  switchStatus(event: WechatMiniprogram.TouchEvent) {
    const status = String(event.currentTarget.dataset.status) as "all" | FeedbackStatus;
    if (status === this.data.status) return;
    this.setData({ status, selected: null }, () => void this.load(true));
  },

  selectType(event: WechatMiniprogram.TouchEvent) {
    this.setData({ type: String(event.currentTarget.dataset.type) as FeedbackType });
  },

  onContent(event: WechatMiniprogram.Input) {
    const content = event.detail.value;
    const validLength = content.trim().length;
    this.setData({
      content,
      contentLength: content.length,
      contentRemaining: Math.max(0, 5 - validLength),
      canSubmit: validLength >= 5,
    });
  },

  onContact(event: WechatMiniprogram.Input) {
    this.setData({ contact: event.detail.value });
  },

  async chooseImage() {
    try {
      const result = await wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sourceType: ["album", "camera"],
        sizeType: ["compressed"],
      });
      const file = result.tempFiles[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        wx.showToast({ title: "图片不能超过 10MB", icon: "none" });
        return;
      }
      this.setData({ imagePath: file.tempFilePath });
    } catch {
      // 用户取消选择时不提示错误。
    }
  },

  removeImage() {
    this.setData({ imagePath: "" });
  },

  previewImage() {
    if (this.data.imagePath) {
      wx.previewImage({ urls: [this.data.imagePath], current: this.data.imagePath });
    }
  },

  async load(reset: boolean) {
    if (!reset && (this.data.loadingMore || this.data.page >= this.data.totalPages)) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true } : { loadingMore: true });
    try {
      const result = await getMyFeedbacks(
        page,
        20,
        this.data.status === "all" ? undefined : this.data.status,
      );
      this.setData({
        items: reset ? result.items ?? [] : [...this.data.items, ...(result.items ?? [])],
        page: result.page ?? page,
        totalPages: result.totalPages ?? page,
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "获取反馈失败",
        icon: "none",
      });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  async openDetail(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const current = this.data.items.find((item) => item.id === id);
    if (!current) return;
    this.setData({ selected: current, detailLoading: true });
    try {
      this.setData({ selected: await getFeedbackDetail(id) });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "详情加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ detailLoading: false });
    }
  },

  backToList() {
    this.setData({ selected: null });
  },

  previewRemoteImage() {
    const url = this.data.selected?.imageUrl;
    if (url) wx.previewImage({ urls: [url], current: url });
  },

  async submit() {
    const content = this.data.content.trim();
    if (content.length < 5 || this.data.submitting) {
      wx.showToast({ title: "请至少输入 5 个字", icon: "none" });
      return;
    }
    this.setData({ submitting: true });
    try {
      const device = wx.getDeviceInfo?.();
      const account = wx.getAccountInfoSync?.();
      const imageUrl = this.data.imagePath
        ? await uploadFeedbackImage(this.data.imagePath)
        : undefined;
      await createFeedback({
        type: this.data.type,
        content,
        contact: this.data.contact.trim() || undefined,
        imageUrl,
        clientMeta: {
          platform: "wechat_miniprogram",
          appVersion: account?.miniProgram?.version || "dev",
          os: device?.platform,
          deviceModel: device?.model,
        },
      });
      wx.showToast({ title: "反馈已提交", icon: "success" });
      this.setData({
        mode: "list",
        status: "all",
        selected: null,
        content: "",
        contact: "",
        imagePath: "",
        contentLength: 0,
        contentRemaining: 5,
        canSubmit: false,
      });
      await this.load(true);
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "提交失败",
        icon: "none",
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
