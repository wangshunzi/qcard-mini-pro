import { getTeacherCardPacks, unlockCardPack } from "../../../services/cardPack";
import type { CardPackSummary } from "../../../services/discovery";
import { getProfile } from "../../../services/profile";
import { UI_ASSETS } from "../../../config/uiAssets";

interface DisplayTeacherPack extends CardPackSummary {
  canStudy: boolean;
}

Page({
  data: {
    id: "",
    loading: true,
    error: "",
    teacher: null as Awaited<ReturnType<typeof getTeacherCardPacks>>["teacher"] | null,
    cardPacks: [] as DisplayTeacherPack[],
    ratingStars: [] as Array<{ active: boolean }>,
    unlockingId: "",
    unlockPanelOpen: false,
    selectedUnlockPack: {} as CardPackSummary,
    userBalance: 0,
    isVip: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "vip",
    purchaseGuideReason: "",
    assets: UI_ASSETS,
  },

  onLoad(options: Record<string, string>) {
    this.setData({ id: String(options.id || "") });
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
      this.setData({
        userBalance: Math.max(0, Number(profile.balance || 0)),
        isVip: profile.vip?.isVip === true,
        cardPacks: this.data.cardPacks.map((pack) => ({
          ...pack,
          canStudy: Boolean(
            pack.isUnlocked ||
            (pack.unlockType === "vip_free" && profile.vip?.isVip === true),
          ),
        })),
      });
    } catch {
      // The drawer remains usable with a zero balance and exposes the recharge path.
    }
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    if (!this.data.id) {
      this.setData({ loading: false, error: "老师参数无效" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const result = await getTeacherCardPacks(this.data.id);
      const rating = Math.max(0, Math.min(5, Number(result.teacher.rating) || 0));
      this.setData({
        teacher: result.teacher,
        cardPacks: (result.cardPacks ?? []).map((pack) => ({
          ...pack,
          canStudy: Boolean(
            pack.isUnlocked ||
            (pack.unlockType === "vip_free" && this.data.isVip),
          ),
        })),
        ratingStars: Array.from({ length: 5 }, (_, index) => ({ active: index + 0.5 <= rating })),
      });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "老师主页加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  openPack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    if (id) wx.navigateTo({ url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}` });
  },

  startStudy(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    if (!id) return;
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(id)}`,
    });
  },

  unlock(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    const pack = this.data.cardPacks.find((item) => item.id === id);
    if (!pack || pack.canStudy || this.data.unlockingId) return;
    if (pack.unlockType === "vip_free" && !this.data.isVip) {
      this.openVipGuide();
      return;
    }
    this.setData({
      selectedUnlockPack: pack,
      unlockPanelOpen: true,
    });
  },

  closeUnlockPanel() {
    if (this.data.unlockingId) return;
    this.setData({ unlockPanelOpen: false });
  },

  openVipGuide() {
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "该卡包为 VIP 免费卡包，请在叩咔 AI App 中开通 VIP 后学习。",
    });
  },

  openUnlockRecharge(event?: WechatMiniprogram.CustomEvent<{ shortage?: number }>) {
    const shortage = Number(event?.detail?.shortage ?? 0);
    this.setData({
      unlockPanelOpen: false,
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: shortage > 0
        ? `余额不足，还需要 ${shortage.toFixed(1)} 咔豆。`
        : "当前咔豆余额不足，请在叩咔 AI App 中充值。",
    });
  },
  closePurchaseGuide() {
    this.setData({ purchaseGuideOpen: false });
  },

  async confirmUnlock() {
    const pack = this.data.selectedUnlockPack;
    if (!pack?.id || this.data.unlockingId) return;
    this.setData({ unlockingId: pack.id });
    try {
      const result = await unlockCardPack(pack.id);
      if (!result.success) throw new Error(result.message || "解锁失败");
      this.setData({ unlockPanelOpen: false });
      await Promise.all([this.load(), this.loadUnlockProfile()]);
      wx.showToast({ title: result.message || "解锁成功", icon: "success" });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "解锁失败",
        icon: "none",
      });
    } finally {
      this.setData({ unlockingId: "" });
    }
  },
});
