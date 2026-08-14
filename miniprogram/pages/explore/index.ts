import { isMiniProgramCardType } from "../../config/cardTypes";
import {
  getPublicCardFace,
  getPublicCardFaces,
  type PublicCardFaceSummary,
} from "../../services/exploration";
import type { CardTransferPayload } from "../../cards/cardTransfer";
import { sessionStore } from "../../stores/session";
import { getMiniProgramTemplates, type AiTemplate } from "../../services/ai";
import { getProfile } from "../../services/profile";
import { UI_ASSETS } from "../../config/uiAssets";
import { validateCardData } from "../../cards/CardTypeConfig";
import { syncNavigationScroll } from "../../utils/navigationScroll";
import {
  markDataFresh,
  shouldRefreshData,
} from "../../stores/dataInvalidation";
import { bindThemeBackgrounds } from "../../design-system/themeBackground";
import { isAuthenticated, requireLogin } from "../../utils/authGate";

const EXPLORE_CONTEXT_DOMAINS = ["account"] as const;

interface ExplorationFace extends PublicCardFaceSummary {
  previewCard?: {
    type: string;
    data: Record<string, unknown>;
  };
}

Page({
  data: {
    navScrollTop: 0,
    query: "",
    items: [] as ExplorationFace[],
    page: 1,
    totalPages: 1,
    loading: true,
    loadingMore: false,
    error: "",
    openingId: "",
    templates: [] as AiTemplate[],
    selectedTemplateId: "",
    selectedTemplateName: "全部",
    templateDrawerOpen: false,
    cardPreviewOpen: false,
    cardPreviewVisible: false,
    cardPreviewPayload: null as CardTransferPayload | null,
    exploreBackground: "",
    assets: UI_ASSETS,
    listeningBackground: UI_ASSETS.listeningStoryBackground,
    isGuest: true,
  },
  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },
  onLoad() {
    markDataFresh(this as any, EXPLORE_CONTEXT_DOMAINS);
    (this as any)._lastAuthenticated = isAuthenticated();
    this.setData({ isGuest: !isAuthenticated() });
    void this.loadContext();
    void this.load(true);
  },
  async loadContext() {
    try {
      const templates = await getMiniProgramTemplates();
      const profile = await getProfile().catch(() => null);
      if (profile) {
        bindThemeBackgrounds(this, profile.currentTheme?.config, {
          exploreBackground: "explore_bg",
        });
      }
      this.setData({
        templates,
        isGuest: !sessionStore.getState(),
      });
    } catch {
      // 列表仍可独立加载，辅助筛选或主题失败不阻断核心浏览。
    }
  },
  onShow() {
    const authenticated = isAuthenticated();
    const authenticationChanged =
      (this as any)._lastAuthenticated !== authenticated;
    (this as any)._lastAuthenticated = authenticated;
    this.setData({ isGuest: !authenticated });
    if (
      (this as any)._didShow && (
        authenticationChanged ||
        shouldRefreshData(this as any, EXPLORE_CONTEXT_DOMAINS)
      )
    ) {
      markDataFresh(this as any, EXPLORE_CONTEXT_DOMAINS);
      void this.loadContext();
    }
    (this as any)._didShow = true;
  },
  onUnload() {
    const timer = (this as any)._searchTimer;
    if (timer) clearTimeout(timer);
    wx.showTabBar({ animation: false });
  },
  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    void this.load(false);
  },
  onInput(event: WechatMiniprogram.Input) {
    const query = event.detail.value.trimStart();
    this.setData({ query });
    const previous = (this as any)._searchTimer;
    if (previous) clearTimeout(previous);
    (this as any)._searchTimer = setTimeout(() => void this.load(true), 350);
  },
  clearSearch() {
    const previous = (this as any)._searchTimer;
    if (previous) clearTimeout(previous);
    this.setData({ query: "" }, () => void this.load(true));
  },
  async load(reset: boolean) {
    const state = this.data as any;
    if (!reset && (state.loadingMore || state.page >= state.totalPages)) return;
    const page = reset ? 1 : state.page + 1;
    const sequence = Number((this as any)._loadSequence ?? 0) + 1;
    (this as any)._loadSequence = sequence;
    this.setData(reset
      ? { loading: true, error: "" }
      : { loadingMore: true });
    try {
      const result = await getPublicCardFaces({
        page,
        limit: 12,
        name: (this.data as any).query.trim(),
        templateId: (this.data as any).selectedTemplateId || undefined,
      });
      if ((this as any)._loadSequence !== sequence) return;
      const supported = (result.items ?? [])
        .filter(
          (item) =>
            isMiniProgramCardType(item.type) &&
            (item.schemaVersion ?? 1) <= 1 &&
            (!item.supportedPlatforms?.length ||
              item.supportedPlatforms.includes("wechat_miniprogram")),
        )
        .map((item): ExplorationFace => ({
          ...item,
          previewCard:
            item.data && validateCardData(item.type, item.data)
              ? { type: item.type, data: item.data }
              : undefined,
        }));
      this.setData({
        items: reset ? supported : [...state.items, ...supported],
        page: result.page ?? page,
        totalPages: result.totalPages ?? page,
      });
    } catch (error) {
      if ((this as any)._loadSequence === sequence) {
        this.setData({ error: error instanceof Error ? error.message : "探索内容加载失败" });
      }
    } finally {
      if ((this as any)._loadSequence === sequence) {
        this.setData({ loading: false, loadingMore: false });
      }
    }
  },
  openTemplateDrawer() {
    this.setData({ templateDrawerOpen: true });
  },

  closeTemplateDrawer() {
    this.setData({ templateDrawerOpen: false });
  },

  selectTemplate(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id ?? "");
    const templates = (this.data as any).templates as AiTemplate[];
    const template = templates.find((item) => String(item.id) === id);
    this.setData(
      {
        selectedTemplateId: template?.id || "",
        selectedTemplateName: template?.name || "全部",
        templateDrawerOpen: false,
      },
      () => void this.load(true),
    );
  },
  async openMyCards() {
    if (!(await requireLogin("profile"))) return;
    wx.navigateTo({ url: "/package-cards/pages/my-generation/index" });
  },
  async makeSimilar(event: WechatMiniprogram.TouchEvent) {
    const templateId = String(event.currentTarget.dataset.templateId ?? "");
    const genParams = event.currentTarget.dataset.genParams as
      | Record<string, unknown>
      | undefined;
    if (!templateId) {
      wx.showToast({ title: "该卡面暂不支持做同款", icon: "none" });
      return;
    }
    if (!(await requireLogin("generate"))) return;
    wx.navigateTo({
      url:
        `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(templateId)}` +
        (genParams
          ? `&genParams=${encodeURIComponent(JSON.stringify(genParams))}`
          : ""),
    });
  },
  async openCard(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id || (this.data as any).openingId) return;
    this.setData({ openingId: id });
    wx.showLoading({ title: "加载卡片", mask: true });
    try {
      const face = await getPublicCardFace(id);
      if (!isMiniProgramCardType(face.type)) throw new Error("该卡片暂不支持小程序");
      if ((face.schemaVersion ?? 1) > 1) throw new Error("请升级小程序后查看此卡片");
      if (
        face.supportedPlatforms?.length &&
        !face.supportedPlatforms.includes("wechat_miniprogram")
      ) throw new Error("该卡片暂不支持小程序");
      const payload: CardTransferPayload = {
        front: {
          type: face.type,
          data: face.data,
          schemaVersion: face.schemaVersion,
        },
        title: face.name,
        templateId: face.templateId,
        genParams: face.genParams,
      };
      this.setData({ cardPreviewOpen: true, cardPreviewPayload: payload });
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "卡片加载失败", icon: "none" });
    } finally {
      wx.hideLoading();
      this.setData({ openingId: "" });
    }
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
});
