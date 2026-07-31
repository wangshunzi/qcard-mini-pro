import { createHash } from "node:crypto";
import {
  CLIENT_CARD_ASSET_BASE_URL,
  CLIENT_CARD_ASSETS,
} from "./client-card-assets.mjs";

const baseUrl = "https://www.kolka.cn";
const headers = {
  appname: "kolka-miniprogram",
  platform: "wechat_miniprogram",
};

async function expectApi(path, validate) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
  const body = await response.json();
  if (body.code !== 2000) {
    throw new Error(`${path}: ${body.message || `业务码 ${body.code}`}`);
  }
  if (validate && !validate(body.data)) {
    throw new Error(`${path}: 响应数据结构不正确`);
  }
  console.log(`PASS ${path}`);
}

async function expectDocument(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/html")) {
    throw new Error(`${path}: 协议文档不可访问`);
  }
  console.log(`PASS ${path}`);
}

async function expectVirtualPaymentCallbackRoute() {
  const path =
    "/api/wechat/miniprogram/xpay/callback?signature=release-probe&timestamp=1&nonce=release-probe&echostr=release-probe";
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(8000),
    redirect: "manual",
  });
  const body = await response.text();
  if (
    response.status === 404 ||
    response.status >= 500 ||
    /Cannot\s+GET/i.test(body)
  ) {
    throw new Error(
      `/api/wechat/miniprogram/xpay/callback: 回调路由未部署或配置异常（HTTP ${response.status}）`,
    );
  }
  console.log("PASS 微信虚拟支付回调路由");
}

async function expectCardAsset([path, expectedHash]) {
  const response = await fetch(`${CLIENT_CARD_ASSET_BASE_URL}/${path}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`卡片素材 ${path}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`卡片素材 ${path}: 内容哈希与 Client 不一致`);
  }
}

async function expectCardAssets() {
  const entries = Object.entries(CLIENT_CARD_ASSETS);
  const concurrency = 8;
  const failures = [];
  for (let index = 0; index < entries.length; index += concurrency) {
    const batch = entries.slice(index, index + concurrency);
    const results = await Promise.allSettled(batch.map(expectCardAsset));
    results.forEach((result) => {
      if (result.status === "rejected") {
        failures.push(
          result.reason instanceof Error ? result.reason.message : String(result.reason),
        );
      }
    });
  }
  if (failures.length) {
    const details = failures.slice(0, 3).join("；");
    const remainder =
      failures.length > 3 ? `；另有 ${failures.length - 3} 个素材失败` : "";
    throw new Error(`${details}${remainder}`);
  }
  console.log(`PASS Client 卡片素材（${entries.length} 个）`);
}

async function main() {
  const checks = [
    () =>
      expectApi(
        "/api/client/home",
        (data) =>
          data &&
          Array.isArray(data.recentStudy) &&
          Array.isArray(data.promotions),
      ),
    () =>
      expectApi(
        "/api/client/products?channel=wechat_virtual&env=0",
        // A 200 + [] is deliberately returned when XPay is disabled, not
        // ready, or running in sandbox. A release must prove that production
        // has at least one fully confirmed, enabled item that users can buy.
        (data) => Array.isArray(data) && data.length > 0,
      ),
    () => expectVirtualPaymentCallbackRoute(),
    () =>
      expectApi(
        `/api/client/hanzi-data/${encodeURIComponent("我")}`,
        (data) =>
          data &&
          Array.isArray(data.strokes) &&
          data.strokes.length > 0 &&
          Array.isArray(data.medians),
      ),
    () => expectDocument("/user_agreement.html"),
    () => expectDocument("/privacy.html"),
    () => expectDocument("/app.html"),
    () => expectCardAssets(),
  ];
  const results = await Promise.allSettled(checks.map((check) => check()));
  const failures = results.flatMap((result) =>
    result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : String(result.reason)]
      : [],
  );
  if (failures.length) {
    throw new Error(`\n- ${failures.join("\n- ")}`);
  }
  console.log("生产依赖检查通过");
}

main().catch((error) => {
  console.error(
    `发布阻断：${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
});
