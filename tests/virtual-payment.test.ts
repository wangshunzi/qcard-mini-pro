import { describe, expect, it, vi } from "vitest";
import {
  buildVirtualPaymentInvocation,
  classifyVirtualPaymentFailure,
  compareVersion,
  evaluateVirtualPaymentCapability,
  getVirtualOrderPresentation,
  getPendingVirtualPaymentRetryDelay,
  getSignedVirtualPaymentEnvironment,
  isSandboxVirtualPayment,
  isVirtualOrderFulfilled,
  normalizePendingVirtualPaymentRecord,
  normalizeVirtualPaymentOrder,
  normalizeVirtualProduct,
  sanitizeVirtualPaymentDiagnostic,
  shouldReconcileVirtualPaymentFailure,
  type PreparedVirtualPayment,
  VIRTUAL_PAYMENT_RECONCILIATION_WINDOW_MS,
} from "../miniprogram/services/virtualPayment";
import { resolveRuntimeEnvironment } from "../miniprogram/config/env";
import { getWechatLoginCode } from "../miniprogram/services/auth";

describe("WeChat virtual payment", () => {
  it("keeps the configured coin bonus used by the App UI", () => {
    expect(
      normalizeVirtualProduct({
        id: "coin-60",
        type: "coin_package",
        price: 600,
        coinAmount: 60,
        bonusCoinAmount: 2,
        bonusCoinDescription: "限时额外赠送 2 咔豆",
      }),
    ).toMatchObject({
      coinAmount: 60,
      bonusCoinAmount: 2,
      bonusCoinDescription: "限时额外赠送 2 咔豆",
    });
  });

  it("evaluates base-library and iOS requirements", () => {
    expect(compareVersion("3.7.10", "2.19.2")).toBe(1);
    expect(compareVersion("2.19.2", "2.19.2")).toBe(0);
    expect(
      evaluateVirtualPaymentCapability(
        {
          platform: "ios",
          SDKVersion: "3.7.10",
          version: "8.0.68",
          system: "iOS 15.0",
        },
        true,
      ).supported,
    ).toBe(true);
    expect(
      evaluateVirtualPaymentCapability(
        {
          platform: "ios",
          SDKVersion: "3.7.10",
          version: "8.0.67",
          system: "iOS 17.5",
        },
        true,
      ),
    ).toMatchObject({
      supported: false,
      action: "upgrade_wechat",
    });
    expect(
      evaluateVirtualPaymentCapability(
        { platform: "devtools", SDKVersion: "3.7.10" },
        true,
      ),
    ).toMatchObject({ supported: false, action: "use_device" });
    expect(
      evaluateVirtualPaymentCapability(
        {
          platform: "android",
          SDKVersion: "3.7.10",
          system: "HarmonyOS 4.2",
        },
        true,
      ).platform,
    ).toBe("harmony");
  });

  it("passes the server-signed signData string byte-for-byte", () => {
    const signData =
      '{"offerId":"100","attach":"保留\\\\转义","buyQuantity":1,"env":0}';
    const prepared: PreparedVirtualPayment = {
      orderNo: "ORDER123",
      outTradeNo: "OUTORDER123",
      mode: "short_series_goods",
      signData,
      paySig: "pay-signature",
      signature: "user-signature",
      expiresAt: "2030-01-01T00:00:00.000Z",
    };
    const invocation = buildVirtualPaymentInvocation(prepared);
    expect(invocation.signData).toBe(signData);
    expect(invocation).toEqual({
      mode: "short_series_goods",
      signData,
      paySig: "pay-signature",
      signature: "user-signature",
    });
  });

  it("defensively rejects iOS sandbox payloads without reserializing them", () => {
    expect(isSandboxVirtualPayment('{"env":1,"offerId":"test"}')).toBe(true);
    expect(isSandboxVirtualPayment('{"env":0,"offerId":"test"}')).toBe(false);
    expect(isSandboxVirtualPayment("not-json")).toBe(false);
    expect(getSignedVirtualPaymentEnvironment('{"env":0}')).toBe(0);
    expect(getSignedVirtualPaymentEnvironment('{"env":1}')).toBe(1);
    expect(getSignedVirtualPaymentEnvironment('{"env":"1"}')).toBeNull();
    expect(getSignedVirtualPaymentEnvironment("not-json")).toBeNull();
  });

  it("retries wx.login with a new one-time credential attempt", async () => {
    const originalWx = (globalThis as any).wx;
    let attempts = 0;
    vi.useFakeTimers();
    (globalThis as any).wx = {
      login(options: {
        success: (result: { code: string }) => void;
        fail: (result: { errMsg: string }) => void;
      }) {
        attempts += 1;
        if (attempts === 1) {
          options.fail({ errMsg: "wx.login:fail network" });
          return;
        }
        options.success({ code: `fresh-code-${attempts}` });
      },
    };
    try {
      const codePromise = getWechatLoginCode();
      await vi.runAllTimersAsync();
      await expect(codePromise).resolves.toBe("fresh-code-2");
      expect(attempts).toBe(2);
    } finally {
      vi.useRealTimers();
      if (originalWx === undefined) delete (globalThis as any).wx;
      else (globalThis as any).wx = originalWx;
    }
  });

  it("keeps legacy orders reconcilable after signature expiry with a hard deadline", () => {
    const createdAt = Date.UTC(2030, 0, 1);
    const signatureExpiresAt = new Date(createdAt + 10 * 60 * 1000).toISOString();
    const oneDayLater = createdAt + 24 * 60 * 60 * 1000;
    const legacy = normalizePendingVirtualPaymentRecord(
      {
        orderNo: "LEGACY-PENDING",
        outTradeNo: "LEGACY-OUT",
        clientRequestId: "request-1",
        productId: "coins-100",
        productName: "100 咔豆",
        productKind: "coin",
        createdAt,
        expiresAt: signatureExpiresAt,
        userId: "user-1",
        paymentUiResult: "accepted",
      },
      oneDayLater,
    );
    expect(legacy).not.toBeNull();
    if (!legacy) throw new Error("legacy pending order was discarded");
    expect(Date.parse(legacy.reconciliationDeadlineAt)).toBe(
      createdAt + VIRTUAL_PAYMENT_RECONCILIATION_WINDOW_MS,
    );
    expect(getPendingVirtualPaymentRetryDelay(legacy, oneDayLater)).toBe(
      15 * 60 * 1000,
    );
    expect(
      getPendingVirtualPaymentRetryDelay(
        { ...legacy, pollAttempts: 6 },
        oneDayLater,
      ),
    ).toBe(15 * 60 * 1000);
    expect(
      getPendingVirtualPaymentRetryDelay(
        { ...legacy, pollAttempts: 6, reconciliationPollAttempts: 1 },
        oneDayLater,
      ),
    ).toBe(30 * 60 * 1000);
    expect(
      normalizePendingVirtualPaymentRecord(
        legacy,
        createdAt + VIRTUAL_PAYMENT_RECONCILIATION_WINDOW_MS,
      ),
    ).toBeNull();
  });

  it("drops an orderless intent when its payment signature expires", () => {
    const createdAt = Date.UTC(2030, 0, 1);
    expect(
      normalizePendingVirtualPaymentRecord(
        {
          clientRequestId: "request-no-order",
          productId: "coins-100",
          productName: "100 咔豆",
          productKind: "coin",
          createdAt,
          expiresAt: new Date(createdAt + 1000).toISOString(),
          userId: "user-1",
          paymentUiResult: "waiting",
        },
        createdAt + 1001,
      ),
    ).toBeNull();
  });

  it("only considers an order delivered when both status axes succeed", () => {
    const paidOnly = normalizeVirtualPaymentOrder({
      orderNo: "ORDER123",
      productPrice: 600,
      paymentStatus: "SUCCEEDED",
      fulfillmentStatus: "PENDING",
      refundStatus: "NONE",
    });
    expect(paidOnly.amountInCents).toBe(600);
    expect(isVirtualOrderFulfilled(paidOnly)).toBe(false);
    expect(
      isVirtualOrderFulfilled({
        ...paidOnly,
        fulfillmentStatus: "SUCCEEDED",
      }),
    ).toBe(true);
  });

  it("normalizes legacy expiry and keeps refunding orders out of arrived state", () => {
    expect(
      normalizeVirtualPaymentOrder({
        orderNo: "LEGACY-EXPIRED",
        status: "expired",
      }).paymentStatus,
    ).toBe("CLOSED");

    const refunding = normalizeVirtualPaymentOrder({
      orderNo: "REFUNDING",
      paymentStatus: "SUCCEEDED",
      fulfillmentStatus: "SUCCEEDED",
      refundStatus: "UNKNOWN",
    });
    expect(isVirtualOrderFulfilled(refunding)).toBe(false);
    expect(getVirtualOrderPresentation(refunding)).toMatchObject({
      completed: false,
      processing: true,
      fulfillmentLabel: "权益状态确认中",
      refundLabel: "退款状态确认中",
    });

    const deliveryFailed = normalizeVirtualPaymentOrder({
      orderNo: "DELIVERY-FAILED",
      paymentStatus: "SUCCEEDED",
      fulfillmentStatus: "FAILED",
      refundStatus: "NONE",
    });
    expect(getVirtualOrderPresentation(deliveryFailed)).toMatchObject({
      processing: true,
      fulfillmentLabel: "发放异常",
    });
  });

  it("uses one API host while payment environment is selected by Server", () => {
    expect(resolveRuntimeEnvironment("develop")).toEqual({
      envVersion: "develop",
      apiBaseUrl: "https://www.kolka.cn",
    });
    expect(resolveRuntimeEnvironment("trial")).toEqual({
      envVersion: "trial",
      apiBaseUrl: "https://www.kolka.cn",
    });
    expect(resolveRuntimeEnvironment("release")).toEqual({
      envVersion: "release",
      apiBaseUrl: "https://www.kolka.cn",
    });
  });

  it("retains diagnostic error context while redacting signed secrets", () => {
    const diagnostic = sanitizeVirtualPaymentDiagnostic(
      "requestVirtualPayment:fail errCode=-15010 paySig=abc signature=def",
    );
    expect(diagnostic).toContain("errCode=-15010");
    expect(diagnostic).not.toContain("paySig=abc");
    expect(diagnostic).not.toContain("signature=def");
  });

  it("normalizes unified coin and VIP products without using client prices for prepare", () => {
    expect(
      normalizeVirtualProduct({
        id: "coins-100",
        name: "100 咔豆",
        productType: "coin_package",
        price: "600",
        coinAmount: 100,
      }),
    ).toMatchObject({
      kind: "coin",
      priceInCents: 600,
      coinAmount: 100,
    });
    expect(
      normalizeVirtualProduct({
        id: "vip-30",
        name: "30 天 VIP",
        fulfillmentType: "VIP",
        priceInCents: 1800,
        vipDurationDays: 30,
      }),
    ).toMatchObject({
      kind: "vip",
      priceInCents: 1800,
      vipDurationDays: 30,
    });
  });

  it("maps cancellation, expiry, rate limits and configuration failures", () => {
    expect(classifyVirtualPaymentFailure(-2)).toMatchObject({
      cancelled: true,
    });
    expect(classifyVirtualPaymentFailure(-15007)).toMatchObject({
      retryable: true,
    });
    expect(classifyVirtualPaymentFailure(-15020).message).toContain("频繁");
    expect(classifyVirtualPaymentFailure(-15010)).toMatchObject({
      retryable: false,
    });
    expect(classifyVirtualPaymentFailure(-15006).message).toContain("签名");
    expect(classifyVirtualPaymentFailure(-15013).message).toContain("价格");
    expect(shouldReconcileVirtualPaymentFailure(-1)).toBe(true);
    expect(shouldReconcileVirtualPaymentFailure(-5)).toBe(true);
    expect(shouldReconcileVirtualPaymentFailure(-15003)).toBe(true);
    expect(shouldReconcileVirtualPaymentFailure(-15006)).toBe(false);
    expect(shouldReconcileVirtualPaymentFailure(-2)).toBe(false);
  });
});
