import {
  bindCurrentWechatMiniIdentity,
  loginWithPhone,
  loginWithWechat,
  sendVerificationCode,
} from "../../services/auth";
import { sessionStore } from "../../stores/session";
import { UI_ASSETS } from "../../config/uiAssets";
import { getCachedLoginThemeConfig } from "../../design-system/loginTheme";
import {
  bindThemeBackgrounds,
  refreshThemeBackgrounds,
  resolveThemeBackground,
} from "../../design-system/themeBackground";
import { readSystemThemeMode } from "../../design-system/theme";
import {
  MINI_PROGRAM_FILING,
  openMiniProgramFilingQuery,
} from "../../config/filing";
import { logger } from "../../utils/logger";

const LAST_LOGIN_METHOD_KEY = "qcard.lastLoginMethod";
const LEGACY_LAST_LOGIN_METHOD_KEY = "qcard.last-login-method";

Page({
  data: {
    phoneNumber: "",
    code: "",
    sending: false,
    loggingIn: false,
    countdown: 0,
    error: "",
    agreed: false,
    canSendCode: false,
    canPhoneLogin: false,
    agreementPromptOpen: false,
    loginMode: "choice" as "choice" | "phone",
    lastLoginMethod: "",
    assets: UI_ASSETS,
    loginBackground: resolveThemeBackground(
      getCachedLoginThemeConfig(),
      "login_bg",
      readSystemThemeMode(),
    ),
    filingNumber: MINI_PROGRAM_FILING.number,
  },

  timer: 0 as number,
  pendingAgreementResolve: null as ((agreed: boolean) => void) | null,

  onLoad() {
    this.setData({
      lastLoginMethod: String(
        wx.getStorageSync(LAST_LOGIN_METHOD_KEY)
          || wx.getStorageSync(LEGACY_LAST_LOGIN_METHOD_KEY)
          || "",
      ),
    });
  },

  onShow() {
    refreshThemeBackgrounds(readSystemThemeMode());
    bindThemeBackgrounds(this, getCachedLoginThemeConfig(), {
      loginBackground: "login_bg",
    });
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer);
    this.finishAgreementPrompt(false);
  },

  onPhoneInput(event: WechatMiniprogram.Input) {
    const phoneNumber = event.detail.value.replace(/\D/g, "").slice(0, 11);
    this.setData({
      phoneNumber,
      canSendCode: /^1\d{10}$/.test(phoneNumber),
      canPhoneLogin: /^1\d{10}$/.test(phoneNumber) && this.data.code.length === 6,
      error: "",
    });
  },

  onCodeInput(event: WechatMiniprogram.Input) {
    const code = event.detail.value.replace(/\D/g, "").slice(0, 6);
    this.setData({
      code,
      canPhoneLogin: /^1\d{10}$/.test(this.data.phoneNumber) && code.length === 6,
      error: "",
    });
  },

  async onSendCode() {
    if (this.data.sending || this.data.countdown > 0) return;
    if (!/^1\d{10}$/.test(this.data.phoneNumber)) {
      this.setData({ error: "请输入正确的手机号" });
      return;
    }
    this.setData({ sending: true, error: "" });
    try {
      await sendVerificationCode(this.data.phoneNumber);
      this.setData({ countdown: 60 });
      wx.showToast({ title: "验证码已发送", icon: "success" });
      this.timer = setInterval(() => {
        const next = this.data.countdown - 1;
        this.setData({ countdown: Math.max(0, next) });
        if (next <= 0) clearInterval(this.timer);
      }, 1000) as unknown as number;
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "发送失败" });
    } finally {
      this.setData({ sending: false });
    }
  },

  async onPhoneLogin() {
    if (this.data.loggingIn) return;
    if (!/^1\d{10}$/.test(this.data.phoneNumber) || this.data.code.length !== 6) {
      this.setData({ error: "请输入正确的手机号和 6 位验证码" });
      return;
    }
    if (!(await this.ensureAgreement())) return;
    await this.performLogin(
      () => loginWithPhone(this.data.phoneNumber, this.data.code),
      "phone",
    );
  },

  async onWechatLogin() {
    if (this.data.loggingIn) return;
    if (!(await this.ensureAgreement())) return;
    await this.performLogin(loginWithWechat, "wechat");
  },

  showPhoneLogin() {
    if (this.data.loggingIn) return;
    this.setData({ loginMode: "phone", error: "" });
  },

  showLoginChoices() {
    if (this.data.loggingIn) return;
    wx.hideKeyboard();
    this.setData({ loginMode: "choice", error: "" });
  },

  onAgreementChange(event: WechatMiniprogram.CheckboxGroupChange) {
    this.setData({ agreed: event.detail.value.includes("agreed") });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  openAgreement() {
    wx.navigateTo({ url: "/package-settings/pages/web-doc/index?doc=user_agreement" });
  },

  openPrivacy() {
    wx.navigateTo({ url: "/package-settings/pages/web-doc/index?doc=privacy_policy" });
  },

  openFilingQuery() {
    openMiniProgramFilingQuery();
  },

  noop() {},

  cancelAgreementPrompt() {
    this.finishAgreementPrompt(false);
  },

  confirmAgreementAndLogin() {
    this.setData({ agreed: true });
    this.finishAgreementPrompt(true);
  },

  finishAgreementPrompt(agreed: boolean) {
    const resolve = this.pendingAgreementResolve;
    this.pendingAgreementResolve = null;
    if (this.data.agreementPromptOpen) {
      this.setData({ agreementPromptOpen: false });
    }
    if (resolve) resolve(agreed);
  },

  ensureAgreement(): Promise<boolean> {
    if (this.data.agreed) return Promise.resolve(true);
    return new Promise((resolve) => {
      this.pendingAgreementResolve = resolve;
      this.setData({ agreementPromptOpen: true });
    });
  },

  async performLogin(
    login: () => Promise<Parameters<typeof sessionStore.setSession>[0]>,
    method: "phone" | "wechat",
  ) {
    this.setData({ loggingIn: true, error: "" });
    try {
      const session = await login();
      sessionStore.setSession(session);
      if (method === "phone") {
        try {
          await bindCurrentWechatMiniIdentity();
        } catch (error) {
          if (!sessionStore.getState()) throw error;
          // Phone login still grants access to non-payment features. Checkout
          // repeats this binding as a hard precondition and will show a
          // user-facing error if the identity belongs to another account.
          logger.warn("手机号登录后的微信身份预绑定失败", {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      wx.setStorageSync(LAST_LOGIN_METHOD_KEY, method);
      wx.showToast({ title: "登录成功", icon: "success" });
      wx.switchTab({ url: "/pages/home/index" });
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : "登录失败" });
    } finally {
      this.setData({ loggingIn: false });
    }
  },
});
