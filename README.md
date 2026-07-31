# QCard Mini Program

叩咔 AI 微信原生小程序。页面结构、链接和交互以 `QCard-H5` 为基准，卡片内核继续以
`QCard-H5/src/components/QCard` 与 `QCard-Client/src/cards` 的共享数据契约为准。

## 开发

```bash
pnpm install
pnpm assets:tabbar
pnpm vendor:hanzi
pnpm typecheck
pnpm test
```

在微信开发者工具中导入本目录，填写真实 AppID，并在“工具 → 构建 npm”生成 `miniprogram_npm`。

环境地址在 `miniprogram/config/env.ts` 中配置。发布前必须配置 request/downloadFile 合法域名，以及与 App/公众号相同开放平台下的小程序 AppID。

小程序内的咔豆包和固定时长 VIP 使用微信虚拟支付
`short_series_goods`。客户端每次购买先重新执行 `wx.login`，只把内部商品 ID、
一次性 `code` 和幂等请求 ID 发给服务端；服务端返回的 `signData` 必须原样传给
`wx.requestVirtualPayment`。支付面板、订单恢复与三状态购买记录实现在
`miniprogram/services/virtualPayment.ts`，本地只保存不含签名的待确认订单。

服务端发布前需：

1. 配置 `WECHAT_MINIPROGRAM_APP_ID`、`WECHAT_MINIPROGRAM_APP_SECRET`。
2. 执行 `QCard-Server/scripts/sql/20260725_miniprogram_release_complete.sql`。
3. 在后台逐个确认 AI 模板的平台与 Schema 版本。
4. 在微信开放平台确认 App、公众号、小程序属于同一主体并可取得相同 UnionID。

主导航使用微信原生 TabBar，页面采用沉浸式自定义导航并避让微信胶囊。图标由 Client 的
MaterialCommunityIcons 字体生成。卡片分包页面只使用原生组件；学习页关闭 Swiper
手势抢占，保证拼图、连线、分类、刮擦和描字手势可用。Hanzi Writer 固定为 3.7.3，
通过 Canvas 2D RenderTarget 适配，字形数据从自有 CDN 加载并缓存。
