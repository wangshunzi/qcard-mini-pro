import { validateCardData } from "../../../cards/CardTypeConfig";
import type { CardData } from "../../../cards/types";
import { getProfile } from "../../../services/profile";
import type { PrivateCardFace } from "../../../services/profile";
import {
  createPrivateCard,
  getPrivateCardFaces,
  getPrivateCardPack,
  getPrivateCardPacks,
  type PrivateCardPack,
  toPrivateCardData,
} from "../../services/userContent";
import { syncNavigationScroll } from "../../../utils/navigationScroll";

type CardSlot = "front" | "back";

interface SelectableCardFace extends PrivateCardFace {
  cardData: CardData | null;
  selectable: boolean;
  selectedAs: "" | "front" | "back" | "both";
}

const PRIVATE_FACE_POLL_MS = 3000;

function hasGeneratingFaces(faces: PrivateCardFace[]) {
  return faces.some(
    (face) => face.status === "pending" || face.status === "processing",
  );
}

function prepareFace(
  face: PrivateCardFace,
  frontId: string,
  backId: string,
): SelectableCardFace {
  const cardData = toPrivateCardData(face) ?? null;
  const selectable =
    face.status === "success" &&
    !!cardData &&
    validateCardData(cardData.type, cardData.data);
  return {
    ...face,
    cardData,
    selectable,
    selectedAs:
      face.id === frontId && face.id === backId
        ? "both"
        : face.id === frontId
          ? "front"
          : face.id === backId
            ? "back"
            : "",
  };
}

Page({
  data: {
    navScrollTop: 0,
    query: "",
    faces: [] as SelectableCardFace[],
    page: 1,
    totalPages: 1,
    loading: true,
    loadingMore: false,
    error: "",
    frontFace: null as SelectableCardFace | null,
    backFace: null as SelectableCardFace | null,
    emptyCardData: {},
    currentSlot: "front" as CardSlot,
    cardCount: 1,
    selectedPack: null as PrivateCardPack | null,
    packs: [] as PrivateCardPack[],
    packPickerOpen: false,
    previewOpen: false,
    saving: false,
    heroBackground: "",
    defaultFrontFaceId: "",
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onLoad(options: Record<string, string>) {
    const privatePackId = String(options.privatePackId || "");
    this.setData({ defaultFrontFaceId: String(options.frontFaceId || "") });
    void Promise.all([
      this.loadFaces(true),
      this.loadPacks(privatePackId),
      getProfile()
        .then((profile) => {
          this.setData({ heroBackground: profile.currentTheme?.config?.gen_bg || "" });
        })
        .catch(() => undefined),
    ]);
  },

  async onPullDownRefresh() {
    await Promise.all([this.loadFaces(true), this.loadPacks(this.data.selectedPack?.id || "")]);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    void this.loadFaces(false);
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
    (this.selectComponent("#full-preview") as any)?.pause?.();
  },

  onUnload() {
    this.clearPrivateFacePolling();
    (this.selectComponent("#full-preview") as any)?.pause?.();
  },

  noop() {
    // 阻止遮罩层上的手势穿透到页面。
  },

  async loadPacks(defaultId = "") {
    try {
      const result = await getPrivateCardPacks(1, 100);
      let packs: PrivateCardPack[] = result.items ?? [];
      let selectedPack = this.data.selectedPack;
      if (defaultId) {
        selectedPack = packs.find((item) => item.id === defaultId) ?? null;
        if (!selectedPack) {
          try {
            selectedPack = await getPrivateCardPack(defaultId);
            packs = [selectedPack, ...packs.filter((item) => item.id !== selectedPack?.id)];
          } catch {
            selectedPack = null;
          }
        }
      }
      this.setData({ packs, selectedPack });
    } catch {
      if (defaultId) wx.showToast({ title: "归属卡包加载失败", icon: "none" });
    }
  },

  async loadFaces(reset: boolean) {
    if (!reset && (this.data.loadingMore || this.data.page >= this.data.totalPages)) return;
    const page = reset ? 1 : this.data.page + 1;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true });
    try {
      const result = await getPrivateCardFaces({
        page,
        limit: 20,
        name: this.data.query.trim(),
      });
      const sourceItems = result.items ?? [];
      const defaultFront = reset && !this.data.frontFace && this.data.defaultFrontFaceId
        ? sourceItems.find((item) => item.id === this.data.defaultFrontFaceId)
        : undefined;
      const preparedDefaultCandidate = defaultFront
        ? prepareFace(defaultFront, defaultFront.id, this.data.backFace?.id || "")
        : null;
      const preparedDefaultFront = preparedDefaultCandidate?.selectable
        ? preparedDefaultCandidate
        : null;
      const frontId = preparedDefaultFront?.id || this.data.frontFace?.id || "";
      const backId = this.data.backFace?.id || "";
      const next = sourceItems.map((item) => prepareFace(item, frontId, backId));
      this.setData({
        faces: reset ? next : [...this.data.faces, ...next],
        frontFace: preparedDefaultFront || this.data.frontFace,
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
    if (!hasGeneratingFaces(this.data.faces)) return;
    (this as any)._privateFacePollTimer = setTimeout(
      () => void this.refreshPrivateFaces(false),
      PRIVATE_FACE_POLL_MS,
    );
  },

  async refreshPrivateFaces(includeNew: boolean) {
    if ((this as any)._privateFacePollBusy) return;
    if (!includeNew && !hasGeneratingFaces(this.data.faces)) return;
    (this as any)._privateFacePollBusy = true;
    try {
      const result = await getPrivateCardFaces({
        page: 1,
        limit: 20,
        name: this.data.query.trim(),
      });
      const frontId = this.data.frontFace?.id || "";
      const backId = this.data.backFace?.id || "";
      const incoming = (result.items ?? []).map((item) =>
        prepareFace(item, frontId, backId),
      );
      const incomingById = new Map(incoming.map((item) => [item.id, item]));
      const existingIds = new Set(this.data.faces.map((item) => item.id));
      const newItems = includeNew
        ? incoming.filter((item) => !existingIds.has(item.id))
        : [];
      const faces = [
        ...newItems,
        ...this.data.faces.map((item) => incomingById.get(item.id) ?? item),
      ];
      this.setData({ faces }, () => this.schedulePrivateFacePolling());
    } catch {
      this.schedulePrivateFacePolling();
    } finally {
      (this as any)._privateFacePollBusy = false;
    }
  },

  refreshSelection() {
    const frontId = this.data.frontFace?.id || "";
    const backId = this.data.backFace?.id || "";
    this.setData({
      faces: this.data.faces.map((item) => prepareFace(item, frontId, backId)),
    });
  },

  onInput(event: WechatMiniprogram.Input) {
    this.setData({ query: event.detail.value.trimStart() });
    const previous = (this as any)._searchTimer;
    if (previous) clearTimeout(previous);
    (this as any)._searchTimer = setTimeout(() => void this.loadFaces(true), 350);
  },

  clearSearch() {
    this.setData({ query: "" }, () => void this.loadFaces(true));
  },

  chooseSlot(event: WechatMiniprogram.TouchEvent) {
    const slot = String(event.currentTarget.dataset.slot) as CardSlot;
    if (slot === "front") {
      this.setData({ currentSlot: slot });
      return;
    }
    this.setData({ currentSlot: "back", cardCount: 2 });
  },

  selectFace(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    const face = this.data.faces.find((item) => item.id === id);
    if (!face) return;
    if (!face.selectable) {
      wx.showToast({
        title:
          face.status === "failed"
            ? "该卡面生成失败"
            : face.status === "success"
              ? "卡片数据不完整"
              : "卡面仍在生成中",
        icon: "none",
      });
      return;
    }
    if (this.data.currentSlot === "front") {
      this.setData({ frontFace: face }, () => this.refreshSelection());
      return;
    }
    this.setData({ backFace: face, cardCount: 2 }, () => this.refreshSelection());
  },

  removeBack() {
    this.setData(
      { backFace: null, cardCount: 1, currentSlot: "front" },
      () => this.refreshSelection(),
    );
  },

  resetSelection() {
    this.setData(
      { frontFace: null, backFace: null, cardCount: 1, currentSlot: "front" },
      () => this.refreshSelection(),
    );
  },

  openPackPicker() {
    this.setData({ packPickerOpen: true });
  },

  closePackPicker() {
    this.setData({ packPickerOpen: false });
  },

  choosePack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    const selectedPack = this.data.packs.find((item) => item.id === id) ?? null;
    if (selectedPack) this.setData({ selectedPack, packPickerOpen: false });
  },

  openPreview() {
    if (!this.data.frontFace) {
      wx.showToast({ title: "请先选择正面卡面", icon: "none" });
      return;
    }
    this.setData({ previewOpen: true });
  },

  closePreview() {
    (this.selectComponent("#full-preview") as any)?.pause?.();
    this.setData({ previewOpen: false });
  },

  openAi() {
    const privatePackId = this.data.selectedPack?.id || "";
    wx.navigateTo({
      url: `/package-cards/pages/ai-generate/index${privatePackId ? `?privatePackId=${encodeURIComponent(privatePackId)}` : ""}`,
    });
  },

  async save() {
    const { frontFace, backFace, cardCount, selectedPack } = this.data;
    if (!frontFace) {
      wx.showToast({ title: "请选择正面卡面", icon: "none" });
      return;
    }
    if (cardCount === 2 && !backFace) {
      wx.showToast({ title: "请选择背面卡面", icon: "none" });
      return;
    }
    if (!selectedPack) {
      wx.showToast({ title: "请选择归属卡包", icon: "none" });
      return;
    }
    if (this.data.saving) return;
    this.setData({ saving: true });
    try {
      const name = backFace ? `${frontFace.name}**${backFace.name}` : frontFace.name;
      await createPrivateCard({
        name,
        userPrivateCardPackId: selectedPack.id,
        frontFaceId: frontFace.id,
        backFaceId: cardCount === 2 ? backFace?.id : undefined,
      });
      this.resetSelection();
      wx.showModal({
        title: "保存成功",
        content: `卡片已保存到「${selectedPack.title}」`,
        cancelText: "继续组卡",
        confirmText: "立即查看",
        success: ({ confirm }) => {
          if (confirm) {
            wx.redirectTo({
              url: `/package-cards/pages/private-pack/index?id=${encodeURIComponent(selectedPack.id)}`,
            });
          }
        },
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "保存失败，请稍后重试",
        icon: "none",
      });
    } finally {
      this.setData({ saving: false });
    }
  },
});
