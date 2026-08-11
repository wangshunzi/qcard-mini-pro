import { sessionStore } from "./stores/session";
import { mediaCoordinator } from "./services/MediaCoordinator";
import { logger } from "./utils/logger";
import { flushStudyReports } from "./stores/studyReportQueue";
import { trackDayBoundary } from "./stores/dataInvalidation";
import { refreshThemeBackgrounds } from "./design-system/themeBackground";
import {
  claimVirtualFulfillmentNotification,
  getPendingVirtualPaymentRecoveryDelay,
  resumePendingVirtualPayments,
  subscribePendingVirtualPayments,
} from "./services/virtualPayment";

let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let recoveryGeneration = 0;
let recoveryActive = false;
let appVisible = false;
let unsubscribePending: (() => void) | undefined;
let unsubscribeSession: (() => void) | undefined;

function installUpdateManager() {
  if (typeof wx.getUpdateManager !== "function") return;
  const manager = wx.getUpdateManager();
  manager.onUpdateReady(() => {
    wx.showModal({
      title: "新版本已就绪",
      content: "更新后可继续使用最新的购买与学习功能。",
      confirmText: "立即更新",
      showCancel: false,
      success: (result) => {
        if (result.confirm) manager.applyUpdate();
      },
    });
  });
  manager.onUpdateFailed(() => {
    wx.showToast({
      title: "新版本下载失败，请稍后重启小程序",
      icon: "none",
    });
  });
}

async function recoverVirtualPaymentOrders(force = false) {
  const orders = await resumePendingVirtualPayments({ force });
  const newlyFulfilled = orders.filter((order) =>
    claimVirtualFulfillmentNotification(order.orderNo),
  );
  if (!newlyFulfilled.length) return;
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as
    | (WechatMiniprogram.Page.Instance<
        WechatMiniprogram.IAnyObject,
        WechatMiniprogram.IAnyObject
      > & {
        onVirtualPaymentFulfilled?: () => void | Promise<void>;
      })
    | undefined;
  try {
    await currentPage?.onVirtualPaymentFulfilled?.();
  } catch (error) {
    logger.warn("虚拟支付到账后刷新当前页面失败", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  wx.showToast({
    title:
      newlyFulfilled.length > 1
        ? `${newlyFulfilled.length}笔购买已到账`
        : "购买权益已到账",
    icon: "success",
  });
}

function startVirtualPaymentRecovery() {
  if (!appVisible || recoveryActive) return;
  if (getPendingVirtualPaymentRecoveryDelay() === null) return;
  recoveryActive = true;
  recoveryGeneration += 1;
  const generation = recoveryGeneration;
  if (recoveryTimer) clearTimeout(recoveryTimer);
  let firstRun = true;
  const run = async () => {
    try {
      await recoverVirtualPaymentOrders(firstRun);
      firstRun = false;
    } catch (error) {
      logger.warn("恢复虚拟支付订单失败", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (generation === recoveryGeneration) {
        const delay = getPendingVirtualPaymentRecoveryDelay();
        if (appVisible && delay !== null) {
          recoveryTimer = setTimeout(
            () => void run(),
            Math.max(1000, delay),
          );
        } else {
          recoveryTimer = undefined;
          recoveryActive = false;
        }
      }
    }
  };
  void run();
}

function stopVirtualPaymentRecovery() {
  recoveryGeneration += 1;
  if (recoveryTimer) clearTimeout(recoveryTimer);
  recoveryTimer = undefined;
  recoveryActive = false;
}

App({
  globalData: {
    sessionStore,
  },
  onLaunch() {
    trackDayBoundary();
    sessionStore.hydrate();
    unsubscribePending = subscribePendingVirtualPayments(() => {
      if (getPendingVirtualPaymentRecoveryDelay() === null) {
        stopVirtualPaymentRecovery();
      } else {
        startVirtualPaymentRecovery();
      }
    });
    unsubscribeSession = sessionStore.subscribe((session) => {
      if (!session) {
        stopVirtualPaymentRecovery();
        return;
      }
      startVirtualPaymentRecovery();
    });
    installUpdateManager();
    void flushStudyReports();
  },
  onShow() {
    appVisible = true;
    trackDayBoundary();
    void flushStudyReports();
    startVirtualPaymentRecovery();
  },
  onHide() {
    appVisible = false;
    stopVirtualPaymentRecovery();
    mediaCoordinator.pauseAll();
  },
  onThemeChange({ theme }) {
    refreshThemeBackgrounds(theme === "dark" ? "dark" : "light");
  },
  onUnload() {
    unsubscribePending?.();
    unsubscribePending = undefined;
    unsubscribeSession?.();
    unsubscribeSession = undefined;
    stopVirtualPaymentRecovery();
  },
  onError(message) {
    logger.error("小程序运行时异常", { message });
  },
  onUnhandledRejection(result) {
    logger.error("未处理的 Promise 异常", {
      reason: String(result.reason),
    });
  },
});
