import { describe, expect, it } from "vitest";
import {
  buildVirtualPaymentInvocation,
  classifyVirtualPaymentFailure,
  compareVersion,
  evaluateVirtualPaymentCapability,
  isSandboxVirtualPayment,
  isVirtualOrderFulfilled,
  normalizeVirtualPaymentOrder,
  normalizeVirtualProduct,
  type PreparedVirtualPayment,
} from "../miniprogram/services/virtualPayment";

describe("WeChat virtual payment", () => {
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
  });
});
