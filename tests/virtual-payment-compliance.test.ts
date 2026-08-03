import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

const paymentSurfaces = [
  "miniprogram/components/app-purchase-guide/index.ts",
  "miniprogram/components/app-purchase-guide/index.wxml",
  "miniprogram/pages/home/index.ts",
  "miniprogram/pages/home/index.wxml",
  "miniprogram/pages/resource/index.ts",
  "miniprogram/pages/resource/index.wxml",
  "miniprogram/pages/profile/index.ts",
  "miniprogram/pages/profile/index.wxml",
  "miniprogram/package-cards/pages/pack-detail/index.ts",
  "miniprogram/package-cards/pages/pack-detail/index.wxml",
  "miniprogram/package-cards/pages/study/index.ts",
  "miniprogram/package-cards/pages/study/index.wxml",
  "miniprogram/package-cards/pages/teacher/index.ts",
  "miniprogram/package-cards/pages/teacher/index.wxml",
  "miniprogram/package-cards/pages/ai-generate/index.ts",
  "miniprogram/package-cards/pages/ai-generate/index.wxml",
];

describe("virtual-payment compliance", () => {
  it("contains no external purchase diversion in payment surfaces", () => {
    const forbidden = [
      /前往\s*App/i,
      /下载.*App/i,
      /App\s*Store/i,
      /应用商店/,
      /小程序不提供(?:充值|订阅|购买)/,
      /联系客服.*(?:充值|订阅|购买|开通)/,
      /doc=app_download/,
      /open-type="contact"/,
    ];
    for (const path of paymentSurfaces) {
      const source = read(path);
      for (const pattern of forbidden) {
        expect(source, `${path} 命中 ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("wires every purchase surface to an entitlement refresh handler", () => {
    for (const path of paymentSurfaces.filter((item) => item.endsWith(".wxml"))) {
      const source = read(path);
      if (!source.includes("<app-purchase-guide")) continue;
      expect(source, path).toContain(
        'bind:success="onVirtualPaymentFulfilled"',
      );
    }
  });

  it("shows fixed-duration VIP and coin products in one H5-aligned drawer", () => {
    const logic = read(
      "miniprogram/components/app-purchase-guide/index.ts",
    );
    const template = read(
      "miniprogram/components/app-purchase-guide/index.wxml",
    );
    expect(logic).toContain('item.kind === "vip"');
    expect(logic).toContain('item.kind === "coin"');
    expect(logic).not.toContain(".filter((item) => item.kind === expectedKind)");
    expect(template).toContain("会员与咔豆");
    expect(template).toContain('wx:for="{{subscriptionProducts}}"');
    expect(template).toContain('wx:for="{{coinProducts}}"');
    expect(template).toContain("固定时长 · 一次性购买 · 不自动续费");
    expect(template).toContain('bindtap="selectProduct"');
    expect(template).toContain('bindtap="purchase"');
    expect(logic).toContain("baseCoinAmount + bonusCoinAmount");
    expect(logic).toContain("bonusCoinDescription");
    expect(logic).toContain("selectedProduct.totalCoinAmount");
    expect(template).toContain("coin-bonus-tag");
    expect(template).toContain("item.bonusCoinAmount");
  });

  it("removes VIP products from the selectable state for active members", () => {
    const logic = read(
      "miniprogram/components/app-purchase-guide/index.ts",
    );
    const template = read(
      "miniprogram/components/app-purchase-guide/index.wxml",
    );

    expect(logic).toContain("const availableProducts = isVip");
    expect(logic).toContain('products.filter((item) => item.kind !== "vip")');
    expect(logic).toContain("products: availableProducts");
    expect(template).toContain("VIP 商品不再重复展示");
    expect(template).toContain("capabilitySupported && products.length");
  });

  it("locks host-page scrolling and provides a real drag-to-dismiss drawer", () => {
    const logic = read(
      "miniprogram/components/app-purchase-guide/index.ts",
    );
    const template = read(
      "miniprogram/components/app-purchase-guide/index.wxml",
    );
    const styles = read(
      "miniprogram/components/app-purchase-guide/index.wxss",
    );
    const contexts = paymentSurfaces.filter((item) => item.endsWith(".wxml") &&
      item !== "miniprogram/components/app-purchase-guide/index.wxml");

    expect(template).toContain('bindtouchstart="onDragStart"');
    expect(template).toContain('catchtouchmove="onDragMove"');
    expect(template).toContain('bindtouchend="onDragEnd"');
    expect(logic).toContain("onDragStart(event:");
    expect(logic).toContain("const shouldClose = offset >= 88");
    expect(styles).toContain("grid-template-columns:minmax(0,1fr) minmax(0,1fr)");
    for (const context of contexts) {
      const source = read(context);
      expect(source.trimStart(), context).toMatch(/^<page-meta\b/);
      expect(source, context).toContain("purchaseGuideOpen");
      expect(source, context).toContain("overflow: hidden;");
    }
  });

  it("keeps Client-aligned VIP benefits and entry points in the mini program", () => {
    const guide = read(
      "miniprogram/components/app-purchase-guide/index.wxml",
    );
    const sideMenu = read(
      "miniprogram/components/side-drawer-menu/index.wxml",
    );
    const sideMenuLogic = read(
      "miniprogram/components/side-drawer-menu/index.ts",
    );
    const profile = read("miniprogram/pages/profile/index.wxml");
    const benefits = [
      "卡包免费观看",
      "每日咔豆领取",
      "专属 AI 模板",
      "AI 制卡助手",
    ];

    for (const benefit of benefits) {
      expect(guide).toContain(benefit);
      expect(profile).toContain(benefit);
    }
    expect(guide).toContain("当前账号已开通 VIP");
    expect(guide).toContain("一次性购买 · 不自动续费");
    expect(sideMenu).toContain("开通 VIP · 解锁特权");
    expect(sideMenu).toContain("vipExpireText");
    expect(sideMenuLogic).toContain('this.triggerEvent("vip")');
    expect(profile).toContain('bind:vip="openVipGuide"');
    expect(profile).toContain("tab-notice-dot");
    expect(read("miniprogram/components/ui-icon/index.ts")).toContain(
      "crown: String.fromCodePoint(983461)",
    );
    expect(
      read("miniprogram/package-cards/pages/ai-generate/index.wxml"),
    ).not.toContain("♛");
  });

  it("keeps signed material out of persistent pending records", () => {
    const service = read("miniprogram/services/virtualPayment.ts");
    const pendingInterface = service.slice(
      service.indexOf("export interface PendingVirtualPayment"),
      service.indexOf("export type VirtualPurchaseOutcome"),
    );
    expect(pendingInterface).not.toContain("session_key");
    expect(pendingInterface).not.toContain("paySig");
    expect(pendingInterface).not.toContain("signature");
    expect(pendingInterface).not.toContain("signData");
    expect(service).toContain("savePending(pending)");
    expect(service).toContain("const orderPersisted = updatePending(");
    expect(service).toContain("if (!orderPersisted)");
    expect(service).toContain('"X-Client-Platform"');
    expect(service).toContain("expectedEnv,");
    expect(service).toContain(
      'data: { channel: "wechat_virtual" }',
    );
    expect(service).toContain("reportVirtualPaymentInvocationFailure");
    expect(service).toContain("shouldReconcileVirtualPaymentFailure");
    expect(service.indexOf("savePending(pending)")).toBeLessThan(
      service.indexOf("requestVirtualPayment(prepared)"),
    );
    expect(service.indexOf("const orderPersisted = updatePending(")).toBeLessThan(
      service.indexOf("requestVirtualPayment(prepared)"),
    );
    const purchaseComponent = read(
      "miniprogram/components/app-purchase-guide/index.ts",
    );
    expect(purchaseComponent).toContain("(this as any)._purchaseBusy = true");
    expect(purchaseComponent).toContain("(this as any)._purchaseBusy = false");
  });

  it("locks a user/product checkout and bounds background reconciliation", () => {
    const service = read("miniprogram/services/virtualPayment.ts");
    const component = read(
      "miniprogram/components/app-purchase-guide/index.wxml",
    );
    const app = read("miniprogram/app.ts");
    expect(service).toContain("getPendingVirtualPaymentForProduct(product.id)");
    expect(service).toContain("const purchasePromises = new Map");
    expect(service).toContain("item.productId === record.productId");
    expect(service).toContain("PENDING_QUERY_CONCURRENCY = 3");
    expect(service).toContain(
      "Date.parse(record.reconciliationDeadlineAt) > now",
    );
    expect(service).toContain("RECONCILIATION_MAX_RETRY_MS");
    expect(service).toContain("reconciliationPollAttempts");
    expect(service).toContain("normalizePendingVirtualPaymentRecord");
    expect(service).toContain(
      "signedEnvironment !== product.paymentEnv",
    );
    expect(service.indexOf("signedEnvironment !== product.paymentEnv"))
      .toBeLessThan(
        service.indexOf(
          "const paymentResult = await requestVirtualPayment(prepared)",
        ),
      );
    expect(service.indexOf("Date.parse(prepared.expiresAt) <= Date.now()"))
      .toBeLessThan(
        service.indexOf(
          "const paymentResult = await requestVirtualPayment(prepared)",
        ),
      );
    expect(component).toContain("item.purchaseLocked");
    expect(component).toContain("点击可立即查询状态");
    expect(component).not.toContain(
      'disabled="{{submittingId || item.purchaseLocked}}"',
    );
    expect(app).toContain("getPendingVirtualPaymentRecoveryDelay");
    expect(app).toContain("unsubscribeSession = sessionStore.subscribe");
    expect(app).toContain("unsubscribeSession?.()");
    expect(app).not.toContain("setTimeout(() => void run(), 5000)");
    const ordersPage = read(
      "miniprogram/package-settings/pages/virtual-orders/index.ts",
    );
    expect(ordersPage).toContain("ORDER_PAGE_POLL_DELAYS_MS");
    expect(ordersPage).toContain(
      "attempt >= ORDER_PAGE_POLL_DELAYS_MS.length",
    );
    expect(ordersPage).toContain("Preserve bounded polling");
    const ordersTemplate = read(
      "miniprogram/package-settings/pages/virtual-orders/index.wxml",
    );
    expect(ordersTemplate).toContain('wx:if="{{error}}" class="inline-error"');
  });

  it("uses fresh WeChat codes for binding and prepare retries", () => {
    const auth = read("miniprogram/services/auth.ts");
    const service = read("miniprogram/services/virtualPayment.ts");
    expect(auth).toContain('path: "/api/client/auth/wechat-mini-bind"');
    expect(auth).toContain("const code = await getWechatLoginCode()");
    expect(auth).toContain("return await requestWechatLoginCode()");
    expect(auth).toContain("attempt === maxAttempts - 1");
    expect(service).toContain("const wxCode = await getWechatLoginCode()");
    expect(service).toContain("expectedEnv,");
    expect(service).toContain("retry: false");
    expect(service).toContain("await bindCurrentWechatMiniIdentity()");
  });

  it("blocks a production release unless an env=0 virtual item is saleable", () => {
    const releaseCheck = read("scripts/check-production.mjs");
    expect(releaseCheck).toContain(
      '"/api/client/products?channel=wechat_virtual"',
    );
    expect(releaseCheck).toContain(
      "data?.env === 0",
    );
  });
});
