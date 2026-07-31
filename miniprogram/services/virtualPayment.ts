import { request } from "./http";
import { sessionStore } from "../stores/session";
import { createRequestId } from "../utils/requestId";

export type VirtualProductKind = "coin" | "vip";
export type VirtualPaymentMode = "short_series_goods";

export interface VirtualPaymentProduct {
  id: string;
  name: string;
  description: string;
  kind: VirtualProductKind;
  priceInCents: number;
  displayPrice: string;
  coinAmount?: number;
  bonusCoinAmount?: number;
  vipDurationDays?: number;
  badge?: string;
}

interface VirtualPaymentProductPayload {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  productType?: string;
  type?: string;
  fulfillmentType?: string;
  price?: number | string;
  priceInCents?: number;
  coinAmount?: number;
  bonusCoinAmount?: number;
  subscriptionDurationDays?: number;
  vipDurationDays?: number;
  badge?: string;
  isRecommended?: boolean;
  tags?: string | string[];
  channelMapping?: {
    priceInCents?: number;
    status?: string;
  };
}

export interface PreparedVirtualPayment {
  orderNo: string;
  outTradeNo: string;
  mode: VirtualPaymentMode;
  signData: string;
  paySig: string;
  signature: string;
  expiresAt: string;
}

export type PaymentAxisStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "CLOSED"
  | "UNKNOWN";

export type FulfillmentAxisStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "REVERSED"
  | "UNKNOWN";

export type RefundAxisStatus =
  | "NONE"
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN";

export interface VirtualPaymentOrder {
  id?: string;
  orderNo: string;
  outTradeNo?: string;
  productId?: string;
  productName: string;
  productKind?: VirtualProductKind;
  amountInCents: number;
  paymentStatus: PaymentAxisStatus;
  fulfillmentStatus: FulfillmentAxisStatus;
  refundStatus: RefundAxisStatus;
  createdAt: string;
  updatedAt?: string;
}

interface VirtualPaymentOrderPayload {
  id?: string;
  orderNo?: string;
  orderNumber?: string;
  outTradeNo?: string;
  productId?: string;
  productName?: string;
  productPrice?: number;
  amountInCents?: number;
  amount?: number | string;
  totalAmount?: number | string;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  refundStatus?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  productSnapshot?: {
    name?: string;
    productType?: string;
    fulfillmentType?: string;
    priceInCents?: number;
    price?: number | string;
  };
  product?: {
    id?: string;
    name?: string;
    productType?: string;
    type?: string;
  };
}

export interface VirtualPaymentOrderPage {
  items: VirtualPaymentOrder[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VirtualPaymentCapability {
  supported: boolean;
  reason: string;
  action: "none" | "upgrade_wechat" | "use_device";
  platform: string;
}

export interface PendingVirtualPayment {
  orderNo: string;
  outTradeNo: string;
  clientRequestId: string;
  productId: string;
  productName: string;
  productKind: VirtualProductKind;
  createdAt: number;
  expiresAt: string;
  userId: string;
  paymentUiResult: "waiting" | "accepted" | "cancelled" | "failed";
  pollAttempts?: number;
  nextCheckAt?: number;
}

export type VirtualPurchaseOutcome =
  | { kind: "fulfilled"; order: VirtualPaymentOrder }
  | { kind: "pending"; order: VirtualPaymentOrder | null }
  | { kind: "cancelled"; order: VirtualPaymentOrder | null }
  | { kind: "failed"; order: VirtualPaymentOrder | null; message: string };

export interface VirtualPaymentFailure {
  code: number;
  cancelled: boolean;
  retryable: boolean;
  message: string;
}

interface SystemSnapshot {
  SDKVersion?: string;
  version?: string;
  system?: string;
  platform?: string;
}

const PENDING_STORAGE_KEY = "qcard.virtual-payment.pending.v1";
const MIN_BASE_LIBRARY_VERSION = "2.19.2";
const MIN_IOS_VERSION = "15.0.0";
const MIN_IOS_WECHAT_VERSION = "8.0.68";
const TERMINAL_PAYMENT_STATUSES = new Set([
  "FAILED",
  "CANCELLED",
  "CLOSED",
]);
const MAX_PENDING_RECORDS = 20;
const MAX_PENDING_AGE_MS = 7 * 24 * 60 * 60 * 1000;
let resumePromise: Promise<VirtualPaymentOrder[]> | null = null;
const reportedFulfillmentOrderNos = new Set<string>();

export function compareVersion(left: string, right: string) {
  const leftParts = String(left || "0").split(".");
  const rightParts = String(right || "0").split(".");
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = Number.parseInt(leftParts[index] || "0", 10) || 0;
    const rightPart = Number.parseInt(rightParts[index] || "0", 10) || 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

function parseIosVersion(system: string) {
  const match = String(system || "").match(/iOS\s+([\d.]+)/i);
  return match?.[1] || "0";
}

export function evaluateVirtualPaymentCapability(
  system: SystemSnapshot,
  canRequestVirtualPayment: boolean,
): VirtualPaymentCapability {
  const rawPlatform = String(system.platform || "").toLowerCase();
  const platform =
    /harmony|ohos/i.test(`${rawPlatform} ${system.system || ""}`)
      ? "harmony"
      : rawPlatform;
  if (platform === "devtools") {
    return {
      supported: false,
      reason: "虚拟支付需要在支持的真机微信中完成",
      action: "use_device",
      platform,
    };
  }

  const baseLibrarySupported =
    compareVersion(system.SDKVersion || "0", MIN_BASE_LIBRARY_VERSION) >= 0 ||
    canRequestVirtualPayment;
  if (!baseLibrarySupported) {
    return {
      supported: false,
      reason: "当前微信版本暂不支持小程序虚拟支付，请升级微信后重试",
      action: "upgrade_wechat",
      platform,
    };
  }

  if (platform === "ios") {
    if (compareVersion(parseIosVersion(system.system || ""), MIN_IOS_VERSION) < 0) {
      return {
        supported: false,
        reason: "iPhone 需升级至 iOS 15 或更高版本后购买",
        action: "upgrade_wechat",
        platform,
      };
    }
    if (
      compareVersion(system.version || "0", MIN_IOS_WECHAT_VERSION) < 0
    ) {
      return {
        supported: false,
        reason: "iPhone 需升级至微信 8.0.68 或更高版本后购买",
        action: "upgrade_wechat",
        platform,
      };
    }
  }

  return {
    supported: true,
    reason: "",
    action: "none",
    platform,
  };
}

export function getVirtualPaymentCapability(): VirtualPaymentCapability {
  let system: SystemSnapshot = {};
  try {
    system = wx.getSystemInfoSync();
  } catch {
    return {
      supported: false,
      reason: "暂时无法确认当前设备的支付能力，请稍后重试",
      action: "none",
      platform: "",
    };
  }
  let canRequest = false;
  try {
    canRequest = wx.canIUse("requestVirtualPayment");
  } catch {
    canRequest = false;
  }
  return evaluateVirtualPaymentCapability(system, canRequest);
}

function inferProductKind(product: VirtualPaymentProductPayload): VirtualProductKind {
  const source = [
    product.fulfillmentType,
    product.productType,
    product.type,
  ]
    .filter(Boolean)
    .join("_")
    .toLowerCase();
  return /vip|subscription|member/.test(source) ? "vip" : "coin";
}

function centsFromProduct(product: VirtualPaymentProductPayload) {
  const explicit = Number(
    product.channelMapping?.priceInCents ?? product.priceInCents,
  );
  if (Number.isFinite(explicit) && explicit >= 0) return Math.round(explicit);
  const priceInCents = Number(product.price);
  return Number.isFinite(priceInCents) && priceInCents >= 0
    ? Math.round(priceInCents)
    : 0;
}

export function normalizeVirtualProduct(
  product: VirtualPaymentProductPayload,
): VirtualPaymentProduct {
  const priceInCents = centsFromProduct(product);
  const firstTag = Array.isArray(product.tags)
    ? product.tags[0]
    : String(product.tags || "")
        .split(/[,，]/)
        .map((item) => item.trim())
        .find(Boolean);
  return {
    id: String(product.id),
    name: String(product.name || product.title || "虚拟商品"),
    description: String(product.description || ""),
    kind: inferProductKind(product),
    priceInCents,
    displayPrice: (priceInCents / 100).toFixed(2),
    coinAmount:
      Number.isFinite(Number(product.coinAmount)) && Number(product.coinAmount) > 0
        ? Number(product.coinAmount)
        : undefined,
    bonusCoinAmount:
      Number.isFinite(Number(product.bonusCoinAmount)) &&
      Number(product.bonusCoinAmount) > 0
        ? Number(product.bonusCoinAmount)
        : undefined,
    vipDurationDays:
      Number.isFinite(
        Number(product.vipDurationDays ?? product.subscriptionDurationDays),
      ) &&
      Number(product.vipDurationDays ?? product.subscriptionDurationDays) > 0
        ? Number(product.vipDurationDays ?? product.subscriptionDurationDays)
        : undefined,
    badge: product.badge
      ? String(product.badge)
      : product.isRecommended
        ? "推荐"
        : firstTag,
  };
}

export async function listVirtualPaymentProducts() {
  const response = await request<
    VirtualPaymentProductPayload[] | { items?: VirtualPaymentProductPayload[] }
  >({
    path: "/api/client/products",
    data: { channel: "wechat_virtual" },
  });
  const items = Array.isArray(response) ? response : response.items ?? [];
  return items
    .filter((item) => item?.id)
    .map(normalizeVirtualProduct)
    .sort((left, right) => left.priceInCents - right.priceInCents);
}

function normalizePaymentStatus(value?: string): PaymentAxisStatus {
  const status = String(value || "").toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "PAID", "PAY_SUCCESS"].includes(status)) {
    return "SUCCEEDED";
  }
  if (["FAIL", "FAILED", "PAY_FAILED"].includes(status)) return "FAILED";
  if (["CANCEL", "CANCELLED", "CANCELED"].includes(status)) return "CANCELLED";
  if (["CLOSE", "CLOSED", "EXPIRED"].includes(status)) return "CLOSED";
  if (["PENDING", "CREATED", "UNPAID", "PROCESSING"].includes(status)) {
    return "PENDING";
  }
  return "UNKNOWN";
}

function normalizeFulfillmentStatus(value?: string): FulfillmentAxisStatus {
  const status = String(value || "").toUpperCase();
  if (["SUCCESS", "SUCCEEDED", "DELIVERED", "FULFILLED"].includes(status)) {
    return "SUCCEEDED";
  }
  if (["FAIL", "FAILED"].includes(status)) return "FAILED";
  if (status === "REVERSED") return "REVERSED";
  if (["PROCESSING", "DELIVERING"].includes(status)) return "PROCESSING";
  if (["PENDING", "CREATED", "NONE"].includes(status)) return "PENDING";
  return "UNKNOWN";
}

function normalizeRefundStatus(value?: string): RefundAxisStatus {
  const status = String(value || "").toUpperCase();
  if (!status || ["NONE", "NOT_REQUESTED"].includes(status)) return "NONE";
  if (["SUCCESS", "SUCCEEDED", "REFUNDED"].includes(status)) return "SUCCEEDED";
  if (["FAIL", "FAILED", "REJECTED"].includes(status)) return "FAILED";
  if (["PENDING", "PROCESSING", "REQUESTED"].includes(status)) return "PENDING";
  return "UNKNOWN";
}

function centsFromOrder(order: VirtualPaymentOrderPayload) {
  const explicit = Number(
    order.amountInCents ??
      order.productPrice ??
      order.productSnapshot?.priceInCents,
  );
  if (Number.isFinite(explicit) && explicit >= 0) return Math.round(explicit);
  const yuan = Number(
    order.totalAmount ?? order.amount ?? order.productSnapshot?.price,
  );
  return Number.isFinite(yuan) && yuan >= 0 ? Math.round(yuan * 100) : 0;
}

export function normalizeVirtualPaymentOrder(
  order: VirtualPaymentOrderPayload,
): VirtualPaymentOrder {
  const kindSource = [
    order.productSnapshot?.fulfillmentType,
    order.productSnapshot?.productType,
    order.product?.productType,
    order.product?.type,
  ]
    .filter(Boolean)
    .join("_")
    .toLowerCase();
  return {
    id: order.id ? String(order.id) : undefined,
    orderNo: String(order.orderNo || order.orderNumber || ""),
    outTradeNo: order.outTradeNo ? String(order.outTradeNo) : undefined,
    productId: order.productId || order.product?.id,
    productName: String(
      order.productName ||
        order.productSnapshot?.name ||
        order.product?.name ||
        "虚拟商品",
    ),
    productKind: kindSource
      ? /vip|subscription|member/.test(kindSource)
        ? "vip"
        : "coin"
      : undefined,
    amountInCents: centsFromOrder(order),
    paymentStatus: normalizePaymentStatus(order.paymentStatus),
    fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus),
    refundStatus: normalizeRefundStatus(order.refundStatus),
    createdAt: String(order.createdAt || ""),
    updatedAt: order.updatedAt ? String(order.updatedAt) : undefined,
  };
}

export function isVirtualOrderFulfilled(order: VirtualPaymentOrder) {
  return (
    order.paymentStatus === "SUCCEEDED" &&
    order.fulfillmentStatus === "SUCCEEDED"
  );
}

export function isVirtualOrderTerminal(order: VirtualPaymentOrder) {
  return (
    isVirtualOrderFulfilled(order) ||
    TERMINAL_PAYMENT_STATUSES.has(order.paymentStatus) ||
    order.refundStatus === "SUCCEEDED"
  );
}

export function claimVirtualFulfillmentNotification(orderNo: string) {
  if (reportedFulfillmentOrderNos.has(orderNo)) return false;
  if (reportedFulfillmentOrderNos.size >= 100) {
    const oldest = reportedFulfillmentOrderNos.values().next().value as
      | string
      | undefined;
    if (oldest) reportedFulfillmentOrderNos.delete(oldest);
  }
  reportedFulfillmentOrderNos.add(orderNo);
  return true;
}

export async function getVirtualPaymentOrder(orderNo: string) {
  const response = await request<
    VirtualPaymentOrderPayload | { order: VirtualPaymentOrderPayload }
  >({
    path: `/api/client/orders/${encodeURIComponent(orderNo)}/status`,
    retry: true,
  });
  return normalizeVirtualPaymentOrder(
    "order" in response ? response.order : response,
  );
}

export async function listVirtualPaymentOrders(params: {
  page?: number;
  limit?: number;
} = {}): Promise<VirtualPaymentOrderPage> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const response = await request<
    | VirtualPaymentOrderPayload[]
    | {
        items?: VirtualPaymentOrderPayload[];
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
      },
    Record<string, unknown>
  >({
    path: "/api/client/orders",
    data: {
      page,
      limit,
      paymentMethod: "wechat_miniprogram_virtual",
    },
  });
  const items = Array.isArray(response) ? response : response.items ?? [];
  const total = Array.isArray(response)
    ? response.length
    : Number(response.total ?? items.length);
  const resolvedLimit = Array.isArray(response)
    ? limit
    : Number(response.limit ?? limit);
  return {
    items: items.map(normalizeVirtualPaymentOrder),
    page: Array.isArray(response) ? page : Number(response.page ?? page),
    limit: resolvedLimit,
    total,
    totalPages: Array.isArray(response)
      ? Math.max(1, Math.ceil(total / Math.max(1, resolvedLimit)))
      : Number(
          response.totalPages ??
            Math.max(1, Math.ceil(total / Math.max(1, resolvedLimit))),
        ),
  };
}

function wxLogin() {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      timeout: 8000,
      success: (result) => {
        if (result.code) resolve(result.code);
        else reject(new Error("微信登录凭证获取失败，请重试"));
      },
      fail: () => reject(new Error("微信登录凭证获取失败，请检查网络")),
    });
  });
}

async function prepareVirtualPayment(
  productId: string,
  clientRequestId: string,
  platform: string,
) {
  const wxCode = await wxLogin();
  const prepared = await request<
    PreparedVirtualPayment,
    { productId: string; wxCode: string; clientRequestId: string }
  >({
    path: "/api/client/wechat-virtual/prepare",
    method: "POST",
    data: { productId, wxCode, clientRequestId },
    idempotent: true,
    retry: true,
    timeoutMs: 10000,
    headers: {
      "X-Client-Platform": [
        "ios",
        "android",
        "windows",
        "harmony",
      ].includes(platform)
        ? platform
        : "unknown",
    },
  });
  if (
    !prepared?.orderNo ||
    !prepared.outTradeNo ||
    !prepared.expiresAt ||
    prepared.mode !== "short_series_goods" ||
    typeof prepared.signData !== "string" ||
    !prepared.signData ||
    !prepared.paySig ||
    !prepared.signature
  ) {
    throw new Error("支付参数不完整，请稍后重试");
  }
  return prepared;
}

export function classifyVirtualPaymentFailure(
  code: number,
): VirtualPaymentFailure {
  if (code === -2) {
    return {
      code,
      cancelled: true,
      retryable: true,
      message: "已取消支付，未确认扣款",
    };
  }
  if (code === -4) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: "本次交易未通过微信支付安全校验",
    };
  }
  if (code === -15020 || code === -15021) {
    return {
      code,
      cancelled: false,
      retryable: true,
      message: "操作过于频繁，请稍后再试",
    };
  }
  if (code === -15007) {
    return {
      code,
      cancelled: false,
      retryable: true,
      message: "支付凭证已过期，请重新发起购买",
    };
  }
  if ([-15008, -15009, -15010, -15014, -15018].includes(code)) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: "该商品暂不可购买，请稍后再试",
    };
  }
  if ([-15017, -15019].includes(code)) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: "当前暂无法完成交易，请稍后再试",
    };
  }
  return {
    code,
    cancelled: false,
    retryable: true,
    message: "支付未完成，请稍后重试",
  };
}

function requestVirtualPayment(
  prepared: PreparedVirtualPayment,
): Promise<{ ok: true } | { ok: false; failure: VirtualPaymentFailure }> {
  return new Promise((resolve) => {
    const invoke = wx.requestVirtualPayment as unknown as (options: {
      mode: VirtualPaymentMode;
      signData: string;
      paySig: string;
      signature: string;
      success: () => void;
      fail: (result: { errCode?: number; errMsg?: string }) => void;
    }) => void;
    invoke({
      ...buildVirtualPaymentInvocation(prepared),
      success: () => resolve({ ok: true }),
      fail: (result) =>
        resolve({
          ok: false,
          failure: classifyVirtualPaymentFailure(Number(result.errCode ?? -1)),
        }),
    });
  });
}

export function buildVirtualPaymentInvocation(
  prepared: PreparedVirtualPayment,
) {
  return {
    mode: prepared.mode,
    // signData is signed as an exact byte string by the server. Never parse and
    // stringify it here because key order or escaping changes invalidate paySig.
    signData: prepared.signData,
    paySig: prepared.paySig,
    signature: prepared.signature,
  };
}

export function isSandboxVirtualPayment(signData: string) {
  try {
    const parsed = JSON.parse(signData) as { env?: unknown };
    return Number(parsed.env ?? 0) === 1;
  } catch {
    return false;
  }
}

function readPendingRecords(): PendingVirtualPayment[] {
  const value = wx.getStorageSync(PENDING_STORAGE_KEY) as unknown;
  if (!Array.isArray(value)) return [];
  const now = Date.now();
  return value
    .filter(
      (item): item is PendingVirtualPayment =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof item.orderNo === "string" &&
            typeof item.outTradeNo === "string" &&
            typeof item.clientRequestId === "string" &&
            typeof item.productId === "string" &&
            typeof item.userId === "string" &&
            typeof item.createdAt === "number" &&
            now - item.createdAt < MAX_PENDING_AGE_MS,
        ),
    )
    .slice(-MAX_PENDING_RECORDS);
}

function writePendingRecords(records: PendingVirtualPayment[]) {
  if (records.length) {
    wx.setStorageSync(PENDING_STORAGE_KEY, records.slice(-MAX_PENDING_RECORDS));
  } else {
    wx.removeStorageSync(PENDING_STORAGE_KEY);
  }
}

export function getPendingVirtualPayments() {
  const userId = sessionStore.getState()?.user.id;
  return readPendingRecords().filter((item) => item.userId === userId);
}

function savePending(record: PendingVirtualPayment) {
  const records = readPendingRecords().filter(
    (item) =>
      !(
        item.userId === record.userId &&
        (item.orderNo === record.orderNo ||
          item.clientRequestId === record.clientRequestId)
      ),
  );
  records.push(record);
  writePendingRecords(records);
}

function updatePending(
  orderNo: string,
  patch: Partial<PendingVirtualPayment>,
) {
  writePendingRecords(
    readPendingRecords().map((item) =>
      item.orderNo === orderNo ? { ...item, ...patch } : item,
    ),
  );
}

function removePending(orderNo: string) {
  writePendingRecords(
    readPendingRecords().filter((item) => item.orderNo !== orderNo),
  );
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function waitForFulfillment(
  orderNo: string,
  delays = [0, 800, 1200, 2000, 3000, 5000, 5000],
) {
  let lastOrder: VirtualPaymentOrder | null = null;
  for (const delay of delays) {
    if (delay) await wait(delay);
    try {
      lastOrder = await getVirtualPaymentOrder(orderNo);
    } catch {
      continue;
    }
    if (isVirtualOrderTerminal(lastOrder)) return lastOrder;
  }
  return lastOrder;
}

export async function startVirtualPurchase(
  product: VirtualPaymentProduct,
): Promise<VirtualPurchaseOutcome> {
  const session = sessionStore.getState();
  if (!session) throw new Error("请先登录后购买");
  const capability = getVirtualPaymentCapability();
  if (!capability.supported) throw new Error(capability.reason);

  const clientRequestId = createRequestId();
  const prepared = await prepareVirtualPayment(
    product.id,
    clientRequestId,
    capability.platform,
  );
  if (
    capability.platform === "ios" &&
    isSandboxVirtualPayment(prepared.signData)
  ) {
    throw new Error("iPhone 不支持沙箱支付，请使用正式环境商品");
  }
  const pending: PendingVirtualPayment = {
    orderNo: prepared.orderNo,
    outTradeNo: prepared.outTradeNo,
    clientRequestId,
    productId: product.id,
    productName: product.name,
    productKind: product.kind,
    createdAt: Date.now(),
    expiresAt: prepared.expiresAt,
    userId: session.user.id,
    paymentUiResult: "waiting",
  };
  // Persist the recoverable order before handing control to WeChat. Signatures
  // and signData are intentionally excluded from storage.
  savePending(pending);

  const paymentResult = await requestVirtualPayment(prepared);
  updatePending(prepared.orderNo, {
    paymentUiResult: paymentResult.ok
      ? "accepted"
      : paymentResult.failure.cancelled
        ? "cancelled"
        : "failed",
  });
  const order = await waitForFulfillment(
    prepared.orderNo,
    paymentResult.ok ? undefined : [0, 800],
  );

  if (order && isVirtualOrderFulfilled(order)) {
    removePending(order.orderNo);
    return { kind: "fulfilled", order };
  }
  if (order?.paymentStatus === "SUCCEEDED") {
    return { kind: "pending", order };
  }
  if (order?.refundStatus === "SUCCEEDED") {
    removePending(order.orderNo);
    return { kind: "failed", order, message: "该订单已退款" };
  }
  if (order && TERMINAL_PAYMENT_STATUSES.has(order.paymentStatus)) {
    removePending(order.orderNo);
    if (
      order.paymentStatus === "CANCELLED" ||
      paymentResult.ok === false && paymentResult.failure.cancelled
    ) {
      return { kind: "cancelled", order };
    }
    return { kind: "failed", order, message: "订单未支付成功，请重新购买" };
  }
  if (!paymentResult.ok) {
    if (paymentResult.failure.code === -5) {
      return { kind: "pending", order };
    }
    if (paymentResult.failure.cancelled) {
      return { kind: "cancelled", order };
    }
    return {
      kind: "failed",
      order,
      message: paymentResult.failure.message,
    };
  }
  return { kind: "pending", order };
}

function schedulePendingRetry(record: PendingVirtualPayment) {
  const pollAttempts = Number(record.pollAttempts || 0) + 1;
  const delay = Math.min(5 * 60 * 1000, 5000 * 2 ** Math.min(pollAttempts, 6));
  updatePending(record.orderNo, {
    pollAttempts,
    nextCheckAt: Date.now() + delay,
  });
}

export async function resumePendingVirtualPayments(options: {
  force?: boolean;
} = {}) {
  if (!sessionStore.getState()) return [];
  if (resumePromise) {
    if (!options.force) return resumePromise;
    await resumePromise;
    return resumePendingVirtualPayments(options);
  }
  resumePromise = (async () => {
    const fulfilled: VirtualPaymentOrder[] = [];
    const now = Date.now();
    const pending = getPendingVirtualPayments().filter(
      (record) => options.force || Number(record.nextCheckAt || 0) <= now,
    );
    await Promise.all(
      pending.map(async (record) => {
        try {
          const order = await getVirtualPaymentOrder(record.orderNo);
          if (isVirtualOrderFulfilled(order)) fulfilled.push(order);
          if (isVirtualOrderTerminal(order)) {
            removePending(record.orderNo);
          } else {
            schedulePendingRetry(record);
          }
        } catch {
          // A network or temporary server error must not discard recovery data.
          schedulePendingRetry(record);
        }
      }),
    );
    return fulfilled;
  })().finally(() => {
    resumePromise = null;
  });
  return resumePromise;
}

export function formatVirtualPaymentError(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "购买失败，请稍后重试";
}
