import {
  claimVirtualFulfillmentNotification,
  formatVirtualPaymentError,
  getPendingVirtualPaymentForProduct,
  getVirtualPaymentCapability,
  listVirtualPaymentProducts,
  startVirtualPurchase,
  subscribePendingVirtualPayments,
  type VirtualPaymentProduct,
  type VirtualProductKind,
} from "../../services/virtualPayment";

interface ProductView extends VirtualPaymentProduct {
  benefitText: string;
  detailText: string;
  durationLabel: string;
  purchaseState: "" | "continue" | "confirming";
  purchaseLocked: boolean;
}

function getDurationLabel(days?: number) {
  const safeDays = Math.max(0, Number(days) || 0);
  if (!safeDays) return "";
  if (safeDays <= 7) return "周卡";
  if (safeDays <= 31) return "月卡";
  if (safeDays <= 93) return "季卡";
  return "年卡";
}

function formatVipExpireAt(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}/${month}/${day}`;
}

function toProductView(product: VirtualPaymentProduct): ProductView {
  const pending = getPendingVirtualPaymentForProduct(product.id);
  const purchaseState = pending
    ? pending.orderNo
      ? "confirming"
      : "continue"
    : "";
  const isCoin = product.kind === "coin";
  return {
    ...product,
    purchaseState,
    purchaseLocked: purchaseState === "confirming",
    durationLabel: isCoin ? "" : getDurationLabel(product.vipDurationDays),
    benefitText: isCoin
      ? product.bonusCoinAmount
        ? `${product.coinAmount || 0} 咔豆 + 赠 ${product.bonusCoinAmount}`
        : `${product.coinAmount || 0} 咔豆`
      : `${product.vipDurationDays || 0} 天固定权益`,
    detailText: isCoin
      ? product.bonusCoinAmount
        ? `含赠送 ${product.bonusCoinAmount} 咔豆`
        : "支付成功后发放到统一余额"
      : product.dailyRewardAmount
        ? `每日可领取 ${product.dailyRewardAmount} 咔豆`
        : "一次性购买，不自动续费",
  };
}

function kindForMode(mode: string): VirtualProductKind {
  return mode === "recharge" ? "coin" : "vip";
}

function productSelectionState(
  products: ProductView[],
  preferredKind: VirtualProductKind,
  selectedId: string,
  isVip: boolean,
) {
  const availableProducts = isVip
    ? products.filter((item) => item.kind !== "vip")
    : products;
  const subscriptionProducts = availableProducts.filter(
    (item) => item.kind === "vip",
  );
  const coinProducts = availableProducts.filter((item) => item.kind === "coin");
  const selectedProduct =
    availableProducts.find((item) => item.id === selectedId) ||
    availableProducts.find((item) => item.kind === preferredKind) ||
    availableProducts[0] ||
    null;
  const selectedKind = selectedProduct?.kind || preferredKind;
  const primaryLabel = !selectedProduct
    ? "请选择商品"
    : selectedProduct.purchaseState === "confirming"
      ? "查询订单状态"
      : selectedProduct.kind === "vip"
        ? `开通 ${selectedProduct.durationLabel || selectedProduct.name}`
        : `购买 ${selectedProduct.coinAmount || 0} 咔豆`;
  return {
    products: availableProducts,
    subscriptionProducts,
    coinProducts,
    selectedProduct,
    selectedProductId: selectedProduct?.id || "",
    selectedKind,
    primaryLabel,
  };
}

Component({
  properties: {
    open: { type: Boolean, value: false },
    mode: { type: String, value: "vip" },
    reason: { type: String, value: "" },
    balance: { type: Number, value: 0 },
    isVip: { type: Boolean, value: false },
    vipExpireAt: { type: String, value: "" },
    dailyRewardAmount: { type: Number, value: 0 },
  },

  data: {
    closing: false,
    loading: false,
    loaded: false,
    error: "",
    statusMessage: "",
    capabilitySupported: true,
    capabilityReason: "",
    capabilityAction: "none",
    products: [] as ProductView[],
    subscriptionProducts: [] as ProductView[],
    coinProducts: [] as ProductView[],
    selectedProduct: null as ProductView | null,
    selectedProductId: "",
    selectedKind: "vip" as VirtualProductKind,
    primaryLabel: "请选择商品",
    submittingId: "",
    dragging: false,
    dragSettling: false,
    dragOffset: 0,
    vipStatusText: "VIP 权益已生效",
  },

  observers: {
    "open, mode, isVip, vipExpireAt"(
      open: boolean,
      _mode: string,
      isVip: boolean,
      vipExpireAt: string,
    ) {
      const expiry = formatVipExpireAt(vipExpireAt);
      this.setData({
        vipStatusText: isVip && expiry
          ? `有效期至 ${expiry}`
          : "VIP 权益已生效",
      });
      if (!open) {
        this.clearCloseTimer();
        this.clearDragSettleTimer();
        (this as any)._dragStartY = null;
        this.setData({
          closing: false,
          statusMessage: "",
          submittingId: "",
          dragging: false,
          dragSettling: false,
          dragOffset: 0,
        });
        return;
      }
      void this.loadProducts();
    },
  },

  lifetimes: {
    attached() {
      (this as any)._unsubscribePending = subscribePendingVirtualPayments(() => {
        this.syncPendingProducts();
      });
    },
    detached() {
      this.clearCloseTimer();
      this.clearDragSettleTimer();
      (this as any)._unsubscribePending?.();
      (this as any)._unsubscribePending = undefined;
      (this as any)._loadSequence = Number((this as any)._loadSequence || 0) + 1;
    },
  },

  methods: {
    syncPendingProducts() {
      const state = this.data as any;
      const products = (state.products as ProductView[]).map(toProductView);
      this.setData(
        productSelectionState(
          products,
          kindForMode(state.mode),
          String(state.selectedProductId || ""),
          Boolean(state.isVip),
        ),
      );
    },

    clearCloseTimer() {
      const timer = (this as any)._closeTimer;
      if (timer) clearTimeout(timer);
      (this as any)._closeTimer = null;
    },

    clearDragSettleTimer() {
      const timer = (this as any)._dragSettleTimer;
      if (timer) clearTimeout(timer);
      (this as any)._dragSettleTimer = null;
    },

    scheduleClose() {
      this.clearCloseTimer();
      (this as any)._closeTimer = setTimeout(() => {
        (this as any)._closeTimer = null;
        this.triggerEvent("close");
      }, 220);
    },

    async loadProducts() {
      const sequence = Number((this as any)._loadSequence || 0) + 1;
      (this as any)._loadSequence = sequence;
      const capability = getVirtualPaymentCapability();
      if (!capability.supported) {
        this.setData({
          capabilitySupported: false,
          capabilityReason: capability.reason,
          capabilityAction: capability.action,
          ...productSelectionState(
            [],
            kindForMode(String((this.data as any).mode)),
            "",
            Boolean((this.data as any).isVip),
          ),
          loading: false,
          loaded: true,
          error: "",
        });
        return;
      }

      this.setData({
        capabilitySupported: true,
        capabilityReason: "",
        capabilityAction: "none",
        loading: true,
        error: "",
      });
      try {
        const state = this.data as any;
        const products = (await listVirtualPaymentProducts()).map(toProductView);
        if (sequence !== (this as any)._loadSequence) return;
        const selection = productSelectionState(
          products,
          kindForMode(state.mode),
          "",
          Boolean(state.isVip),
        );
        this.setData({
          ...selection,
          loaded: true,
          error: selection.products.length
            ? ""
            : state.isVip
              ? ""
              : "当前暂无可购买的商品",
        });
      } catch (error) {
        if (sequence !== (this as any)._loadSequence) return;
        this.setData({
          ...productSelectionState(
            [],
            kindForMode(String((this.data as any).mode)),
            "",
            Boolean((this.data as any).isVip),
          ),
          loaded: true,
          error: formatVirtualPaymentError(error),
        });
      } finally {
        if (sequence === (this as any)._loadSequence) {
          this.setData({ loading: false });
        }
      }
    },

    close() {
      if ((this.data as any).submittingId || (this.data as any).closing) return;
      this.clearDragSettleTimer();
      (this as any)._dragStartY = null;
      this.setData({
        closing: true,
        dragging: false,
        dragSettling: false,
        dragOffset: 0,
      });
      this.scheduleClose();
    },

    preventClose() {},

    onDragStart(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.submittingId || state.closing) return;
      const touch = event.touches?.[0];
      if (!touch) return;
      this.clearDragSettleTimer();
      (this as any)._dragStartY = touch.clientY;
      (this as any)._dragStartedAt = Date.now();
      this.setData({
        dragging: true,
        dragSettling: false,
        dragOffset: 0,
      });
    },

    onDragMove(event: WechatMiniprogram.TouchEvent) {
      const startY = Number((this as any)._dragStartY);
      const touch = event.touches?.[0];
      if (!(this.data as any).dragging || !Number.isFinite(startY) || !touch) return;
      const windowHeight = wx.getWindowInfo?.().windowHeight || 800;
      const offset = Math.min(windowHeight, Math.max(0, touch.clientY - startY));
      this.setData({ dragOffset: offset });
    },

    onDragEnd() {
      if (!(this.data as any).dragging) return;
      const offset = Number((this.data as any).dragOffset || 0);
      const elapsed = Date.now() - Number((this as any)._dragStartedAt || 0);
      const shouldClose = offset >= 88 || (offset >= 40 && elapsed <= 260);
      (this as any)._dragStartY = null;

      if (shouldClose) {
        const windowHeight = wx.getWindowInfo?.().windowHeight || 800;
        this.setData({
          closing: true,
          dragging: false,
          dragSettling: true,
          dragOffset: windowHeight,
        });
        this.scheduleClose();
        return;
      }

      this.setData({
        dragging: false,
        dragSettling: true,
        dragOffset: 0,
      });
      this.clearDragSettleTimer();
      (this as any)._dragSettleTimer = setTimeout(() => {
        (this as any)._dragSettleTimer = null;
        if (!(this.data as any).closing) this.setData({ dragSettling: false });
      }, 220);
    },

    onDragCancel() {
      this.onDragEnd();
    },

    selectProduct(event: WechatMiniprogram.TouchEvent) {
      if ((this.data as any).submittingId) return;
      const state = this.data as any;
      this.setData(
        productSelectionState(
          state.products as ProductView[],
          kindForMode(state.mode),
          String(event.currentTarget.dataset.id || ""),
          Boolean(state.isVip),
        ),
      );
    },

    async purchase() {
      if ((this as any)._purchaseBusy || (this.data as any).submittingId) return;
      const id = String((this.data as any).selectedProductId || "");
      const product = ((this.data as any).products as ProductView[]).find(
        (item) => item.id === id,
      );
      if (!product) return;

      (this as any)._purchaseBusy = true;
      this.setData({
        submittingId: product.id,
        statusMessage:
          product.purchaseState === "confirming"
            ? "正在确认上一笔订单状态…"
            : "正在创建安全支付订单…",
        error: "",
      });
      try {
        const outcome = await startVirtualPurchase(product);
        if (outcome.kind === "fulfilled") {
          this.setData({ statusMessage: "支付及权益发放均已完成" });
          if (claimVirtualFulfillmentNotification(outcome.order.orderNo)) {
            this.triggerEvent("success", {
              orderNo: outcome.order.orderNo,
              productKind: product.kind,
            });
            wx.showToast({ title: "购买权益已到账", icon: "success" });
          }
          this.setData({ submittingId: "" });
          this.triggerEvent("close");
          return;
        }
        if (outcome.kind === "pending") {
          this.setData({
            statusMessage:
              "订单状态仍在确认中，可稍后再次点击查询；期间不会创建重复扣款",
          });
          this.syncPendingProducts();
          return;
        }
        if (outcome.kind === "cancelled") {
          this.setData({ statusMessage: "支付已取消，未发生扣款，可重新购买" });
          this.syncPendingProducts();
          return;
        }
        this.setData({
          statusMessage: "",
          error: outcome.message,
        });
        this.syncPendingProducts();
      } catch (error) {
        this.setData({
          statusMessage: "",
          error: formatVirtualPaymentError(error),
        });
        this.syncPendingProducts();
      } finally {
        (this as any)._purchaseBusy = false;
        if ((this.data as any).submittingId) {
          this.setData({ submittingId: "" });
        }
      }
    },

    explainUnsupported() {
      const reason = String((this.data as any).capabilityReason || "");
      wx.showModal({
        title: "当前暂不支持购买",
        content: reason || "请升级微信或稍后重试。",
        confirmText: "知道了",
        showCancel: false,
      });
    },

    openOrders() {
      if ((this.data as any).submittingId) return;
      wx.navigateTo({
        url: "/package-settings/pages/virtual-orders/index",
      });
    },
  },
});
