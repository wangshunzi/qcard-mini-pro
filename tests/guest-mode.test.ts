import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("小程序游客模式", () => {
  it("游客默认进入首页，四个 Tab 不再强制重启到登录页", () => {
    const app = JSON.parse(read("miniprogram/app.json"));
    expect(app.entryPagePath).toBe("pages/home/index");

    for (const page of ["home", "explore", "resource", "profile"]) {
      const source = read(`miniprogram/pages/${page}/index.ts`);
      expect(source).not.toContain('wx.reLaunch({ url: "/pages/login/index" })');
    }
  });

  it("退出登录或注销账号后统一返回游客首页", () => {
    const profile = read("miniprogram/pages/profile/index.ts");
    const settings = read("miniprogram/package-settings/pages/settings/index.ts");
    const account = read("miniprogram/package-settings/pages/account/index.ts");

    for (const source of [profile, settings, account]) {
      expect(source).toContain("sessionStore.clear()");
      expect(source).toContain('url: "/pages/home/index"');
    }
  });

  it("登录用户从默认首页入口转到灵感页，游客首页同时展示卡包和卡片", () => {
    const home = read("miniprogram/pages/home/index.ts");
    const template = read("miniprogram/pages/home/index.wxml");

    expect(home).toContain('launchPath === "pages/home/index"');
    expect(home).toContain('url: "/pages/explore/index"');
    expect(home).toContain("getPublicCardFaces({ page: 1, limit: 6 })");
    expect(template).toContain("随便逛逛");
    expect(template).toContain("精选卡包");
    expect(template).toContain("精选卡片");
    expect(template).toContain('bindtap="openResources"');
    expect(template).toContain('bindtap="openExplore"');
    expect(template).toContain('class="guest-face-grid"');
    expect(template).not.toContain("guest-face-title");
    expect(template).not.toContain("无需登录");
  });

  it("401 只清理失效会话，不进行全局登录跳转", () => {
    const http = read("miniprogram/services/http.ts");
    expect(http).toContain('hadSession ? "登录已过期，请重新登录" : "请先登录"');
    expect(http).not.toContain("redirectingToLogin");
    expect(http).not.toContain("wx.reLaunch");
  });

  it("公共浏览与个人服务采用不同的数据加载路径", () => {
    const explore = read("miniprogram/pages/explore/index.ts");
    const resource = read("miniprogram/pages/resource/index.ts");
    const home = read("miniprogram/pages/home/index.ts");
    const homeService = read("miniprogram/services/home.ts");

    expect(explore).toContain("void this.load(true)");
    expect(explore).toContain("await getProfile().catch(() => null)");
    expect(resource).toContain("void this.load()");
    expect(resource).toContain("const discovery = await getDiscoveryData()");
    expect(homeService).toContain("featuredCardPacks");
    expect(home).toContain("const sections: HomeSection[] = promotions");
    expect(home).not.toContain('"为你推荐"');
  });

  it("关键服务通过统一、带场景文案的登录门槛", () => {
    const gate = read("miniprogram/utils/authGate.ts");
    const explore = read("miniprogram/pages/explore/index.ts");
    const resource = read("miniprogram/pages/resource/index.ts");
    const detail = read("miniprogram/package-cards/pages/pack-detail/index.ts");
    const preview = read("miniprogram/components/card-preview-modal/index.ts");

    expect(gate).not.toContain("wx.showModal");
    expect(gate).toContain("openLogin(scene)");
    expect(explore).toContain('requireLogin("generate")');
    expect(resource).toContain('requireLogin("unlock")');
    expect(detail).toContain('state.canStudy ? "study" : "unlock"');
    expect(detail).toContain('requireLogin("favorite")');
    expect(preview).toContain('requireLogin("generate")');
  });

  it("我的页提供页内游客引导，登录成功后回到触发页", () => {
    const profile = read("miniprogram/pages/profile/index.wxml");
    const login = read("miniprogram/pages/login/index.ts");

    expect(profile).toContain('wx:if="{{isGuest}}"');
    expect(profile).toContain("登录后同步记录");
    expect(profile).not.toContain("guest-profile-copy");
    expect(profile).not.toContain("continueBrowsing");
    expect(profile).toContain('bindtap="openGuestLogin"');
    expect(login).toContain("if (pages.length > 1) wx.navigateBack()");
    expect(login).toContain('wx.switchTab({ url: "/pages/explore/index" })');
  });

  it("按需登录页提供与胶囊对齐的关闭入口和底部上滑动效", () => {
    const logic = read("miniprogram/pages/login/index.ts");
    const template = read("miniprogram/pages/login/index.wxml");
    const styles = read("miniprogram/pages/login/index.wxss");

    expect(logic).toContain("getImmersiveNavigationMetrics()");
    expect(logic).toContain("controlRowTop");
    expect(logic).toContain("controlRowHeight");
    expect(logic).toContain("wx.navigateBack({");
    expect(template).toContain('name="close"');
    expect(template).toContain('aria-label="关闭登录，返回继续浏览"');
    expect(styles).toContain(".login-page-back {");
    expect(styles).toContain("@keyframes login-sheet-up");
  });

  it("游客 profile 用默认主题，登录 profile 继续使用个人主题", () => {
    const profileService = read("miniprogram/services/profile.ts");
    const home = read("miniprogram/pages/home/index.ts");
    const login = read("miniprogram/pages/login/index.ts");

    expect(profileService).toContain("isGuest?: boolean");
    expect(home).toContain("getProfile().catch(() => null)");
    expect(login).toContain("profile?.currentTheme?.config ?? getCachedLoginThemeConfig()");
  });
});
