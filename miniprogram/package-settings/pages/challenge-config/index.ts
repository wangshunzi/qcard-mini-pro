import {
  getChallengeConfig,
  updateChallengeConfig,
  type ChallengeConfig,
  type LearningIntensity,
  type LearningStrategy,
} from "../../../services/challengeConfig";

const INTENSITIES: Record<LearningIntensity, { label: string; detail: string; cards: number; percent: number }> = {
  light: { label: "轻松模式", detail: "每天少量学习，适合刚开始", cards: 12, percent: 70 },
  moderate: { label: "平衡模式", detail: "新学与复习均衡，推荐", cards: 20, percent: 60 },
  intensive: { label: "强化模式", detail: "更快推进学习计划", cards: 30, percent: 50 },
};

Page({
  data: {
    loading: true,
    saving: false,
    config: null as ChallengeConfig | null,
    intensities: Object.entries(INTENSITIES).map(([value, item]) => ({ value, ...item })),
    strategies: [
      { value: "balanced", label: "平衡策略", detail: "均衡安排新卡与复习卡" },
      { value: "focus", label: "专注策略", detail: "复习优先，强化已经学过的内容" },
      { value: "explore", label: "探索策略", detail: "新卡优先，更快接触新内容" },
    ],
    fillStrategies: [
      { value: "balanced", label: "平衡填充", detail: "新卡和复习卡按比例填充" },
      { value: "review_first", label: "复习优先", detail: "优先用复习卡填充，巩固已学内容" },
      { value: "new_first", label: "新卡优先", detail: "优先用新卡填充，快速学习新内容" },
    ],
    advancedOpen: false,
    previewNewCards: 0,
    previewReviewCards: 0,
    previewTotalCards: 0,
    previewMinutes: 0,
    minDailyMax: 20,
    maxNewCardsMax: 20,
  },

  onLoad() {
    void this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      this.setData({ config: await getChallengeConfig() }, () => this.refreshPreview());
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "配置加载失败", icon: "none" });
    } finally {
      this.setData({ loading: false });
    }
  },

  chooseIntensity(event: WechatMiniprogram.TouchEvent) {
    const value = String(event.currentTarget.dataset.value) as LearningIntensity;
    const selected = INTENSITIES[value];
    this.setData({
      "config.learningIntensity": value,
      "config.systemConfig.targetDailyCards": selected.cards,
      "config.systemConfig.minDailyCards": Math.max(3, Math.floor(selected.cards * .4)),
      "config.systemConfig.newCardPercentage": selected.percent,
      "config.systemConfig.maxNewCardsPerDay": Math.floor(selected.cards * selected.percent / 100),
      "config.systemConfig.nearDueWindowDays": value === "light" ? 3 : value === "moderate" ? 2 : 1,
    }, () => this.refreshPreview());
  },

  chooseStrategy(event: WechatMiniprogram.TouchEvent) {
    this.setData(
      { "config.learningStrategy": String(event.currentTarget.dataset.value) as LearningStrategy },
      () => this.refreshPreview(),
    );
  },

  toggleAuto(event: WechatMiniprogram.SwitchChange) {
    this.setData({ "config.autoAdjust": event.detail.value });
  },

  toggleAdvanced() {
    this.setData({ advancedOpen: !this.data.advancedOpen });
  },

  onSystemSlider(event: WechatMiniprogram.SliderChange) {
    const key = String(event.currentTarget.dataset.key);
    const allowed = [
      "targetDailyCards",
      "minDailyCards",
      "newCardPercentage",
      "maxNewCardsPerDay",
      "nearDueWindowDays",
    ];
    if (!allowed.includes(key)) return;
    let value = Math.round(Number(event.detail.value));
    const target = key === "targetDailyCards"
      ? value
      : Number(this.data.config?.systemConfig.targetDailyCards || 20);
    if (key === "targetDailyCards") {
      this.setData({
        [`config.systemConfig.${key}`]: value,
        "config.systemConfig.minDailyCards": Math.min(
          Number(this.data.config?.systemConfig.minDailyCards || 3),
          Math.min(20, target),
        ),
        "config.systemConfig.maxNewCardsPerDay": Math.min(
          Number(this.data.config?.systemConfig.maxNewCardsPerDay || 1),
          Math.min(30, target),
        ),
      }, () => this.refreshPreview());
      return;
    }
    if (key === "minDailyCards") value = Math.min(value, Math.min(20, target));
    if (key === "maxNewCardsPerDay") value = Math.min(value, Math.min(30, target));
    this.setData({ [`config.systemConfig.${key}`]: value }, () => this.refreshPreview());
  },

  chooseFillStrategy(event: WechatMiniprogram.TouchEvent) {
    this.setData(
      { "config.systemConfig.fillStrategy": String(event.currentTarget.dataset.value) },
      () => this.refreshPreview(),
    );
  },

  refreshPreview() {
    const system = this.data.config?.systemConfig;
    if (!system) return;
    const total = Math.max(0, Number(system.targetDailyCards) || 0);
    const calculatedNew = Math.floor(total * (Number(system.newCardPercentage) || 0) / 100);
    const newCards = Math.min(calculatedNew, Number(system.maxNewCardsPerDay) || 0);
    this.setData({
      previewNewCards: newCards,
      previewReviewCards: Math.max(0, total - newCards),
      previewTotalCards: total,
      previewMinutes: Math.ceil(total * 1.5),
      minDailyMax: Math.min(20, total),
      maxNewCardsMax: Math.min(30, total),
    });
  },

  async save() {
    if (!this.data.config) return;
    this.setData({ saving: true });
    try {
      this.setData({ config: await updateChallengeConfig(this.data.config) });
      wx.showToast({ title: "学习计划已更新", icon: "success" });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      wx.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    } finally {
      this.setData({ saving: false });
    }
  },
});
