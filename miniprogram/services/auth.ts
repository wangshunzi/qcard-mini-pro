import type { SessionState } from "../stores/session";
import { ENV } from "../config/env";
import { ApiError, request } from "./http";

interface ServerLoginResponse {
  access_token: string;
  sessionId?: string;
  user: SessionState["user"];
}

const normalizeSession = (response: ServerLoginResponse): SessionState => ({
  accessToken: response.access_token,
  sessionId: response.sessionId,
  user: response.user,
});

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

class WechatLoginCodeError extends Error {}

function isRetryableWechatBindingError(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.code === -1 || error.code === 429 || error.code >= 500)
  );
}

function requestWechatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      timeout: 8000,
      success: (result) => {
        if (result.code) resolve(result.code);
        else reject(new WechatLoginCodeError("微信登录凭证获取失败，请重试"));
      },
      fail: () =>
        reject(new WechatLoginCodeError("微信登录凭证获取失败，请检查网络")),
    });
  });
}

/**
 * Obtain a one-time WeChat login code with bounded retries. Every attempt calls
 * wx.login again, so a failed or consumed credential is never replayed.
 */
export async function getWechatLoginCode() {
  const maxAttempts = ENV.requestRetryCount + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await requestWechatLoginCode();
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof WechatLoginCodeError) ||
        attempt === maxAttempts - 1
      ) {
        throw error;
      }
      await wait(ENV.requestRetryDelayMs * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("微信登录凭证获取失败，请稍后重试");
}

export function sendVerificationCode(phoneNumber: string) {
  return request<{ message: string }, { phoneNumber: string }>({
    path: "/api/client/auth/send-code",
    method: "POST",
    data: { phoneNumber },
    auth: false,
  });
}

export async function loginWithPhone(phoneNumber: string, code: string) {
  const response = await request<ServerLoginResponse, { phoneNumber: string; code: string }>({
    path: "/api/client/auth/login",
    method: "POST",
    data: { phoneNumber, code },
    auth: false,
  });
  return normalizeSession(response);
}

export async function loginWithWechat() {
  const code = await getWechatLoginCode();
  const response = await request<ServerLoginResponse, { code: string }>({
    path: "/api/client/auth/wechat-mini-login",
    method: "POST",
    data: { code },
    auth: false,
  });
  return normalizeSession(response);
}

/**
 * Bind the currently logged-in account to this Mini Program identity.
 * Every retry obtains a new wx.login code because WeChat codes are one-time
 * credentials and must never be replayed by the generic HTTP retry layer.
 */
export async function bindCurrentWechatMiniIdentity() {
  const maxAttempts = ENV.requestRetryCount + 1;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const code = await getWechatLoginCode();
    try {
      return await request<{ bound: boolean }, { code: string }>({
        path: "/api/client/auth/wechat-mini-bind",
        method: "POST",
        data: { code },
        idempotent: true,
        retry: false,
        timeoutMs: 10000,
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableWechatBindingError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
      await wait(ENV.requestRetryDelayMs * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("微信身份绑定失败，请稍后重试");
}

export function deleteAccount() {
  return request<null>({
    path: "/api/client/auth/account",
    method: "DELETE",
  });
}
