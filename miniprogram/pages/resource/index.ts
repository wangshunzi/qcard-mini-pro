import {
  getDiscoveryCards,
  getDiscoveryData,
  searchCardPacks,
  type CardPackSummary,
  type DiscoveryCard,
  type Grade,
  type KnowledgePoint,
  type Subject,
} from "../../services/discovery";
import { getProfile } from "../../services/profile";
import { sessionStore } from "../../stores/session";
import { saveCardTransfer } from "../../stores/cardTransfer";
import { isMiniProgramCardType } from "../../config/cardTypes";
import { validateCardData } from "../../cards/CardTypeConfig";
import { UI_ASSETS } from "../../config/uiAssets";
import { getCardDetails, toCardData, unlockCardPack } from "../../services/cardPack";
import type { CardData } from "../../cards/types";
import { syncNavigationScroll } from "../../utils/navigationScroll";

interface DisplayDiscoveryCard extends DiscoveryCard {
  previewCard: CardData;
}

interface DisplayCardPack extends CardPackSummary {
  progressPercent: number;
  timeAgo: string;
  canStudy: boolean;
  displayPrice: number;
}

interface DisplayKnowledgePoint extends Omit<KnowledgePoint, "cardPacks"> {
  collapsed: boolean;
  cardPacks: DisplayCardPack[];
}

function formatTimeAgo(value?: string) {
  if (!value) return "未开始";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const hour = 60 * 60 * 1000;
  const day = hour * 24;
  if (elapsed < hour) return "刚刚学习";
  if (elapsed < day) return `${Math.floor(elapsed / hour)}小时前`;
  if (elapsed < 7 * day) return `${Math.floor(elapsed / day)}天前`;
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function toDisplayKnowledgePoints(
  items: KnowledgePoint[],
  collapsedState: Record<string, boolean> = {},
  isVip = false,
): DisplayKnowledgePoint[] {
  return (items ?? []).map((point) => ({
    ...point,
    collapsed: collapsedState[point.id] === true,
    cardPacks: (point.cardPacks ?? []).map((pack) => {
      const raw = Number(pack.userStudyProgress?.progress ?? 0);
      const progressPercent = Math.max(0, Math.min(100, raw <= 1 ? raw * 100 : raw));
      return {
        ...pack,
        progressPercent,
        timeAgo: formatTimeAgo(pack.userStudyProgress?.lastStudiedAt),
        canStudy: Boolean(
          pack.isUnlocked || (pack.unlockType === "vip_free" && isVip),
        ),
        displayPrice: Number(pack.priceInfo?.finalPrice ?? pack.basePrice ?? 0),
      };
    }),
  }));
}

function toDisplayDiscoveryCard(item: DiscoveryCard): DisplayDiscoveryCard {
  return {
    ...item,
    previewCard: {
      type: item.frontFace.type as CardData["type"],
      data: item.frontFace.data,
    },
  };
}

Page({
  data: {
    navScrollTop: 0,
    query: "",
    loading: true,
    loadingMore: false,
    error: "",
    grades: [] as Grade[],
    gradeIndex: 0,
    selectedGradeName: "选择年级",
    gradeDrawerOpen: false,
    subjects: [] as Subject[],
    subjectIndex: 0,
    knowledgePoints: [] as DisplayKnowledgePoint[],
    collapsedKnowledgePoints: {} as Record<string, boolean>,
    searching: false,
    searchItems: [] as CardPackSummary[],
    searchPage: 1,
    searchTotalPages: 1,
    mode: "cardpack" as "cardpack" | "preview",
    resourceBackground: "",
    previewItems: [] as DisplayDiscoveryCard[],
    previewPage: 1,
    previewTotalPages: 1,
    previewLoadingMore: false,
    unlockPanelOpen: false,
    selectedUnlockPack: {} as CardPackSummary,
    unlocking: false,
    userBalance: 0,
    isVip: false,
    purchaseGuideOpen: false,
    purchaseGuideMode: "vip",
    purchaseGuideReason: "",
    assets: UI_ASSETS,
  },
  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },
  onLoad() {
    if (sessionStore.getState()) void this.load();
  },
  onShow() {
    if (!sessionStore.getState()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }
    if ((this as any)._didShow) void this.load();
    else (this as any)._didShow = true;
  },
  onUnload() {
    const timer = (this as any)._searchTimer;
    if (timer) clearTimeout(timer);
    wx.showTabBar({ animation: false });
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    if ((this.data as any).mode === "preview") {
      void this.loadPreview(false);
    } else if ((this.data as any).searching) {
      void this.loadMoreSearch();
    }
  },
  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const [discovery, profile] = await Promise.all([
        getDiscoveryData(),
        getProfile(),
      ]);
      const grades = discovery.grades ?? [];
      const gradeIndex = Math.min(
        (this.data as any).gradeIndex,
        Math.max(0, grades.length - 1),
      );
      const subjects = grades[gradeIndex]?.subjects ?? [];
      const subjectIndex = Math.min(
        (this.data as any).subjectIndex,
        Math.max(0, subjects.length - 1),
      );
      this.setData({
        grades,
        gradeIndex,
        selectedGradeName: grades[gradeIndex]?.name || "选择年级",
        subjects,
        subjectIndex,
        knowledgePoints: toDisplayKnowledgePoints(
          subjects[subjectIndex]?.knowledgePoints ?? [],
          {},
          profile.vip?.isVip === true,
        ),
        collapsedKnowledgePoints: {},
        resourceBackground: profile.currentTheme?.config?.resource_bg || "",
        userBalance: Math.max(0, Number(profile.balance || 0)),
        isVip: profile.vip?.isVip === true,
      });
      if ((this.data as any).mode === "preview") await this.loadPreview(true);
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "资源加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },
  onInput(event: WechatMiniprogram.Input) {
    const query = event.detail.value.trimStart();
    this.setData({ query });
    const previous = (this as any)._searchTimer;
    if (previous) clearTimeout(previous);
    if ((this.data as any).mode === "preview") {
      (this as any)._searchTimer = setTimeout(() => void this.loadPreview(true), 350);
      return;
    }
    if (!query.trim()) {
      this.setData({
        searching: false,
        searchItems: [],
        searchPage: 1,
        searchTotalPages: 1,
      });
      return;
    }
    (this as any)._searchTimer = setTimeout(() => void this.runSearch(query.trim()), 350);
  },
  clearSearch() {
    const timer = (this as any)._searchTimer;
    if (timer) clearTimeout(timer);
    this.setData({
      query: "",
      searching: false,
      searchItems: [],
      searchPage: 1,
      searchTotalPages: 1,
    });
    if ((this.data as any).mode === "preview") void this.loadPreview(true);
  },
  async runSearch(keyword: string) {
    const sequence = Number((this as any)._searchSequence ?? 0) + 1;
    (this as any)._searchSequence = sequence;
    this.setData({ searching: true, loading: true, error: "" });
    try {
      const result = await searchCardPacks(keyword, 1, 12);
      if (
        (this as any)._searchSequence !== sequence ||
        (this.data as any).query.trim() !== keyword
      ) return;
      this.setData({
        searchItems: result.items ?? [],
        searchPage: result.page ?? 1,
        searchTotalPages: result.totalPages ?? 1,
      });
    } catch (error) {
      if ((this as any)._searchSequence === sequence) {
        this.setData({ error: error instanceof Error ? error.message : "搜索失败" });
      }
    } finally {
      if ((this as any)._searchSequence === sequence) this.setData({ loading: false });
    }
  },
  async loadMoreSearch() {
    const state = this.data as any;
    if (
      state.loadingMore ||
      state.searchPage >= state.searchTotalPages ||
      !state.query.trim()
    ) return;
    this.setData({ loadingMore: true });
    try {
      const nextPage = state.searchPage + 1;
      const result = await searchCardPacks(state.query.trim(), nextPage, 12);
      if ((this.data as any).query.trim() !== state.query.trim()) return;
      this.setData({
        searchItems: [...state.searchItems, ...(result.items ?? [])],
        searchPage: result.page ?? nextPage,
        searchTotalPages: result.totalPages ?? state.searchTotalPages,
      });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "加载失败", icon: "none" });
    } finally {
      this.setData({ loadingMore: false });
    }
  },
  openGradeDrawer() {
    this.setData({ gradeDrawerOpen: true });
  },

  closeGradeDrawer() {
    this.setData({ gradeDrawerOpen: false });
  },

  selectGrade(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const grades = (this.data as any).grades as Grade[];
    const id = String(event.detail.id || "");
    const index = grades.findIndex((grade) => grade.id === id);
    if (index < 0) return;
    const subjects = grades[index]?.subjects ?? [];
    this.setData({
      gradeIndex: index,
      selectedGradeName: grades[index]?.name || "选择年级",
      gradeDrawerOpen: false,
      subjects,
      subjectIndex: 0,
      knowledgePoints: toDisplayKnowledgePoints(
        subjects[0]?.knowledgePoints ?? [],
        {},
        (this.data as any).isVip,
      ),
      collapsedKnowledgePoints: {},
    });
    if ((this.data as any).mode === "preview") void this.loadPreview(true);
  },
  selectSubject(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    const subjects = (this.data as any).subjects as Subject[];
    this.setData({
      subjectIndex: index,
      knowledgePoints: toDisplayKnowledgePoints(
        subjects[index]?.knowledgePoints ?? [],
        {},
        (this.data as any).isVip,
      ),
      collapsedKnowledgePoints: {},
    });
  },
  openPack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) return;
    wx.navigateTo({ url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}` });
  },
  switchMode(event: WechatMiniprogram.TouchEvent) {
    const mode = String(event.currentTarget.dataset.mode) as "cardpack" | "preview";
    if (mode === (this.data as any).mode) return;
    this.setData({
      mode,
      query: "",
      searching: false,
      searchItems: [],
    });
    if (mode === "preview") void this.loadPreview(true);
  },

  toggleKnowledge(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    if (!id) return;
    const collapsed = {
      ...((this.data as any).collapsedKnowledgePoints as Record<string, boolean>),
    };
    collapsed[id] = !collapsed[id];
    const current = (this.data as any).knowledgePoints as DisplayKnowledgePoint[];
    this.setData({
      collapsedKnowledgePoints: collapsed,
      knowledgePoints: current.map((point) => (
        point.id === id ? { ...point, collapsed: collapsed[id] } : point
      )),
    });
  },

  startPack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    const points = (this.data as any).knowledgePoints as DisplayKnowledgePoint[];
    const pack = points.flatMap((point) => point.cardPacks).find((item) => item.id === id);
    if (!pack) return;
    if (!pack.canStudy) {
      if (pack.unlockType === "vip_free" && !(this.data as any).isVip) {
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
      url: `/package-cards/pages/study/index?packId=${encodeURIComponent(id)}${
        pack.userStudyProgress?.lastStudiedCardId
          ? `&cardId=${encodeURIComponent(pack.userStudyProgress.lastStudiedCardId)}`
          : ""
      }`,
    });
  },

  closeUnlockPanel() {
    if ((this.data as any).unlocking) return;
    this.setData({ unlockPanelOpen: false });
    wx.showTabBar({ animation: false });
  },

  openVipGuide() {
    wx.hideTabBar({ animation: false });
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "该卡包为 VIP 免费卡包，开通后即可学习。",
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
        : "当前咔豆余额不足，可选择咔豆包购买。",
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

  async confirmPackUnlock() {
    const pack = (this.data as any).selectedUnlockPack as CardPackSummary;
    if (!pack?.id || (this.data as any).unlocking) return;
    this.setData({ unlocking: true });
    try {
      const result = await unlockCardPack(pack.id);
      if (!result.success) throw new Error(result.message || "解锁失败，请稍后重试");
      this.setData({ unlockPanelOpen: false });
      wx.showTabBar({ animation: false });
      await this.load();
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
  async loadPreview(reset: boolean) {
    const state = this.data as any;
    if (
      !reset &&
      (state.previewLoadingMore || state.previewPage >= state.previewTotalPages)
    ) return;
    const page = reset ? 1 : state.previewPage + 1;
    this.setData(reset ? { loading: true, error: "" } : { previewLoadingMore: true });
    try {
      const grade = (state.grades as Grade[])[state.gradeIndex];
      const result = await getDiscoveryCards({
        gradeId: grade?.id,
        cardName: state.query.trim() || undefined,
        page,
        pageSize: 12,
      });
      const supported = (result.items ?? []).filter(
        (item) =>
          isMiniProgramCardType(item.frontFace.type) &&
          validateCardData(item.frontFace.type, item.frontFace.data),
      );
      const displayItems = supported.map(toDisplayDiscoveryCard);
      this.setData({
        previewItems: reset ? displayItems : [...state.previewItems, ...displayItems],
        previewPage: result.page ?? page,
        previewTotalPages: result.totalPages ?? page,
      });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "预览卡片加载失败" });
    } finally {
      this.setData({ loading: false, previewLoadingMore: false });
    }
  },
  async openPreview(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    const card = ((this.data as any).previewItems as DiscoveryCard[]).find(
      (item) => item.id === id,
    );
    if (!card) return;
    if (!isMiniProgramCardType(card.frontFace.type)) {
      wx.showToast({ title: "该卡片暂不支持小程序", icon: "none" });
      return;
    }
    wx.showLoading({ title: "加载卡片", mask: true });
    try {
      const [detail] = await getCardDetails(card.cardPack.id, [card.id]);
      const front =
        toCardData(detail?.frontFace) ??
        { type: card.frontFace.type, data: card.frontFace.data };
      const back = toCardData(detail?.backFace);
      if (!validateCardData(front.type, front.data)) {
        throw new Error("卡片数据不完整，无法预览");
      }
      saveCardTransfer({
        front,
        back: back && validateCardData(back.type, back.data) ? back : undefined,
        title: card.name,
        sourcePack: {
          id: card.cardPack.id,
          title: card.cardPack.title,
          cover: card.cardPack.cover,
          subjectName: card.cardPack.subject?.name,
          knowledgePointName: card.cardPack.knowledgePoint?.name,
          isUnlocked: card.cardPack.isUnlocked,
          basePrice: card.cardPack.basePrice,
          finalPrice: card.cardPack.priceInfo?.finalPrice,
        },
      });
      wx.navigateTo({ url: "/package-cards/pages/preview/index" });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "卡片加载失败",
        icon: "none",
      });
    } finally {
      wx.hideLoading();
    }
  },
});
