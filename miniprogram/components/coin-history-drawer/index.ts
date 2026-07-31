import {
  getBalanceHistory,
  type BalanceChangeType,
  type BalanceHistoryItem,
} from "../../services/wallet";
import { UI_ASSETS } from "../../config/uiAssets";

type DisplayHistoryItem = BalanceHistoryItem & {
  label: string;
  icon: string;
  tone: "positive" | "negative" | "warning" | "info";
  amountText: string;
  timeText: string;
  reasonText: string;
};

const TYPE_CONFIG: Record<
  BalanceChangeType,
  { label: string; icon: string; tone: DisplayHistoryItem["tone"] }
> = {
  recharge: { label: "充值", icon: "arrow-up-circle-outline", tone: "positive" },
  reward: { label: "奖励", icon: "gift-outline", tone: "positive" },
  unlock: { label: "解锁", icon: "lock-open-outline", tone: "negative" },
  free_unlock: { label: "免费解锁", icon: "gift-outline", tone: "positive" },
  ai_generation: { label: "AI卡面生成", icon: "robot-outline", tone: "warning" },
  card_pack_creation: { label: "卡包创建", icon: "layers-outline", tone: "info" },
  refund: { label: "退款", icon: "arrow-left", tone: "positive" },
  system_adjustment: { label: "系统调整", icon: "cog", tone: "info" },
};

const FILTERS = [
  { key: "all", label: "全部", icon: "" },
  { key: "recharge", label: "充值", icon: "arrow-up-circle-outline" },
  { key: "reward", label: "奖励", icon: "gift-outline" },
  { key: "unlock", label: "解锁", icon: "lock-open-outline" },
  { key: "free_unlock", label: "免费解锁", icon: "gift-outline" },
  { key: "ai_generation", label: "AI生成", icon: "robot-outline" },
  { key: "card_pack_creation", label: "卡包创建", icon: "layers-outline" },
  { key: "refund", label: "退款", icon: "arrow-left" },
  { key: "system_adjustment", label: "系统调整", icon: "cog" },
] as const;

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const elapsed = Math.max(0, Date.now() - date.getTime());
  const day = 24 * 60 * 60 * 1000;
  if (elapsed < day && date.getDate() === new Date().getDate()) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  if (elapsed < day * 2) return "昨天";
  if (elapsed < day * 7) return `${Math.floor(elapsed / day)}天前`;
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function stripHtml(value?: string) {
  return String(value || "余额变动").replace(/<[^>]+>/g, "").trim();
}

function toDisplay(item: BalanceHistoryItem): DisplayHistoryItem {
  const config = TYPE_CONFIG[item.changeType] ?? TYPE_CONFIG.system_adjustment;
  return {
    ...item,
    ...config,
    amountText: `${item.amount > 0 ? "+" : ""}${item.amount} 咔豆`,
    timeText: formatTime(item.createdAt),
    reasonText: stripHtml(item.reason),
  };
}

Component({
  properties: {
    open: { type: Boolean, value: false },
    profile: { type: Object, value: {} },
  },

  data: {
    assets: UI_ASSETS,
    filters: FILTERS,
    selectedType: "all",
    items: [] as DisplayHistoryItem[],
    loading: false,
    page: 1,
    totalPages: 1,
  },

  observers: {
    open(open: boolean) {
      if (open) void this.resetAndLoad();
    },
  },

  methods: {
    close() {
      this.triggerEvent("close");
    },

    preventClose() {},

    recharge() {
      this.triggerEvent("recharge");
    },

    selectType(event: WechatMiniprogram.TouchEvent) {
      const selectedType = String(event.currentTarget.dataset.type || "all");
      if (selectedType === (this.data as any).selectedType) return;
      this.setData({ selectedType });
      void this.resetAndLoad();
    },

    async resetAndLoad() {
      this.setData({ items: [], page: 1, totalPages: 1 });
      await this.loadPage(1, false);
    },

    async loadPage(page: number, append: boolean) {
      if ((this.data as any).loading) return;
      this.setData({ loading: true });
      try {
        const selected = String((this.data as any).selectedType);
        const result = await getBalanceHistory({
          page,
          limit: 20,
          changeType: selected === "all" ? undefined : selected as BalanceChangeType,
        });
        const next = (result.items ?? []).map(toDisplay);
        this.setData({
          items: append ? [...((this.data as any).items as DisplayHistoryItem[]), ...next] : next,
          page: result.page ?? page,
          totalPages: result.totalPages ?? page,
        });
      } catch (error) {
        wx.showToast({
          title: error instanceof Error ? error.message : "历史记录加载失败",
          icon: "none",
        });
      } finally {
        this.setData({ loading: false });
      }
    },

    loadMore() {
      const state = this.data as any;
      if (state.loading || state.page >= state.totalPages) return;
      void this.loadPage(state.page + 1, true);
    },

    openPack(event: WechatMiniprogram.TouchEvent) {
      const id = String(event.currentTarget.dataset.id || "");
      if (!id) return;
      this.close();
      wx.navigateTo({
        url: `/package-cards/pages/pack-detail/index?id=${encodeURIComponent(id)}`,
      });
    },
  },
});
