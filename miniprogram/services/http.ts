import { ENV } from "../config/env";
import { sessionStore } from "../stores/session";

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: number,
  ) {
    super(message);
  }
}

const SESSION_ERROR_CODES = new Set([4001, 4104, 4105]);

interface RequestOptions<TBody> {
  path: string;
  method?: WechatMiniprogram.RequestOption["method"];
  data?: TBody;
  auth?: boolean;
  retry?: boolean;
  idempotent?: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function omitUndefined<TBody>(data: TBody | undefined) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>).filter(
      ([, value]) => value !== undefined,
    ),
  ) as TBody;
}

async function executeRequest<T, TBody>(
  options: RequestOptions<TBody>,
): Promise<WechatMiniprogram.RequestSuccessCallbackResult<ApiResponse<T>>> {
  const token = sessionStore.getState()?.accessToken;
  return new Promise((resolve, reject) => {
    wx.request<ApiResponse<T>>({
      url: `${ENV.apiBaseUrl}${options.path}`,
      method: options.method ?? "GET",
      data: omitUndefined(options.data) as WechatMiniprogram.IAnyObject | undefined,
      timeout: options.timeoutMs ?? ENV.requestTimeoutMs,
      header: {
        "content-type": "application/json",
        appname: ENV.appName,
        ...options.headers,
        ...(options.auth !== false && token
          ? { authorization: `Bearer ${token}` }
          : {}),
      },
      success: resolve,
      fail: reject,
    });
  });
}

export async function request<T, TBody = unknown>({
  path,
  method = "GET",
  data,
  auth = true,
  retry = true,
  idempotent = false,
  timeoutMs,
  headers,
}: RequestOptions<TBody>): Promise<T> {
  const maxAttempts =
    retry && (method === "GET" || idempotent) ? ENV.requestRetryCount + 1 : 1;
  let response:
    | WechatMiniprogram.RequestSuccessCallbackResult<ApiResponse<T>>
    | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      response = await executeRequest<T, TBody>({
        path,
        method,
        data,
        auth,
        retry,
        idempotent,
        timeoutMs,
        headers,
      });
      const retryableStatus =
        response.statusCode === 429 || response.statusCode >= 500;
      if (!retryableStatus || attempt === maxAttempts - 1) break;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1) break;
    }
    await wait(ENV.requestRetryDelayMs * (attempt + 1));
  }

  if (!response) {
    const message =
      typeof lastError === "object" &&
      lastError &&
      "errMsg" in lastError &&
      String((lastError as { errMsg: unknown }).errMsg).includes("timeout")
        ? "请求超时，请检查网络后重试"
        : "网络连接失败，请检查网络";
    throw new ApiError(message, -1);
  }

  const payload =
    response.data && typeof response.data === "object"
      ? response.data
      : undefined;
  if (
    response.statusCode === 401 ||
    (typeof payload?.code === "number" && SESSION_ERROR_CODES.has(payload.code))
  ) {
    const hadSession = Boolean(sessionStore.getState());
    if (hadSession) sessionStore.clear();
    throw new ApiError(
      hadSession ? "登录已过期，请重新登录" : "请先登录",
      payload?.code ?? 4001,
    );
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const message =
      typeof payload?.message === "string" && payload.message
        ? payload.message
        : `网络请求失败（${response.statusCode}）`;
    throw new ApiError(message, response.statusCode);
  }
  if (!payload || typeof payload.code !== "number") {
    throw new ApiError("服务响应格式异常，请稍后重试", -2);
  }
  if (payload.code !== 2000) {
    throw new ApiError(payload.message || "请求失败", payload.code);
  }
  return payload.data;
}
