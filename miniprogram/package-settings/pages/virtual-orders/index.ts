import {
  getVirtualPaymentOrder,
  isVirtualOrderFulfilled,
  listVirtualPaymentOrders,
  type VirtualPaymentOrder,
} from "../../../services/virtualPayment";

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

function formatTime(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function paymentPresentation(status: VirtualPaymentOrder["paymentStatus"]) {
  if (status === "SUCCEEDED") return ["支付成功", "success"] as const;
  if (status === "FAILED") return ["支付失败", "failed"] as const;
  if (status === "CANCELLED") return ["已取消", "muted"] as const;
  if (status === "CLOSED") return ["已关闭", "muted"] as const;
  if (status === "PENDING") return ["待确认", "pending"] as const;
  return ["状态确认中", "pending"] as const;
}

function fulfillmentPresentation(
  status: VirtualPaymentOrder["fulfillmentStatus"],
) {
  if (status === "SUCCEEDED") return ["已到账", "success"] as const;
  if (status === "FAILED") return ["发放异常", "failed"] as const;
  if (status === "REVERSED") return ["权益已撤回", "muted"] as const;
  if (status === "PROCESSING") return ["发放中", "pending"] as const;
  if (status === "PENDING") return ["待发放", "pending"] as const;
  return ["状态确认中", "pending"] as const;
}

function refundPresentation(status: VirtualPaymentOrder["refundStatus"]) {
  if (status === "SUCCEEDED") return ["已退款", "muted"] as const;
  if (status === "FAILED") return ["退款失败", "failed"] as const;
  if (status === "PENDING") return ["退款中", "pending"] as const;
  return ["无退款", "muted"] as const;
}

function toOrderView(order: VirtualPaymentOrder): OrderView {
  const [paymentLabel, paymentTone] = paymentPresentation(order.paymentStatus);
  const [fulfillmentLabel, fulfillmentTone] = fulfillmentPresentation(
    order.fulfillmentStatus,
  );
  const [refundLabel, refundTone] = refundPresentation(order.refundStatus);
  return {
    ...order,
    displayPrice: (order.amountInCents / 100).toFixed(2),
    createdAtText: formatTime(order.createdAt),
    paymentLabel,
    paymentTone,
    fulfillmentLabel,
    fulfillmentTone,
    refundLabel,
    refundTone,
    completed: isVirtualOrderFulfilled(order),
    processing:
      order.paymentStatus === "PENDING" ||
      order.paymentStatus === "UNKNOWN" ||
      order.fulfillmentStatus === "PENDING" ||
      order.fulfillmentStatus === "PROCESSING" ||
      order.fulfillmentStatus === "UNKNOWN",
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
    if ((this as any)._didShow) void this.load(true);
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
    } finally {
      this.setData({ loading: false, loadingMore: false });
    }
  },

  retryLoad() {
    void this.load(true);
  },

  async onVirtualPaymentFulfilled() {
    await this.load(true);
  },

  async refreshOrder(event: WechatMiniprogram.TouchEvent) {
    const orderNo = String(event.currentTarget.dataset.orderNo || "");
    if (!orderNo || (this.data as any).refreshingOrderNo) return;
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
    (this as any)._pollTimer = setTimeout(() => {
      (this as any)._pollTimer = undefined;
      void this.load(true);
    }, 5000);
  },

  stopPolling() {
    const timer = (this as any)._pollTimer;
    if (timer) clearTimeout(timer);
    (this as any)._pollTimer = undefined;
  },
});
