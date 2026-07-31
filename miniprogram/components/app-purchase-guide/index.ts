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
  purchaseState: "" | "continue" | "confirming";
  purchaseLocked: boolean;
}

function toProductView(product: VirtualPaymentProduct): ProductView {
  const pending = getPendingVirtualPaymentForProduct(product.id);
  const purchaseState = pending
    ? pending.orderNo
      ? "confirming"
      : "continue"
    : "";
  return {
    ...product,
    purchaseState,
    purchaseLocked: purchaseState === "confirming",
    benefitText:
      product.kind === "coin"
        ? product.bonusCoinAmount
          ? `${product.coinAmount || 0} 咔豆 + 赠 ${product.bonusCoinAmount}`
          : `${product.coinAmount || 0} 咔豆`
        : `${product.vipDurationDays || 0} 天 VIP`,
  };
}

Component({
  properties: {
    open: { type: Boolean, value: false },
    mode: { type: String, value: "vip" },
    reason: { type: String, value: "" },
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
    submittingId: "",
  },

  observers: {
    "open, mode"(open: boolean) {
      if (!open) {
        this.clearCloseTimer();
        this.setData({
          closing: false,
          statusMessage: "",
          submittingId: "",
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
      (this as any)._unsubscribePending?.();
      (this as any)._unsubscribePending = undefined;
      (this as any)._loadSequence = Number((this as any)._loadSequence || 0) + 1;
    },
  },

  methods: {
    syncPendingProducts() {
      const products = ((this.data as any).products as ProductView[]).map(
        (product) => toProductView(product),
      );
      this.setData({ products });
    },

    clearCloseTimer() {
      const timer = (this as any)._closeTimer;
      if (timer) clearTimeout(timer);
      (this as any)._closeTimer = null;
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
          products: [],
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
        const expectedKind: VirtualProductKind =
          (this.data as any).mode === "recharge" ? "coin" : "vip";
        const products = (await listVirtualPaymentProducts())
          .filter((item) => item.kind === expectedKind)
          .map(toProductView);
        if (sequence !== (this as any)._loadSequence) return;
        this.setData({
          products,
          loaded: true,
          error: products.length ? "" : "当前暂无可购买的商品",
        });
      } catch (error) {
        if (sequence !== (this as any)._loadSequence) return;
        this.setData({
          products: [],
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
      this.clearCloseTimer();
      this.setData({ closing: true });
      (this as any)._closeTimer = setTimeout(() => {
        (this as any)._closeTimer = null;
        this.triggerEvent("close");
      }, 220);
    },

    preventClose() {},

    async purchase(event: WechatMiniprogram.TouchEvent) {
      if ((this as any)._purchaseBusy || (this.data as any).submittingId) return;
      const id = String(event.currentTarget.dataset.id || "");
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
          this.setData({ statusMessage: "支付已取消，正在确认订单最终状态" });
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
