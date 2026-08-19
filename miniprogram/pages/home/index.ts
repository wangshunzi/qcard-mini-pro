import {
  getHomeData,
  type ChallengeCard,
  type DailyChallenge,
  type Promotion,
} from "../../services/home";
import type { CardPackSummary } from "../../services/discovery";
import { sessionStore } from "../../stores/session";
import { saveChallengeTransfer } from "../../stores/challengeTransfer";
import {
  getProfile,
  getRecentPrivateCardFaces,
  type PrivateCardFace,
} from "../../services/profile";
import { UI_ASSETS } from "../../config/uiAssets";
import { isMiniProgramCardType } from "../../config/cardTypes";
import { validateCardData } from "../../cards/CardTypeConfig";
import type { CardTransferPayload } from "../../cards/cardTransfer";
import type { CardData } from "../../cards/types";
import { syncNavigationScroll } from "../../utils/navigationScroll";
import {
  markDataFresh,
  shouldRefreshData,
  type DataDomain,
} from "../../stores/dataInvalidation";
import { bindThemeBackgrounds, getThemePageData, syncThemePreferenceForPage } from "../../design-system/themeBackground";
import { isExpiredVipStudyAccess } from "../../utils/recentStudyAccess";
import {
  getPublicCardFace,
  getPublicCardFaces,
  type PublicCardFaceSummary,
} from "../../services/exploration";
import {
  isAuthenticated,
  openLogin,
  requireLogin,
} from "../../utils/authGate";

const HOME_DATA_DOMAINS: DataDomain[] = [
  "account",
  "wallet",
  "learning",
  "content",
  "challenge",
];

interface HomeSection {
  key: string;
  title: string;
  subtitle: string;
  items: HomeCardPack[];
}

interface HomeCardPack extends CardPackSummary {
  progressPercent: number;
  progressValue: number;
  timeAgo: string;
  isPrivate: boolean;
  isVipAccessExpired: boolean;
  privateCover?: string;
}

interface HomeCardFace extends PrivateCardFace {
  cardData?: CardData;
  canPreview: boolean;
}

interface HomeChallengeCard extends ChallengeCard {
  previewCard: {
    type: string;
    data: Record<string, unknown>;
  };
}

interface GuestFeaturedCard extends PublicCardFaceSummary {
  previewCard?: CardData;
}

const PRIVATE_FACE_POLL_MS = 3000;

function hasGeneratingFaces(faces: PrivateCardFace[]) {
  return faces.some(
    (face) => face.status === "pending" || face.status === "processing",
  );
}

function formatTimeAgo(value?: string, prefix = "学习") {
  if (!value) return prefix === "学习" ? "尚未学习" : `刚刚${prefix}`;
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (elapsed < minute) return `刚刚${prefix}`;
  if (elapsed < hour) return `${Math.floor(elapsed / minute)}分钟前`;
  if (elapsed < day) return `${Math.floor(elapsed / hour)}小时前`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}天前`;
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function withProgress(
  cardPack: CardPackSummary,
  currentUserId = "",
  currentUserAvatar = "",
): HomeCardPack {
  const raw = Number(cardPack.userStudyProgress?.progress ?? 0);
  const progressPercent = Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
  const isOwnedByCurrentUser = Boolean(
    currentUserId && cardPack.author?.id === currentUserId,
  );
  const hasPrivatePackShape = Boolean(
    !cardPack.cover &&
    !cardPack.subject?.id &&
    !cardPack.knowledgePoint?.id &&
    Number(cardPack.basePrice || 0) === 0 &&
    cardPack.isUnlocked,
  );
  const isPrivate = isOwnedByCurrentUser || hasPrivatePackShape;
  const isVipAccessExpired = isExpiredVipStudyAccess(cardPack, isPrivate);
  return {
    ...cardPack,
    progressPercent,
    progressValue: progressPercent / 100,
    isPrivate,
    isVipAccessExpired,
    privateCover: isPrivate
      ? currentUserAvatar || cardPack.author?.avatar
      : undefined,
    timeAgo: formatTimeAgo(
      cardPack.userStudyProgress?.lastStudiedAt,
      progressPercent > 0 ? "学习" : "解锁",
    ),
  };
}

function withCardPreview(face: PrivateCardFace): HomeCardFace {
  const canPreview =
    face.status === "success" &&
    isMiniProgramCardType(face.type) &&
    validateCardData(face.type, face.data);
  return {
    ...face,
    canPreview,
    cardData: canPreview
      ? { type: face.type as CardData["type"], data: face.data! }
      : undefined,
  };
}

function withGuestCardPreview(
  face: PublicCardFaceSummary,
): GuestFeaturedCard | null {
  if (
    !isMiniProgramCardType(face.type) ||
    (face.schemaVersion ?? 1) > 1 ||
    (face.supportedPlatforms?.length &&
      !face.supportedPlatforms.includes("wechat_miniprogram"))
  ) return null;
  return {
    ...face,
    previewCard:
      face.data && validateCardData(face.type, face.data)
        ? { type: face.type as CardData["type"], data: face.data }
        : undefined,
  };
}

Page({
  data: {
    ...getThemePageData(),
    navScrollTop: 0,
    loading: true,
    error: "",
    userName: "同学",
    recentStudy: [] as HomeCardPack[],
    recentCards: [] as HomeCardFace[],
    dailyChallenge: null as DailyChallenge | null,
    challengeCards: [] as HomeChallengeCard[],
    challengeProgress: 0,
    sections: [] as HomeSection[],
    featuredPacks: [] as HomeCardPack[],
    guestFeaturedCards: [] as GuestFeaturedCard[],
    guestCardOpeningId: "",
    profile: null as Awaited<ReturnType<typeof getProfile>> | null,
    homeBackground: "",
    assets: UI_ASSETS,
    cardPreviewOpen: false,
    cardPreviewVisible: false,
    cardPreviewPayload: null as CardTransferPayload | null,
    coinHistoryOpen: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "recharge",
    purchaseGuideReason: "",
    isGuest: true,
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onLoad() {
    const launchPath = wx.getLaunchOptionsSync?.().path;
    if (
      isAuthenticated() &&
      launchPath === "pages/home/index" &&
      getCurrentPages().length === 1
    ) {
      (this as any)._redirectingAuthenticatedEntry = true;
      wx.switchTab({
        url: "/pages/explore/index",
        success: () => {
          (this as any)._redirectingAuthenticatedEntry = false;
        },
        fail: () => {
          (this as any)._redirectingAuthenticatedEntry = false;
          void this.load();
        },
      });
    }
  },

  onShow() {
    syncThemePreferenceForPage(this);
    if ((this as any)._redirectingAuthenticatedEntry) return;
    const session = sessionStore.getState();
    const authenticated = Boolean(session);
    const authenticationChanged =
      (this as any)._lastAuthenticated !== authenticated;
    (this as any)._lastAuthenticated = authenticated;
    this.setData({
      isGuest: !authenticated,
      userName: session?.user.nickname || (authenticated ? "同学" : "访客"),
    });
    if (
      !(this as any)._loaded ||
      authenticationChanged ||
      shouldRefreshData(this as any, HOME_DATA_DOMAINS)
    ) void this.load();
    else this.schedulePrivateFacePolling();
  },

  onHide() {
    this.clearPrivateFacePolling();
    if ((this.data as any).purchaseGuideOpen) wx.showTabBar({ animation: false });
  },

  onUnload() {
    this.clearPrivateFacePolling();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    markDataFresh(this as any, HOME_DATA_DOMAINS);
    this.clearPrivateFacePolling();
    this.setData({ loading: true, error: "" });
    try {
      const session = sessionStore.getState();
      const [data, profile, privateFaces, publicFaces] = await Promise.all([
        getHomeData(),
        getProfile().catch(() => null),
        session
          ? getRecentPrivateCardFaces(6).catch(() => ({ items: [] as PrivateCardFace[] }))
          : Promise.resolve({ items: [] as PrivateCardFace[] }),
        session
          ? Promise.resolve({ items: [] as PublicCardFaceSummary[] })
          : getPublicCardFaces({ page: 1, limit: 6 }).catch(() => ({
              items: [] as PublicCardFaceSummary[],
            })),
      ]);
      const promotions = (data.promotions ?? [])
        .filter((promotion) => promotion.cardPacks?.length)
        .map((promotion: Promotion) => ({
          key: promotion.id,
          title: promotion.name,
          subtitle: promotion.description || "精选学习内容",
          items: promotion.cardPacks.map((pack) => withProgress(pack)),
        }));
      const featured = (data.featuredCardPacks ?? []).map((pack) =>
        withProgress(pack, profile?.id, profile?.avatar || ""),
      );
      const sections: HomeSection[] = promotions;
      const recentCards = (privateFaces.items ?? []).map(withCardPreview);
      const guestFeaturedCards = (publicFaces.items ?? [])
        .map(withGuestCardPreview)
        .filter((item): item is GuestFeaturedCard => Boolean(item));
      if (profile) {
        bindThemeBackgrounds(this, profile.currentTheme?.config, {
          homeBackground: "home_bg",
        });
      }
      const recentStudy = (data.recentStudy ?? []).map((pack) =>
          withProgress(pack, profile?.id, profile?.avatar || ""),
        );
      this.setData({
        recentStudy,
        recentCards,
        dailyChallenge: data.dailyChallenge ?? null,
        challengeCards: (data.dailyChallenge?.cards ?? [])
          .filter(
            (card) =>
              isMiniProgramCardType(card.frontFace.type) &&
              validateCardData(card.frontFace.type, card.frontFace.data),
          )
          .map((card) => ({
            ...card,
            previewCard: {
              type: card.frontFace.type,
              data: card.frontFace.data,
            },
          })),
        challengeProgress: data.dailyChallenge
          ? Math.max(
              0,
              Math.min(
                100,
                ((data.dailyChallenge.completedNewCards +
                  data.dailyChallenge.completedReviewCards) *
                  100) /
                  Math.max(
                    1,
                    data.dailyChallenge.newCardCount +
                      data.dailyChallenge.reviewCardCount,
                  ),
              ),
            )
          : 0,
        sections,
        featuredPacks: featured,
        guestFeaturedCards,
        profile,
        isGuest: !sessionStore.getState(),
        userName:
          profile?.nickname ||
          sessionStore.getState()?.user.nickname ||
          "访客",
      }, () => this.schedulePrivateFacePolling());
      (this as any)._loaded = true;
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "首页加载失败" });
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
    if (!isAuthenticated()) return;
    if ((this as any)._privateFacePollBusy) return;
    (this as any)._privateFacePollBusy = true;
    try {
      const result = await getRecentPrivateCardFaces(6);
      const recentCards = (result.items ?? []).map(withCardPreview);
      this.setData({ recentCards }, () => this.schedulePrivateFacePolling());
    } catch {
      this.schedulePrivateFacePolling();
    } finally {
      (this as any)._privateFacePollBusy = false;
    }
  },

  async openAi() {
    if (!(await requireLogin("generate"))) return;
    wx.navigateTo({ url: "/package-cards/pages/ai-generate/index" });
  },

  async makeSimilar(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id ?? "");
    const card = (this.data.recentCards as HomeCardFace[]).find(
      (item) => item.id === id,
    );
    if (!card?.templateId) {
      wx.showToast({ title: "该卡面缺少模板信息", icon: "none" });
      return;
    }
    if (!(await requireLogin("generate"))) return;
    wx.navigateTo({
      url:
        `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(card.templateId)}` +
        (card.genParams
          ? `&genParams=${encodeURIComponent(JSON.stringify(card.genParams))}`
          : ""),
    });
  },

  async openStudy() {
    if (!(await requireLogin("study"))) return;
    const recent = (this.data as any).recentStudy as HomeCardPack[];
    const pack = recent[0];
    if (!pack) {
      wx.switchTab({ url: "/pages/resource/index" });
      return;
    }
    if (pack.isVipAccessExpired) {
      this.openExpiredVipGuide(pack);
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(pack.id)}${
        pack.isPrivate ? "&private=1" : ""
      }${
        pack.userStudyProgress?.lastStudiedCardId
          ? `&cardId=${encodeURIComponent(pack.userStudyProgress.lastStudiedCardId)}`
          : ""
      }`,
    });
  },

  async startStudy(event: WechatMiniprogram.TouchEvent) {
    if (!(await requireLogin("study"))) return;
    const id = String(event.currentTarget.dataset.id ?? "");
    const pack = ((this.data as any).recentStudy as HomeCardPack[]).find(
      (item) => item.id === id,
    );
    if (!pack) return;
    if (pack.isVipAccessExpired) {
      this.openExpiredVipGuide(pack);
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(pack.id)}${
        pack.isPrivate ? "&private=1" : ""
      }${
        pack.userStudyProgress?.lastStudiedCardId
          ? `&cardId=${encodeURIComponent(pack.userStudyProgress.lastStudiedCardId)}`
          : ""
      }`,
    });
  },

  openPack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) return;
    const pack = [
      ...((this.data as any).recentStudy as HomeCardPack[]),
      ...((this.data as any).sections as HomeSection[]).flatMap((section) => section.items),
    ].find((item) => item.id === id);
    if (pack?.isPrivate) {
      wx.navigateTo({
        url: `/package-cards/pages/private-pack/index?id=${encodeURIComponent(id)}`,
      });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}`,
    });
  },

  async openChallenge(event?: WechatMiniprogram.TouchEvent) {
    if (!(await requireLogin("study"))) return;
    const challenge = (this.data as any).dailyChallenge as DailyChallenge | null;
    if (!challenge?.cards?.length) {
      wx.showToast({ title: "今日暂无挑战卡片", icon: "none" });
      return;
    }
    const requestedCardId = String(event?.currentTarget?.dataset?.id ?? "");
    const cardId = requestedCardId ||
      challenge.cards.find((item) => !item.isCompleted)?.id ||
      challenge.cards[0]?.id ||
      "";
    saveChallengeTransfer(challenge);
    wx.navigateTo({
      url:
        "/package-cards/pages/study/index?challenge=1" +
        (cardId ? `&cardId=${encodeURIComponent(cardId)}` : ""),
    });
  },

  openResources() {
    wx.switchTab({ url: "/pages/resource/index" });
  },

  openExplore() {
    wx.switchTab({ url: "/pages/explore/index" });
  },

  async openGuestFeaturedCard(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id || this.data.guestCardOpeningId) return;
    this.setData({ guestCardOpeningId: id });
    wx.showLoading({ title: "加载卡片", mask: true });
    try {
      const face = await getPublicCardFace(id);
      if (!isMiniProgramCardType(face.type)) throw new Error("该卡片暂不支持小程序");
      if ((face.schemaVersion ?? 1) > 1) throw new Error("请升级小程序后查看此卡片");
      if (
        face.supportedPlatforms?.length &&
        !face.supportedPlatforms.includes("wechat_miniprogram")
      ) throw new Error("该卡片暂不支持小程序");
      if (!validateCardData(face.type, face.data)) throw new Error("卡片内容暂不可用");
      this.setData({
        cardPreviewOpen: true,
        cardPreviewPayload: {
          front: {
            type: face.type,
            data: face.data,
            schemaVersion: face.schemaVersion,
          },
          title: face.name,
          templateId: face.templateId,
          genParams: face.genParams,
        } as CardTransferPayload,
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "卡片加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
      this.setData({ guestCardOpeningId: "" });
    }
  },

  async openMyLearning() {
    if (!(await requireLogin("profile"))) return;
    wx.navigateTo({ url: "/package-cards/pages/my-learning/index" });
  },

  async createPrivatePack() {
    if (!(await requireLogin("generate"))) return;
    wx.navigateTo({
      url: "/package-cards/pages/my-learning/index?mode=private&create=true",
    });
  },

  async openMyCards() {
    if (!(await requireLogin("profile"))) return;
    wx.navigateTo({ url: "/package-cards/pages/my-generation/index" });
  },

  async openLevel() {
    if (!(await requireLogin("asset"))) return;
    wx.navigateTo({ url: "/package-settings/pages/level-detail/index" });
  },

  openProfile() {
    wx.switchTab({ url: "/pages/profile/index" });
  },

  async openCoinHistory() {
    if (!(await requireLogin("asset"))) return;
    this.setData({ coinHistoryOpen: true });
    wx.hideTabBar({ animation: false });
  },

  closeCoinHistory() {
    this.setData({ coinHistoryOpen: false });
    wx.showTabBar({ animation: false });
  },

  async openRechargeGuide() {
    if (!(await requireLogin("purchase"))) return;
    this.setData({ coinHistoryOpen: false });
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: "咔豆余额不足，可选择咔豆包购买后继续使用。",
    });
  },

  async openExpiredVipGuide(pack?: HomeCardPack | WechatMiniprogram.TouchEvent) {
    if (!(await requireLogin("purchase"))) return;
    const selectedPack = pack && "id" in pack ? pack : undefined;
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: selectedPack?.title
        ? `《${selectedPack.title}》曾通过 VIP 免费权益学习。当前权益已到期，恢复 VIP 后即可继续学习，原进度仍会保留。`
        : "部分最近学习卡包来自已到期的 VIP 免费权益。恢复 VIP 后即可继续学习，原学习记录和进度仍会保留。",
    });
    wx.hideTabBar({ animation: false });
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

  openPrivateCard(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id ?? "");
    const card = ((this.data as any).recentCards as PrivateCardFace[]).find(
      (item) => item.id === id,
    );
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

  openGuestLogin() {
    openLogin("profile");
  },
});
