import {
  getExperienceHistory,
  getExperienceLevels,
  getUnlockDiscount,
  type ExperienceHistory,
  type ExperienceLevel,
} from "../../../services/experience";
import { syncNavigationScroll } from "../../../utils/navigationScroll";
import { getProfile, type UserProfile } from "../../../services/profile";
import { UI_ASSETS } from "../../../config/uiAssets";

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

interface DisplayLevel extends ExperienceLevel {
  description: string;
  state: "earned" | "current" | "locked";
}

function getLevelDescription(level?: ExperienceLevel) {
  const description = level?.benefits?.description;
  if (typeof description === "string" && description.trim()) return description.trim();
  if (Number(level?.unlockDiscount || 0) > 0) {
    return `解锁卡包可以便宜${level?.unlockDiscount}%啦！`;
  }
  return "消费咔豆，马上就能获得折扣啦！";
}

Page({
  data: {
    navScrollTop: 0,
    loading: true,
    error: "",
    profile: null as UserProfile | null,
    levels: [] as ExperienceLevel[],
    histories: [] as Array<ExperienceHistory & { dateText: string }>,
    discountText: "暂无等级折扣",
    tab: "history" as "history" | "benefits",
    progress: 0,
    currentLevelInfo: null as DisplayLevel | null,
    nextLevelInfo: null as DisplayLevel | null,
    visibleLevels: [] as DisplayLevel[],
    currentLevel: 1,
    currentExperience: 0,
    nextLevelExperience: 100,
    currentDiscount: 0,
    assets: UI_ASSETS,
  },

  onPageScroll(event: { scrollTop: number }) {
    syncNavigationScroll(this, event.scrollTop);
  },

  onLoad() {
    void this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    this.setData({ loading: true, error: "" });
    try {
      const [profile, levels, history, discount] = await Promise.all([
        getProfile(),
        getExperienceLevels(),
        getExperienceHistory(),
        getUnlockDiscount(),
      ]);
      const current = profile.experience?.experience ?? 0;
      const next = profile.experience?.nextLevelRequiredExp ?? 1;
      const currentLevel = profile.experience?.level ?? 1;
      const rate = Number(discount.discount ?? 0);
      const displayLevels = (levels ?? []).map((level) => ({
        ...level,
        description: getLevelDescription(level),
        state: (level.level < currentLevel
          ? "earned"
          : level.level === currentLevel
            ? "current"
            : "locked") as DisplayLevel["state"],
      }));
      this.setData({
        profile,
        levels: displayLevels,
        histories: (history.items ?? []).map((item) => ({ ...item, dateText: formatDate(item.createdAt) })),
        discountText: rate > 0 ? `当前等级解锁卡包优惠 ${rate}%` : "当前等级暂无额外折扣",
        progress: Math.max(0, Math.min(100, current * 100 / next)),
        currentLevelInfo: displayLevels.find((level) => level.level === currentLevel) || {
          level: currentLevel,
          name: `成长等级 ${currentLevel}`,
          description: "继续学习获得更多权益",
          unlockDiscount: rate,
          state: "current",
        },
        nextLevelInfo: displayLevels.find((level) => level.level === currentLevel + 1) || null,
        visibleLevels: displayLevels.filter((level) => level.level <= currentLevel + 2),
        currentLevel,
        currentExperience: current,
        nextLevelExperience: next,
        currentDiscount: rate,
      });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "等级信息加载失败" });
    } finally {
      this.setData({ loading: false });
    }
  },

  switchTab(event: WechatMiniprogram.TouchEvent) {
    this.setData({ tab: String(event.currentTarget.dataset.tab) as "history" | "benefits" });
  },
});
