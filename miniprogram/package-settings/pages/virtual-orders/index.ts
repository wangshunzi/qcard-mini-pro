import {
  getVirtualPaymentOrder,
  getVirtualOrderPresentation,
  listVirtualPaymentOrders,
  type VirtualPaymentOrder,
} from "../../../services/virtualPayment";
import {
  markDataFresh,
  shouldRefreshData,
} from "../../../stores/dataInvalidation";

const ORDER_DATA_DOMAINS = ["orders"] as const;

interface OrderView extends VirtualPaymentOrder {
  displayPrice: string;
  createdAtText: string;
  paymentLabel: string;
  paymentTone: string;
  fulfillmentLabel: string;
  fulfillmentTone: string;
  refundLabel: string;
  refundTone: string;
  completed: boolean;
  processing: boolean;
}

const PAGE_SIZE = 20;
const ORDER_PAGE_POLL_DELAYS_MS = [5000, 10000, 20000, 30000, 60000, 120000];

function formatTime(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toOrderView(order: VirtualPaymentOrder): OrderView {
  const presentation = getVirtualOrderPresentation(order);
  return {
    ...order,
    displayPrice: (order.amountInCents / 100).toFixed(2),
    createdAtText: formatTime(order.createdAt),
    ...presentation,
  };
}

Page({
  data: {
    loading: true,
    loadingMore: false,
    error: "",
    items: [] as OrderView[],
    page: 1,
    totalPages: 1,
    total: 0,
    refreshingOrderNo: "",
  },

  onLoad() {
    void this.load(true);
  },

  onShow() {
    (this as any)._pollAttempt = 0;
    if (
      (this as any)._didShow &&
      shouldRefreshData(this as any, ORDER_DATA_DOMAINS)
    ) void this.load(true);
    (this as any)._didShow = true;
    this.startPolling();
  },

  onHide() {
    this.stopPolling();
  },

  onUnload() {
    this.stopPolling();
  },

  async onPullDownRefresh() {
    (this as any)._pollAttempt = 0;
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (
      !(this.data as any).loadingMore &&
      Number((this.data as any).page) < Number((this.data as any).totalPages)
    ) {
      void this.load(false);
    }
  },

  async load(reset: boolean) {
    markDataFresh(this as any, ORDER_DATA_DOMAINS);
    if ((this.data as any).loadingMore) return;
    const page = reset ? 1 : Number((this.data as any).page) + 1;
    this.setData(
      reset
        ? { loading: true, error: "" }
        : { loadingMore: true, error: "" },
    );
    try {
      const result = await listVirtualPaymentOrders({
        page,
        limit: PAGE_SIZE,
      });
      const nextItems = result.items.map(toOrderView);
      this.setData({
        items: reset
          ? nextItems
          : ([...(this.data as any).items, ...nextItems] as OrderView[]),
        page: result.page,
        totalPages: result.totalPages,
        total: result.total,
      });
      this.startPolling();
    } catch (error) {
      this.setData({
        error: error instanceof Error ? error.message : "购买记录加载失败",
      });
      // Preserve bounded polling when a refresh fails transiently. If there are
      // no previously loaded processing orders, the normal manual retry remains.
      this.startPolling();
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  retryLoad() {
    (this as any)._pollAttempt = 0;
    void this.load(true);
  },

  async onVirtualPaymentFulfilled() {
    await this.load(true);
  },

  async refreshOrder(event: WechatMiniprogram.TouchEvent) {
    const orderNo = String(event.currentTarget.dataset.orderNo || "");
    if (!orderNo || (this.data as any).refreshingOrderNo) return;
    (this as any)._pollAttempt = 0;
    this.setData({ refreshingOrderNo: orderNo });
    try {
      const latest = await getVirtualPaymentOrder(orderNo);
      const current = ((this.data as any).items as OrderView[]).find(
        (item) => item.orderNo === orderNo,
      );
      const order = toOrderView({
        ...current,
        ...latest,
        productName:
          latest.productName === "虚拟商品"
            ? current?.productName || latest.productName
            : latest.productName,
        amountInCents: latest.amountInCents || current?.amountInCents || 0,
        createdAt: latest.createdAt || current?.createdAt || "",
      });
      const items = ((this.data as any).items as OrderView[]).map((item) =>
        item.orderNo === orderNo ? order : item,
      );
      this.setData({ items });
      wx.showToast({
        title: order.completed ? "权益已到账" : "状态已更新",
        icon: order.completed ? "success" : "none",
      });
      this.startPolling();
    } catch (error) {
      wx.showToast({
        title: error instanceof Error ? error.message : "状态查询失败",
        icon: "none",
      });
    } finally {
      this.setData({ refreshingOrderNo: "" });
    }
  },

  startPolling() {
    this.stopPolling();
    const hasProcessing = ((this.data as any).items as OrderView[]).some(
      (item) => item.processing,
    );
    if (!hasProcessing) return;
    const attempt = Math.max(0, Number((this as any)._pollAttempt || 0));
    if (attempt >= ORDER_PAGE_POLL_DELAYS_MS.length) return;
    (this as any)._pollTimer = setTimeout(() => {
      (this as any)._pollTimer = undefined;
      (this as any)._pollAttempt = attempt + 1;
      void this.load(true);
    }, ORDER_PAGE_POLL_DELAYS_MS[attempt]);
  },

  stopPolling() {
    const timer = (this as any)._pollTimer;
    if (timer) clearTimeout(timer);
    (this as any)._pollTimer = undefined;
  },
});
