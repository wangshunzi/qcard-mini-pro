import { isSupportedCardType, validateCardData } from "../../../cards/CardTypeConfig";
import type { CardData } from "../../../cards/types";
import {
  generateCard,
  getMiniProgramSchemaIssues,
  getMiniProgramTemplateDetails,
  getMiniProgramTemplates,
  type AiTemplate,
} from "../../../services/ai";
import { getProfile } from "../../../services/profile";
import {
  markDataFresh,
  shouldRefreshData,
} from "../../../stores/dataInvalidation";

const AI_ACCESS_DOMAINS = ["account", "wallet"] as const;
import { getImmersiveNavigationMetrics } from "../../../utils/navigationMetrics";
import { createRequestId } from "../../../utils/requestId";
import { initializeFormData } from "../../../components/schema-form/runtime";
import { computeAiGenerateLayout } from "./layout";

type TemplateView = AiTemplate & {
  previewCard: CardData | null;
  detailLoaded: boolean;
  detailError: string;
};

function parseRouteParams(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function supportedDetail(detail: AiTemplate) {
  if (!isSupportedCardType(detail.type)) return "该模板暂不支持小程序";
  if ((detail.schemaVersion ?? 1) > 1) return "模板版本高于当前小程序支持版本";
  const issues = getMiniProgramSchemaIssues(detail.params);
  if (!issues.length) return "";
  const issue = issues[0];
  return `字段“${issue.title || issue.field}”：${issue.reason}`;
}

function previewCardOf(detail: AiTemplate): CardData | null {
  if (!detail.exampleData || !validateCardData(detail.type, detail.exampleData)) return null;
  return {
    type: detail.type,
    data: detail.exampleData,
    schemaVersion: detail.schemaVersion,
  } as CardData;
}

Page({
  data: {
    loading: true,
    loadError: "",
    empty: false,
    submitting: false,
    templates: [] as TemplateView[],
    selectedIndex: 0,
    selectedId: "",
    currentSummary: null as TemplateView | null,
    template: null as AiTemplate | null,
    templateLoading: false,
    templateError: "",
    formData: {} as Record<string, unknown>,
    valid: false,
    applyFormDefaults: true,
    stepIndex: 0 as 0 | 1,
    viewMode: "carousel" as "carousel" | "grid",
    gridScrollIntoView: "",
    previewOpen: false,
    previewTemplate: null as TemplateView | null,
    userBalance: 0,
    isVip: false,
    canAfford: true,
    vipBlocked: false,
    needBalance: 0,
    carouselHeight: 560,
    carouselSideMargin: 46,
    contentHeight: 560,
    bottomBarHeight: 96,
    pageBackground: "",
    purchaseGuideOpen: false,
    purchaseGuideMode: "vip",
    purchaseGuideReason: "",
  },

  onLoad(options: Record<string, string>) {
    (this as any)._initialTemplateId = String(options.templateId || "");
    (this as any)._defaultGenParams = parseRouteParams(options.genParams);
    (this as any)._details = {} as Record<string, AiTemplate>;
    (this as any)._loadingIds = new Set<string>();
    this.calculateLayout();
    void this.loadTemplates();
  },

  onShow() {
    if (
      (this as any)._didShow &&
      shouldRefreshData(this as any, AI_ACCESS_DOMAINS)
    ) void this.refreshProfileAccess();
    else (this as any)._didShow = true;
  },

  async refreshProfileAccess() {
    markDataFresh(this as any, AI_ACCESS_DOMAINS);
    try {
      const profile = await getProfile();
      this.setData({
        userBalance: Number(profile.balance || 0),
        isVip: profile.vip?.isVip === true,
        pageBackground: profile.currentTheme?.config?.gen_bg || "",
      });
      this.updateAccessState();
    } catch {
      // 保留最近一次权益快照，下一次回到前台继续同步。
    }
  },

  calculateLayout() {
    const windowInfo = wx.getWindowInfo();
    const { statusBarHeight, navigationHeight } =
      getImmersiveNavigationMetrics();
    const safeInsetBottom = windowInfo.safeArea
      ? Math.max(0, windowInfo.windowHeight - windowInfo.safeArea.bottom)
      : 0;
    const layout = computeAiGenerateLayout({
      windowWidth: windowInfo.windowWidth,
      windowHeight: windowInfo.windowHeight,
      statusBarHeight,
      navigationHeight,
      safeInsetBottom,
    });
    this.setData(layout);
  },

  onResize() {
    this.calculateLayout();
  },

  async loadTemplates() {
    markDataFresh(this as any, AI_ACCESS_DOMAINS);
    this.setData({ loading: true, loadError: "" });
    try {
      const [compact, profile] = await Promise.all([
        getMiniProgramTemplates(),
        getProfile(),
      ]);
      const supported = compact.filter(
        (item) =>
          isSupportedCardType(item.type) &&
          (item.schemaVersion ?? 1) <= 1 &&
          (item.supportedPlatforms?.includes("wechat_miniprogram") ?? true),
      );
      const templates: TemplateView[] = supported.map((item) => ({
        ...item,
        previewCard: null,
        detailLoaded: false,
        detailError: "",
      }));
      const initialIndex = Math.max(
        0,
        templates.findIndex(
          (item) => item.id === String((this as any)._initialTemplateId || ""),
        ),
      );
      const currentSummary = templates[initialIndex] ?? null;
      this.setData({
        templates,
        loading: false,
        selectedIndex: initialIndex,
        selectedId: currentSummary?.id ?? "",
        currentSummary,
        userBalance: Number(profile.balance || 0),
        isVip: profile.vip?.isVip === true,
        pageBackground: profile.currentTheme?.config?.gen_bg || "",
        loadError: "",
        empty: templates.length === 0,
      });
      this.updateAccessState();
      if (templates.length) {
        await this.loadDetailsAround(initialIndex);
      }
    } catch (error) {
      this.setData({
        loading: false,
        empty: false,
        loadError: error instanceof Error ? error.message : "加载模板失败，请稍后重试",
      });
    }
  },

  retryLoad() {
    void this.loadTemplates();
  },

  async ensureDetails(indices: number[]) {
    const templates = (this.data as any).templates as TemplateView[];
    const details = (this as any)._details as Record<string, AiTemplate>;
    const loadingIds = (this as any)._loadingIds as Set<string>;
    const summaries = [...new Set(indices)]
      .filter((index) => index >= 0 && index < templates.length)
      .map((index) => templates[index])
      .filter((item) => !details[item.id] && !loadingIds.has(item.id));
    if (!summaries.length) {
      this.applyCurrentDetail();
      return;
    }
    summaries.forEach((item) => loadingIds.add(item.id));
    if (summaries.some((item) => item.id === this.data.selectedId)) {
      this.setData({ templateLoading: true, templateError: "" });
    }
    try {
      const loaded = await getMiniProgramTemplateDetails(summaries.map((item) => item.id));
      const loadedIds = new Set(loaded.map((detail) => detail.id));
      loaded.forEach((detail) => {
        const compact = templates.find((item) => item.id === detail.id);
        details[detail.id] = {
          ...detail,
          vipRequired: detail.vipRequired ?? compact?.vipRequired,
          description: detail.description ?? compact?.description,
        };
      });
      const nextTemplates = templates.map((item) => {
        const detail = details[item.id];
        if (!detail) {
          return summaries.some((summary) => summary.id === item.id) && !loadedIds.has(item.id)
            ? { ...item, detailLoaded: true, detailError: "模板已下线或当前端不可用" }
            : item;
        }
        const error = supportedDetail(detail);
        if (error) {
          console.warn("[AI Schema] 小程序模板不兼容", {
            templateId: detail.id,
            templateName: detail.name,
            error,
          });
        }
        return {
          ...item,
          vipRequired: detail.vipRequired ?? item.vipRequired,
          previewCard: error ? null : previewCardOf(detail),
          detailLoaded: true,
          detailError: error,
        };
      });
      this.setData({ templates: nextTemplates });
    } catch (error) {
      const message = error instanceof Error ? error.message : "模板详情加载失败";
      const requested = new Set(summaries.map((item) => item.id));
      this.setData({
        templates: templates.map((item) =>
          requested.has(item.id)
            ? { ...item, detailLoaded: true, detailError: message }
            : item,
        ),
      });
    } finally {
      summaries.forEach((item) => loadingIds.delete(item.id));
      this.applyCurrentDetail();
    }
  },

  loadDetailsAround(index: number) {
    const count = (this.data.templates as TemplateView[]).length;
    return this.ensureDetails([
      index,
      index - 1,
      index + 1,
      index === 0 ? count - 1 : -1,
      index === count - 1 ? 0 : -1,
    ]);
  },

  applyCurrentDetail() {
    const current = (this.data.templates as TemplateView[])[this.data.selectedIndex];
    if (!current || current.id !== this.data.selectedId) return;
    const detail = ((this as any)._details as Record<string, AiTemplate>)[current.id];
    this.setData(
      {
        currentSummary: current,
        template: detail && !current.detailError ? detail : null,
        templateLoading: !current.detailLoaded,
        templateError: current.detailError,
      },
      () => {
        this.updateAccessState();
        setTimeout(() => this.maybeAutoOpenForm(), 0);
      },
    );
  },

  updateAccessState() {
    const summary = this.data.currentSummary as TemplateView | null;
    const price = Number(summary?.price || 0);
    const balance = Number(this.data.userBalance || 0);
    this.setData({
      canAfford: !summary || balance >= price,
      vipBlocked: Boolean(summary?.vipRequired && !this.data.isVip),
      needBalance: Math.max(0, price - balance),
    });
  },

  onSwiperChange(event: WechatMiniprogram.SwiperChange) {
    const index = Number(event.detail.current);
    void this.selectIndex(index);
  },

  selectIndex(index: number) {
    const templates = this.data.templates as TemplateView[];
    const currentSummary = templates[index];
    if (!currentSummary || index === this.data.selectedIndex) {
      return Promise.resolve();
    }
    this.setData({
      selectedIndex: index,
      selectedId: currentSummary.id,
      currentSummary,
      template: null,
      templateLoading: !currentSummary.detailLoaded,
      templateError: currentSummary.detailError,
      formData: {},
      valid: false,
      applyFormDefaults: true,
    });
    this.updateAccessState();
    return this.loadDetailsAround(index);
  },

  async chooseGridTemplate(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index)) return;
    if (index !== this.data.selectedIndex) await this.selectIndex(index);
    else await this.ensureDetails([index]);
    const item = (this.data.templates as TemplateView[])[index];
    if (!item?.previewCard) {
      wx.showToast({ title: item?.detailError || "暂无预览", icon: "none" });
      return;
    }
    this.setData({
      previewOpen: true,
      previewTemplate: item,
      gridScrollIntoView: `template-grid-${index}`,
    });
  },

  closePreview() {
    this.setData({ previewOpen: false, previewTemplate: null });
  },

  noop() {
    // Prevent taps inside the preview dialog from closing the overlay.
  },

  previewNext() {
    this.closePreview();
    this.nextStep();
  },

  switchViewMode(event: WechatMiniprogram.TouchEvent) {
    const viewMode = String(event.currentTarget.dataset.mode) as "carousel" | "grid";
    if (viewMode === this.data.viewMode || !["carousel", "grid"].includes(viewMode)) return;
    this.setData({
      viewMode,
      gridScrollIntoView:
        viewMode === "grid" ? `template-grid-${this.data.selectedIndex}` : "",
    });
    if (viewMode === "grid") {
      void this.ensureDetails((this.data.templates as TemplateView[]).map((_, index) => index));
    }
  },

  maybeAutoOpenForm() {
    if (
      (this as any)._autoOpened ||
      !(this as any)._defaultGenParams ||
      !this.data.template ||
      this.data.vipBlocked ||
      !this.data.canAfford
    ) return;
    (this as any)._autoOpened = true;
    this.setData({
      formData: (this as any)._defaultGenParams,
      stepIndex: 1,
      valid: false,
      applyFormDefaults: true,
    });
  },

  nextStep() {
    if (this.data.templateLoading) return;
    if (this.data.templateError || !this.data.template) {
      wx.showToast({ title: this.data.templateError || "模板暂不可用", icon: "none" });
      return;
    }
    if (this.data.vipBlocked) {
      this.openVipGuide();
      return;
    }
    if (!this.data.canAfford) {
      this.openRechargeGuide();
      return;
    }
    this.setData({ stepIndex: 1 });
  },

  previousStep() {
    if (this.data.submitting) return;
    (this as any)._defaultGenParams = undefined;
    const template = this.data.template as AiTemplate | null;
    this.setData({
      stepIndex: 0,
      formData: template
        ? initializeFormData(template.params as any, {})
        : {},
      valid: false,
      applyFormDefaults: true,
    });
  },

  onNavBack() {
    if (this.data.stepIndex === 1) {
      this.previousStep();
      return;
    }
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.switchTab({ url: "/pages/home/index" });
  },

  openVipGuide() {
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "vip",
      purchaseGuideReason: "该模板为 VIP 专属模板，开通后即可使用。",
    });
  },

  openRechargeGuide() {
    this.setData({
      purchaseGuideOpen: true,
      purchaseGuideMode: "recharge",
      purchaseGuideReason: `余额不足，还需要 ${this.data.needBalance} 咔豆。`,
    });
  },

  closePurchaseGuide() {
    this.setData({ purchaseGuideOpen: false });
  },

  async onVirtualPaymentFulfilled() {
    this.setData({ purchaseGuideOpen: false });
    await this.refreshProfileAccess();
  },

  retryTemplate() {
    void this.ensureDetails([this.data.selectedIndex]);
  },

  onFormChange(event: WechatMiniprogram.CustomEvent) {
    this.setData({
      formData: event.detail.value,
      valid: event.detail.valid,
      applyFormDefaults: false,
    });
  },

  generate() {
    const template = this.data.template as AiTemplate | null;
    if (!template || this.data.submitting) return;
    const result = (this.selectComponent("#form") as any)?.getValue?.();
    if (!result?.valid) {
      wx.showToast({ title: "请填写所有必填项", icon: "none" });
      return;
    }
    if (this.data.vipBlocked) {
      this.openVipGuide();
      return;
    }
    if (!this.data.canAfford) {
      this.openRechargeGuide();
      return;
    }
    void this.submitGeneration(result.value);
  },

  async submitGeneration(params: Record<string, unknown>) {
    const template = this.data.template as AiTemplate;
    this.setData({ submitting: true });
    try {
      const generation = await generateCard(template.id, params, createRequestId());
      if (!generation?.taskId) throw new Error("生成任务创建失败");
      const profile = await getProfile().catch(() => null);
      if (profile) {
        this.setData({
          userBalance: Number(profile.balance || 0),
          isVip: profile.vip?.isVip === true,
        });
        this.updateAccessState();
      }
      wx.showModal({
        title: "提交成功",
        content: "AI卡面生成任务已提交，返回后卡片列表将自动刷新",
        cancelText: "返回",
        confirmText: "继续生成",
        confirmColor: "#529917",
        success: ({ confirm }) => {
          if (confirm) {
            this.setData({
              stepIndex: 1,
              formData: {},
              valid: false,
              applyFormDefaults: false,
            });
          } else {
            const pages = getCurrentPages();
            if (pages.length > 1) wx.navigateBack();
            else wx.switchTab({ url: "/pages/profile/index" });
          }
        },
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "提交生成任务失败，请稍后重试",
        icon: "none",
        duration: 2800,
      });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
