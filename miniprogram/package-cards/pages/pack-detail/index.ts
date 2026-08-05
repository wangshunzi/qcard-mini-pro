import {
  createCardPackReview,
  getCardPackCatalogue,
  getCardPackDetail,
  getCardPackReviews,
  setCardPackFavorite,
  unlockCardPack,
  type CardCatalogue,
  type CardPackDetail,
  type CardPackReview,
} from "../../../services/cardPack";
import { getProfile } from "../../../services/profile";
import { syncNavigationScroll } from "../../../utils/navigationScroll";

Page({
  data: {
    navScrollTop: 0,
    id: "",
    detail: null as CardPackDetail | null,
    catalogue: [] as CardCatalogue[],
    loading: true,
    unlocking: false,
    unlockPanelOpen: false,
    unlockProfileLoaded: false,
    userBalance: 0,
    emptyCardPack: {},
    error: "",
    activeTab: "intro" as "intro" | "cards" | "comments",
    detailBackground: "",
    reviews: [] as CardPackReview[],
    reviewsLoading: false,
    reviewRating: 5,
    reviewComment: "",
    reviewSubmitting: false,
    canSubmitReview: false,
    isVip: false,
    canStudy: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "vip",
    purchaseGuideReason: "",
    studyTimeText: "0 小时",
    authorRatingText: "",
    displayHighlights: [] as Array<{
      id: string;
      icon?: string;
      color: string;
      title: string;
      description?: string;
    }>,
  },
  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },
  onLoad(query: Record<string, string | undefined>) {
    const id = String(query.id ?? "");
    if (!id) {
      wx.showToast({ title: "卡包参数无效", icon: "none" });
      setTimeout(() => wx.navigateBack(), 500);
      return;
    }
    this.setData({ id });
    void this.load();
    void this.loadUnlockProfile();
  },
  onShow() {
    if ((this as any)._didShow) {
      void Promise.all([this.load(), this.loadUnlockProfile()]);
    } else {
      (this as any)._didShow = true;
    }
  },
  async loadUnlockProfile() {
    try {
      const profile = await getProfile();
      const isVip = profile.vip?.isVip === true;
      const detail = this.data.detail;
      this.setData({
        detailBackground: profile.currentTheme?.config?.detail_bg || "",
        isVip,
        userBalance: Math.max(0, Number(profile.balance || 0)),
        unlockProfileLoaded: true,
        canStudy: Boolean(
          detail?.isUnlocked ||
          (detail?.unlockType === "vip_free" && isVip),
        ),
      });
    } catch {
      this.setData({ unlockProfileLoaded: false });
    }
  },
  switchTab(event: WechatMiniprogram.TouchEvent) {
    const activeTab = String(event.currentTarget.dataset.tab) as
      | "intro"
      | "cards"
      | "comments";
    if (!activeTab || activeTab === this.data.activeTab) return;
    this.setData({ activeTab });
    if (activeTab === "comments" && !this.data.reviews.length) void this.loadReviews();
  },
  async loadReviews() {
    if (!this.data.id) return;
    this.setData({ reviewsLoading: true });
    try {
      const result = await getCardPackReviews(this.data.id, 1, 30);
      this.setData({ reviews: result.items ?? [] });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "评论加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ reviewsLoading: false });
    }
  },
  chooseRating(event: WechatMiniprogram.TouchEvent) {
    this.setData({ reviewRating: Number(event.currentTarget.dataset.rating) || 5 });
  },
  onReviewInput(event: WechatMiniprogram.Input) {
    const reviewComment = event.detail.value;
    this.setData({
      reviewComment,
      canSubmitReview: reviewComment.trim().length >= 3,
    });
  },
  async submitReview() {
    const comment = this.data.reviewComment.trim();
    if (comment.length < 3 || this.data.reviewSubmitting) return;
    this.setData({ reviewSubmitting: true });
    try {
      await createCardPackReview(this.data.id, this.data.reviewRating, comment);
      wx.showToast({ title: "评价已提交", icon: "success" });
      this.setData({ reviewComment: "", canSubmitReview: false });
      await this.loadReviews();
      await this.load();
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "评价提交失败",
        icon: "none",
      });
    } finally {
      this.setData({ reviewSubmitting: false });
    }
  },
  async toggleFavorite() {
    const detail = this.data.detail;
    if (!detail) return;
    try {
      await setCardPackFavorite(detail.id, detail.isFavorited === true);
      this.setData({
        "detail.isFavorited": !detail.isFavorited,
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "收藏操作失败",
        icon: "none",
      });
    }
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },
  onShareAppMessage() {
    const detail = (this.data as any).detail as CardPackDetail | null;
    return {
      title: detail?.title ?? "叩咔 AI 学习卡包",
      path: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent((this.data as any).id)}`,
      imageUrl: detail?.cover,
    };
  },
  async load() {
    const id = String((this.data as any).id);
    if (!id) return;
    this.setData({ loading: true, error: "" });
    try {
      const [detail, catalogue] = await Promise.all([
        getCardPackDetail(id),
        getCardPackCatalogue(id),
      ]);
      this.setData({
        detail,
        catalogue: [...(catalogue ?? [])].sort((a, b) => a.sort - b.sort),
        canStudy: Boolean(
          detail.isUnlocked ||
          (detail.unlockType === "vip_free" && this.data.isVip),
        ),
        studyTimeText: `${
          Math.round(
            (Number(detail.userStudyProgress?.totalStudyTime || 0) / 3600) * 10,
          ) / 10
        } 小时`,
        authorRatingText: Number.isFinite(Number(detail.author?.rating))
          ? Number(detail.author?.rating).toFixed(1)
          : "",
        displayHighlights: (detail.highlights ?? []).map((item) => ({
          ...item,
          color: item.color || "#f3f7f0",
        })),
      });
      wx.setNavigationBarTitle({ title: detail.title || "卡包详情" });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "卡包加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },
  startStudy() {
    const state = this.data as any;
    if (!state.canStudy) {
      this.confirmUnlock();
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(state.id)}`,
    });
  },

  bottomAction() {
    const detail = this.data.detail;
    if (!detail) {
      return;
    }

    if ((this.data as any).canStudy) {
      this.startStudy();
      return;
    }

    this.confirmUnlock();
  },
  openCard(event: WechatMiniprogram.TouchEvent) {
    const state = this.data as any;
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) return;
    if (!state.canStudy) {
      this.confirmUnlock();
      return;
    }
    wx.navigateTo({
      url:
        `/package-cards/pages/study/index?packId=${encodeURIComponent(state.id)}` +
        `&cardId=${encodeURIComponent(id)}`,
    });
  },
  openTeacher() {
    const id = this.data.detail?.author?.id;
    if (id) {
      wx.navigateTo({
        url: `/package-cards/pages/teacher/index?id=${encodeURIComponent(id)}`,
      });
    }
  },
  confirmUnlock() {
    const detail = (this.data as any).detail as CardPackDetail | null;
    if (!detail || (this.data as any).unlocking) return;
    if (detail.unlockType === "vip_free" && !(this.data as any).isVip) {
      this.openVipGuide();
      return;
    }
    this.setData({ unlockPanelOpen: true });
    void this.loadUnlockProfile();
  },
  closeUnlockPanel() {
    if ((this.data as any).unlocking) return;
    this.setData({ unlockPanelOpen: false });
  },
  openVipGuide() {
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "该卡包为 VIP 免费卡包，开通后即可学习。",
    });
  },
  openRechargeGuide(event?: WechatMiniprogram.CustomEvent<{ shortage?: number }>) {
    const shortage = Number(event?.detail?.shortage ?? 0);
    this.setData({
      unlockPanelOpen: false,
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: shortage > 0
        ? `余额不足，还需要 ${shortage.toFixed(1)} 咔豆。`
        : "当前咔豆余额不足，可选择咔豆包购买。",
    });
  },
  closePurchaseGuide() {
    this.setData({ purchaseGuideOpen: false });
  },

  async onVirtualPaymentFulfilled() {
    this.setData({ purchaseGuideOpen: false });
    await Promise.all([this.load(), this.loadUnlockProfile()]);
  },
  async unlock() {
    if ((this.data as any).unlocking) return;
    const id = String((this.data as any).id);
    this.setData({ unlocking: true });
    try {
      const result = await unlockCardPack(id);
      if (!result.success) {
        throw new Error(result.message || "解锁失败，请稍后重试");
      }
      this.setData({ unlockPanelOpen: false });
      await Promise.all([this.load(), this.loadUnlockProfile()]);
      wx.showToast({ title: result.message || "卡包解锁成功！", icon: "success" });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "解锁失败", icon: "none" });
    } finally {
      this.setData({ unlocking: false });
    }
  },
});
