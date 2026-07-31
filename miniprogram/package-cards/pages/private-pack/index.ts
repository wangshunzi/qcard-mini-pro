import {
  getPrivateCardCatalogue,
  getPrivateCardPack,
  type PrivateCard,
  type PrivateCardPack,
} from "../../../services/userContent";
import { getProfile } from "../../../services/profile";
import { syncNavigationScroll } from "../../../utils/navigationScroll";

Page({
  data: {
    navScrollTop: 0,
    id: "",
    pack: null as PrivateCardPack | null,
    cards: [] as PrivateCard[],
    loading: true,
    error: "",
    activeTab: "intro" as "intro" | "cards",
    heroBackground: "",
    authorName: "叩咔用户",
    authorAvatar: "",
    progress: 0,
    completedCards: 0,
    studyTimeText: "0分钟",
    lastStudiedText: "从未学习",
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onLoad(options: Record<string, string>) {
    this.setData({ id: String(options.id || "") });
    void this.load();
    void getProfile()
      .then((profile) => {
        this.setData({
          heroBackground: profile.currentTheme?.config?.detail_bg || "",
          authorName: profile.nickname || "叩咔用户",
          authorAvatar: profile.avatar || "",
        });
      })
      .catch(() => undefined);
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    if (!this.data.id) {
      this.setData({ loading: false, error: "卡包参数无效" });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const [pack, cards] = await Promise.all([
        getPrivateCardPack(this.data.id),
        getPrivateCardCatalogue(this.data.id),
      ]);
      const progress = Math.max(0, Number(pack.userStudyProgress?.progress) || 0);
      const totalStudyTime = Math.max(0, Number(pack.userStudyProgress?.totalStudyTime) || 0);
      const lastStudiedAt = pack.userStudyProgress?.lastStudiedAt;
      const diffDays = lastStudiedAt
        ? Math.floor((Date.now() - new Date(lastStudiedAt).getTime()) / 86400000)
        : -1;
      this.setData({
        pack,
        cards: cards ?? [],
        progress,
        completedCards: pack.userStudyProgress?.completedCards || 0,
        studyTimeText:
          totalStudyTime >= 3600
            ? `${Math.floor(totalStudyTime / 3600)}小时${Math.floor((totalStudyTime % 3600) / 60)}分钟`
            : `${Math.floor(totalStudyTime / 60)}分钟`,
        lastStudiedText:
          diffDays < 0 ? "从未学习" : diffDays === 0 ? "今天" : diffDays === 1 ? "昨天" : `${diffDays}天前`,
        authorName: pack.author?.name || this.data.authorName,
        authorAvatar: pack.author?.avatar || this.data.authorAvatar,
      });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "卡包加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    const activeTab = String(event.currentTarget.dataset.tab) as "intro" | "cards";
    if (activeTab) this.setData({ activeTab });
  },

  openCard(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id || "");
    const card = this.data.cards.find((item) => item.id === id);
    if (!card) return;
    wx.navigateTo({
      url: `/package-cards/pages/study/index?private=1&packId=${encodeURIComponent(this.data.id)}&cardId=${encodeURIComponent(card.id)}`,
    });
  },

  study() {
    if (!this.data.cards.length) {
      wx.showToast({ title: "请先添加卡片", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/package-cards/pages/study/index?private=1&packId=${encodeURIComponent(this.data.id)}`,
    });
  },

  generate() {
    wx.navigateTo({
      url: `/package-cards/pages/generate/index?privatePackId=${encodeURIComponent(this.data.id)}`,
    });
  },
});
