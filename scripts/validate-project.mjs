import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const miniRoot = path.join(root, "miniprogram");
const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function fail(file, message) {
  errors.push(`${path.relative(root, file)}: ${message}`);
}

const files = walk(miniRoot);
for (const file of files.filter((item) => item.endsWith(".json"))) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `JSON 无法解析：${error instanceof Error ? error.message : error}`);
  }
}

const appJsonPath = path.join(miniRoot, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
const expectedTabs = [
  ["pages/home/index", "首页", "assets/tabbar/home.png", "assets/tabbar/home-active.png"],
  ["pages/explore/index", "灵感", "assets/tabbar/explore.png", "assets/tabbar/explore-active.png"],
  ["pages/resource/index", "卡包", "assets/tabbar/resource.png", "assets/tabbar/resource-active.png"],
  ["pages/profile/index", "我的", "assets/tabbar/profile.png", "assets/tabbar/profile-active.png"],
];
if (appJson.tabBar?.custom === true) {
  fail(appJsonPath, "发布版本必须使用微信原生 TabBar，避免页面与选中态不同步");
}
const actualTabs = (appJson.tabBar?.list ?? []).map((item) => [
  item.pagePath,
  item.text,
  item.iconPath,
  item.selectedIconPath,
]);
if (JSON.stringify(actualTabs) !== JSON.stringify(expectedTabs)) {
  fail(appJsonPath, "原生底部导航的顺序、文案或图标与 Client 不一致");
}
if (appJson.pages?.[0] !== "pages/home/index") {
  fail(appJsonPath, "首页必须作为小程序默认启动页");
}
for (const [, , iconPath, selectedIconPath] of expectedTabs) {
  for (const relativePath of [iconPath, selectedIconPath]) {
    const file = path.join(miniRoot, relativePath);
    if (!fs.existsSync(file)) {
      fail(appJsonPath, `原生底栏缺少图标：${relativePath}`);
      continue;
    }
    if (fs.statSync(file).size > 40 * 1024) {
      fail(appJsonPath, `原生底栏图标超过 40KB：${relativePath}`);
    }
  }
}
const routes = [
  ...(appJson.pages ?? []).map((page) => page),
  ...(appJson.subpackages ?? []).flatMap((subpackage) =>
    (subpackage.pages ?? []).map((page) => `${subpackage.root}/${page}`),
  ),
];
const routeSet = new Set(routes);
if (new Set(routes).size !== routes.length) {
  fail(appJsonPath, "页面路由存在重复项");
}

const requiredH5AlignedRoutes = [
  "pages/home/index",
  "pages/explore/index",
  "pages/resource/index",
  "pages/profile/index",
  "pages/login/index",
  "package-cards/pages/pack-detail/index",
  "package-cards/pages/private-pack/index",
  "package-cards/pages/preview/index",
  "package-cards/pages/study/index",
  "package-cards/pages/generate/index",
  "package-cards/pages/ai-generate/index",
  "package-cards/pages/my-learning/index",
  "package-cards/pages/my-generation/index",
  "package-cards/pages/teacher/index",
  "package-settings/pages/settings/index",
  "package-settings/pages/theme/index",
  "package-settings/pages/feedback/index",
  "package-settings/pages/account/index",
  "package-settings/pages/profile-edit/index",
  "package-settings/pages/level-detail/index",
  "package-settings/pages/challenge-config/index",
];
for (const route of requiredH5AlignedRoutes) {
  if (!routeSet.has(route)) fail(appJsonPath, `缺少 H5 对齐页面：${route}`);
}
for (const route of routes) {
  for (const extension of [".ts", ".json", ".wxml", ".wxss"]) {
    const file = path.join(miniRoot, `${route}${extension}`);
    if (!fs.existsSync(file)) fail(appJsonPath, `路由缺少文件：${route}${extension}`);
  }
}

for (const jsonFile of files.filter((item) => item.endsWith(".json"))) {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
  } catch {
    continue;
  }
  for (const [name, componentPath] of Object.entries(config.usingComponents ?? {})) {
    if (
      typeof componentPath !== "string" ||
      /^(?:plugin|dynamicLib):\/\//.test(componentPath)
    ) {
      continue;
    }
    const base = componentPath.startsWith("/")
      ? path.join(miniRoot, componentPath)
      : path.resolve(path.dirname(jsonFile), componentPath);
    if (!base.startsWith(`${miniRoot}${path.sep}`)) {
      fail(jsonFile, `组件 ${name} 路径越出 miniprogram：${componentPath}`);
      continue;
    }
    for (const extension of [".ts", ".json", ".wxml", ".wxss"]) {
      if (!fs.existsSync(`${base}${extension}`)) {
        fail(jsonFile, `组件 ${name} 缺少 ${componentPath}${extension}`);
      }
    }
  }

  if (config.component === true) {
    const wxssFile = jsonFile.replace(/\.json$/, ".wxss");
    if (fs.existsSync(wxssFile)) {
      const wxss = fs.readFileSync(wxssFile, "utf8");
      const unsupportedComponentTagSelector =
        /(?:^|[,{]\s*|[>+~]\s+)(?:view|text|image|button|input|textarea|scroll-view)(?=[\s:{.#[])/m;
      if (unsupportedComponentTagSelector.test(wxss)) {
        fail(
          wxssFile,
          "自定义组件 WXSS 使用了基础标签选择器；微信组件样式隔离下必须改用 class",
        );
      }
    }
  }
}

const unsupportedTags = /<\/?(?:div|span|section|article|main|p|i)\b/i;
const expressionMethodCall = /\{\{[^}]*\.[A-Za-z_$][\w$]*\s*\(/;
const dynamicHandler = /\b(?:bind|catch)(?::[a-z]+|[a-z]+)="\{\{/;
const handlerPattern = /\b(?:bind|catch)(?::[a-z]+|[a-z]+)="([A-Za-z_$][\w$]*)"/g;

for (const wxmlFile of files.filter((item) => item.endsWith(".wxml"))) {
  const source = fs.readFileSync(wxmlFile, "utf8");
  if (unsupportedTags.test(source)) fail(wxmlFile, "包含小程序不支持的 HTML 标签");
  if (expressionMethodCall.test(source)) fail(wxmlFile, "WXML 表达式中调用了方法");
  if (dynamicHandler.test(source)) fail(wxmlFile, "事件处理器不能使用动态表达式");
  if (source.includes("<web-view") && !wxmlFile.endsWith("/web-doc/index.wxml")) {
    fail(wxmlFile, "仅协议文档页允许使用 web-view");
  }

  const tsFile = wxmlFile.replace(/\.wxml$/, ".ts");
  if (!fs.existsSync(tsFile)) continue;
  const script = fs.readFileSync(tsFile, "utf8");
  for (const match of source.matchAll(handlerPattern)) {
    const handler = match[1];
    const declaration = new RegExp(
      `(?:^|\\n)\\s*(?:async\\s+)?${handler.replace(/[$]/g, "\\$&")}\\s*\\(`,
    );
    if (!declaration.test(script)) {
      fail(wxmlFile, `事件处理器 ${handler} 未在同名 TypeScript 文件中声明`);
    }
  }
}

const navigationRoutePattern =
  /\/((?:pages|package-[A-Za-z0-9_-]+\/pages)\/[A-Za-z0-9_/-]+\/index)(?=[?`"'])/g;
for (const scriptFile of files.filter((item) => item.endsWith(".ts"))) {
  const source = fs.readFileSync(scriptFile, "utf8");
  for (const match of source.matchAll(navigationRoutePattern)) {
    if (!routeSet.has(match[1])) {
      fail(scriptFile, `跳转到未注册页面：/${match[1]}`);
    }
  }
}

const iconSourcePath = path.join(miniRoot, "components/ui-icon/index.ts");
const iconSource = fs.readFileSync(iconSourcePath, "utf8");
const iconNames = new Set(
  Array.from(
    iconSource.matchAll(
      /^\s*(?:"([^"]+)"|([A-Za-z][A-Za-z0-9-]*)):\s*String\.fromCodePoint/gm,
    ),
    (match) => match[1] || match[2],
  ),
);
const iconExpressionValues = new Set(["success", "failed", "light", "moderate"]);
for (const wxmlFile of files.filter((item) => item.endsWith(".wxml"))) {
  const source = fs.readFileSync(wxmlFile, "utf8");
  for (const match of source.matchAll(/<ui-icon\b[^>]*\bname="([^"]+)"/g)) {
    const attribute = match[1];
    const names = attribute.startsWith("{{")
      ? Array.from(attribute.matchAll(/'([A-Za-z][A-Za-z0-9-]*)'/g), (item) => item[1])
      : [attribute];
    for (const name of names) {
      if (iconExpressionValues.has(name)) continue;
      if (!iconNames.has(name)) fail(wxmlFile, `使用了未注册图标：${name}`);
    }
  }
}

for (const sourceFile of files.filter((item) => /\.(?:ts|wxml|wxss)$/.test(item))) {
  const source = fs.readFileSync(sourceFile, "utf8");
  if (/http:\/\/(?!127\.0\.0\.1|localhost)/i.test(source)) {
    fail(sourceFile, "包含非 HTTPS 的远程资源");
  }
}

const flipCardTemplatePath = path.join(
  miniRoot,
  "cards/FlipCardContainer/index.wxml",
);
const flipCardTemplate = fs.readFileSync(flipCardTemplatePath, "utf8");
if ((flipCardTemplate.match(/<listening-card\b/g) ?? []).length !== 2) {
  fail(flipCardTemplatePath, "听力卡必须同时注册在 FlipCardContainer 的正面和背面");
}
for (const route of [
  "pages/home/index",
  "pages/explore/index",
  "pages/resource/index",
  "pages/profile/index",
]) {
  const file = path.join(miniRoot, `${route}.wxml`);
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes("<flip-card") || !source.includes('preview="{{true}}"')) {
    fail(file, "主包卡面列表必须使用统一的原生预览内核");
  }
}
for (const route of [
  "package-cards/pages/my-generation/index",
  "package-cards/pages/generate/index",
  "package-cards/pages/ai-generate/index",
  "package-cards/pages/preview/index",
]) {
  const file = path.join(miniRoot, `${route}.wxml`);
  const source = fs.readFileSync(file, "utf8");
  const usesSharedPrivateFace =
    route === "package-cards/pages/my-generation/index" &&
    source.includes("<private-card-face-item");
  if (!source.includes("<flip-card") && !usesSharedPrivateFace) {
    fail(file, "卡面预览页必须使用统一的原生 FlipCardContainer");
  }
}
const privateFaceItemPath = path.join(
  miniRoot,
  "components/private-card-face-item/index.wxml",
);
const privateFaceItemTemplate = fs.readFileSync(privateFaceItemPath, "utf8");
if (
  !privateFaceItemTemplate.includes("<flip-card") ||
  !privateFaceItemTemplate.includes('preview="{{true}}"')
) {
  fail(privateFaceItemPath, "私有卡面组件必须使用统一的原生 FlipCardContainer");
}

const projectConfigPath = path.join(root, "project.config.json");
const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
if (!/^wx[a-f0-9]{16}$/i.test(projectConfig.appid ?? "")) {
  fail(projectConfigPath, "appid 不是有效的小程序 AppID 格式");
}
if (projectConfig.miniprogramRoot !== "miniprogram/") {
  fail(projectConfigPath, "miniprogramRoot 必须指向 miniprogram/");
}

const runtimeAssetConfigPath = path.join(
  miniRoot,
  "cards/assets/client-card-assets.ts",
);
const releaseAssetConfigPath = path.join(root, "scripts/client-card-assets.mjs");
const assetBasePattern =
  /https:\/\/kolka-public\.oss-cn-shanghai\.aliyuncs\.com\/qcard\/client-assets\/v\d+/;
const runtimeAssetBase = fs
  .readFileSync(runtimeAssetConfigPath, "utf8")
  .match(assetBasePattern)?.[0];
const releaseAssetBase = fs
  .readFileSync(releaseAssetConfigPath, "utf8")
  .match(assetBasePattern)?.[0];
if (!runtimeAssetBase || runtimeAssetBase !== releaseAssetBase) {
  fail(
    runtimeAssetConfigPath,
    "运行时卡片素材版本必须与发布哈希校验使用同一 OSS 路径",
  );
}

if (errors.length) {
  console.error(`项目静态结构检查失败（${errors.length} 项）`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(
  `项目静态结构检查通过：${routes.length} 个页面、${
    files.filter((item) => item.endsWith(".wxml")).length
  } 个 WXML 文件`,
);
