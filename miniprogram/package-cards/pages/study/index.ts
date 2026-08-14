import { validateCardData } from "../../../cards/CardTypeConfig";
import type { CardData } from "../../../cards/types";
import {
  getCardDetails,
  getCardPackCatalogue,
  getCardPackDetail,
  toCardData,
  unlockCardPack,
  type CardCatalogue,
  type CardPackDetail,
} from "../../../services/cardPack";
import {
  favoriteCard,
  getFavoriteCards,
  getProfile,
  unfavoriteCard,
} from "../../../services/profile";
import { readCardTransfer } from "../../services/cardTransfer";
import { readChallengeTransfer } from "../../../stores/challengeTransfer";
import { enqueueStudyReport } from "../../../stores/studyReportQueue";
import {
  getPrivateCardCatalogue,
  getPrivateCardDetails,
  getPrivateCardPack,
  recordPrivateCardStudy,
  toPrivateCardData,
} from "../../services/userContent";
import { getImmersiveNavigationMetrics } from "../../../utils/navigationMetrics";
import {
  markDataFresh,
  shouldRefreshData,
} from "../../../stores/dataInvalidation";
import { isAuthenticated, requireLogin } from "../../../utils/authGate";

const STUDY_ACCESS_DOMAINS = ["wallet"] as const;

interface StudyCard extends CardCatalogue {
  cardPackId?: string;
  front?: CardData;
  back?: CardData | null;
  loading?: boolean;
  loadError?: string;
  locked?: boolean;
  detailsLoaded?: boolean;
}

function isValidCard(card?: CardData): card is CardData {
  return !!card && validateCardData(card.type, card.data);
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return minutes > 0 ? `${minutes}分${rest}秒` : `${rest}秒`;
}

Page({
  data: {
    packId: "",
    pack: null as CardPackDetail | null,
    cards: [] as StudyCard[],
    activeIndex: 0,
    completed: {} as Record<number, boolean>,
    loading: true,
    error: "",
    previewOnly: false,
    completionVisible: false,
    studyDuration: "0秒",
    progressPercent: 0,
    progressLabel: "0.0",
    controlRowTop: 72,
    controlRowHeight: 32,
    unlocking: false,
    unlockPanelOpen: false,
    unlockProfileLoaded: false,
    userBalance: 0,
    isVip: false,
    accessGrantedByVip: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "vip",
    purchaseGuideReason: "",
    challengeMode: false,
    privateMode: false,
    favoriteMode: false,
    favoritePage: 1,
    favoriteTotalPages: 1,
    favoriteLoadingMore: false,
    favoriteActionLoading: false,
    emptyCardData: {},
    emptyCardPack: {},
  },

  onLoad(query: Record<string, string | undefined>) {
    markDataFresh(this as any, STUDY_ACCESS_DOMAINS);
    const { controlRowTop, controlRowHeight } =
      getImmersiveNavigationMetrics();
    this.setData({
      packId: String(query.packId ?? ""),
      previewOnly: query.preview === "1",
      challengeMode: query.challenge === "1",
      privateMode: query.private === "1",
      favoriteMode: query.favorite === "1",
      favoritePage: Math.max(1, Number(query.favoritePage) || 1),
      controlRowTop,
      controlRowHeight,
    });
    (this as any)._initialCardId = String(query.cardId ?? "");
    (this as any)._sessionStartedAt = Date.now();
    (this as any)._cardStartedAt = Date.now();
    (this as any)._trackingPaused = false;
    (this as any)._pageHidden = false;
    if (query.challenge === "1") {
      void this.loadChallenge();
    } else if (query.private === "1") {
      void this.loadPrivate();
    } else if (query.favorite === "1") {
      void this.loadFavoriteStudy();
    } else {
      void this.load();
    }
  },

  async loadUnlockProfile() {
    if (!isAuthenticated()) {
      this.setData({
        userBalance: 0,
        isVip: false,
        unlockProfileLoaded: false,
      });
      return;
    }
    try {
      const profile = await getProfile();
      this.setData({
        userBalance: Math.max(0, Number(profile.balance || 0)),
        isVip: profile.vip?.isVip === true,
        unlockProfileLoaded: true,
      });
    } catch {
      this.setData({ unlockProfileLoaded: false });
    }
  },

  async loadPrivate() {
    const packId = String((this.data as any).packId);
    if (!packId) {
      this.setData({ loading: false, error: "缺少专属卡包参数" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const [pack, catalogue] = await Promise.all([
        getPrivateCardPack(packId),
        getPrivateCardCatalogue(packId),
      ]);
      const cards: StudyCard[] = [...(catalogue ?? [])]
        .sort((left, right) => Number(left.sort || 0) - Number(right.sort || 0))
        .map((item, index) => {
          const front = toPrivateCardData(item.frontFace);
          return {
            id: item.id,
            name: item.name,
            sort: item.sort ?? index,
            isStudied: false,
            isPreview: true,
            frontFace: item.frontFace,
            front: isValidCard(front) ? front : undefined,
            detailsLoaded: false,
          };
        });
      const initialId = String((this as any)._initialCardId ?? "");
      const initialIndex = cards.findIndex((item) => item.id === initialId);
      const activeIndex = initialIndex >= 0 ? initialIndex : 0;
      this.setData({
        pack: {
          id: pack.id,
          title: pack.title,
          description: pack.description,
          cover: pack.cover,
          cardCount: cards.length,
          isUnlocked: true,
        },
        cards,
        activeIndex,
        loading: false,
        progressPercent: cards.length ? ((activeIndex + 1) / cards.length) * 100 : 0,
        progressLabel: cards.length ? (((activeIndex + 1) / cards.length) * 100).toFixed(1) : "0.0",
      });
      (this as any)._currentCardId = cards[activeIndex]?.id ?? "";
      (this as any)._currentCardPackId = packId;
      (this as any)._cardStartedAt = Date.now();
      await this.preloadAround(activeIndex);
    } catch (error) {
      this.setData({ loading: false, error: error instanceof Error ? error.message : "专属卡包加载失败" });
    }
  },

  async loadChallenge() {
    const challenge = readChallengeTransfer();
    if (!challenge?.cards?.length) {
      this.setData({ loading: false, error: "今日挑战数据已过期，请返回首页重试" });
      return;
    }
    const cards: StudyCard[] = challenge.cards.map((item, index) => {
      const front = toCardData(item.frontFace);
      return {
        id: item.id,
        name: item.name,
        sort: index,
        isStudied: item.isCompleted,
        isPreview: true,
        isFavorited: item.isFavorited,
        frontFace: item.frontFace,
        front: isValidCard(front) ? front : undefined,
        cardPackId: item.cardPack.id,
        detailsLoaded: false,
      };
    });
    const initialCardId = String((this as any)._initialCardId ?? "");
    const initialIndex = cards.findIndex((item) => item.id === initialCardId);
    const activeIndex = initialIndex >= 0 ? initialIndex : 0;
    const progressPercent = cards.length ? ((activeIndex + 1) / cards.length) * 100 : 0;
    this.setData({
      pack: {
        id: "",
        title: "今日挑战",
        cardCount: cards.length,
        isUnlocked: true,
      },
      cards,
      loading: false,
      activeIndex,
      progressPercent,
      progressLabel: progressPercent.toFixed(1),
    });
    (this as any)._currentCardId = cards[activeIndex]?.id ?? "";
    (this as any)._currentCardPackId = cards[activeIndex]?.cardPackId ?? "";
    (this as any)._cardStartedAt = Date.now();
    await this.preloadAround(activeIndex);
  },

  async loadFavoriteStudy() {
    const page = Math.max(1, Number((this.data as any).favoritePage) || 1);
    this.setData({ loading: true, error: "" });
    try {
      const result = await getFavoriteCards(page, 20);
      const cards: StudyCard[] = (result.items ?? []).map((item, index) => {
        const frontFace = {
          ...item.frontFace,
          id: item.frontFace.id || `${item.id}-front`,
          name: item.frontFace.name || item.name,
        };
        const front = toCardData(frontFace);
        return {
          id: item.id,
          name: item.name,
          sort: index,
          isStudied: false,
          isPreview: true,
          isFavorited: true,
          frontFace,
          front: isValidCard(front) ? front : undefined,
          cardPackId: item.cardPack.id,
          detailsLoaded: false,
        };
      });
      const initialCardId = String((this as any)._initialCardId ?? "");
      const initialIndex = cards.findIndex((item) => item.id === initialCardId);
      const activeIndex = initialIndex >= 0 ? initialIndex : 0;
      const progressPercent = cards.length
        ? ((activeIndex + 1) / cards.length) * 100
        : 0;
      this.setData({
        pack: {
          id: "",
          title: "收藏卡片",
          cardCount: Math.max(cards.length, Number(result.total) || 0),
          isUnlocked: true,
        },
        cards,
        activeIndex,
        favoritePage: Math.max(1, Number(result.page) || page),
        favoriteTotalPages: Math.max(1, Number(result.totalPages) || 1),
        loading: false,
        progressPercent,
        progressLabel: progressPercent.toFixed(1),
      });
      (this as any)._currentCardId = cards[activeIndex]?.id ?? "";
      (this as any)._currentCardPackId = cards[activeIndex]?.cardPackId ?? "";
      (this as any)._cardStartedAt = Date.now();
      await this.preloadAround(activeIndex);
      void this.loadMoreFavoriteStudyIfNeeded(activeIndex);
    } catch (error) {
      this.setData({
        loading: false,
        error: error instanceof Error ? error.message : "收藏卡片加载失败",
      });
    }
  },

  async loadMoreFavoriteStudyIfNeeded(index: number) {
    const state = this.data as any;
    const cards = state.cards as StudyCard[];
    if (
      !state.favoriteMode ||
      state.favoriteLoadingMore ||
      Number(state.favoritePage) >= Number(state.favoriteTotalPages) ||
      index < Math.max(0, cards.length - 3)
    ) return;
    this.setData({ favoriteLoadingMore: true });
    try {
      const nextPage = Number(state.favoritePage) + 1;
      const result = await getFavoriteCards(nextPage, 20);
      const existingIds = new Set(cards.map((item) => item.id));
      const appended: StudyCard[] = (result.items ?? [])
        .filter((item) => !existingIds.has(item.id))
        .map((item, offset) => {
          const frontFace = {
            ...item.frontFace,
            id: item.frontFace.id || `${item.id}-front`,
            name: item.frontFace.name || item.name,
          };
          const front = toCardData(frontFace);
          return {
            id: item.id,
            name: item.name,
            sort: cards.length + offset,
            isStudied: false,
            isPreview: true,
            isFavorited: true,
            frontFace,
            front: isValidCard(front) ? front : undefined,
            cardPackId: item.cardPack.id,
            detailsLoaded: false,
          };
        });
      this.setData({
        cards: [...cards, ...appended],
        favoritePage: Math.max(nextPage, Number(result.page) || nextPage),
        favoriteTotalPages: Math.max(1, Number(result.totalPages) || 1),
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "更多收藏加载失败",
        icon: "none",
      });
    } finally {
      this.setData({ favoriteLoadingMore: false });
    }
  },

  async load() {
    const packId = String((this.data as any).packId);
    if (!packId) {
      this.loadTransferredCard();
      return;
    }

    this.setData({ loading: true, error: "" });
    try {
      const [pack, catalogue, profile] = await Promise.all([
        getCardPackDetail(packId),
        getCardPackCatalogue(packId),
        getProfile().catch(() => null),
      ]);
      const isVip = profile?.vip?.isVip === true;
      const hasFullAccess = Boolean(
        pack.isUnlocked || (pack.unlockType === "vip_free" && isVip),
      );
      const effectivePack = hasFullAccess && !pack.isUnlocked
        ? { ...pack, isUnlocked: true }
        : pack;
      const sorted = [...(catalogue ?? [])].sort((a, b) => a.sort - b.sort);
      const cards: StudyCard[] = sorted.map((item) => ({
        ...item,
        front: toCardData(item.frontFace),
        locked: !hasFullAccess && !item.isPreview,
      }));
      const initialId = String((this as any)._initialCardId ?? "");
      const activeIndex = Math.max(0, cards.findIndex((item) => item.id === initialId));
      const resolvedIndex = activeIndex >= cards.length ? 0 : activeIndex;
      this.setData({
        pack: effectivePack,
        cards,
        userBalance: Math.max(0, Number(profile?.balance || 0)),
        isVip,
        accessGrantedByVip: hasFullAccess && !pack.isUnlocked,
        unlockProfileLoaded: Boolean(profile),
        activeIndex: resolvedIndex,
        progressPercent: cards.length ? ((resolvedIndex + 1) / cards.length) * 100 : 0,
        progressLabel: cards.length ? (((resolvedIndex + 1) / cards.length) * 100).toFixed(1) : "0.0",
      });
      (this as any)._currentCardId = cards[resolvedIndex]?.id ?? "";
      (this as any)._currentCardPackId =
        cards[resolvedIndex]?.cardPackId ?? packId;
      (this as any)._cardStartedAt = Date.now();
      wx.setNavigationBarTitle({ title: effectivePack.title || "开始学习" });
      await this.preloadAround(resolvedIndex);
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "获取卡片数据失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  retryLoad() {
    if ((this.data as any).challengeMode) {
      void this.loadChallenge();
    } else if ((this.data as any).privateMode) {
      void this.loadPrivate();
    } else if ((this.data as any).favoriteMode) {
      void this.loadFavoriteStudy();
    } else {
      void this.load();
    }
  },

  loadTransferredCard() {
    const payload = readCardTransfer();
    if (!payload || !isValidCard(payload.front)) {
      this.setData({ loading: false, error: "卡片参数无效或已过期" });
      return;
    }
    const card: StudyCard = {
      id: "transferred-card",
      name: payload.title || "卡片预览",
      sort: 0,
      isStudied: false,
      isPreview: true,
      frontFace: {
        id: "transferred-front",
        name: payload.title || "卡片",
        type: payload.front.type,
        data: payload.front.data,
      },
      front: payload.front,
      back: isValidCard(payload.back) ? payload.back : undefined,
    };
    this.setData({
      pack: {
        id: "",
        title: payload.title || "卡片学习",
        cardCount: 1,
        isUnlocked: true,
      },
      cards: [card],
      loading: false,
      progressPercent: 100,
      progressLabel: "100.0",
    });
  },

  async preloadAround(index: number) {
    const state = this.data as any;
    const cards = state.cards as StudyCard[];
    const indexes = [index - 1, index, index + 1].filter(
      (item) => item >= 0 && item < cards.length,
    );
    const pending = indexes
      .map((item) => cards[item])
      .filter((card) => !card.locked && !card.loading && !card.detailsLoaded && !card.loadError);
    if (!pending.length) return;

    const patch: Record<string, unknown> = {};
    pending.forEach((card) => {
      const cardIndex = cards.findIndex((item) => item.id === card.id);
      patch[`cards[${cardIndex}].loading`] = true;
    });
    this.setData(patch);

    try {
      if (state.privateMode) {
        const details = await getPrivateCardDetails(
          String(state.packId),
          pending.map((item) => item.id),
        );
        const detailMap = new Map(details.map((item) => [item.id, item]));
        const resultPatch: Record<string, unknown> = {};
        pending.forEach((card) => {
          const cardIndex = cards.findIndex((item) => item.id === card.id);
          const detail = detailMap.get(card.id);
          const front = toPrivateCardData(detail?.frontFace ?? card.frontFace);
          const back = toPrivateCardData(detail?.backFace);
          resultPatch[`cards[${cardIndex}].loading`] = false;
          resultPatch[`cards[${cardIndex}].detailsLoaded`] = true;
          if (!isValidCard(front)) {
            resultPatch[`cards[${cardIndex}].loadError`] = "卡片数据格式不受支持";
            return;
          }
          resultPatch[`cards[${cardIndex}].front`] = front;
          resultPatch[`cards[${cardIndex}].back`] = isValidCard(back) ? back : null;
        });
        this.setData(resultPatch);
        return;
      }

      const groups = new Map<string, StudyCard[]>();
      pending.forEach((card) => {
        const packId = String(card.cardPackId || state.packId);
        if (!packId) return;
        groups.set(packId, [...(groups.get(packId) ?? []), card]);
      });
      const details = (
        await Promise.all(
          Array.from(groups, ([packId, group]) =>
            getCardDetails(packId, group.map((item) => item.id)),
          ),
        )
      ).flat();
      const detailMap = new Map(details.map((item) => [item.id, item]));
      const resultPatch: Record<string, unknown> = {};
      pending.forEach((card) => {
        const cardIndex = cards.findIndex((item) => item.id === card.id);
        const detail = detailMap.get(card.id);
        const front = toCardData(detail?.frontFace);
        const back = toCardData(detail?.backFace);
        resultPatch[`cards[${cardIndex}].loading`] = false;
        resultPatch[`cards[${cardIndex}].detailsLoaded`] = true;
        if (!isValidCard(front)) {
          resultPatch[`cards[${cardIndex}].loadError`] = "卡片数据格式不受支持";
          return;
        }
        resultPatch[`cards[${cardIndex}].front`] = front;
        resultPatch[`cards[${cardIndex}].back`] = isValidCard(back) ? back : null;
      });
      this.setData(resultPatch);
    } catch (error) {
      const message = error instanceof Error ? error.message : "卡片加载失败";
      const errorPatch: Record<string, unknown> = {};
      pending.forEach((card) => {
        const cardIndex = cards.findIndex((item) => item.id === card.id);
        errorPatch[`cards[${cardIndex}].loading`] = false;
        errorPatch[`cards[${cardIndex}].loadError`] = message;
      });
      this.setData(errorPatch);
    }
  },

  onSlide(event: WechatMiniprogram.SwiperChange) {
    const previous = Number((this.data as any).activeIndex);
    const current = event.detail.current;
    (this.selectComponent(`#study-card-${previous}`) as any)?.pause?.();
    this.reportCurrentCard();
    this.setData({
      activeIndex: current,
      progressPercent: (current + 1) / Math.max(1, (this.data as any).cards.length) * 100,
      progressLabel: (((current + 1) / Math.max(1, (this.data as any).cards.length)) * 100).toFixed(1),
    });
    (this as any)._currentCardId = (this.data as any).cards[current]?.id ?? "";
    (this as any)._currentCardPackId =
      (this.data as any).cards[current]?.cardPackId ??
      (this.data as any).packId ??
      "";
    (this as any)._cardStartedAt = Date.now();
    setTimeout(() => {
      (this.selectComponent(`#study-card-${current}`) as any)?.showFront?.();
    }, 0);
    void this.preloadAround(current);
    void this.loadMoreFavoriteStudyIfNeeded(current);
  },

  onCardEvent(event: WechatMiniprogram.CustomEvent) {
    if (event.detail?.type === "complete") {
      const index = Number((this.data as any).activeIndex);
      this.setData({ [`completed.${index}`]: true });
    }
  },

  previous() {
    const current = Number((this.data as any).activeIndex);
    if (current > 0) this.setData({ activeIndex: current - 1 });
  },

  nextOrComplete() {
    const state = this.data as any;
    const current = Number(state.activeIndex);
    if (current < state.cards.length - 1) {
      this.setData({ activeIndex: current + 1 });
      return;
    }
    if (
      state.favoriteMode &&
      Number(state.favoritePage) < Number(state.favoriteTotalPages)
    ) {
      if (state.favoriteLoadingMore) {
        wx.showToast({ title: "正在加载更多收藏", icon: "none" });
      } else {
        void this.loadMoreFavoriteStudyIfNeeded(current).then(() => {
          if (Number((this.data as any).activeIndex) < (this.data as any).cards.length - 1) {
            this.setData({ activeIndex: Number((this.data as any).activeIndex) + 1 });
          }
        });
      }
      return;
    }
    this.reportCurrentCard();
    (this as any)._trackingPaused = true;
    this.setData({
      completionVisible: true,
      studyDuration: formatDuration((Date.now() - Number((this as any)._sessionStartedAt)) / 1000),
    });
  },

  flip() {
    const index = Number((this.data as any).activeIndex);
    (this.selectComponent(`#study-card-${index}`) as any)?.flip?.();
  },

  async toggleFavorite() {
    if (!(await requireLogin("favorite"))) return;
    const state = this.data as any;
    if (state.favoriteActionLoading || state.privateMode) return;
    const index = Number(state.activeIndex);
    const card = (state.cards as StudyCard[])[index];
    const cardPackId = String(card?.cardPackId || state.packId || "");
    if (!card?.id || !cardPackId) return;
    this.setData({ favoriteActionLoading: true });
    try {
      if (card.isFavorited) {
        this.reportCurrentCard();
        await unfavoriteCard(card.id);
        if (state.favoriteMode) {
          const cards = (state.cards as StudyCard[]).filter((item) => item.id !== card.id);
          const nextIndex = Math.min(index, Math.max(0, cards.length - 1));
          this.setData({
            cards,
            "pack.cardCount": Math.max(0, Number(state.pack?.cardCount || cards.length) - 1),
            activeIndex: nextIndex,
            progressPercent: cards.length ? ((nextIndex + 1) / cards.length) * 100 : 0,
            progressLabel: cards.length
              ? (((nextIndex + 1) / cards.length) * 100).toFixed(1)
              : "0.0",
          });
          (this as any)._currentCardId = cards[nextIndex]?.id ?? "";
          (this as any)._currentCardPackId = cards[nextIndex]?.cardPackId ?? "";
          void this.preloadAround(nextIndex);
        } else {
          this.setData({ [`cards[${index}].isFavorited`]: false });
        }
        wx.showToast({ title: "已取消收藏", icon: "success" });
      } else {
        await favoriteCard(card.id, cardPackId);
        this.setData({ [`cards[${index}].isFavorited`]: true });
        wx.showToast({ title: "已收藏", icon: "success" });
      }
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "收藏操作失败",
        icon: "none",
      });
    } finally {
      this.setData({ favoriteActionLoading: false });
    }
  },

  retryCard() {
    const index = Number((this.data as any).activeIndex);
    this.setData({
      [`cards[${index}].loadError`]: "",
      [`cards[${index}].back`]: null,
      [`cards[${index}].detailsLoaded`]: false,
    });
    void this.preloadAround(index);
  },

  restart() {
    (this.selectAllComponents(".study-card") as any[]).forEach((item) => item.reset?.());
    (this as any)._sessionStartedAt = Date.now();
    (this as any)._cardStartedAt = Date.now();
    (this as any)._trackingPaused = false;
    (this as any)._currentCardId = (this.data as any).cards[0]?.id ?? "";
    (this as any)._currentCardPackId =
      (this.data as any).cards[0]?.cardPackId ??
      (this.data as any).packId ??
      "";
    this.setData({
      activeIndex: 0,
      completionVisible: false,
      completed: {},
      progressPercent: (this.data as any).cards.length ? 100 / (this.data as any).cards.length : 0,
      progressLabel: (this.data as any).cards.length
        ? (100 / (this.data as any).cards.length).toFixed(1)
        : "0.0",
    });
    void this.preloadAround(0);
  },

  async exit() {
    const report = this.reportCurrentCard();
    (this as any)._trackingPaused = true;
    await Promise.race([
      Promise.resolve(report),
      new Promise<void>((resolve) => setTimeout(resolve, 1200)),
    ]);
    wx.navigateBack();
  },

  closeCompletion() {
    (this as any)._trackingPaused = false;
    (this as any)._cardStartedAt = Date.now();
    this.setData({ completionVisible: false });
  },

  async confirmUnlock() {
    const pack = (this.data as any).pack as CardPackDetail | null;
    if (!pack || (this.data as any).unlocking) return;
    if (!(await requireLogin("unlock"))) return;
    if (pack.unlockType === "vip_free" && !(this.data as any).isVip) {
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

  async openVipGuide() {
    if (!(await requireLogin("purchase"))) return;
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "该卡包为 VIP 免费卡包，开通后即可学习。",
    });
  },

  async openRechargeGuide(event?: WechatMiniprogram.CustomEvent<{ shortage?: number }>) {
    if (!(await requireLogin("purchase"))) return;
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
    await this.loadUnlockProfile();
    await this.refreshVipAccess();
  },

  async unlock() {
    if (!(await requireLogin("unlock"))) return;
    if ((this.data as any).unlocking) return;
    const packId = String((this.data as any).packId);
    this.setData({ unlocking: true });
    try {
      const result = await unlockCardPack(packId);
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

  reportCurrentCard() {
    if ((this as any)._trackingPaused) return;
    const state = this.data as any;
    const pack = state.pack as CardPackDetail | null;
    const cardId = String((this as any)._currentCardId ?? "");
    const cardPackId = String(
      (this as any)._currentCardPackId || state.packId || "",
    );
    if (state.privateMode) {
      if (cardPackId && cardId) {
        return recordPrivateCardStudy(cardPackId, cardId).then(
          () => undefined,
          () => undefined,
        );
      }
      return;
    }
    const currentCard = (state.cards as StudyCard[])[Number(state.activeIndex)];
    if (state.favoriteMode && (currentCard?.locked || currentCard?.loadError)) return;
    if (!cardPackId || (!pack?.isUnlocked && !state.challengeMode) || !cardId) return;
    const seconds = Math.max(1, (Date.now() - Number((this as any)._cardStartedAt)) / 1000);
    (this as any)._cardStartedAt = Date.now();
    return enqueueStudyReport(cardPackId, cardId, seconds);
  },

  onHide() {
    this.reportCurrentCard();
    (this as any)._pageHidden = true;
    (this.selectAllComponents(".study-card") as any[]).forEach((item) => item.pause?.());
  },

  onShow() {
    if (!(this as any)._pageHidden) return;
    (this as any)._pageHidden = false;
    if (!(this as any)._trackingPaused) {
      (this as any)._cardStartedAt = Date.now();
    }
    if (shouldRefreshData(this as any, STUDY_ACCESS_DOMAINS)) {
      void this.refreshVipAccess();
    }
  },

  async refreshVipAccess() {
    markDataFresh(this as any, STUDY_ACCESS_DOMAINS);
    const state = this.data as any;
    if (state.privateMode || state.challengeMode || state.favoriteMode || !state.packId) return;
    try {
      const profile = await getProfile();
      const isVip = profile.vip?.isVip === true;
      const shouldReload =
        isVip !== state.isVip &&
        (state.accessGrantedByVip || state.pack?.unlockType === "vip_free");
      this.setData({
        isVip,
        userBalance: Math.max(0, Number(profile.balance || 0)),
      });
      if (shouldReload) await this.load();
    } catch {
      // 保留当前学习会话，等待下一次回到前台时重新同步。
    }
  },

  onUnload() {
    if (!(this as any)._pageHidden) this.reportCurrentCard();
    (this.selectAllComponents(".study-card") as any[]).forEach((item) => item.pause?.());
  },

  noop() {},
});
