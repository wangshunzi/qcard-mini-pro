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
import type { CardTransferPayload } from "../../cards/cardTransfer";
import { sessionStore } from "../../stores/session";
import { UI_ASSETS } from "../../config/uiAssets";
import type { CardData } from "../../cards/types";
import { syncNavigationScroll } from "../../utils/navigationScroll";
import {
  markDataFresh,
  shouldRefreshData,
  type DataDomain,
} from "../../stores/dataInvalidation";
import { bindThemeBackgrounds } from "../../design-system/themeBackground";

const PROFILE_DATA_DOMAINS: DataDomain[] = [
  "account",
  "wallet",
  "learning",
  "content",
  "favorites",
];

interface ProfileCardFace extends PrivateCardFace {
  previewCard?: CardData;
  cardData?: CardData;
  canPreview: boolean;
}

interface DisplayFavoriteCard extends FavoriteCard {
  previewCard: CardData;
  sourcePage: number;
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

function withFavoritePreview(card: FavoriteCard, sourcePage = 1): DisplayFavoriteCard | null {
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
    sourcePage,
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

const PROFILE_HEADER_CONTENT_OFFSET_PX = 20;

Page({
  data: {
    navScrollTop: 0,
    profileHeaderTop: 84,
    profile: null as UserProfile | null,
    recentCards: [] as ProfileCardFace[],
    loading: true,
    error: "",
    studyTimeText: "0 分",
    isVip: false,
    profileBackground: "",
    assets: UI_ASSETS,
    cardPreviewOpen: false,
    cardPreviewVisible: false,
    cardPreviewPayload: null as CardTransferPayload | null,
    activeTab: "recent" as "recent" | "feedback" | "favorited" | "vipBenefits",
    feedbackStatus: "all" as "all" | FeedbackStatus,
    feedbackCards: [] as ProfileCardFace[],
    favoritesMode: "packs" as "packs" | "cards",
    favoritePacks: [] as DisplayFavoritePack[],
    favoriteCards: [] as DisplayFavoriteCard[],
    feedbackPage: 1,
    feedbackTotalPages: 1,
    feedbackTotal: 0,
    favoritePacksPage: 1,
    favoritePacksTotalPages: 1,
    favoritePacksTotal: 0,
    favoriteCardsPage: 1,
    favoriteCardsTotalPages: 1,
    favoriteCardsTotal: 0,
    panelLoading: false,
    panelLoadingMore: false,
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

  onNavigationMetrics(
    event: WechatMiniprogram.CustomEvent<{ totalHeight?: number }>,
  ) {
    this.setData({
      profileHeaderTop: Math.max(
        64 + PROFILE_HEADER_CONTENT_OFFSET_PX,
        Math.ceil(Number(event.detail?.totalHeight || 64) + PROFILE_HEADER_CONTENT_OFFSET_PX),
      ),
    });
  },

  onReachBottom() {
    if (this.data.activeTab === "feedback") {
      void this.loadFeedbackCards(false);
    } else if (this.data.activeTab === "favorited") {
      void this.loadFavorites(false);
    }
  },

  onShow() {
    if (!sessionStore.getState()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    if (shouldRefreshData(this as any, PROFILE_DATA_DOMAINS)) void this.load();
    else this.schedulePrivateFacePolling();
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
    markDataFresh(this as any, PROFILE_DATA_DOMAINS);
    (this as any)._feedbackPanelCache = {};
    (this as any)._favoritePanelCache = {};
    this.clearPrivateFacePolling();
    this.setData({ loading: true, error: "" });
    try {
      const [profile, privateFaces] = await Promise.all([
        getProfile(),
        getRecentPrivateCardFaces(),
      ]);
      const recentCards = (privateFaces.items ?? []).map(withPrivatePreview);
      bindThemeBackgrounds(this, profile.currentTheme?.config, {
        profileBackground: "profile_bg",
      });
      this.setData({
        profile,
        recentCards,
        studyTimeText: formatStudyTime(profile.totalStudyTime),
        isVip: profile.vip?.isVip === true,
      }, () => this.schedulePrivateFacePolling());
      if (this.data.activeTab === "feedback" || this.data.activeTab === "favorited") {
        await this.loadPanel();
      }
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
    this.setData({ feedbackStatus }, () => void this.loadPanel());
  },

  switchFavoritesMode(event: WechatMiniprogram.TouchEvent) {
    const favoritesMode = String(event.currentTarget.dataset.mode) as "packs" | "cards";
    if (favoritesMode === this.data.favoritesMode) return;
    this.setData({ favoritesMode }, () => void this.loadPanel());
  },

  async loadPanel() {
    if (this.data.activeTab === "feedback") {
      const cache = (this as any)._feedbackPanelCache?.[this.data.feedbackStatus];
      if (cache) {
        this.setData({
          feedbackCards: cache.items,
          feedbackPage: cache.page,
          feedbackTotalPages: cache.totalPages,
          feedbackTotal: cache.total,
        });
      } else {
        await this.loadFeedbackCards(true);
      }
    }
    if (this.data.activeTab === "favorited") {
      const cache = (this as any)._favoritePanelCache?.[this.data.favoritesMode];
      if (cache) {
        this.setData(this.data.favoritesMode === "packs"
          ? {
              favoritePacks: cache.items,
              favoritePacksPage: cache.page,
              favoritePacksTotalPages: cache.totalPages,
              favoritePacksTotal: cache.total,
            }
          : {
              favoriteCards: cache.items,
              favoriteCardsPage: cache.page,
              favoriteCardsTotalPages: cache.totalPages,
              favoriteCardsTotal: cache.total,
            });
      } else {
        await this.loadFavorites(true);
      }
    }
  },

  async loadFeedbackCards(reset = true) {
    if (this.data.panelLoading || this.data.panelLoadingMore) return;
    if (!reset && this.data.feedbackPage >= this.data.feedbackTotalPages) return;
    const page = reset ? 1 : this.data.feedbackPage + 1;
    const status = this.data.feedbackStatus;
    this.setData(reset ? { panelLoading: true } : { panelLoadingMore: true });
    try {
      const result = await getRecentPrivateCardFaces(20, {
        hasFeedback: true,
        feedbackStatus:
          status === "all" ? undefined : status,
      }, page);
      const incoming = (result.items ?? []).map(withPrivatePreview);
      const previous = (this as any)._feedbackPanelCache?.[status]?.items ?? [];
      const existingIds = new Set(previous.map((item: ProfileCardFace) => item.id));
      const items = reset
        ? incoming
        : [...previous, ...incoming.filter((item) => !existingIds.has(item.id))];
      const cache = (this as any)._feedbackPanelCache ?? {};
      cache[status] = {
        items,
        page: Math.max(1, Number(result.page) || page),
        totalPages: Math.max(1, Number(result.totalPages) || 1),
        total: Math.max(items.length, Number(result.total) || 0),
      };
      (this as any)._feedbackPanelCache = cache;
      if (this.data.feedbackStatus === status) {
        this.setData({
          feedbackCards: items,
          feedbackPage: cache[status].page,
          feedbackTotalPages: cache[status].totalPages,
          feedbackTotal: cache[status].total,
        });
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "反馈记录加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ panelLoading: false, panelLoadingMore: false });
      if (
        this.data.activeTab === "feedback" &&
        this.data.feedbackStatus !== status
      ) void this.loadPanel();
    }
  },

  loadMoreFeedbackCards() {
    void this.loadFeedbackCards(false);
  },

  async loadFavorites(reset = true) {
    if (this.data.panelLoading || this.data.panelLoadingMore) return;
    const mode = this.data.favoritesMode;
    const currentPage = mode === "packs"
      ? this.data.favoritePacksPage
      : this.data.favoriteCardsPage;
    const totalPages = mode === "packs"
      ? this.data.favoritePacksTotalPages
      : this.data.favoriteCardsTotalPages;
    if (!reset && currentPage >= totalPages) return;
    const page = reset ? 1 : currentPage + 1;
    this.setData(reset ? { panelLoading: true } : { panelLoadingMore: true });
    try {
      if (mode === "packs") {
        const result = await getFavoriteCardPacks(page, 20);
        const incoming = (result.items ?? []).map((pack) =>
          withFavoritePackDisplay(pack, this.data.isVip),
        );
        const cache = (this as any)._favoritePanelCache ?? {};
        const previous = cache.packs?.items ?? [];
        const existingIds = new Set(previous.map((item: DisplayFavoritePack) => item.id));
        const items = reset
          ? incoming
          : [...previous, ...incoming.filter((item) => !existingIds.has(item.id))];
        cache.packs = {
          items,
          page: Math.max(1, Number(result.page) || page),
          totalPages: Math.max(1, Number(result.totalPages) || 1),
          total: Math.max(items.length, Number(result.total) || 0),
        };
        (this as any)._favoritePanelCache = cache;
        if (this.data.favoritesMode === mode) {
          this.setData({
            favoritePacks: items,
            favoritePacksPage: cache.packs.page,
            favoritePacksTotalPages: cache.packs.totalPages,
            favoritePacksTotal: cache.packs.total,
          });
        }
      } else {
        const result = await getFavoriteCards(page, 20);
        const incoming = (result.items ?? [])
          .map((item) => withFavoritePreview(item, page))
          .filter((item): item is DisplayFavoriteCard => item !== null);
        const cache = (this as any)._favoritePanelCache ?? {};
        const previous = cache.cards?.items ?? [];
        const existingIds = new Set(previous.map((item: DisplayFavoriteCard) => item.id));
        const items = reset
          ? incoming
          : [...previous, ...incoming.filter((item) => !existingIds.has(item.id))];
        cache.cards = {
          items,
          page: Math.max(1, Number(result.page) || page),
          totalPages: Math.max(1, Number(result.totalPages) || 1),
          total: Math.max(items.length, Number(result.total) || 0),
        };
        (this as any)._favoritePanelCache = cache;
        if (this.data.favoritesMode === mode) {
          this.setData({
            favoriteCards: items,
            favoriteCardsPage: cache.cards.page,
            favoriteCardsTotalPages: cache.cards.totalPages,
            favoriteCardsTotal: cache.cards.total,
          });
        }
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "收藏加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ panelLoading: false, panelLoadingMore: false });
      if (
        this.data.activeTab === "favorited" &&
        this.data.favoritesMode !== mode
      ) void this.loadPanel();
    }
  },

  loadMoreFavorites() {
    void this.loadFavorites(false);
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
      genParams: card.genParams,
      privateFace: {
        id: card.id,
        templateId: card.templateId,
        feedback: card.feedback,
      },
    };
    this.setData({ cardPreviewOpen: true, cardPreviewPayload: payload });
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
      url:
        `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(card.templateId)}` +
        (card.genParams
          ? `&genParams=${encodeURIComponent(JSON.stringify(card.genParams))}`
          : ""),
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
      url:
        `/package-cards/pages/study/index?packId=${encodeURIComponent(id)}` +
        (pack.userStudyProgress?.lastStudiedCardId
          ? `&cardId=${encodeURIComponent(pack.userStudyProgress.lastStudiedCardId)}`
          : ""),
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
    wx.navigateTo({
      url:
        `/package-cards/pages/study/index?favorite=1&favoritePage=${card.sourcePage}` +
        `&cardId=${encodeURIComponent(card.id)}`,
    });
  },

  onCardPreviewShown() {
    this.setData({ cardPreviewVisible: true });
    wx.hideTabBar({ animation: false });
  },

  closeCardPreview() {
    this.setData({
      cardPreviewOpen: false,
      cardPreviewVisible: false,
      cardPreviewPayload: null,
    });
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
