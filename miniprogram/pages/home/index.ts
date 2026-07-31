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
import { saveCardTransfer } from "../../stores/cardTransfer";
import type { CardData } from "../../cards/types";
import { syncNavigationScroll } from "../../utils/navigationScroll";

interface HomeSection {
  key: string;
  title: string;
  subtitle: string;
  items: CardPackSummary[];
}

interface HomeCardPack extends CardPackSummary {
  progressPercent: number;
  progressValue: number;
  timeAgo: string;
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

function withProgress(cardPack: CardPackSummary): HomeCardPack {
  const raw = Number(cardPack.userStudyProgress?.progress ?? 0);
  const progressPercent = Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
  return {
    ...cardPack,
    progressPercent,
    progressValue: progressPercent / 100,
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

Page({
  data: {
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
    profile: null as Awaited<ReturnType<typeof getProfile>> | null,
    homeBackground: "",
    assets: UI_ASSETS,
    coinHistoryOpen: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "recharge",
    purchaseGuideReason: "",
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onShow() {
    const session = sessionStore.getState();
    if (!session) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    this.setData({ userName: session.user.nickname || "同学" });
    void this.load();
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
    this.clearPrivateFacePolling();
    this.setData({ loading: true, error: "" });
    try {
      const [data, profile, privateFaces] = await Promise.all([
        getHomeData(),
        getProfile(),
        getRecentPrivateCardFaces(6),
      ]);
      const promotions = (data.promotions ?? [])
        .filter((promotion) => promotion.cardPacks?.length)
        .map((promotion: Promotion) => ({
          key: promotion.id,
          title: promotion.name,
          subtitle: promotion.description || "精选学习内容",
          items: promotion.cardPacks.map(withProgress),
        }));
      const recentCards = (privateFaces.items ?? []).map(withCardPreview);
      this.setData({
        recentStudy: (data.recentStudy ?? []).map(withProgress),
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
        sections: promotions,
        profile,
        userName: profile.nickname || (this.data as any).userName,
        homeBackground: profile.currentTheme?.config?.home_bg || "",
      }, () => this.schedulePrivateFacePolling());
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

  openAi() {
    wx.navigateTo({ url: "/package-cards/pages/ai-generate/index" });
  },

  makeSimilar(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id ?? "");
    const card = (this.data.recentCards as HomeCardFace[]).find(
      (item) => item.id === id,
    );
    if (!card?.templateId) {
      wx.showToast({ title: "该卡面缺少模板信息", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(card.templateId)}`,
    });
  },

  openStudy() {
    const recent = (this.data as any).recentStudy as CardPackSummary[];
    const pack = recent[0];
    if (!pack) {
      wx.switchTab({ url: "/pages/resource/index" });
      return;
    }
    const isPrivate = Boolean(
      pack.author?.id && pack.author.id === sessionStore.getState()?.user.id,
    );
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(pack.id)}${
        isPrivate ? "&private=1" : ""
      }${
        pack.userStudyProgress?.lastStudiedCardId
          ? `&cardId=${encodeURIComponent(pack.userStudyProgress.lastStudiedCardId)}`
          : ""
      }`,
    });
  },

  startStudy(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const pack = ((this.data as any).recentStudy as HomeCardPack[]).find(
      (item) => item.id === id,
    );
    if (!pack) return;
    const isPrivate = Boolean(
      pack.author?.id && pack.author.id === sessionStore.getState()?.user.id,
    );
    wx.navigateTo({
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(pack.id)}${
        isPrivate ? "&private=1" : ""
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
      ...((this.data as any).recentStudy as CardPackSummary[]),
      ...((this.data as any).sections as HomeSection[]).flatMap((section) => section.items),
    ].find((item) => item.id === id);
    const currentUserId = sessionStore.getState()?.user.id;
    if (pack?.author?.id && pack.author.id === currentUserId) {
      wx.navigateTo({
        url: `/package-cards/pages/private-pack/index?id=${encodeURIComponent(id)}`,
      });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}`,
    });
  },

  openChallenge() {
    const challenge = (this.data as any).dailyChallenge as DailyChallenge | null;
    if (!challenge?.cards?.length) {
      wx.showToast({ title: "今日暂无挑战卡片", icon: "none" });
      return;
    }
    saveChallengeTransfer(challenge);
    wx.navigateTo({ url: "/package-cards/pages/study/index?challenge=1" });
  },

  openResources() {
    wx.switchTab({ url: "/pages/resource/index" });
  },

  openMyLearning() {
    wx.navigateTo({ url: "/package-cards/pages/my-learning/index" });
  },

  createPrivatePack() {
    wx.navigateTo({
      url: "/package-cards/pages/my-learning/index?mode=private&create=true",
    });
  },

  openMyCards() {
    wx.navigateTo({ url: "/package-cards/pages/my-generation/index" });
  },

  openLevel() {
    wx.navigateTo({ url: "/package-settings/pages/level-detail/index" });
  },

  openProfile() {
    wx.switchTab({ url: "/pages/profile/index" });
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
    this.setData({ coinHistoryOpen: false });
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: "小程序不提供充值，请在叩咔 AI App 中完成充值后继续使用。",
    });
  },

  closePurchaseGuide() {
    this.setData({ purchaseGuideOpen: false });
    wx.showTabBar({ animation: false });
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
    saveCardTransfer({
      front: { type: card.type, data: card.data! },
      title: card.name,
    });
    wx.navigateTo({ url: "/package-cards/pages/preview/index" });
  },
});
