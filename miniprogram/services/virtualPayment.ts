import { ENV } from "../config/env";
import { sessionStore } from "../stores/session";
import { logger } from "../utils/logger";
import { createRequestId } from "../utils/requestId";
import { bindCurrentWechatMiniIdentity, getWechatLoginCode } from "./auth";
import { ApiError, request } from "./http";

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
  bonusCoinDescription?: string;
  vipDurationDays?: number;
  dailyRewardAmount?: number;
  badge?: string;
  /** 从 Server 实时读取；下单时再次由 Server 校验并固化到订单。 */
  paymentEnv: 0 | 1;
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
  bonusCoinDescription?: string;
  subscriptionDurationDays?: number;
  vipDurationDays?: number;
  dailyRewardAmount?: number;
  badge?: string;
  isRecommended?: boolean;
  tags?: string | string[];
  paymentEnv?: 0 | 1;
}

export interface PreparedVirtualPayment {
  orderNo: string;
  outTradeNo: string;
  mode: VirtualPaymentMode;
  signData: string;
  paySig: string;
  signature: string;
  expiresAt: string;
  env?: 0 | 1;
}

export type PaymentAxisStatus =
  "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "CLOSED" | "UNKNOWN";

export type FulfillmentAxisStatus =
  "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REVERSED" | "UNKNOWN";

export type RefundAxisStatus =
  "NONE" | "PENDING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";

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
  orderNo?: string;
  outTradeNo?: string;
  clientRequestId: string;
  productId: string;
  productName: string;
  productKind: VirtualProductKind;
  createdAt: number;
  /** Server-signed requestVirtualPayment material is valid only until this time. */
  expiresAt: string;
  /** Local upper bound for reconciling the already-created server order. */
  reconciliationDeadlineAt: string;
  userId: string;
  stage?: "preparing" | "payment" | "reconciling";
  paymentUiResult: "waiting" | "accepted" | "cancelled" | "failed";
  /** Poll count while the server-signed payment material is still valid. */
  pollAttempts?: number;
  /** Independent poll count after signed material expiry, starting at 15 minutes. */
  reconciliationPollAttempts?: number;
  nextCheckAt?: number;
  lastErrorCode?: number;
  lastErrorMessage?: string;
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
  diagnostic?: string;
}

export interface VirtualOrderPresentation {
  paymentLabel: string;
  paymentTone: string;
  fulfillmentLabel: string;
  fulfillmentTone: string;
  refundLabel: string;
  refundTone: string;
  completed: boolean;
  processing: boolean;
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
const TERMINAL_PAYMENT_STATUSES = new Set(["FAILED", "CANCELLED", "CLOSED"]);
const MAX_PENDING_RECORDS = 20;
export const VIRTUAL_PAYMENT_RECONCILIATION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const PREPARE_INTENT_TTL_MS = 10 * 60 * 1000;
const PENDING_QUERY_CONCURRENCY = 3;
const SIGNED_PHASE_MAX_RETRY_MS = 5 * 60 * 1000;
const RECONCILIATION_BASE_RETRY_MS = 15 * 60 * 1000;
const RECONCILIATION_MAX_RETRY_MS = 6 * 60 * 60 * 1000;
let resumePromise: Promise<VirtualPaymentOrder[]> | null = null;
const reportedFulfillmentOrderNos = new Set<string>();
const pendingListeners = new Set<() => void>();
const purchasePromises = new Map<string, Promise<VirtualPurchaseOutcome>>();
let memoryPendingRecords: PendingVirtualPayment[] = [];

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
  const platform = /harmony|ohos/i.test(`${rawPlatform} ${system.system || ""}`)
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
    if (
      compareVersion(parseIosVersion(system.system || ""), MIN_IOS_VERSION) < 0
    ) {
      return {
        supported: false,
        reason: "iPhone 需升级至 iOS 15 或更高版本后购买",
        action: "upgrade_wechat",
        platform,
      };
    }
    if (compareVersion(system.version || "0", MIN_IOS_WECHAT_VERSION) < 0) {
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

function inferProductKind(
  product: VirtualPaymentProductPayload,
): VirtualProductKind {
  const source = [product.fulfillmentType, product.productType, product.type]
    .filter(Boolean)
    .join("_")
    .toLowerCase();
  return /vip|subscription|member/.test(source) ? "vip" : "coin";
}

function centsFromProduct(product: VirtualPaymentProductPayload) {
  const explicit = Number(product.priceInCents);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.round(explicit);
  const priceInCents = Number(product.price);
  return Number.isFinite(priceInCents) && priceInCents >= 0
    ? Math.round(priceInCents)
    : 0;
}

export function normalizeVirtualProduct(
  product: VirtualPaymentProductPayload,
  runtimeEnv?: 0 | 1,
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
      Number.isFinite(Number(product.coinAmount)) &&
      Number(product.coinAmount) > 0
        ? Number(product.coinAmount)
        : undefined,
    bonusCoinAmount:
      Number.isFinite(Number(product.bonusCoinAmount)) &&
      Number(product.bonusCoinAmount) > 0
        ? Number(product.bonusCoinAmount)
        : undefined,
    bonusCoinDescription: product.bonusCoinDescription
      ? String(product.bonusCoinDescription).trim()
      : undefined,
    vipDurationDays:
      Number.isFinite(
        Number(product.vipDurationDays ?? product.subscriptionDurationDays),
      ) &&
      Number(product.vipDurationDays ?? product.subscriptionDurationDays) > 0
        ? Number(product.vipDurationDays ?? product.subscriptionDurationDays)
        : undefined,
    dailyRewardAmount:
      Number.isFinite(Number(product.dailyRewardAmount)) &&
      Number(product.dailyRewardAmount) > 0
        ? Number(product.dailyRewardAmount)
        : undefined,
    badge: product.badge
      ? String(product.badge)
      : product.isRecommended
        ? "推荐"
        : firstTag,
    paymentEnv: runtimeEnv ?? product.paymentEnv ?? 0,
  };
}

export async function listVirtualPaymentProducts() {
  const response = await request<{
    env: 0 | 1;
    environment: "production" | "sandbox";
    enabled: boolean;
    ready: boolean;
    items?: VirtualPaymentProductPayload[];
  }>({
    path: "/api/client/products",
    data: { channel: "wechat_virtual" },
  });
  if (response.env !== 0 && response.env !== 1) {
    throw new Error("服务端支付环境无效，请稍后重试");
  }
  // 正式版绝不进入沙箱。体验版/开发版则实时跟随管理后台，因而可在
  // iPhone 上把后台切到生产后测试真实支付，无需重新上传体验版。
  if (ENV.envVersion === "release" && response.env !== 0) {
    throw new Error("支付服务维护中，请稍后再试");
  }
  if (!response.enabled || !response.ready) return [];
  const items = response.items ?? [];
  return items
    .filter((item) => item?.id)
    .map((item) => normalizeVirtualProduct(item, response.env))
    .sort((left, right) => left.priceInCents - right.priceInCents);
}

function normalizePaymentStatus(value?: string): PaymentAxisStatus {
  const status = String(value || "").toUpperCase();
  if (
    ["SUCCESS", "SUCCEEDED", "COMPLETED", "PAID", "PAY_SUCCESS"].includes(
      status,
    )
  ) {
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
  const legacyStatus = String(order.status || "").toUpperCase();
  const legacyDelivered = ["SUCCESS", "SUCCEEDED", "COMPLETED"].includes(
    legacyStatus,
  );
  const legacyRefunded = legacyStatus === "REFUNDED";
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
    paymentStatus: normalizePaymentStatus(
      order.paymentStatus || (legacyRefunded ? "SUCCEEDED" : order.status),
    ),
    fulfillmentStatus: normalizeFulfillmentStatus(
      order.fulfillmentStatus ||
        (legacyDelivered
          ? "SUCCEEDED"
          : legacyRefunded
            ? "REVERSED"
            : undefined),
    ),
    refundStatus: normalizeRefundStatus(
      order.refundStatus || (legacyRefunded ? "SUCCEEDED" : undefined),
    ),
    createdAt: String(order.createdAt || ""),
    updatedAt: order.updatedAt ? String(order.updatedAt) : undefined,
  };
}

export function isVirtualOrderFulfilled(order: VirtualPaymentOrder) {
  return (
    order.paymentStatus === "SUCCEEDED" &&
    order.fulfillmentStatus === "SUCCEEDED" &&
    (order.refundStatus === "NONE" || order.refundStatus === "FAILED")
  );
}

export function isVirtualOrderTerminal(order: VirtualPaymentOrder) {
  if (order.refundStatus === "PENDING" || order.refundStatus === "UNKNOWN") {
    return false;
  }
  return (
    isVirtualOrderFulfilled(order) ||
    TERMINAL_PAYMENT_STATUSES.has(order.paymentStatus) ||
    order.refundStatus === "SUCCEEDED"
  );
}

export function getVirtualOrderPresentation(
  order: VirtualPaymentOrder,
): VirtualOrderPresentation {
  const payment =
    order.paymentStatus === "SUCCEEDED"
      ? (["支付成功", "success"] as const)
      : order.paymentStatus === "FAILED"
        ? (["支付失败", "failed"] as const)
        : order.paymentStatus === "CANCELLED"
          ? (["已取消", "muted"] as const)
          : order.paymentStatus === "CLOSED"
            ? (["已关闭", "muted"] as const)
            : order.paymentStatus === "PENDING"
              ? (["待确认", "pending"] as const)
              : (["状态确认中", "pending"] as const);

  const refund =
    order.refundStatus === "SUCCEEDED"
      ? (["已退款", "muted"] as const)
      : order.refundStatus === "FAILED"
        ? (["退款失败", "failed"] as const)
        : order.refundStatus === "PENDING"
          ? (["退款中", "pending"] as const)
          : order.refundStatus === "UNKNOWN"
            ? (["退款状态确认中", "pending"] as const)
            : (["无退款", "muted"] as const);

  let fulfillment: readonly [string, string] =
    order.fulfillmentStatus === "SUCCEEDED"
      ? (["已到账", "success"] as const)
      : order.fulfillmentStatus === "FAILED"
        ? (["发放异常", "failed"] as const)
        : order.fulfillmentStatus === "REVERSED"
          ? (["权益已撤回", "muted"] as const)
          : order.fulfillmentStatus === "PROCESSING"
            ? (["发放中", "pending"] as const)
            : order.fulfillmentStatus === "PENDING"
              ? (["待发放", "pending"] as const)
              : (["状态确认中", "pending"] as const);
  if (
    order.fulfillmentStatus === "SUCCEEDED" &&
    (order.refundStatus === "PENDING" || order.refundStatus === "UNKNOWN")
  ) {
    fulfillment = ["权益状态确认中", "pending"] as const;
  } else if (
    order.fulfillmentStatus === "SUCCEEDED" &&
    order.refundStatus === "SUCCEEDED"
  ) {
    fulfillment = ["退款已完成", "muted"] as const;
  }

  const completed = isVirtualOrderFulfilled(order);
  const processing =
    order.refundStatus === "PENDING" ||
    order.refundStatus === "UNKNOWN" ||
    order.paymentStatus === "PENDING" ||
    order.paymentStatus === "UNKNOWN" ||
    (order.paymentStatus === "SUCCEEDED" &&
      order.refundStatus !== "SUCCEEDED" &&
      ["PENDING", "PROCESSING", "FAILED", "REVERSED", "UNKNOWN"].includes(
        order.fulfillmentStatus,
      ));

  return {
    paymentLabel: payment[0],
    paymentTone: payment[1],
    fulfillmentLabel: fulfillment[0],
    fulfillmentTone: fulfillment[1],
    refundLabel: refund[0],
    refundTone: refund[1],
    completed,
    processing,
  };
}

export function claimVirtualFulfillmentNotification(orderNo: string) {
  if (reportedFulfillmentOrderNos.has(orderNo)) return false;
  if (reportedFulfillmentOrderNos.size >= 100) {
    const oldest = reportedFulfillmentOrderNos.values().next().value as
      string | undefined;
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
  const order = normalizeVirtualPaymentOrder(
    "order" in response ? response.order : response,
  );
  if (isVirtualOrderTerminal(order)) {
    const pending = readPendingRecords().find(
      (item) => item.orderNo === order.orderNo,
    );
    if (pending) removePending(pending.clientRequestId);
  }
  return order;
}

async function reportVirtualPaymentInvocationFailure(
  prepared: PreparedVirtualPayment,
  failure: VirtualPaymentFailure,
) {
  const response = await request<
    VirtualPaymentOrderPayload,
    { errCode: number; errMsg?: string }
  >({
    path: `/api/client/wechat-virtual/orders/${encodeURIComponent(prepared.orderNo)}/invocation-failure`,
    method: "POST",
    data: {
      errCode: failure.code,
      ...(failure.diagnostic ? { errMsg: failure.diagnostic } : {}),
    },
    idempotent: true,
  });
  return normalizeVirtualPaymentOrder(response);
}

export async function listVirtualPaymentOrders(
  params: {
    page?: number;
    limit?: number;
  } = {},
): Promise<VirtualPaymentOrderPage> {
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
  const items = Array.isArray(response) ? response : (response.items ?? []);
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

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function isRetryablePrepareError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === -1 || error.code === 429 || error.code >= 500)
  );
}

async function prepareVirtualPayment(
  productId: string,
  clientRequestId: string,
  platform: string,
  expectedEnv: 0 | 1,
) {
  const maxAttempts = ENV.requestRetryCount + 1;
  let prepared: PreparedVirtualPayment | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    // wx.login codes are one-time credentials. Keep the same idempotency key
    // for the logical checkout, but acquire a fresh code on every HTTP retry.
    const wxCode = await getWechatLoginCode();
    try {
      prepared = await request<
        PreparedVirtualPayment,
        {
          productId: string;
          wxCode: string;
          clientRequestId: string;
          expectedEnv: 0 | 1;
        }
      >({
        path: "/api/client/wechat-virtual/prepare",
        method: "POST",
        data: {
          productId,
          wxCode,
          clientRequestId,
          expectedEnv,
        },
        idempotent: true,
        retry: false,
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
      break;
    } catch (error) {
      lastError = error;
      if (!isRetryablePrepareError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await wait(ENV.requestRetryDelayMs * (attempt + 1));
    }
  }
  if (!prepared) {
    throw lastError instanceof Error
      ? lastError
      : new Error("支付订单创建结果待确认，请稍后重试");
  }
  if (
    !prepared?.orderNo ||
    !prepared.outTradeNo ||
    !prepared.expiresAt ||
    !Number.isFinite(Date.parse(prepared.expiresAt)) ||
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
  if ([1001, -15001, -15016].includes(code)) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: `微信支付参数校验失败（错误码 ${code}）`,
    };
  }
  if ([-15005, -15006].includes(code)) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: `微信支付签名校验失败（错误码 ${code}）`,
    };
  }
  if (code === -15013) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: "商品价格与微信后台不一致（错误码 -15013）",
    };
  }
  if (code === -15011) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: "微信支付环境配置不一致（错误码 -15011）",
    };
  }
  if (code === -15002 || code === -15012) {
    return {
      code,
      cancelled: false,
      retryable: true,
      message: `本次支付订单已关闭，请重新购买（错误码 ${code}）`,
    };
  }
  if ([-15008, -15009, -15010, -15014, -15018].includes(code)) {
    return {
      code,
      cancelled: false,
      retryable: false,
      message: `该商品尚未在微信侧生效（错误码 ${code}）`,
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
    message: `支付未完成（微信错误码 ${code}），请稍后重试`,
  };
}

const AMBIGUOUS_PAYMENT_FAILURE_CODES = new Set([-1, -5, -15003]);

/** Only these failures may have reached WeChat and must keep reconciliation. */
export function shouldReconcileVirtualPaymentFailure(code: number) {
  return AMBIGUOUS_PAYMENT_FAILURE_CODES.has(code);
}

export function sanitizeVirtualPaymentDiagnostic(value: unknown) {
  return String(value || "")
    .slice(0, 240)
    .replace(
      /(["']?(?:paySig|signature|signData|session_key|appKey|token|secret)["']?\s*[:=]).*$/i,
      "$1[REDACTED]",
    );
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
    const fail = (result: { errCode?: number; errMsg?: string }) => {
      const rawCode = Number(result.errCode ?? -1);
      const code = Number.isInteger(rawCode) ? rawCode : -1;
      const diagnostic = sanitizeVirtualPaymentDiagnostic(result.errMsg);
      logger.warn("微信虚拟支付界面返回失败", {
        orderNo: prepared.orderNo,
        errCode: code,
        ...(diagnostic ? { errMsg: diagnostic } : {}),
      });
      resolve({
        ok: false,
        failure: {
          ...classifyVirtualPaymentFailure(code),
          ...(diagnostic ? { diagnostic } : {}),
        },
      });
    };
    try {
      invoke({
        ...buildVirtualPaymentInvocation(prepared),
        success: () => resolve({ ok: true }),
        fail,
      });
    } catch (error) {
      fail({
        errCode: 1001,
        errMsg: error instanceof Error ? error.message : String(error),
      });
    }
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

export function getSignedVirtualPaymentEnvironment(
  signData: string,
): 0 | 1 | null {
  try {
    const parsed = JSON.parse(signData) as { env?: unknown };
    if (parsed.env === 0 || parsed.env === 1) return parsed.env;
    return null;
  } catch {
    return null;
  }
}

export function isSandboxVirtualPayment(signData: string) {
  return getSignedVirtualPaymentEnvironment(signData) === 1;
}

export function normalizePendingVirtualPaymentRecord(
  value: unknown,
  now: number,
): PendingVirtualPayment | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<PendingVirtualPayment>;
  if (
    typeof item.clientRequestId !== "string" ||
    typeof item.productId !== "string" ||
    typeof item.productName !== "string" ||
    (item.productKind !== "coin" && item.productKind !== "vip") ||
    typeof item.userId !== "string" ||
    typeof item.createdAt !== "number" ||
    !Number.isFinite(item.createdAt) ||
    typeof item.expiresAt !== "string"
  ) {
    return null;
  }
  const expiresAt = Date.parse(item.expiresAt);
  if (!Number.isFinite(expiresAt)) return null;
  const orderNo =
    typeof item.orderNo === "string" && item.orderNo ? item.orderNo : undefined;
  const hardDeadlineAt =
    item.createdAt + VIRTUAL_PAYMENT_RECONCILIATION_WINDOW_MS;
  const storedDeadlineAt = Date.parse(
    String(item.reconciliationDeadlineAt || ""),
  );
  // Legacy v1 records did not distinguish signature expiry from fact
  // reconciliation. Derive their deadline from createdAt, and clamp all stored
  // values so corrupt local data can never create an immortal checkout lock.
  const reconciliationDeadlineTimestamp =
    Number.isFinite(storedDeadlineAt) && storedDeadlineAt > item.createdAt
      ? Math.min(storedDeadlineAt, hardDeadlineAt)
      : hardDeadlineAt;
  if (reconciliationDeadlineTimestamp <= now) return null;
  // An intent that never received an order number owns no authoritative server
  // order and is safe to discard when its signed checkout window closes. An
  // order-bearing record survives that point exclusively for status queries.
  if (!orderNo && expiresAt <= now) return null;
  const outTradeNo =
    typeof item.outTradeNo === "string" && item.outTradeNo
      ? item.outTradeNo
      : undefined;
  return {
    clientRequestId: item.clientRequestId,
    productId: item.productId,
    productName: item.productName,
    productKind: item.productKind,
    userId: item.userId,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    reconciliationDeadlineAt: new Date(
      reconciliationDeadlineTimestamp,
    ).toISOString(),
    paymentUiResult: ["waiting", "accepted", "cancelled", "failed"].includes(
      String(item.paymentUiResult),
    )
      ? item.paymentUiResult!
      : "waiting",
    stage: ["preparing", "payment", "reconciling"].includes(String(item.stage))
      ? item.stage
      : orderNo
        ? "reconciling"
        : "preparing",
    ...(orderNo ? { orderNo } : {}),
    ...(outTradeNo ? { outTradeNo } : {}),
    ...(Number.isFinite(Number(item.pollAttempts))
      ? { pollAttempts: Number(item.pollAttempts) }
      : {}),
    ...(Number.isFinite(Number(item.reconciliationPollAttempts))
      ? {
          reconciliationPollAttempts: Number(item.reconciliationPollAttempts),
        }
      : {}),
    ...(Number.isFinite(Number(item.nextCheckAt))
      ? { nextCheckAt: Number(item.nextCheckAt) }
      : {}),
    ...(Number.isFinite(Number(item.lastErrorCode))
      ? { lastErrorCode: Number(item.lastErrorCode) }
      : {}),
    ...(item.lastErrorMessage
      ? {
          lastErrorMessage: sanitizeVirtualPaymentDiagnostic(
            item.lastErrorMessage,
          ),
        }
      : {}),
  };
}

function persistPendingRecords(records: PendingVirtualPayment[]) {
  memoryPendingRecords = records.slice(-MAX_PENDING_RECORDS);
  try {
    if (memoryPendingRecords.length) {
      wx.setStorageSync(PENDING_STORAGE_KEY, memoryPendingRecords);
    } else {
      wx.removeStorageSync(PENDING_STORAGE_KEY);
    }
    return true;
  } catch (error) {
    logger.warn("虚拟支付恢复记录写入失败", {
      message: error instanceof Error ? error.message : "storage unavailable",
    });
    return false;
  }
}

function readPendingRecords(): PendingVirtualPayment[] {
  let value: unknown;
  try {
    value = wx.getStorageSync(PENDING_STORAGE_KEY) as unknown;
  } catch (error) {
    logger.warn("虚拟支付恢复记录读取失败", {
      message: error instanceof Error ? error.message : "storage unavailable",
    });
    memoryPendingRecords = memoryPendingRecords
      .map((item) => normalizePendingVirtualPaymentRecord(item, Date.now()))
      .filter((item): item is PendingVirtualPayment => Boolean(item));
    return memoryPendingRecords;
  }
  if (!Array.isArray(value)) {
    memoryPendingRecords = [];
    if (value !== "" && value !== undefined && value !== null) {
      persistPendingRecords([]);
    }
    return [];
  }
  const now = Date.now();
  const records = value
    .map((item) => normalizePendingVirtualPaymentRecord(item, now))
    .filter((item): item is PendingVirtualPayment => Boolean(item))
    .slice(-MAX_PENDING_RECORDS);
  memoryPendingRecords = records;
  if (records.length !== value.length) {
    persistPendingRecords(records);
    emitPendingChanged();
  }
  return records;
}

function writePendingRecords(records: PendingVirtualPayment[]) {
  return persistPendingRecords(records);
}

function emitPendingChanged() {
  pendingListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A UI lifecycle listener must not break payment record persistence.
    }
  });
}

export function subscribePendingVirtualPayments(listener: () => void) {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
}

export function getPendingVirtualPayments() {
  const userId = sessionStore.getState()?.user.id;
  if (!userId) return [];
  return readPendingRecords().filter((item) => item.userId === userId);
}

export function getPendingVirtualPaymentForProduct(productId: string) {
  return getPendingVirtualPayments().find(
    (item) => item.productId === productId,
  );
}

export function getPendingVirtualPaymentRetryDelay(
  record: PendingVirtualPayment,
  now = Date.now(),
) {
  const nextAttempt = Math.max(
    1,
    Math.floor(
      Number(
        Date.parse(record.expiresAt) > now
          ? record.pollAttempts || 0
          : record.reconciliationPollAttempts || 0,
      ),
    ) + 1,
  );
  const signatureStillValid = Date.parse(record.expiresAt) > now;
  if (signatureStillValid) {
    return Math.min(
      SIGNED_PHASE_MAX_RETRY_MS,
      5000 * 2 ** Math.min(nextAttempt - 1, 6),
    );
  }
  return Math.min(
    RECONCILIATION_MAX_RETRY_MS,
    RECONCILIATION_BASE_RETRY_MS * 2 ** Math.min(nextAttempt - 1, 5),
  );
}

export function getPendingVirtualPaymentRecoveryDelay() {
  const now = Date.now();
  const pollable = getPendingVirtualPayments().filter(
    (item) => item.orderNo && Date.parse(item.reconciliationDeadlineAt) > now,
  );
  if (!pollable.length) return null;
  const nextCheckAt = Math.min(
    ...pollable.map((item) =>
      Math.min(
        Number(item.nextCheckAt || 0),
        Date.parse(item.reconciliationDeadlineAt),
      ),
    ),
  );
  return Math.max(0, nextCheckAt - Date.now());
}

function savePending(record: PendingVirtualPayment) {
  const records = readPendingRecords().filter(
    (item) =>
      !(
        item.userId === record.userId &&
        (item.clientRequestId === record.clientRequestId ||
          item.productId === record.productId ||
          (item.orderNo && record.orderNo && item.orderNo === record.orderNo))
      ),
  );
  records.push(record);
  const persisted = writePendingRecords(records);
  emitPendingChanged();
  return persisted;
}

function updatePending(
  clientRequestId: string,
  patch: Partial<PendingVirtualPayment>,
  notify = false,
) {
  const persisted = writePendingRecords(
    readPendingRecords().map((item) =>
      item.clientRequestId === clientRequestId ? { ...item, ...patch } : item,
    ),
  );
  if (notify) emitPendingChanged();
  return persisted;
}

function removePending(clientRequestId: string) {
  const records = readPendingRecords();
  const next = records.filter(
    (item) => item.clientRequestId !== clientRequestId,
  );
  if (next.length === records.length) return;
  writePendingRecords(next);
  emitPendingChanged();
}

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

async function executeVirtualPurchase(
  product: VirtualPaymentProduct,
): Promise<VirtualPurchaseOutcome> {
  const session = sessionStore.getState();
  if (!session) throw new Error("请先登录后购买");
  const capability = getVirtualPaymentCapability();
  if (!capability.supported) throw new Error(capability.reason);
  if (capability.platform === "ios" && product.paymentEnv === 1) {
    throw new Error("iPhone 不支持微信支付沙箱，请改用 Android 真机验收");
  }

  const existing = getPendingVirtualPaymentForProduct(product.id);
  if (existing?.orderNo) {
    try {
      const order = await getVirtualPaymentOrder(existing.orderNo);
      if (isVirtualOrderFulfilled(order)) {
        removePending(existing.clientRequestId);
        return { kind: "fulfilled", order };
      }
      if (order.refundStatus === "SUCCEEDED") {
        removePending(existing.clientRequestId);
        return { kind: "failed", order, message: "该订单已退款" };
      }
      if (
        order.refundStatus === "PENDING" ||
        order.refundStatus === "UNKNOWN"
      ) {
        schedulePendingRetry(existing);
        return { kind: "pending", order };
      }
      if (TERMINAL_PAYMENT_STATUSES.has(order.paymentStatus)) {
        removePending(existing.clientRequestId);
        return order.paymentStatus === "CANCELLED"
          ? { kind: "cancelled", order }
          : {
              kind: "failed",
              order,
              message: "上一笔订单已结束，请再次点击购买",
            };
      }
      schedulePendingRetry(existing);
      return { kind: "pending", order };
    } catch {
      // The previous order is still authoritative while its status cannot be
      // queried. Reuse it; never generate a second charge candidate.
      schedulePendingRetry(existing);
      return { kind: "pending", order: null };
    }
  }

  await bindCurrentWechatMiniIdentity();

  const clientRequestId = existing?.clientRequestId || createRequestId();
  const createdAt = Date.now();
  const pending: PendingVirtualPayment = existing || {
    clientRequestId,
    productId: product.id,
    productName: product.name,
    productKind: product.kind,
    createdAt,
    expiresAt: new Date(createdAt + PREPARE_INTENT_TTL_MS).toISOString(),
    reconciliationDeadlineAt: new Date(
      createdAt + VIRTUAL_PAYMENT_RECONCILIATION_WINDOW_MS,
    ).toISOString(),
    userId: session.user.id,
    stage: "preparing",
    paymentUiResult: "waiting",
  };
  if (!existing) {
    if (!savePending(pending)) {
      throw new Error("设备存储暂不可用，为避免重复扣款，本次未创建订单");
    }
  } else if (!writePendingRecords(readPendingRecords())) {
    throw new Error("设备存储暂不可用，为避免重复扣款，本次未创建订单");
  }

  let prepared: PreparedVirtualPayment;
  try {
    prepared = await prepareVirtualPayment(
      product.id,
      clientRequestId,
      capability.platform,
      product.paymentEnv,
    );
  } catch (error) {
    const code = error instanceof ApiError ? error.code : undefined;
    updatePending(clientRequestId, {
      ...(typeof code === "number" ? { lastErrorCode: code } : {}),
      lastErrorMessage: sanitizeVirtualPaymentDiagnostic(
        error instanceof Error ? error.message : error,
      ),
    });
    if (!isRetryablePrepareError(error)) removePending(clientRequestId);
    throw error;
  }
  const orderPersisted = updatePending(
    clientRequestId,
    {
      orderNo: prepared.orderNo,
      outTradeNo: prepared.outTradeNo,
      expiresAt: prepared.expiresAt,
      stage: "payment",
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
    },
    true,
  );
  if (!orderPersisted) {
    throw new Error(
      "设备存储暂不可用，订单已创建但未调起支付，请稍后从订单页恢复",
    );
  }
  const signedEnvironment = getSignedVirtualPaymentEnvironment(
    prepared.signData,
  );
  if (signedEnvironment !== product.paymentEnv) {
    const message =
      signedEnvironment === null
        ? "支付环境参数无效，本次未调起支付"
        : "支付环境配置不一致，本次未调起支付";
    const reconciliationRecord: PendingVirtualPayment = {
      ...pending,
      orderNo: prepared.orderNo,
      outTradeNo: prepared.outTradeNo,
      expiresAt: prepared.expiresAt,
      stage: "reconciling",
      paymentUiResult: "failed",
      lastErrorMessage: message,
    };
    updatePending(
      clientRequestId,
      {
        stage: "reconciling",
        paymentUiResult: "failed",
        lastErrorMessage: message,
      },
      true,
    );
    schedulePendingRetry(reconciliationRecord);
    throw new Error(message);
  }
  if (capability.platform === "ios" && signedEnvironment === 1) {
    throw new Error("支付环境配置不一致：iPhone 不支持微信支付沙箱");
  }
  // Persist the recoverable order before handing control to WeChat. Signatures
  // and signData are intentionally excluded from storage.

  if (Date.parse(prepared.expiresAt) <= Date.now()) {
    const reconciliationRecord: PendingVirtualPayment = {
      ...pending,
      orderNo: prepared.orderNo,
      outTradeNo: prepared.outTradeNo,
      expiresAt: prepared.expiresAt,
      stage: "reconciling",
      paymentUiResult: "failed",
      lastErrorCode: -15007,
      lastErrorMessage: "支付凭证已过期，正在确认订单最终状态",
    };
    updatePending(
      clientRequestId,
      {
        stage: "reconciling",
        paymentUiResult: "failed",
        lastErrorCode: -15007,
        lastErrorMessage: "支付凭证已过期，正在确认订单最终状态",
      },
      true,
    );
    schedulePendingRetry(reconciliationRecord);
    const expiredOrder = await waitForFulfillment(prepared.orderNo, [0]);
    if (expiredOrder && isVirtualOrderFulfilled(expiredOrder)) {
      removePending(clientRequestId);
      return { kind: "fulfilled", order: expiredOrder };
    }
    if (expiredOrder?.refundStatus === "SUCCEEDED") {
      removePending(clientRequestId);
      return {
        kind: "failed",
        order: expiredOrder,
        message: "该订单已退款",
      };
    }
    if (
      expiredOrder &&
      TERMINAL_PAYMENT_STATUSES.has(expiredOrder.paymentStatus)
    ) {
      removePending(clientRequestId);
      return expiredOrder.paymentStatus === "CANCELLED"
        ? { kind: "cancelled", order: expiredOrder }
        : {
            kind: "failed",
            order: expiredOrder,
            message: "支付凭证已过期，订单已关闭，请重新购买",
          };
    }
    return { kind: "pending", order: expiredOrder };
  }

  const paymentResult = await requestVirtualPayment(prepared);
  updatePending(clientRequestId, {
    stage: "reconciling",
    paymentUiResult: paymentResult.ok
      ? "accepted"
      : paymentResult.failure.cancelled
        ? "cancelled"
        : "failed",
    ...(!paymentResult.ok
      ? {
          lastErrorCode: paymentResult.failure.code,
          lastErrorMessage:
            paymentResult.failure.diagnostic || paymentResult.failure.message,
        }
      : {}),
  });
  let reportedOrder: VirtualPaymentOrder | null = null;
  if (!paymentResult.ok) {
    try {
      reportedOrder = await reportVirtualPaymentInvocationFailure(
        prepared,
        paymentResult.failure,
      );
    } catch (error) {
      logger.warn("记录微信虚拟支付调用失败结果失败", {
        orderNo: prepared.orderNo,
        errCode: paymentResult.failure.code,
        message: sanitizeVirtualPaymentDiagnostic(
          error instanceof Error ? error.message : error,
        ),
      });
    }
    if (!shouldReconcileVirtualPaymentFailure(paymentResult.failure.code)) {
      removePending(clientRequestId);
      return paymentResult.failure.cancelled
        ? { kind: "cancelled", order: reportedOrder }
        : {
            kind: "failed",
            order: reportedOrder,
            message: paymentResult.failure.message,
          };
    }
  }
  const order =
    reportedOrder && isVirtualOrderTerminal(reportedOrder)
      ? reportedOrder
      : await waitForFulfillment(
          prepared.orderNo,
          paymentResult.ok ? undefined : [0, 800],
        );

  if (order && isVirtualOrderFulfilled(order)) {
    removePending(clientRequestId);
    return { kind: "fulfilled", order };
  }
  if (order?.refundStatus === "SUCCEEDED") {
    removePending(clientRequestId);
    return { kind: "failed", order, message: "该订单已退款" };
  }
  if (order?.refundStatus === "PENDING" || order?.refundStatus === "UNKNOWN") {
    return { kind: "pending", order };
  }
  if (order && TERMINAL_PAYMENT_STATUSES.has(order.paymentStatus)) {
    removePending(clientRequestId);
    if (
      order.paymentStatus === "CANCELLED" ||
      (paymentResult.ok === false && paymentResult.failure.cancelled)
    ) {
      return { kind: "cancelled", order };
    }
    return { kind: "failed", order, message: "订单未支付成功，请重新购买" };
  }
  if (order?.paymentStatus === "SUCCEEDED") {
    return { kind: "pending", order };
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

export function startVirtualPurchase(
  product: VirtualPaymentProduct,
): Promise<VirtualPurchaseOutcome> {
  const userId = sessionStore.getState()?.user.id || "anonymous";
  const key = `${userId}:${product.id}`;
  const active = purchasePromises.get(key);
  if (active) return active;
  const purchase = executeVirtualPurchase(product);
  purchasePromises.set(key, purchase);
  const clear = () => {
    if (purchasePromises.get(key) === purchase) purchasePromises.delete(key);
  };
  void purchase.then(clear, clear);
  return purchase;
}

function schedulePendingRetry(record: PendingVirtualPayment) {
  const now = Date.now();
  const deadlineAt = Date.parse(record.reconciliationDeadlineAt);
  const delay = getPendingVirtualPaymentRetryDelay(record, now);
  const signatureStillValid = Date.parse(record.expiresAt) > now;
  const attemptPatch = signatureStillValid
    ? { pollAttempts: Number(record.pollAttempts || 0) + 1 }
    : {
        reconciliationPollAttempts:
          Number(record.reconciliationPollAttempts || 0) + 1,
      };
  updatePending(record.clientRequestId, {
    ...attemptPatch,
    // Never arm a timer beyond the bounded reconciliation window. At the
    // deadline normalization drops the stale lock; foreground recovery and
    // explicit taps still force checks before then.
    nextCheckAt: Math.min(now + delay, deadlineAt),
  });
}

async function processWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

export async function resumePendingVirtualPayments(
  options: {
    force?: boolean;
  } = {},
) {
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
      (record) =>
        Boolean(record.orderNo) &&
        Date.parse(record.reconciliationDeadlineAt) > now &&
        (options.force || Number(record.nextCheckAt || 0) <= now),
    );
    await processWithConcurrency(
      pending,
      PENDING_QUERY_CONCURRENCY,
      async (record) => {
        try {
          const order = await getVirtualPaymentOrder(record.orderNo!);
          if (isVirtualOrderFulfilled(order)) fulfilled.push(order);
          if (isVirtualOrderTerminal(order)) {
            removePending(record.clientRequestId);
          } else {
            schedulePendingRetry(record);
          }
        } catch {
          // A network or temporary server error must not discard recovery data.
          schedulePendingRetry(record);
        }
      },
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
