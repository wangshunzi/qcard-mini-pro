import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

declare const process: { cwd(): string };

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("H5-aligned product surfaces", () => {
  it("anchors custom navigation controls on the native capsule row", () => {
    const logic = read("miniprogram/components/immersive-nav/index.ts");
    const template = read("miniprogram/components/immersive-nav/index.wxml");
    const metrics = read("miniprogram/utils/navigationMetrics.ts");
    expect(logic).toContain("multipleSlots: true");
    expect(logic).toContain("getImmersiveNavigationMetrics");
    expect(logic).toContain('"scrollTop, overlay"');
    expect(logic).toContain("navBackground");
    expect(logic).toContain('navTitleColor: "#172019"');
    expect(logic).toContain("(progress - 0.48) / 0.42");
    expect(metrics).toContain("const controlRowTop = capsuleTop");
    expect(metrics).toContain("capsule?.left");
    expect(metrics).toContain("controlsMaxWidth");
    expect(template).toContain("margin-top:{{controlRowTop}}px");
    expect(template).toContain("height:{{totalHeight}}px");
    expect(template).toContain("color:{{navTitleColor}}");
    expect(template).toContain('class="nav-back-icon"');
    expect(read("miniprogram/components/immersive-nav/index.wxss")).toContain(
      ".nav-back-icon { width:100%; height:100%; display:flex; align-items:center; justify-content:center;",
    );
    expect(template).toContain('class="nav-controls"');
    expect(template.indexOf('class="nav-action"')).toBeLessThan(
      template.indexOf('class="nav-center"'),
    );
    expect(template).toContain('<slot name="leading"></slot>');
    expect(template).toContain('<slot name="center"></slot>');
    expect(template).toContain('<slot name="action"></slot>');

    const studyTemplate = read(
      "miniprogram/package-cards/pages/study/index.wxml",
    );
    const studyLogic = read(
      "miniprogram/package-cards/pages/study/index.ts",
    );
    const studyStyles = read(
      "miniprogram/package-cards/pages/study/index.wxss",
    );
    expect(studyTemplate).toContain("padding-top:{{controlRowTop}}px");
    expect(studyTemplate).toContain('class="study-nav-controls"');
    expect(studyLogic).toContain("getImmersiveNavigationMetrics");
    expect(studyStyles).toMatch(
      /\.pack-info\s*\{[\s\S]*position:\s*absolute;[\s\S]*left:\s*50%;[\s\S]*transform:\s*translateX\(-50%\);/,
    );

    const packDetailTemplate = read(
      "miniprogram/package-cards/pages/pack-detail/index.wxml",
    );
    const packDetailStyles = read(
      "miniprogram/package-cards/pages/pack-detail/index.wxss",
    );
    expect(packDetailTemplate).toContain('class="favorite-button-icon"');
    expect(packDetailStyles).toContain(
      ".favorite-button-icon { width:100%; height:100%; display:flex; align-items:center; justify-content:center;",
    );
    const packDetailLogic = read(
      "miniprogram/package-cards/pages/pack-detail/index.ts",
    );
    expect(packDetailLogic).not.toContain('"已取消收藏"');
    expect(packDetailLogic).not.toContain('"已收藏"');
    expect(packDetailLogic).toContain('"收藏操作失败"');
  });

  it("centers icon glyphs inside every capsule-row button", () => {
    const iconStyles = read("miniprogram/components/ui-icon/index.wxss");
    expect(iconStyles).toMatch(
      /:host\s*\{[\s\S]*display:\s*inline-flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*line-height:\s*1;/,
    );
    expect(iconStyles).toMatch(
      /\.ui-icon\s*\{[\s\S]*width:\s*1em;[\s\S]*height:\s*1em;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/,
    );

    for (const stylesheet of [
      "miniprogram/components/immersive-nav/index.wxss",
      "miniprogram/components/side-drawer-menu/index.wxss",
      "miniprogram/package-cards/pages/study/index.wxss",
      "miniprogram/pages/profile/index.wxss",
      "miniprogram/package-cards/pages/pack-detail/index.wxss",
    ]) {
      const styles = read(stylesheet);
      expect(styles, stylesheet).toMatch(/align-items:\s*center/);
      expect(styles, stylesheet).toMatch(/justify-content:\s*center/);
      expect(styles, stylesheet).toMatch(/line-height:\s*1/);
    }
  });

  it("keeps every capsule-row control on the shared polished height", () => {
    const globalStyles = read("miniprogram/app.wxss");
    const metrics = read("miniprogram/utils/navigationMetrics.ts");
    const navigationTemplate = read(
      "miniprogram/components/immersive-nav/index.wxml",
    );
    expect(globalStyles).toContain("--immersive-control-height: 72rpx");
    expect(globalStyles).toContain("--immersive-control-background:");
    expect(globalStyles).toContain("--immersive-control-shadow:");
    expect(metrics).toContain("controlRowTop = capsuleTop");
    expect(metrics).toContain("controlRowHeight: capsuleHeight");
    expect(navigationTemplate).toContain(
      "--immersive-control-height:{{controlRowHeight}}px",
    );
    expect(globalStyles).toContain(
      ".app-segmented.nav-segmented { height:var(--immersive-control-height)",
    );
    for (const template of [
      "miniprogram/pages/resource/index.wxml",
      "miniprogram/package-cards/pages/my-learning/index.wxml",
    ]) {
      expect(read(template), template).toContain(
        'class="app-segmented nav-segmented"',
      );
    }

    for (const stylesheet of [
      "miniprogram/components/immersive-nav/index.wxss",
      "miniprogram/components/side-drawer-menu/index.wxss",
      "miniprogram/pages/home/index.wxss",
      "miniprogram/pages/explore/index.wxss",
      "miniprogram/pages/profile/index.wxss",
      "miniprogram/package-cards/pages/my-generation/index.wxss",
      "miniprogram/package-cards/pages/private-pack/index.wxss",
      "miniprogram/package-cards/pages/pack-detail/index.wxss",
      "miniprogram/package-cards/pages/ai-generate/index.wxss",
      "miniprogram/package-cards/pages/study/index.wxss",
      "miniprogram/package-settings/pages/profile-edit/index.wxss",
      "miniprogram/package-settings/pages/challenge-config/index.wxss",
    ]) {
      expect(read(stylesheet), stylesheet).toContain(
        "var(--immersive-control-height)",
      );
    }
  });

  it("uses the complete H5 unlock drawer flow at every public card-pack unlock entry", () => {
    const drawerTemplate = read(
      "miniprogram/components/unlock-confirm-drawer/index.wxml",
    );
    const drawerLogic = read(
      "miniprogram/components/unlock-confirm-drawer/index.ts",
    );
    const drawerStyles = read(
      "miniprogram/components/unlock-confirm-drawer/index.wxss",
    );
    const packTemplate = read(
      "miniprogram/package-cards/pages/pack-detail/index.wxml",
    );
    const packLogic = read(
      "miniprogram/package-cards/pages/pack-detail/index.ts",
    );
    const studyTemplate = read(
      "miniprogram/package-cards/pages/study/index.wxml",
    );
    const studyLogic = read(
      "miniprogram/package-cards/pages/study/index.ts",
    );
    const resourceTemplate = read("miniprogram/pages/resource/index.wxml");
    const resourceLogic = read("miniprogram/pages/resource/index.ts");
    const profileTemplate = read("miniprogram/pages/profile/index.wxml");
    const profileLogic = read("miniprogram/pages/profile/index.ts");
    const teacherTemplate = read(
      "miniprogram/package-cards/pages/teacher/index.wxml",
    );
    const teacherLogic = read(
      "miniprogram/package-cards/pages/teacher/index.ts",
    );

    expect(drawerTemplate).toContain("解锁确认");
    expect(drawerTemplate).toContain("余额不足");
    expect(drawerTemplate).toContain("账户余额");
    expect(drawerTemplate).toContain("价格详情");
    expect(drawerTemplate).toContain("活动折扣");
    expect(drawerTemplate).toContain("等级折扣");
    expect(drawerTemplate).toContain("最终价格");
    expect(drawerTemplate).toContain("立即充值");
    expect(drawerLogic).toContain("balanceFloor >= currentPrice");
    expect(drawerLogic).toContain('this.triggerEvent("confirm")');
    expect(drawerStyles).toContain("@keyframes unlock-panel-in");
    expect(drawerStyles).toContain(".unlock-drawer.closing");
    expect(drawerStyles).toContain("env(safe-area-inset-bottom)");

    for (const template of [packTemplate, studyTemplate]) {
      expect(template).toContain("<unlock-confirm-drawer");
      expect(template).toContain('bind:confirm="unlock"');
      expect(template).toContain('bind:recharge="openRechargeGuide"');
    }
    for (const template of [
      resourceTemplate,
      profileTemplate,
      teacherTemplate,
    ]) {
      expect(template).toContain("<unlock-confirm-drawer");
      expect(template).toContain("bind:recharge=");
    }
    for (const logic of [packLogic, studyLogic]) {
      expect(logic).toContain("unlockPanelOpen: true");
      expect(logic).toContain('unlockType === "vip_free"');
      expect(logic).toContain("if (!result.success)");
    }
    for (const logic of [resourceLogic, profileLogic, teacherLogic]) {
      expect(logic).toContain("selectedUnlockPack");
      expect(logic).toContain('unlockType === "vip_free"');
      expect(logic).toContain("if (!result.success)");
    }
    expect(resourceLogic).toContain("wx.hideTabBar");
    expect(profileLogic).toContain("wx.hideTabBar");
    expect(teacherLogic).not.toContain('title: "解锁卡包"');
    expect(packLogic).toMatch(
      /bottomAction\(\)[\s\S]*this\.data as any\)\.canStudy[\s\S]*this\.confirmUnlock\(\)/,
    );
    expect(packLogic).not.toMatch(
      /confirmUnlock\(\)[\s\S]*wx\.showModal\(\{[\s\S]*title:\s*"解锁卡包"/,
    );
    expect(studyLogic).toContain("const hasFullAccess");
  });

  it("consumes server VIP state and keeps every purchase prompt inside WeChat virtual payment", () => {
    const guide = read("miniprogram/components/app-purchase-guide/index.wxml");
    const guideLogic = read("miniprogram/components/app-purchase-guide/index.ts");
    const contexts = [
      "miniprogram/pages/home/index.wxml",
      "miniprogram/pages/resource/index.wxml",
      "miniprogram/pages/profile/index.wxml",
      "miniprogram/package-cards/pages/pack-detail/index.wxml",
      "miniprogram/package-cards/pages/study/index.wxml",
      "miniprogram/package-cards/pages/teacher/index.wxml",
      "miniprogram/package-cards/pages/ai-generate/index.wxml",
    ];

    expect(guide).toContain("由微信虚拟支付安全处理");
    expect(guide).toContain("咔豆和 VIP 在同一账号内统一使用");
    expect(guide).not.toContain("下载");
    expect(guide).not.toContain('open-type="contact"');
    expect(guideLogic).toContain("startVirtualPurchase");
    expect(guideLogic).not.toContain("app_download");
    for (const context of contexts) {
      const source = read(context);
      expect(source, context).toContain("<app-purchase-guide");
      expect(source, context).toContain(
        'bind:success="onVirtualPaymentFulfilled"',
      );
    }

    const aiLogic = read(
      "miniprogram/package-cards/pages/ai-generate/index.ts",
    );
    const studyLogic = read(
      "miniprogram/package-cards/pages/study/index.ts",
    );
    expect(aiLogic).toContain("refreshProfileAccess");
    expect(aiLogic).toContain("profile.vip?.isVip === true");
    expect(studyLogic).toContain("refreshVipAccess");
    expect(studyLogic).toContain("accessGrantedByVip");
  });

  it("keeps a deliberate gap between the group-card pack selector and search", () => {
    const template = read(
      "miniprogram/package-cards/pages/generate/index.wxml",
    );
    const styles = read(
      "miniprogram/package-cards/pages/generate/index.wxss",
    );
    expect(template).toContain("选择归属卡包");
    expect(template).not.toContain("选择存属卡包");
    expect(styles).toContain(
      "padding: var(--immersive-content-safe-top) 32rpx 86rpx",
    );
  });

  it("keeps the complete H5 profile entry matrix and wallet semantics", () => {
    const template = read("miniprogram/pages/profile/index.wxml");
    const logic = read("miniprogram/pages/profile/index.ts");
    const styles = read("miniprogram/pages/profile/index.wxss");
    const config = read("miniprogram/pages/profile/index.json");
    const drawerTemplate = read(
      "miniprogram/components/side-drawer-menu/index.wxml",
    );
    const drawerLogic = read(
      "miniprogram/components/side-drawer-menu/index.ts",
    );
    for (const label of [
      "我的钱包",
      "我的卡包",
      "我的卡面",
      "主题",
      "客服",
      "定制",
    ]) {
      expect(drawerTemplate).toContain(label);
    }
    for (const label of [
      "咔豆充值",
      "反馈中心",
    ]) {
      expect(template).toContain(label);
    }
    expect(template).toContain("vip-upsell-banner");
    expect(template).toContain("会员与咔豆购买");
    expect(template).toContain("side-drawer-menu");
    expect(drawerTemplate).toContain('bindtap="openWallet"');
    expect(drawerLogic).toContain("getMenuButtonBoundingClientRect");
    expect(drawerLogic).toContain("safeTopPx");
    expect(template).not.toContain(
      'class="quick-card" bindtap="openAccount"',
    );
    expect(logic).toContain("coinHistoryOpen: false");
    expect(logic).toContain("withFavoritePackDisplay");
    expect(logic).toContain("useFavoritePack");
    expect(template).toContain("favorite-marketing-tag");
    expect(template).toContain("favorite-taxonomy");
    expect(template).toContain("favorite-pack-action");
    expect(template).toContain("background:conic-gradient(#529917");
    expect(styles).toContain(".favorite-pack-action");
    expect(styles).toContain(".favorite-difficulty");
    expect(config).toContain('"/components/coin-history-drawer/index"');
    expect(config).toContain('"/components/side-drawer-menu/index"');
  });

  it("routes Home create into the complete H5 private-pack workflow", () => {
    const homeTemplate = read("miniprogram/pages/home/index.wxml");
    const homeLogic = read("miniprogram/pages/home/index.ts");
    const template = read(
      "miniprogram/package-cards/pages/my-learning/index.wxml",
    );
    const logic = read(
      "miniprogram/package-cards/pages/my-learning/index.ts",
    );
    const service = read("miniprogram/package-cards/services/userContent.ts");

    expect(homeTemplate).toContain('bindtap="createPrivatePack"');
    expect(homeLogic).toContain("mode=private&create=true");
    expect(template).toContain("创建一个新的专属卡包");
    expect(template).toContain("卡包标题");
    expect(template).toContain("卡包描述");
    expect(template).toContain('bindtap="toggleManage"');
    expect(template).toContain('catchtap="deletePack"');
    expect(logic).toContain("createPrivateCardPack(title, description)");
    expect(service).toContain("{ title, description, isActive: true }");
  });

  it("shares the drawer shell while keeping page-specific menu content", () => {
    const profileDrawerTemplate = read(
      "miniprogram/components/side-drawer-menu/index.wxml",
    );
    const profileDrawerStyles = read(
      "miniprogram/components/side-drawer-menu/index.wxss",
    );
    const selectionTemplate = read(
      "miniprogram/components/selection-side-drawer/index.wxml",
    );
    const selectionStyles = read(
      "miniprogram/components/selection-side-drawer/index.wxss",
    );
    expect(profileDrawerTemplate).toContain("padding-top:{{safeTopPx}}px");
    expect(profileDrawerStyles).toContain("align-items:flex-end");
    expect(selectionTemplate).toContain('wx:if="{{open}}"');
    expect(selectionStyles).toContain("position:fixed");
    expect(selectionStyles).toContain("z-index:1600");

    const profile = read("miniprogram/pages/profile/index.wxml");
    const explore = read("miniprogram/pages/explore/index.wxml");
    const resource = read("miniprogram/pages/resource/index.wxml");
    const exploreConfig = read("miniprogram/pages/explore/index.json");
    const resourceConfig = read("miniprogram/pages/resource/index.json");
    expect(profile).toContain('bind:wallet="openCoinHistory"');
    expect(explore).toContain("selection-side-drawer");
    expect(explore).toContain('class="drawer-selector-trigger');
    expect(explore.indexOf("</immersive-nav>")).toBeLessThan(
      explore.indexOf("<selection-side-drawer"),
    );
    expect(explore).toContain('title="模板分类"');
    expect(explore).toContain('bindtap="openTemplateDrawer"');
    expect(explore).toContain('bind:select="selectTemplate"');
    expect(explore).not.toContain('bind:wallet="openCoinHistory"');
    expect(resource).toContain("selection-side-drawer");
    expect(resource).toContain('class="drawer-selector-trigger');
    expect(resource.indexOf("</immersive-nav>")).toBeLessThan(
      resource.indexOf("<selection-side-drawer"),
    );
    expect(resource).toContain('title="选择年级"');
    expect(resource).toContain('bindtap="openGradeDrawer"');
    expect(resource).toContain('bind:select="selectGrade"');
    expect(resource).not.toContain('bind:wallet="openCoinHistory"');
    expect(exploreConfig).toContain(
      '"/components/selection-side-drawer/index"',
    );
    expect(resourceConfig).toContain(
      '"/components/selection-side-drawer/index"',
    );
  });

  it("keeps profile editing fields and the H5 avatar drawer flow", () => {
    const template = read(
      "miniprogram/package-settings/pages/profile-edit/index.wxml",
    );
    const logic = read(
      "miniprogram/package-settings/pages/profile-edit/index.ts",
    );
    const styles = read(
      "miniprogram/package-settings/pages/profile-edit/index.wxss",
    );
    const service = read("miniprogram/services/profile.ts");
    expect(template).toContain("个人简介");
    expect(template).toContain('class="avatar-drawer');
    expect(template).toContain('class="avatar-image-square"');
    expect(template).toContain('slot="action"');
    expect(styles).toMatch(
      /\.avatar-image-square\s*\{[^}]*width:100%;[^}]*height:0;[^}]*padding-top:100%;[^}]*overflow:hidden;/s,
    );
    expect(styles).toMatch(
      /\.avatar-image-square image\s*\{[^}]*position:absolute;[^}]*width:100%;[^}]*height:100%;/s,
    );
    expect(logic).toContain("bio: profile.bio ||");
    expect(logic).toContain("bio: this.data.bio || undefined");
    expect(service).toContain("bio?: string");
  });

  it("keeps account deletion behind the H5 confirmation dialog", () => {
    const template = read(
      "miniprogram/package-settings/pages/account/index.wxml",
    );
    expect(template).toContain('bindtap="openDeleteDialog"');
    expect(template).toContain('wx:if="{{deleteDialogOpen}}"');
    expect(template).toContain("此操作不可撤销");
    expect(template).toContain("我再想想");
  });

  it("ships every H5 learning customization parameter and preview", () => {
    const template = read(
      "miniprogram/package-settings/pages/challenge-config/index.wxml",
    );
    const logic = read(
      "miniprogram/package-settings/pages/challenge-config/index.ts",
    );
    for (const label of [
      "学习预览",
      "高级配置",
      "目标每日卡片数",
      "最小每日卡片数",
      "新卡百分比",
      "每日新卡上限",
      "填充策略",
      "近到期窗口天数",
    ]) {
      expect(template).toContain(label);
    }
    expect(logic).toContain("refreshPreview()");
    expect(logic).toContain("review_first");
    expect(logic).toContain("new_first");
  });

  it("keeps H5 private-card management actions", () => {
    const template = read(
      "miniprogram/package-cards/pages/my-generation/index.wxml",
    );
    const logic = read(
      "miniprogram/package-cards/pages/my-generation/index.ts",
    );
    const itemTemplate = read(
      "miniprogram/components/private-card-face-item/index.wxml",
    );
    const service = read("miniprogram/package-cards/services/userContent.ts");
    expect(template).toContain("生成卡面");
    expect(itemTemplate).toContain("做同款");
    expect(template).toContain('bindtap="toggleEditMode"');
    expect(template).toContain('bind:delete="deleteCard"');
    expect(itemTemplate).toContain('catchtap="deleteItem"');
    expect(logic).toContain("deletePrivateCardFace");
    expect(service).toContain('method: "DELETE"');
  });

  it("keeps H5 private-card preview feedback, grouping, and make-similar actions", () => {
    const template = read(
      "miniprogram/package-cards/pages/preview/index.wxml",
    );
    const logic = read(
      "miniprogram/package-cards/pages/preview/index.ts",
    );
    const generateLogic = read(
      "miniprogram/package-cards/pages/generate/index.ts",
    );
    expect(template).toContain("卡面问题反馈");
    expect(template).toContain("去组卡");
    expect(template).toContain("做同款");
    expect(logic).toContain("submitPrivateCardFaceFeedback");
    expect(logic).toContain("frontFaceId=");
    expect(generateLogic).toContain("defaultFrontFaceId");
  });

  it("keeps every overlay hero copy and panel below the native capsule row", () => {
    const globalStyles = read("miniprogram/app.wxss");
    expect(globalStyles).toContain(
      "--immersive-content-safe-top: calc(env(safe-area-inset-top) + 192rpx);",
    );
    expect(globalStyles).toContain(
      "--immersive-panel-safe-top: calc(env(safe-area-inset-top) + 192rpx);",
    );

    const heroStyles = [
      "miniprogram/pages/explore/index.wxss",
      "miniprogram/pages/resource/index.wxss",
      "miniprogram/pages/home/index.wxss",
      "miniprogram/pages/profile/index.wxss",
      "miniprogram/package-cards/pages/my-generation/index.wxss",
      "miniprogram/package-cards/pages/my-learning/index.wxss",
      "miniprogram/package-cards/pages/generate/index.wxss",
      "miniprogram/package-settings/pages/level-detail/index.wxss",
    ];
    for (const file of heroStyles) {
      const styles = read(file);
      expect(styles).toContain("var(--immersive-content-safe-top)");
      expect(styles).not.toContain("env(safe-area-inset-top) + 112rpx");
    }

    const scrollDrivenPages = [
      "miniprogram/pages/home/index",
      "miniprogram/pages/explore/index",
      "miniprogram/pages/resource/index",
      "miniprogram/pages/profile/index",
      "miniprogram/package-cards/pages/pack-detail/index",
      "miniprogram/package-cards/pages/private-pack/index",
      "miniprogram/package-cards/pages/my-learning/index",
      "miniprogram/package-cards/pages/my-generation/index",
      "miniprogram/package-cards/pages/generate/index",
      "miniprogram/package-settings/pages/level-detail/index",
    ];
    for (const page of scrollDrivenPages) {
      expect(read(`${page}.wxml`)).toContain(
        'scroll-top="{{navScrollTop}}"',
      );
      expect(read(`${page}.ts`)).toContain("syncNavigationScroll");
    }

    const drawerStyles = read(
      "miniprogram/components/selection-side-drawer/index.wxss",
    );
    expect(drawerStyles).toContain(".selection-header");
    expect(drawerStyles).toContain(".selection-list");
  });

  it("keeps public and private card-pack intro panels aligned with H5", () => {
    const template = read(
      "miniprogram/package-cards/pages/pack-detail/index.wxml",
    );
    const styles = read(
      "miniprogram/package-cards/pages/pack-detail/index.wxss",
    );
    const privateStyles = read(
      "miniprogram/package-cards/pages/private-pack/index.wxss",
    );

    expect(template).toContain('wx:if="{{canStudy}}"');
    expect(template).toContain("已学习 {{detail.userStudyProgress.completedCards || 0}}");
    expect(template).toContain("累计 {{studyTimeText}}");
    expect(template).toContain('class="highlight-icon"');
    expect(template).toContain("background-color:{{item.color}}");
    expect(template).toContain('class="author-title-badge"');
    expect(template).toContain('class="author-rating"');
    for (const source of [styles, privateStyles]) {
      expect(source).toContain(".panel { padding:32rpx 40rpx 256rpx;");
      expect(source).toContain(".section-title { color:var(--color-text); font-size:36rpx;");
      expect(source).toContain(".progress-meta { margin-top:16rpx;");
    }
  });

  it("keeps login validation and agreement states aligned", () => {
    const logic = read("miniprogram/pages/login/index.ts");
    const template = read("miniprogram/pages/login/index.wxml");
    const styles = read("miniprogram/pages/login/index.wxss");
    expect(logic).toContain('const LAST_LOGIN_METHOD_KEY = "qcard.lastLoginMethod"');
    expect(logic).toContain("code.length === 6");
    expect(template).toContain("agreement-disabled");
    expect(template).toContain("最近登录");
    expect(template).toContain('class="wechat-login-option"');
    expect(template).toMatch(
      /<\/button>\s*<text wx:if="\{\{lastLoginMethod === 'wechat'\}\}" class="recent-tag social-recent">最近登录<\/text>/,
    );
    expect(styles).toMatch(
      /\.wechat-login-option\s*\{[^}]*overflow:\s*visible;/s,
    );
  });

  it("renders recent learning as an in-flow study list with a tall empty state", () => {
    const template = read("miniprogram/pages/home/index.wxml");
    const styles = read("miniprogram/pages/home/index.wxss");
    expect(template).toContain('class="study-list"');
    expect(template).toContain('class="study-start"');
    expect(styles).toContain(".compact-empty { min-height:480rpx;");
    expect(styles).toContain(".compact-empty.recent-empty { min-height:480rpx;");
    expect(styles).not.toMatch(/\.compact-empty\s*\{[^}]*border:/s);
  });

  it("renders home challenge cards with the shared native preview renderer", () => {
    const template = read("miniprogram/pages/home/index.wxml");
    const styles = read("miniprogram/pages/home/index.wxss");
    const config = read("miniprogram/pages/home/index.json");
    expect(template).toContain('front-card-data="{{item.previewCard}}"');
    expect(template).toContain('preview="{{true}}"');
    expect(template).toContain('read-only="{{true}}"');
    expect(styles).toContain("width:250rpx; height:444.44rpx;");
    expect(config).toContain('"/cards/FlipCardContainer/index"');
  });

  it("renders exploration data instead of server thumbnails whenever card data is valid", () => {
    const template = read("miniprogram/pages/explore/index.wxml");
    const logic = read("miniprogram/pages/explore/index.ts");
    const service = read("miniprogram/services/exploration.ts");
    expect(template).toContain('wx:if="{{item.previewCard}}"');
    expect(template).toContain('preview="{{true}}"');
    expect(logic).toContain("validateCardData(item.type, item.data)");
    expect(service).not.toContain("summaryOnly");
  });

  it.each([
    ["resource", "resource-preview-renderer"],
    ["profile", "profile-face-renderer"],
  ])("renders %s card lists through the shared 9:16 preview engine", (page, className) => {
    const template = read(`miniprogram/pages/${page}/index.wxml`);
    const config = read(`miniprogram/pages/${page}/index.json`);
    expect(template).toContain(`<flip-card`);
    expect(template).toContain(className);
    expect(template).toContain('preview="{{true}}"');
    expect(template).toContain('read-only="{{true}}"');
    expect(config).toContain('"/cards/FlipCardContainer/index"');
  });

  it("matches the H5 preview grid with a compact card-pack thumbnail bar", () => {
    const template = read("miniprogram/pages/resource/index.wxml");
    const styles = read("miniprogram/pages/resource/index.wxss");
    const logic = read("miniprogram/pages/resource/index.ts");

    expect(template).toContain('class="preview-pack-summary"');
    expect(template).toContain('class="preview-pack-cover"');
    expect(template).toContain("{{item.cardPack.title}}");
    expect(template).toContain('catchtap="openPack"');
    expect(template).toContain('name="lock-open-outline"');
    expect(template).not.toContain('class="preview-title">{{item.name}}');
    expect(styles).toContain(".preview-pack-summary {");
    expect(styles).toContain(".preview-pack-cover {");
    expect(logic).toContain("packDisplayPrice");
  });

  it("renders Home private faces through the shared H5-aligned item", () => {
    const template = read("miniprogram/pages/home/index.wxml");
    const config = read("miniprogram/pages/home/index.json");
    const itemTemplate = read(
      "miniprogram/components/private-card-face-item/index.wxml",
    );
    expect(template).toContain("<private-card-face-item");
    expect(itemTemplate).toContain("<flip-card");
    expect(itemTemplate).toContain('preview="{{true}}"');
    expect(itemTemplate).toContain('read-only="{{true}}"');
    expect(config).toContain('"/components/private-card-face-item/index"');
  });

  it("renders favorited cards as native previews instead of card-pack cover substitutes", () => {
    const template = read("miniprogram/pages/profile/index.wxml");
    const styles = read("miniprogram/pages/profile/index.wxss");
    expect(template).toContain('class="favorite-card-renderer"');
    expect(template).not.toContain('class="favorite-card-cover"');
    expect(styles).toContain("aspect-ratio: 9/16;");
  });

  it("keeps every card-list preview surface on the shared 9:16 contract", () => {
    const sharedStyles = read("miniprogram/cards/FlipCardContainer/index.ts");
    expect(sharedStyles).toContain("width:100%;height:auto;aspect-ratio:9/16;max-height:100%;");

    const styleContracts = [
      ["miniprogram/pages/explore/index.wxss", ".face-card", "aspect-ratio:9/16"],
      ["miniprogram/pages/resource/index.wxss", ".resource-preview-shell", "aspect-ratio:9/16"],
      ["miniprogram/pages/profile/index.wxss", ".face-preview", "aspect-ratio: 9/16"],
      ["miniprogram/package-cards/pages/my-generation/index.wxss", ".card", "aspect-ratio:9/16"],
      ["miniprogram/components/private-card-face-item/index.wxss", ":host", "aspect-ratio: 9/16"],
      ["miniprogram/package-cards/pages/generate/index.wxss", ".face-preview", "aspect-ratio: 9 / 16"],
      ["miniprogram/package-cards/pages/ai-generate/index.wxss", ".grid-card-preview", "aspect-ratio:9/16"],
      ["miniprogram/package-cards/pages/pack-detail/index.wxss", ".card-preview", "aspect-ratio:9/16"],
      ["miniprogram/package-cards/pages/private-pack/index.wxss", ".add-placeholder, .card-preview", "aspect-ratio:9/16"],
    ] as const;

    for (const [file, selector, ratio] of styleContracts) {
      const styles = read(file);
      expect(styles).toContain(selector);
      expect(styles).toContain(ratio);
    }
  });

  it("uses the H5 generation placeholder and polling in every private-face list", () => {
    const statusTemplate = read(
      "miniprogram/components/private-card-status/index.wxml",
    );
    const statusStyles = read(
      "miniprogram/components/private-card-status/index.wxss",
    );
    for (const copy of [
      "正在排队...",
      "正在生成...",
      "生成失败...",
      "已退款",
    ]) {
      expect(statusTemplate).toContain(copy);
    }
    for (const animation of [
      "status-spin",
      "status-spin-reverse",
      "status-glow",
      "status-dot-bounce",
    ]) {
      expect(statusStyles).toContain(animation);
    }
    expect(statusTemplate).toContain('name="auto-fix"');
    expect(statusTemplate).toContain('catchtap="retry"');

    for (const pageRoot of [
      "miniprogram/pages/home",
      "miniprogram/pages/profile",
      "miniprogram/package-cards/pages/my-generation",
      "miniprogram/package-cards/pages/generate",
    ]) {
      const logic = read(`${pageRoot}/index.ts`);
      expect(logic).toContain("PRIVATE_FACE_POLL_MS = 3000");
      expect(logic).toContain("schedulePrivateFacePolling");
      expect(logic).toContain("clearPrivateFacePolling");
    }

    for (const pageRoot of [
      "miniprogram/pages/profile",
      "miniprogram/package-cards/pages/generate",
    ]) {
      const template = read(`${pageRoot}/index.wxml`);
      const config = read(`${pageRoot}/index.json`);
      expect(template).toContain("<private-card-status");
      expect(template).toContain("item.status !== 'success'");
      expect(config).toContain('"/components/private-card-status/index"');
    }

    const sharedItemTemplate = read(
      "miniprogram/components/private-card-face-item/index.wxml",
    );
    const sharedItemStyles = read(
      "miniprogram/components/private-card-face-item/index.wxss",
    );
    expect(sharedItemTemplate).toContain("<private-card-status");
    expect(sharedItemTemplate).toContain("item.status !== 'success'");
    expect(sharedItemTemplate).toContain('class="make-similar-mask"');
    expect(sharedItemTemplate).not.toContain("item.name");
    expect(sharedItemTemplate).not.toContain("item.type");
    expect(sharedItemStyles).toContain("aspect-ratio: 9/16;");
    expect(sharedItemStyles).toContain("border-radius: 18rpx;");
    expect(sharedItemStyles).toContain("height: 86rpx;");

    for (const pageRoot of [
      "miniprogram/pages/home",
      "miniprogram/pages/profile",
      "miniprogram/package-cards/pages/my-generation",
    ]) {
      const template = read(`${pageRoot}/index.wxml`);
      const config = read(`${pageRoot}/index.json`);
      expect(template).toContain("<private-card-face-item");
      expect(config).toContain('"/components/private-card-face-item/index"');
    }

    expect(
      read("miniprogram/package-cards/pages/generate/index.wxml"),
    ).toContain(
      'wx:if="{{item.status === \'success\'}}" class="face-copy"',
    );
    expect(
      read("miniprogram/pages/profile/index.wxml"),
    ).toContain(
      '<block wx:if="{{item.status === \'success\'}}">',
    );

    const homeTemplate = read("miniprogram/pages/home/index.wxml");
    const profileTemplate = read("miniprogram/pages/profile/index.wxml");
    const myFacesTemplate = read(
      "miniprogram/package-cards/pages/my-generation/index.wxml",
    );
    expect(homeTemplate).toContain('class="private-face-grid"');
    expect(homeTemplate).not.toContain('class="face-title"');
    expect(myFacesTemplate).not.toContain('class="card-copy"');
    expect(myFacesTemplate).not.toContain('class="similar-button"');
    const profileRecentBlock =
      profileTemplate
        .split(
          `<view wx:if="{{activeTab === 'recent'}}" class="panel recent-panel">`,
        )[1]
        ?.split(`<view wx:elif="{{activeTab === 'feedback'}}"`)[0] ?? "";
    expect(profileRecentBlock).toContain("<private-card-face-item");
    expect(profileRecentBlock).not.toContain('class="face-name"');
    expect(profileRecentBlock).not.toContain('class="face-similar"');

    expect(read("miniprogram/pages/home/index.wxss")).toMatch(
      /\.private-face-grid\s*\{[^}]*grid-template-columns:1fr 1fr;[^}]*gap:22rpx;/s,
    );
    expect(
      read("miniprogram/package-cards/pages/my-generation/index.wxss"),
    ).toMatch(
      /\.grid\s*\{[^}]*grid-template-columns:1fr 1fr;[^}]*gap:22rpx;/s,
    );
    expect(
      read("miniprogram/package-cards/pages/generate/index.wxss"),
    ).toMatch(/\.face-grid\s*\{[^}]*align-items:\s*start;/s);
    expect(read("miniprogram/pages/profile/index.wxss")).toMatch(
      /\.faces-grid\s*\{[^}]*align-items:\s*start;/s,
    );
    expect(read("miniprogram/pages/profile/index.wxss")).toContain(
      ".recent-faces-grid { gap:22rpx; }",
    );
  });

  it("ships the level overview and both detail tabs", () => {
    const template = read("miniprogram/package-settings/pages/level-detail/index.wxml");
    expect(template).toContain('class="profile-card"');
    expect(template).toContain('data-tab="history"');
    expect(template).toContain('data-tab="benefits"');
    expect(template).toContain("/assets/icons/coins.png");
  });

  it("keeps subpackage-only services outside the main package", () => {
    for (const service of [
      "challengeConfig",
      "experience",
      "feedback",
      "theme",
      "userContent",
    ]) {
      expect(existsSync(resolve(root, `miniprogram/services/${service}.ts`))).toBe(
        false,
      );
    }
    for (const path of [
      "miniprogram/package-settings/services/challengeConfig.ts",
      "miniprogram/package-settings/services/experience.ts",
      "miniprogram/package-settings/services/feedback.ts",
      "miniprogram/package-settings/services/theme.ts",
      "miniprogram/package-cards/services/userContent.ts",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(true);
    }
  });

  it("ships a filtered, paginated coin history drawer", () => {
    const template = read("miniprogram/components/coin-history-drawer/index.wxml");
    const logic = read("miniprogram/components/coin-history-drawer/index.ts");
    expect(template).toContain('class="filter-scroll"');
    expect(template).toContain('bindscrolltolower="loadMore"');
    expect(template).toContain('catchtouchmove="preventClose"');
    expect(template).toContain('bounces="{{false}}"');
    expect(logic).toContain("getBalanceHistory");
  });

  it("renders knowledge points as collapsible one-column card-pack groups", () => {
    const template = read("miniprogram/pages/resource/index.wxml");
    const logic = read("miniprogram/pages/resource/index.ts");
    expect(template).toContain('class="knowledge-timeline"');
    expect(template).toContain('class="knowledge-pack-list"');
    expect(logic).toContain("toggleKnowledge");
    expect(logic).toContain("startPack");
  });
});
