import { sessionStore } from "../stores/session";

export type LoginScene =
  | "generate"
  | "study"
  | "unlock"
  | "purchase"
  | "favorite"
  | "interaction"
  | "feedback"
  | "profile"
  | "asset"
  | "generic";

interface LoginSceneCopy {
  loginTitle: string;
  loginSubtitle: string;
}

const LOGIN_SCENE_COPY: Record<LoginScene, LoginSceneCopy> = {
  generate: {
    loginTitle: "登录后继续创作",
    loginSubtitle: "保存生成结果，并在多端同步你的卡面",
  },
  study: {
    loginTitle: "登录后开始学习",
    loginSubtitle: "同步卡包、学习进度与记录",
  },
  unlock: {
    loginTitle: "登录后解锁卡包",
    loginSubtitle: "查看账号权益，继续解锁学习内容",
  },
  purchase: {
    loginTitle: "登录后购买权益",
    loginSubtitle: "咔豆、VIP 与订单会同步到你的账号",
  },
  favorite: {
    loginTitle: "登录后收藏内容",
    loginSubtitle: "保存喜欢的卡包和卡片，方便随时查看",
  },
  interaction: {
    loginTitle: "登录后参与互动",
    loginSubtitle: "评价学习内容，并同步你的互动记录",
  },
  feedback: {
    loginTitle: "登录后提交反馈",
    loginSubtitle: "提交问题，并持续查看处理结果",
  },
  profile: {
    loginTitle: "登录后查看个人主页",
    loginSubtitle: "学习数据、收藏与权益将同步展示",
  },
  asset: {
    loginTitle: "登录后查看账号资产",
    loginSubtitle: "查看咔豆、VIP、订单与等级信息",
  },
  generic: {
    loginTitle: "继续你的学习旅程",
    loginSubtitle: "同步卡包、学习进度与记录",
  },
};

let openingLogin = false;

export function getLoginSceneCopy(scene: LoginScene = "generic") {
  return LOGIN_SCENE_COPY[scene] ?? LOGIN_SCENE_COPY.generic;
}

export function isAuthenticated() {
  return Boolean(sessionStore.getState()?.accessToken);
}

export function openLogin(scene: LoginScene = "generic") {
  if (isAuthenticated() || openingLogin) return;
  const url = `/pages/login/index?scene=${encodeURIComponent(scene)}`;
  const pages = getCurrentPages();
  const currentRoute = pages[pages.length - 1]?.route;
  if (currentRoute === "pages/login/index") return;
  openingLogin = true;
  wx.navigateTo({
    url,
    complete: () => {
      openingLogin = false;
    },
  });
}

export function requireLogin(scene: LoginScene = "generic"): Promise<boolean> {
  if (isAuthenticated()) return Promise.resolve(true);
  openLogin(scene);
  return Promise.resolve(false);
}
