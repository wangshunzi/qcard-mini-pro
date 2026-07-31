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
    expect(service).toContain('"X-Client-Platform"');
    expect(service).toContain(
      "data: { productId, wxCode, clientRequestId }",
    );
    expect(service.indexOf("savePending(pending)")).toBeLessThan(
      service.indexOf("requestVirtualPayment(prepared)"),
    );
    const purchaseComponent = read(
      "miniprogram/components/app-purchase-guide/index.ts",
    );
    expect(purchaseComponent).toContain("(this as any)._purchaseBusy = true");
    expect(purchaseComponent).toContain("(this as any)._purchaseBusy = false");
  });
});
