import { getUnlockedCardPacks } from "../../../services/cardPack";
import type { CardPackSummary } from "../../../services/discovery";
import {
  createPrivateCardPack,
  deletePrivateCardPack,
  getPrivateCardPacks,
  type PrivateCardPack,
} from "../../services/userContent";
import { UI_ASSETS } from "../../../config/uiAssets";
import { getProfile } from "../../../services/profile";
import {
  getDiscoveryData,
  type Grade,
  type KnowledgePoint,
  type Subject,
} from "../../../services/discovery";
import { syncNavigationScroll } from "../../../utils/navigationScroll";
import {
  markDataFresh,
  shouldRefreshData,
} from "../../../stores/dataInvalidation";

const MY_LEARNING_DATA_DOMAINS = [
  "account",
  "wallet",
  "learning",
  "content",
] as const;

Page({
  data: {
    navScrollTop: 0,
    mode: "unlocked" as "unlocked" | "private",
    query: "",
    loading: true,
    loadingMore: false,
    error: "",
    page: 1,
    totalPages: 1,
    publicItems: [] as CardPackSummary[],
    privateItems: [] as PrivateCardPack[],
    assets: UI_ASSETS,
    heroBackground: "",
    userAvatar: "",
    categories: [] as Grade[],
    subjects: [] as Subject[],
    knowledgePoints: [] as KnowledgePoint[],
    filterOpen: false,
    selectedGradeId: "",
    selectedSubjectId: "",
    selectedKnowledgePointId: "",
    tempGradeId: "",
    tempSubjectId: "",
    tempKnowledgePointId: "",
    filterCount: 0,
    editMode: false,
    createOpen: false,
    createTitle: "",
    createDescription: "",
    canCreate: false,
    creating: false,
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onLoad(options: Record<string, string>) {
    if (options.mode === "private") this.setData({ mode: "private" });
    void this.load(true);
    void getProfile()
      .then((profile) => {
        this.setData({
          heroBackground: profile.currentTheme?.config?.learning_bg || "",
          userAvatar: profile.avatar || "",
        });
      })
      .catch(() => undefined);
    void getDiscoveryData()
      .then((result) => this.setData({ categories: result.grades ?? [] }))
      .catch(() => undefined);
    if (options.create === "true") setTimeout(() => this.createPack(), 180);
  },

  onShow() {
    if (
      (this as any)._didShow &&
      shouldRefreshData(this as any, MY_LEARNING_DATA_DOMAINS)
    ) {
      void this.load(true);
      void getProfile()
        .then((profile) => {
          this.setData({
            heroBackground: profile.currentTheme?.config?.learning_bg || "",
            userAvatar: profile.avatar || "",
          });
        })
        .catch(() => undefined);
    }
    (this as any)._didShow = true;
  },

  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    void this.load(false);
  },

  switchMode(event: WechatMiniprogram.TouchEvent) {
    const mode = String(event.currentTarget.dataset.mode) as "unlocked" | "private";
    if (mode === this.data.mode) return;
    const pagination = ((this as any)._learningPagination as Record<
      string,
      { page: number; totalPages: number }
    > | undefined) ?? {};
    pagination[this.data.mode] = {
      page: this.data.page,
      totalPages: this.data.totalPages,
    };
    (this as any)._learningPagination = pagination;
    const targetPagination = pagination[mode];
    this.setData({
      mode,
      query: "",
      page: targetPagination?.page ?? 1,
      totalPages: targetPagination?.totalPages ?? 1,
      filterOpen: false,
      editMode: false,
    }, () => {
      const loaded = ((this as any)._loadedLearningModes as Set<string> | undefined)
        ?.has(mode);
      if (!loaded) void this.load(true);
    });
  },

  onInput(event: WechatMiniprogram.Input) {
    const query = event.detail.value.trimStart();
    this.setData({ query });
    const previous = (this as any)._timer;
    if (previous) clearTimeout(previous);
    (this as any)._timer = setTimeout(() => void this.load(true), 350);
  },

  async load(reset: boolean) {
    if (reset) {
      if (shouldRefreshData(this as any, MY_LEARNING_DATA_DOMAINS)) {
        (this as any)._loadedLearningModes = new Set<string>();
        (this as any)._learningPagination = {};
      }
      markDataFresh(this as any, MY_LEARNING_DATA_DOMAINS);
    }
    if (!reset && (this.data.loadingMore || this.data.page >= this.data.totalPages)) return;
    const page = reset ? 1 : this.data.page + 1;
    const mode = this.data.mode;
    const defaultView =
      !this.data.query.trim() &&
      !this.data.selectedGradeId &&
      !this.data.selectedSubjectId &&
      !this.data.selectedKnowledgePointId;
    const loadedModes = ((this as any)._loadedLearningModes as Set<string> | undefined)
      ?? new Set<string>();
    if (!defaultView) loadedModes.delete(mode);
    (this as any)._loadedLearningModes = loadedModes;
    this.setData(reset ? { loading: true, error: "" } : { loadingMore: true });
    try {
      if (this.data.mode === "unlocked") {
        const result = await getUnlockedCardPacks({
          page,
          limit: 20,
          keyword: this.data.query.trim(),
          gradeId: this.data.selectedGradeId,
          subjectId: this.data.selectedSubjectId,
          knowledgePointId: this.data.selectedKnowledgePointId,
        });
        this.setData({
          publicItems: reset ? result.items ?? [] : [...this.data.publicItems, ...(result.items ?? [])],
          page: result.page ?? page,
          totalPages: result.totalPages ?? page,
        });
      } else {
        const result = await getPrivateCardPacks(page, 20, this.data.query.trim());
        const items = result.items ?? [];
        this.setData({
          privateItems: reset ? items : [...this.data.privateItems, ...items],
          page: result.page ?? page,
          totalPages: result.totalPages ?? page,
        });
      }
      if (reset && defaultView) {
        loadedModes.add(mode);
        const pagination = ((this as any)._learningPagination as Record<
          string,
          { page: number; totalPages: number }
        > | undefined) ?? {};
        pagination[mode] = {
          page: this.data.page,
          totalPages: this.data.totalPages,
        };
        (this as any)._learningPagination = pagination;
      }
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "卡包加载失败" });
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  toggleFilter() {
    if (this.data.mode !== "unlocked") return;
    if (this.data.filterOpen) {
      this.setData({ filterOpen: false });
      return;
    }
    this.syncFilterOptions(
      this.data.selectedGradeId,
      this.data.selectedSubjectId,
      this.data.selectedKnowledgePointId,
      true,
    );
  },

  syncFilterOptions(
    gradeId: string,
    subjectId: string,
    knowledgePointId: string,
    open?: boolean,
  ) {
    const grade = this.data.categories.find((item) => item.id === gradeId);
    const subjects = grade?.subjects ?? [];
    const subject = subjects.find((item) => item.id === subjectId);
    this.setData({
      tempGradeId: gradeId,
      tempSubjectId: subjectId,
      tempKnowledgePointId: knowledgePointId,
      subjects,
      knowledgePoints: subject?.knowledgePoints ?? [],
      filterOpen: open ?? this.data.filterOpen,
    });
  },

  chooseGrade(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    this.syncFilterOptions(id, "", "", true);
  },

  chooseSubject(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    this.syncFilterOptions(this.data.tempGradeId, id, "", true);
  },

  chooseKnowledgePoint(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    this.setData({ tempKnowledgePointId: id });
  },

  resetFilters() {
    this.syncFilterOptions("", "", "", true);
  },

  confirmFilters() {
    const selectedGradeId = this.data.tempGradeId;
    const selectedSubjectId = this.data.tempSubjectId;
    const selectedKnowledgePointId = this.data.tempKnowledgePointId;
    this.setData({
      selectedGradeId,
      selectedSubjectId,
      selectedKnowledgePointId,
      filterCount:
        Number(Boolean(selectedGradeId)) +
        Number(Boolean(selectedSubjectId)) +
        Number(Boolean(selectedKnowledgePointId)),
      filterOpen: false,
      page: 1,
      totalPages: 1,
    }, () => void this.load(true));
  },

  toggleManage() {
    if (this.data.mode !== "private") return;
    this.setData({ editMode: !this.data.editMode });
  },

  deletePack(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    const pack = this.data.privateItems.find((item) => item.id === id);
    if (!pack) return;
    wx.showModal({
      title: "删除专属卡包",
      content: `确认删除「${pack.title}」？此操作不可撤销。`,
      confirmText: "删除",
      confirmColor: "#d64f45",
      success: async ({ confirm }) => {
        if (!confirm) return;
        wx.showLoading({ title: "正在删除", mask: true });
        try {
          await deletePrivateCardPack(id);
          await this.load(true);
          wx.showToast({ title: "已删除", icon: "success" });
        } catch (error) {
          wx.showToast({
            title: error instanceof Error ? error.message : "删除失败",
            icon: "none",
          });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  openPublic(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    if (id) wx.navigateTo({ url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}` });
  },

  openPrivate(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    if (id) wx.navigateTo({ url: `/package-cards/pages/private-pack/index?id=${encodeURIComponent(id)}` });
  },

  startPublic(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    if (id) wx.navigateTo({ url: `/package-cards/pages/study/index?packId=${encodeURIComponent(id)}` });
  },

  goResource() {
    wx.switchTab({ url: "/pages/resource/index" });
  },

  createPack() {
    if (this.data.mode !== "private") {
      this.setData(
        {
          mode: "private",
          query: "",
          page: 1,
          totalPages: 1,
          filterOpen: false,
          editMode: false,
          createOpen: true,
          createTitle: "",
          createDescription: "",
          canCreate: false,
        },
        () => void this.load(true),
      );
      return;
    }
    this.setData({
      createOpen: true,
      createTitle: "",
      createDescription: "",
      canCreate: false,
    });
  },

  preventCreateClose() {},

  onCreateTitleInput(event: WechatMiniprogram.Input) {
    const createTitle = event.detail.value;
    this.setData({
      createTitle,
      canCreate: Boolean(createTitle.trim() && this.data.createDescription.trim()),
    });
  },

  onCreateDescriptionInput(event: WechatMiniprogram.Input) {
    const createDescription = event.detail.value;
    this.setData({
      createDescription,
      canCreate: Boolean(this.data.createTitle.trim() && createDescription.trim()),
    });
  },

  cancelCreatePack() {
    if (this.data.creating) return;
    this.setData({
      createOpen: false,
      createTitle: "",
      createDescription: "",
      canCreate: false,
    });
  },

  async confirmCreatePack() {
    if (this.data.creating) return;
    const title = this.data.createTitle.trim();
    const description = this.data.createDescription.trim();
    if (!title) {
      wx.showToast({ title: "请输入卡包标题", icon: "none" });
      return;
    }
    if (!description) {
      wx.showToast({ title: "请输入卡包描述", icon: "none" });
      return;
    }
    this.setData({ creating: true });
    try {
      const pack = await createPrivateCardPack(title, description);
      this.setData({
        createOpen: false,
        createTitle: "",
        createDescription: "",
        canCreate: false,
      });
      await this.load(true);
      wx.navigateTo({
        url: `/package-cards/pages/private-pack/index?id=${encodeURIComponent(pack.id)}`,
      });
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "创建失败",
        icon: "none",
      });
    } finally {
      this.setData({ creating: false });
    }
  },
});
