# 小程序主题规范

小程序的结构 UI 只能使用 `theme.wxss` 中的语义变量，不直接写浅色或深色值。页面和组件按“用途”选择变量，例如：

- 页面背景：`--color-background`
- 内容表面：`--color-surface`、`--color-card`
- 输入与弱背景：`--color-input`、`--color-surface-soft`
- 文字：`--color-text`、`--color-text-secondary`、`--color-text-muted`
- 分隔：`--color-border`、`--color-divider`
- 浮层与玻璃：`--color-glass*`、`--color-overlay`
- 导航栏：由 `immersive-nav` 的语义表面层统一处理，不在页面传入固定颜色
- 加载状态：`--color-progress-track`、`--color-skeleton-base`、`--color-skeleton-highlight`

`theme.wxss` 的深色值与原生 App 的 dark palette 对齐。若新增语义变量，必须同时提供 light/dark 两套值。

卡面内容属于用户作品，可以保留模板自身的创意配色；卡面外部的页面、弹窗、工具栏、按钮和状态提示仍必须使用语义变量。

主题背景通过 `themeBackground.ts` 绑定。页面只声明数据字段和背景 key：

```ts
bindThemeBackgrounds(this, theme.config, {
  heroBackground: "home_bg",
});
```

不要在页面中直接读取 `home_bg_dark`。系统外观变化时，`app.ts` 会统一刷新当前页面，避免每个页面各自维护监听器。

原生导航栏和首屏尚未渲染时的底色由 `theme.json` 控制；自定义导航栏由 `immersive-nav` 控制。加载环和骨架屏不得使用固定浅色中性色。

提交前运行：

```sh
pnpm typecheck
pnpm test
```

`tests/dark-mode-theme.test.ts` 会检查原生主题配置、语义变量、固定浅色表面、图标颜色和运行时背景切换。
