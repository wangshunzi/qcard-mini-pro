import { validateCardData } from "../../cards/CardTypeConfig";
import { isMiniProgramCardType } from "../../config/cardTypes";
import {
  claimDailyReward,
  getFavoriteCards,
  getProfile,
  getRecentPrivateCardFaces,
  type FavoriteCard,
  type FeedbackStatus,
  type PrivateCardFace,
  type UserProfile,
} from "../../services/profile";
import { getFavoriteCardPacks, unlockCardPack } from "../../services/cardPack";
import type { CardPackSummary } from "../../services/discovery";
import type { CardTransferPayload } from "../../stores/cardTransfer";
import { sessionStore } from "../../stores/session";
import { UI_ASSETS } from "../../config/uiAssets";
import type { CardData } from "../../cards/types";
import { syncNavigationScroll } from "../../utils/navigationScroll";

interface ProfileCardFace extends PrivateCardFace {
  previewCard?: CardData;
  cardData?: CardData;
  canPreview: boolean;
}

interface DisplayFavoriteCard extends FavoriteCard {
  previewCard: CardData;
}

interface DisplayFavoritePack extends CardPackSummary {
  canStudy: boolean;
  displayPrice: number;
  progressPercent: number;
  timeAgo: string;
}

const PRIVATE_FACE_POLL_MS = 3000;

function hasGeneratingFaces(faces: PrivateCardFace[]) {
  return faces.some(
    (face) => face.status === "pending" || face.status === "processing",
  );
}

function withPrivatePreview(face: PrivateCardFace): ProfileCardFace {
  const canPreview =
    face.status === "success" &&
    isMiniProgramCardType(face.type) &&
    validateCardData(face.type, face.data);
  const cardData = canPreview
    ? { type: face.type as CardData["type"], data: face.data! }
    : undefined;
  return {
    ...face,
    canPreview,
    cardData,
    previewCard: cardData,
  };
}

type PrivateFaceActionEvent =
  | WechatMiniprogram.TouchEvent
  | WechatMiniprogram.CustomEvent<{ id: string }>;

function privateFaceActionId(event: PrivateFaceActionEvent) {
  return String(
    (event.detail as { id?: string } | undefined)?.id
      ?? event.currentTarget.dataset.id
      ?? "",
  );
}

function withFavoritePreview(card: FavoriteCard): DisplayFavoriteCard | null {
  if (
    !isMiniProgramCardType(card.frontFace.type) ||
    !validateCardData(card.frontFace.type, card.frontFace.data)
  ) return null;
  return {
    ...card,
    previewCard: {
      type: card.frontFace.type as CardData["type"],
      data: card.frontFace.data,
    },
  };
}

function formatFavoriteTime(value?: string) {
  if (!value) return "未开始";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hour = 60 * 60 * 1000;
  const day = hour * 24;
  if (elapsed < hour) return "刚刚学习";
  if (elapsed < day) return `${Math.max(1, Math.floor(elapsed / hour))}小时前`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}天前`;
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function withFavoritePackDisplay(
  pack: CardPackSummary,
  isVip = false,
): DisplayFavoritePack {
  const rawProgress = Number(pack.userStudyProgress?.progress ?? 0);
  return {
    ...pack,
    canStudy: Boolean(
      pack.isUnlocked || (pack.unlockType === "vip_free" && isVip),
    ),
    displayPrice: Number(pack.priceInfo?.finalPrice ?? pack.basePrice ?? 0),
    progressPercent: Math.max(
      0,
      Math.min(100, rawProgress <= 1 ? rawProgress * 100 : rawProgress),
    ),
    timeAgo: formatFavoriteTime(pack.userStudyProgress?.lastStudiedAt),
  };
}

function formatStudyTime(seconds: number) {
  const safe = Math.max(0, Number(seconds) || 0);
  if (safe < 60) return `${Math.round(safe)}秒`;
  if (safe < 3600) return `${Math.round(safe / 60)}分`;
  if (safe < 86400) return `${Math.round((safe / 3600) * 10) / 10}小时`;
  return `${Math.round((safe / 86400) * 10) / 10}天`;
}

Page({
  data: {
    navScrollTop: 0,
    profile: null as UserProfile | null,
    recentCards: [] as ProfileCardFace[],
    loading: true,
    error: "",
    studyTimeText: "0 分",
    isVip: false,
    profileBackground: "",
    assets: UI_ASSETS,
    cardPreviewOpen: false,
    cardPreviewPayload: null as CardTransferPayload | null,
    activeTab: "recent" as "recent" | "feedback" | "favorited" | "vipBenefits",
    feedbackStatus: "all" as "all" | FeedbackStatus,
    feedbackCards: [] as ProfileCardFace[],
    favoritesMode: "packs" as "packs" | "cards",
    favoritePacks: [] as DisplayFavoritePack[],
    favoriteCards: [] as DisplayFavoriteCard[],
    panelLoading: false,
    claimingDailyReward: false,
    coinHistoryOpen: false,
    unlockPanelOpen: false,
    selectedUnlockPack: {} as CardPackSummary,
    unlocking: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "vip",
    purchaseGuideReason: "",
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onShow() {
    if (!sessionStore.getState()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    void this.load();
  },

  onHide() {
    this.clearPrivateFacePolling();
    if (
      (this.data as any).unlockPanelOpen ||
      (this.data as any).purchaseGuideOpen
    ) wx.showTabBar({ animation: false });
  },

  onUnload() {
    this.clearPrivateFacePolling();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    this.clearPrivateFacePolling();
    this.setData({ loading: true, error: "" });
    try {
      const [profile, privateFaces] = await Promise.all([
        getProfile(),
        getRecentPrivateCardFaces(),
      ]);
      const recentCards = (privateFaces.items ?? []).map(withPrivatePreview);
      this.setData({
        profile,
        recentCards,
        studyTimeText: formatStudyTime(profile.totalStudyTime),
        isVip: profile.vip?.isVip === true,
        profileBackground: profile.currentTheme?.config?.profile_bg || "",
      }, () => this.schedulePrivateFacePolling());
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "个人信息加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  clearPrivateFacePolling() {
    const timer = (this as any)._privateFacePollTimer;
    if (timer) clearTimeout(timer);
    (this as any)._privateFacePollTimer = undefined;
  },

  schedulePrivateFacePolling() {
    this.clearPrivateFacePolling();
    if (!hasGeneratingFaces(this.data.recentCards)) return;
    (this as any)._privateFacePollTimer = setTimeout(
      () => void this.refreshPrivateFaces(),
      PRIVATE_FACE_POLL_MS,
    );
  },

  async refreshPrivateFaces() {
    if ((this as any)._privateFacePollBusy) return;
    (this as any)._privateFacePollBusy = true;
    try {
      const result = await getRecentPrivateCardFaces();
      const recentCards = (result.items ?? []).map(withPrivatePreview);
      this.setData({ recentCards }, () => this.schedulePrivateFacePolling());
    } catch {
      this.schedulePrivateFacePolling();
    } finally {
      (this as any)._privateFacePollBusy = false;
    }
  },

  openSettings() {
    wx.navigateTo({ url: "/package-settings/pages/settings/index" });
  },

  openAccount() {
    wx.navigateTo({ url: "/package-settings/pages/account/index" });
  },

  openCoinHistory() {
    this.setData({ coinHistoryOpen: true });
    wx.hideTabBar({ animation: false });
  },

  closeCoinHistory() {
    this.setData({ coinHistoryOpen: false });
    wx.showTabBar({ animation: false });
  },

  openRechargeGuide() {
    wx.hideTabBar({ animation: false });
    this.setData({ coinHistoryOpen: false });
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: "选择咔豆包后，可在微信内安全完成购买。",
    });
  },

  openVipGuide() {
    wx.hideTabBar({ animation: false });
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "选择固定时长 VIP，权益会发放至当前叩咔账号。",
    });
  },

  closePurchaseGuide() {
    this.setData({ purchaseGuideOpen: false });
    wx.showTabBar({ animation: false });
  },

  async onVirtualPaymentFulfilled() {
    this.setData({ purchaseGuideOpen: false });
    wx.showTabBar({ animation: false });
    await this.load();
  },

  openProfileEdit() {
    wx.navigateTo({ url: "/package-settings/pages/profile-edit/index" });
  },

  openLevel() {
    wx.navigateTo({ url: "/package-settings/pages/level-detail/index" });
  },

  openFeedback() {
    wx.navigateTo({ url: "/package-settings/pages/feedback/index" });
  },

  openAi() {
    wx.navigateTo({ url: "/package-cards/pages/ai-generate/index" });
  },

  openResources() {
    wx.switchTab({ url: "/pages/resource/index" });
  },

  openMyLearning() {
    wx.showTabBar({ animation: false });
    wx.navigateTo({ url: "/package-cards/pages/my-learning/index" });
  },

  openMyCards() {
    wx.showTabBar({ animation: false });
    wx.navigateTo({ url: "/package-cards/pages/my-generation/index" });
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    const activeTab = String(event.currentTarget.dataset.tab) as
      | "recent"
      | "feedback"
      | "favorited"
      | "vipBenefits";
    if (!activeTab || activeTab === this.data.activeTab) return;
    this.setData({ activeTab }, () => void this.loadPanel());
  },

  switchFeedbackStatus(event: WechatMiniprogram.TouchEvent) {
    const feedbackStatus = String(event.currentTarget.dataset.status) as
      | "all"
      | FeedbackStatus;
    if (feedbackStatus === this.data.feedbackStatus) return;
    this.setData({ feedbackStatus }, () => void this.loadFeedbackCards());
  },

  switchFavoritesMode(event: WechatMiniprogram.TouchEvent) {
    const favoritesMode = String(event.currentTarget.dataset.mode) as "packs" | "cards";
    if (favoritesMode === this.data.favoritesMode) return;
    this.setData({ favoritesMode }, () => void this.loadFavorites());
  },

  async loadPanel() {
    if (this.data.activeTab === "feedback") await this.loadFeedbackCards();
    if (this.data.activeTab === "favorited") await this.loadFavorites();
  },

  async loadFeedbackCards() {
    this.setData({ panelLoading: true });
    try {
      const result = await getRecentPrivateCardFaces(20, {
        hasFeedback: true,
        feedbackStatus:
          this.data.feedbackStatus === "all" ? undefined : this.data.feedbackStatus,
      });
      this.setData({ feedbackCards: (result.items ?? []).map(withPrivatePreview) });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "反馈记录加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ panelLoading: false });
    }
  },

  async loadFavorites() {
    this.setData({ panelLoading: true });
    try {
      if (this.data.favoritesMode === "packs") {
        const result = await getFavoriteCardPacks(1, 20);
        this.setData({
          favoritePacks: (result.items ?? []).map((pack) =>
            withFavoritePackDisplay(pack, this.data.isVip),
          ),
        });
      } else {
        const result = await getFavoriteCards(1, 20);
        this.setData({
          favoriteCards: (result.items ?? [])
            .map(withFavoritePreview)
            .filter((item): item is DisplayFavoriteCard => item !== null),
        });
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "收藏加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ panelLoading: false });
    }
  },

  copyId() {
    const id = (this.data as any).profile?.shortId;
    if (id) wx.setClipboardData({ data: String(id) });
  },

  openPrivateCard(event: PrivateFaceActionEvent) {
    const id = privateFaceActionId(event);
    const card = [
      ...this.data.recentCards,
      ...this.data.feedbackCards,
    ].find((item) => item.id === id);
    if (!card) return;
    if (card.status !== "success") {
      wx.showToast({
        title: card.status === "failed" ? "该卡片生成失败" : "卡片仍在生成中",
        icon: "none",
      });
      return;
    }
    if (!isMiniProgramCardType(card.type) || !validateCardData(card.type, card.data)) {
      wx.showToast({ title: "卡片数据暂不支持预览", icon: "none" });
      return;
    }
    const payload: CardTransferPayload = {
      front: { type: card.type, data: card.data! },
      title: card.name,
      privateFace: {
        id: card.id,
        templateId: card.templateId,
        feedback: card.feedback,
      },
    };
    this.setData({ cardPreviewOpen: true, cardPreviewPayload: payload });
    wx.hideTabBar({ animation: false });
  },

  makeSimilar(event: PrivateFaceActionEvent) {
    const id = privateFaceActionId(event);
    const card = [...this.data.recentCards, ...this.data.feedbackCards]
      .find((item) => item.id === id);
    if (!card?.templateId) {
      wx.showToast({ title: "该卡面缺少模板信息", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(card.templateId)}`,
    });
  },

  openFavoritePack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (id) {
      wx.navigateTo({
        url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}`,
      });
    }
  },

  useFavoritePack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const pack = this.data.favoritePacks.find((item) => item.id === id);
    if (!pack) return;
    if (!pack.canStudy) {
      if (pack.unlockType === "vip_free" && !this.data.isVip) {
        this.openVipGuide();
        return;
      }
      this.setData({
        selectedUnlockPack: pack,
        unlockPanelOpen: true,
      });
      wx.hideTabBar({ animation: false });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(id)}`,
    });
  },

  closeUnlockPanel() {
    if (this.data.unlocking) return;
    this.setData({ unlockPanelOpen: false });
    wx.showTabBar({ animation: false });
  },

  openUnlockRecharge(event?: WechatMiniprogram.CustomEvent<{ shortage?: number }>) {
    const shortage = Number(event?.detail?.shortage ?? 0);
    this.setData({
      unlockPanelOpen: false,
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: shortage > 0
        ? `余额不足，还需要 ${shortage.toFixed(1)} 咔豆，可选择咔豆包购买。`
        : "当前咔豆余额不足，可选择咔豆包购买。",
    });
  },

  async confirmFavoritePackUnlock() {
    const pack = this.data.selectedUnlockPack;
    if (!pack?.id || this.data.unlocking) return;
    this.setData({ unlocking: true });
    try {
      const result = await unlockCardPack(pack.id);
      if (!result.success) throw new Error(result.message || "解锁失败，请稍后重试");
      this.setData({ unlockPanelOpen: false });
      wx.showTabBar({ animation: false });
      await Promise.all([this.load(), this.loadFavorites()]);
      wx.showToast({ title: result.message || "卡包解锁成功！", icon: "success" });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "解锁失败",
        icon: "none",
      });
    } finally {
      this.setData({ unlocking: false });
    }
  },

  openFavoriteCard(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const card = this.data.favoriteCards.find((item) => item.id === id);
    if (!card) return;
    if (
      !isMiniProgramCardType(card.frontFace.type) ||
      !validateCardData(card.frontFace.type, card.frontFace.data)
    ) {
      wx.showToast({ title: "该收藏卡片暂不支持预览", icon: "none" });
      return;
    }
    const payload: CardTransferPayload = {
      front: { type: card.frontFace.type, data: card.frontFace.data },
      title: card.name,
    };
    this.setData({ cardPreviewOpen: true, cardPreviewPayload: payload });
    wx.hideTabBar({ animation: false });
  },

  closeCardPreview() {
    this.setData({ cardPreviewOpen: false, cardPreviewPayload: null });
    wx.showTabBar({ animation: false });
  },

  async claimReward() {
    const profile = this.data.profile;
    if (
      !profile?.vip?.isVip ||
      profile.vip.dailyRewardClaimed ||
      this.data.claimingDailyReward
    ) return;
    this.setData({ claimingDailyReward: true });
    try {
      const result = await claimDailyReward();
      wx.showToast({ title: `成功领取 ${result.rewardAmount} 咔豆`, icon: "success" });
      await this.load();
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "领取失败",
        icon: "none",
      });
    } finally {
      this.setData({ claimingDailyReward: false });
    }
  },

  logout() {
    wx.showModal({
      title: "退出登录",
      content: "确认退出当前账号？",
      confirmText: "退出",
      confirmColor: "#bd554f",
      success: (result) => {
        if (!result.confirm) return;
        sessionStore.clear();
        wx.reLaunch({ url: "/pages/login/index" });
      },
    });
  },
});
