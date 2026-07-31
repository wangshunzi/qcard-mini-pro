import type { SessionState } from "../stores/session";
import { request } from "./http";

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
  const loginResult = await wx.login();
  if (!loginResult.code) throw new Error("未获取到微信登录凭证");
  const response = await request<ServerLoginResponse, { code: string }>({
    path: "/api/client/auth/wechat-mini-login",
    method: "POST",
    data: { code: loginResult.code },
    auth: false,
  });
  return normalizeSession(response);
}

export function deleteAccount() {
  return request<null>({
    path: "/api/client/auth/account",
    method: "DELETE",
  });
}
