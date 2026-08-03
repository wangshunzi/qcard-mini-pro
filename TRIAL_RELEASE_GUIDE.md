# 小程序体验版发布与支付验收

体验版与正式版使用同一个 API：`https://www.kolka.cn`。沙箱/生产不写入小程序包，统一由 Manager 的数据库运行开关控制。

## 1. 选择本次支付环境

- Android 沙箱验收：Manager 选择“沙箱”，开启“允许新交易”，至少启用一个已经关联并确认发布的商品。
- iPhone 或真实支付验收：Manager 选择“生产”，开启“允许新交易”。该模式会产生真实扣款。

旧订单保存自己的环境快照，切换环境不会影响历史订单查单、履约或退款。

## 2. 微信后台一次性配置

在微信公众平台“开发管理 → 开发设置 → 服务器域名”确认：

- request 合法域名：`https://www.kolka.cn`
- downloadFile 合法域名：`https://kolka-assets.oss-cn-shanghai.aliyuncs.com`、`https://kolka-public.oss-cn-shanghai.aliyuncs.com`
- uploadFile 合法域名：`https://kolka-public.oss-cn-shanghai.aliyuncs.com`

消息推送 URL 保持为 `https://www.kolka.cn/api/wechat/miniprogram/xpay/callback`，确认微信平台的 Token 校验已经保存成功。Token、EncodingAESKey、AppKey 和 AppSecret 只放在 Server/微信后台，禁止写入小程序代码。

## 3. 上传前检查

确认 Server 的 `qcard-api` 和 `qcard-scheduler` 均为 `online`，然后在本项目根目录执行：

```bash
corepack pnpm install --frozen-lockfile
pnpm check
```

根据 Manager 当前环境二选一：

```bash
# Android 沙箱体验版
pnpm trial:check:sandbox

# iPhone/Android 生产真实支付体验版
pnpm trial:check:production
```

检查会访问正式域名，确认首页、微信虚拟商品、消息回调、汉字数据、协议文档和 OSS 素材均可用。任何一项失败都不要上传。

## 4. 微信开发者工具上传

1. 使用小程序开发者账号登录微信开发者工具。
2. 导入本仓库根目录，确认 AppID 为 `wxd9f76b56915a35ce`。
3. 在“详情/本地设置”开启合法域名校验、ES6 转换、代码压缩、WXML/WXSS 压缩和上传 Source Map。
4. 点击“清缓存 → 全部清除”，重新编译并用真机预览核心页面。
5. 点击工具栏“上传”。版本号建议使用 `0.1.0.20260803.1`，备注写明本次环境、商品和验收范围。

## 5. 设置体验版

1. 登录微信公众平台，进入“小程序 → 管理 → 版本管理”。
2. 在“开发版本”找到刚上传的版本，点击“设为体验版”。
3. 在“成员管理 → 体验成员”添加需要测试的微信号。
4. 让体验成员扫描体验版二维码，或从微信最近使用的小程序重新进入。

不需要提交审核，也不要点击正式发布。

## 6. 必测链路

1. 登录后确认首页、卡包、个人中心和 AI 生成功能能正常请求 `www.kolka.cn`。
2. 确认购买页能展示 Manager 已启用的咔豆/VIP商品。
3. 沙箱只使用 Android 白名单账号；iPhone 必须切生产并进行真实支付。
4. 各完成一笔咔豆和 VIP 购买，确认支付、统一资产发放、微信发货确认三个状态均成功。
5. 主动取消一笔支付，再完成一次支付后杀进程，重新进入后确认订单可自动恢复到账状态。
6. 在 Manager 订单页核对环境、支付状态、履约状态和微信发货确认状态。
7. 非 iOS 订单测试一次整单全额退款，确认咔豆/VIP权益正确回收。

验收结束后，如暂不继续测试，在 Manager 关闭“允许新交易”。
