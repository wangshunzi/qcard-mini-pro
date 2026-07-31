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
import { getProfile } from "../../../services/profile";
import { readCardTransfer } from "../../../stores/cardTransfer";
import { readChallengeTransfer } from "../../../stores/challengeTransfer";
import { enqueueStudyReport } from "../../../stores/studyReportQueue";
import {
  getPrivateCardCatalogue,
  getPrivateCardDetails,
  getPrivateCardPack,
  recordPrivateCardStudy,
  toPrivateCardData,
} from "../../../services/userContent";
import { getImmersiveNavigationMetrics } from "../../../utils/navigationMetrics";

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
    emptyCardData: {},
    emptyCardPack: {},
  },

  onLoad(query: Record<string, string | undefined>) {
    const { controlRowTop } = getImmersiveNavigationMetrics();
    this.setData({
      packId: String(query.packId ?? ""),
      previewOnly: query.preview === "1",
      challengeMode: query.challenge === "1",
      privateMode: query.private === "1",
      controlRowTop,
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
    } else {
      void this.load();
    }
  },

  async loadUnlockProfile() {
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
        isFavorited: false,
        frontFace: item.frontFace,
        front: isValidCard(front) ? front : undefined,
        cardPackId: item.cardPack.id,
        detailsLoaded: false,
      };
    });
    this.setData({
      pack: {
        id: "",
        title: "今日挑战",
        cardCount: cards.length,
        isUnlocked: true,
      },
      cards,
      loading: false,
      activeIndex: 0,
      progressPercent: cards.length ? 100 / cards.length : 0,
      progressLabel: cards.length ? (100 / cards.length).toFixed(1) : "0.0",
    });
    (this as any)._currentCardId = cards[0]?.id ?? "";
    (this as any)._currentCardPackId = cards[0]?.cardPackId ?? "";
    (this as any)._cardStartedAt = Date.now();
    await this.preloadAround(0);
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

  exit() {
    wx.navigateBack();
  },

  closeCompletion() {
    (this as any)._trackingPaused = false;
    (this as any)._cardStartedAt = Date.now();
    this.setData({ completionVisible: false });
  },

  confirmUnlock() {
    const pack = (this.data as any).pack as CardPackDetail | null;
    if (!pack || (this.data as any).unlocking) return;
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

  openVipGuide() {
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "该卡包为 VIP 免费卡包，请在叩咔 AI App 中开通 VIP 后学习。",
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
        : "当前咔豆余额不足，请在叩咔 AI App 中充值。",
    });
  },
  closePurchaseGuide() {
    this.setData({ purchaseGuideOpen: false });
  },

  async unlock() {
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
        void recordPrivateCardStudy(cardPackId, cardId).catch(() => undefined);
      }
      return;
    }
    if (!cardPackId || (!pack?.isUnlocked && !state.challengeMode) || !cardId) return;
    const seconds = Math.max(1, (Date.now() - Number((this as any)._cardStartedAt)) / 1000);
    (this as any)._cardStartedAt = Date.now();
    enqueueStudyReport(cardPackId, cardId, seconds);
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
    void this.refreshVipAccess();
  },

  async refreshVipAccess() {
    const state = this.data as any;
    if (state.privateMode || state.challengeMode || !state.packId) return;
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
