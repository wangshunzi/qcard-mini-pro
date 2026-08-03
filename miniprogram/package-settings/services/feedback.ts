import { request } from "../../services/http";
import { hmacSha1Base64 } from "../../utils/hmacSha1";

export type FeedbackType =
  | "account"
  | "subscription"
  | "coins"
  | "content"
  | "product"
  | "other";

export type FeedbackStatus = "pending" | "processing" | "resolved" | "closed";

export interface UserFeedback {
  id: string;
  type: FeedbackType;
  content: string;
  contact?: string | null;
  status: FeedbackStatus;
  imageUrl?: string | null;
  adminReply?: string | null;
  createdAt: string;
  typeLabel?: string;
  statusLabel?: string;
  createdAtText?: string;
}

export interface FeedbackStsCredentials {
  accessKeyId: string;
  accessKeySecret: string;
  securityToken: string;
  expiration: string;
  ossConfig: {
    bucket: string;
    endpoint: string;
    region: string;
  };
  uploadPathPrefix: string;
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  account: "账号",
  subscription: "订阅",
  coins: "咔豆",
  content: "内容",
  product: "产品建议",
  other: "其他",
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

function normalizeFeedback(item: UserFeedback): UserFeedback {
  return {
    ...item,
    typeLabel: TYPE_LABELS[item.type] ?? "其他",
    statusLabel: STATUS_LABELS[item.status] ?? "待处理",
    createdAtText: item.createdAt
      ? new Date(item.createdAt).toLocaleString("zh-CN", { hour12: false })
      : "",
  };
}

export function getMyFeedbacks(
  page = 1,
  limit = 20,
  status?: FeedbackStatus,
) {
  return request<{
    items: UserFeedback[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }, {
    page: number;
    limit: number;
    status?: FeedbackStatus;
  }>({
    path: "/api/client/feedbacks",
    data: { page, limit, status },
  }).then((result) => ({
    ...result,
    items: (result.items ?? []).map(normalizeFeedback),
  }));
}

export function getFeedbackDetail(id: string) {
  return request<UserFeedback>({
    path: `/api/client/feedbacks/${encodeURIComponent(id)}`,
  }).then(normalizeFeedback);
}

export function createFeedback(data: {
  type: FeedbackType;
  content: string;
  contact?: string;
  imageUrl?: string;
  clientMeta: Record<string, unknown>;
}) {
  return request<UserFeedback, typeof data>({
    path: "/api/client/feedbacks",
    method: "POST",
    data,
  }).then(normalizeFeedback);
}

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function utf8Buffer(value: string) {
  const encoded = unescape(encodeURIComponent(value));
  const bytes = new Uint8Array(encoded.length);
  for (let index = 0; index < encoded.length; index += 1) {
    bytes[index] = encoded.charCodeAt(index);
  }
  return bytes.buffer;
}

export async function uploadFeedbackImage(filePath: string) {
  const sts = await request<FeedbackStsCredentials, Record<string, never>>({
    path: "/api/client/feedbacks/sts-token",
    method: "POST",
    data: {},
  });
  const extension = filePath.split(".").pop()?.toLowerCase() || "jpg";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const objectKey = `${sts.uploadPathPrefix}${fileName}`;
  const expiration = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const policy = wx.arrayBufferToBase64(
    utf8Buffer(JSON.stringify({
      expiration,
      conditions: [
        ["content-length-range", 1, 10 * 1024 * 1024],
        ["starts-with", "$key", sts.uploadPathPrefix],
      ],
    })),
  );
  const signature = hmacSha1Base64(sts.accessKeySecret, policy);
  const endpoint = sts.ossConfig.endpoint.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const uploadUrl = `https://${sts.ossConfig.bucket}.${endpoint}`;
  const publicUrl = `${uploadUrl}/${encodeObjectKey(objectKey)}`;

  await new Promise<void>((resolve, reject) => {
    wx.uploadFile({
      url: uploadUrl,
      filePath,
      name: "file",
      formData: {
        key: objectKey,
        policy,
        OSSAccessKeyId: sts.accessKeyId,
        Signature: signature,
        "x-oss-security-token": sts.securityToken,
        success_action_status: "200",
      },
      success: (result) => {
        if (result.statusCode >= 200 && result.statusCode < 300) resolve();
        else reject(new Error(`图片上传失败（${result.statusCode}）`));
      },
      fail: (error) => reject(new Error(error.errMsg || "图片上传失败")),
    });
  });
  return publicUrl;
}
