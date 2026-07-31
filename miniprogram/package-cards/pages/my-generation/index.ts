import { validateCardData } from "../../../cards/CardTypeConfig";
import { CARD_TYPE_LABELS, isMiniProgramCardType } from "../../../config/cardTypes";
import { UI_ASSETS } from "../../../config/uiAssets";
import type { PrivateCardFace } from "../../../services/profile";
import { deletePrivateCardFace, getPrivateCardFaces } from "../../../services/userContent";
import { toPrivateCardData } from "../../../services/userContent";
import { getProfile } from "../../../services/profile";
import { saveCardTransfer } from "../../../stores/cardTransfer";
import type { CardData } from "../../../cards/types";
import { syncNavigationScroll } from "../../../utils/navigationScroll";

interface DisplayCardFace extends PrivateCardFace {
  cardData: CardData | null;
  canPreview: boolean;
}

const PRIVATE_FACE_POLL_MS = 3000;

function hasGeneratingFaces(faces: PrivateCardFace[]) {
  return faces.some(
    (face) => face.status === "pending" || face.status === "processing",
  );
}

function toDisplayCardFace(item: PrivateCardFace): DisplayCardFace {
  const cardData = toPrivateCardData(item) ?? null;
  return {
    ...item,
    cardData,
    canPreview:
      item.status === "success" &&
      !!cardData &&
      isMiniProgramCardType(item.type) &&
      validateCardData(item.type, item.data),
  };
}

Page({
  data: {
    navScrollTop: 0,
    query: "",
    type: "",
    typeLabel: "全部类型",
    items: [] as DisplayCardFace[],
    emptyCardData: {},
    page: 1,
    totalPages: 1,
    loading: true,
    loadingMore: false,
    error: "",
    assets: UI_ASSETS,
    heroBackground: "",
    editMode: false,
    deletingId: "",
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onLoad() {
    void this.load(true);
    void getProfile()
      .then((profile) => {
        this.setData({ heroBackground: profile.currentTheme?.config?.explore_bg || "" });
      })
      .catch(() => undefined);
  },

  onShow() {
    if ((this as any)._didShow) {
      void this.refreshPrivateFaces(true);
    } else {
      (this as any)._didShow = true;
    }
  },

  onHide() {
    this.clearPrivateFacePolling();
  },

  onUnload() {
    this.clearPrivateFacePolling();
  },

  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    void this.load(false);
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ query: event.detail.value.trimStart() });
    const previous = (this as any)._timer;
    if (previous) clearTimeout(previous);
    (this as any)._timer = setTimeout(() => void this.load(true), 350);
  },

  chooseType() {
    const types = Object.keys(CARD_TYPE_LABELS);
    const labels = ["全部类型", ...types.map((type) => CARD_TYPE_LABELS[type])];
    wx.showActionSheet({
      itemList: labels,
      success: ({ tapIndex }) => {
        this.setData({
          type: tapIndex === 0 ? "" : types[tapIndex - 1],
          typeLabel: labels[tapIndex],
        }, () => void this.load(true));
      },
    });
  },

  async load(reset: boolean) {
    if (!reset && (this.data.loadingMore || this.data.page >= this.data.totalPages)) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true });
    try {
      const result = await getPrivateCardFaces({
        page,
        limit: 24,
        name: this.data.query.trim(),
        type: this.data.type,
      });
      const items = reset
        ? (result.items ?? []).map(toDisplayCardFace)
        : [...this.data.items, ...(result.items ?? []).map(toDisplayCardFace)];
      this.setData({
        items,
        page: result.page ?? page,
        totalPages: result.totalPages ?? page,
      }, () => this.schedulePrivateFacePolling());
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "卡面加载失败" });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  clearPrivateFacePolling() {
    const timer = (this as any)._privateFacePollTimer;
    if (timer) clearTimeout(timer);
    (this as any)._privateFacePollTimer = undefined;
  },

  schedulePrivateFacePolling() {
    this.clearPrivateFacePolling();
    if (!hasGeneratingFaces(this.data.items)) return;
    (this as any)._privateFacePollTimer = setTimeout(
      () => void this.refreshPrivateFaces(false),
      PRIVATE_FACE_POLL_MS,
    );
  },

  async refreshPrivateFaces(includeNew: boolean) {
    if ((this as any)._privateFacePollBusy) return;
    if (!includeNew && !hasGeneratingFaces(this.data.items)) return;
    (this as any)._privateFacePollBusy = true;
    try {
      const result = await getPrivateCardFaces({
        page: 1,
        limit: 24,
        name: this.data.query.trim(),
        type: this.data.type,
      });
      const incoming = (result.items ?? []).map(toDisplayCardFace);
      const incomingById = new Map(incoming.map((item) => [item.id, item]));
      const existingIds = new Set(this.data.items.map((item) => item.id));
      const newItems = includeNew
        ? incoming.filter((item) => !existingIds.has(item.id))
        : [];
      const items = [
        ...newItems,
        ...this.data.items.map((item) => incomingById.get(item.id) ?? item),
      ];
      this.setData({ items }, () => this.schedulePrivateFacePolling());
    } catch {
      this.schedulePrivateFacePolling();
    } finally {
      (this as any)._privateFacePollBusy = false;
    }
  },

  openAi() {
    wx.navigateTo({ url: "/package-cards/pages/ai-generate/index" });
  },

  openGroupCard() {
    wx.navigateTo({ url: "/package-cards/pages/generate/index" });
  },

  toggleEditMode() {
    this.setData({ editMode: !this.data.editMode });
  },

  makeSimilar(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id || "");
    const card = this.data.items.find((item) => item.id === id);
    if (!card?.templateId) {
      wx.showToast({ title: "该卡面缺少模板信息", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/ai-generate/index?templateId=${encodeURIComponent(card.templateId)}`,
    });
  },

  deleteCard(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id || "");
    const card = this.data.items.find((item) => item.id === id);
    if (!card || this.data.deletingId) return;
    wx.showModal({
      title: "删除卡面",
      content: `确认删除“${card.name || "该卡面"}”？删除后无法恢复。`,
      confirmText: "删除",
      confirmColor: "#d35f56",
      success: ({ confirm }) => {
        if (!confirm) return;
        this.setData({ deletingId: id });
        void deletePrivateCardFace(id)
          .then(() => {
            this.setData({
              items: this.data.items.filter((item) => item.id !== id),
              deletingId: "",
            });
            wx.showToast({ title: "已删除", icon: "success" });
          })
          .catch((error) => {
            this.setData({ deletingId: "" });
            wx.showToast({
              title: error instanceof Error ? error.message : "删除失败",
              icon: "none",
            });
          });
      },
    });
  },

  openCard(event: WechatMiniprogram.CustomEvent<{ id: string }>) {
    const id = String(event.detail.id || "");
    const card = this.data.items.find((item) => item.id === id);
    if (!card) return;
    if (card.status !== "success") {
      wx.showToast({ title: card.status === "failed" ? "该卡面生成失败" : "卡面仍在生成中", icon: "none" });
      return;
    }
    if (!isMiniProgramCardType(card.type) || !validateCardData(card.type, card.data)) {
      wx.showToast({ title: "卡片数据不完整，无法预览", icon: "none" });
      return;
    }
    saveCardTransfer({
      front: { type: card.type, data: card.data! },
      title: card.name,
      privateFace: {
        id: card.id,
        templateId: card.templateId,
        feedback: card.feedback,
      },
    });
    wx.navigateTo({ url: "/package-cards/pages/preview/index" });
  },
});
