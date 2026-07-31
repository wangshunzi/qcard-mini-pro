# 叩咔 AI 微信小程序发布清单

以下项目全部通过后才可对外发布。TypeScript 构建通过不能替代微信官方编译器和真机验收。

## 服务端与账号

- 先备份生产数据库，再部署 `QCard-Server` 当前代码并运行可重复执行的完整补丁：
  - `scripts/sql/20260725_miniprogram_release_complete.sql`
- 生产环境设置 `WECHAT_MINIPROGRAM_APP_ID`、`WECHAT_MINIPROGRAM_APP_SECRET`。
- PM2 中 `qcard-api` 与单实例 `qcard-scheduler` 必须同时为 online；
  AI 异步任务依赖 scheduler 每 20 秒同步 Coze 结果、保存卡面并执行失败退款。
- Hanzi JSON 由服务端按字符动态从 `hanzi-writer-data@2.0.1` 的
  jsDelivr/unpkg 上游加载并缓存，无需人工收集或上传全集；如配置
  `HANZI_DATA_BASE_URL`，该地址作为第一优先级上游。
- 将 Client 中听力卡和识字卡的 55 个内置素材按
  `scripts/client-card-assets.mjs` 的路径同步到
  `https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/client-assets/v1`；
  不允许压缩、转码或替换文件，`pnpm release:check` 会逐文件下载并校验 SHA-256。
- 运行 `QCard-Server` 的 `node scripts/upload-miniprogram-ui-assets.mjs`，确认
  Client 登录背景、应用图标、微信图标、H5 今日挑战图标和 MaterialCommunityIcons 字体已同步到
  `https://kolka-public.oss-cn-shanghai.aliyuncs.com/qcard/miniprogram-ui/v1`；
  脚本会以合并方式补充公开只读 CORS 规则，不能删除 Bucket 已有规则。
- `project.config.json` 的 AppID 必须与服务端 AppID 完全一致。
- 小程序、App、H5/公众号必须绑定到同一微信开放平台。
- 用同一微信分别登录 App、H5、小程序，核对三个端返回完全相同的 `user.id`。
- Manager 的 AI 卡片类型配置中逐个确认“发布端”和 `schemaVersion`；
  Server 按请求头 `appname` 自动映射发布端，三端请求不得再自行传 `platform`。
- 在 Manager 用户详情中核对同一用户的 App、公众号/H5、小程序微信身份具有相同 UnionID。
- request 合法域名与业务域名加入 `https://www.kolka.cn`。
- downloadFile 合法域名加入：
  - `https://kolka-assets.oss-cn-shanghai.aliyuncs.com`
  - `https://kolka-public.oss-cn-shanghai.aliyuncs.com`
- uploadFile 合法域名加入：
  - `https://kolka-public.oss-cn-shanghai.aliyuncs.com`
  反馈截图通过用户专属 STS 前缀直接上传该公开桶；未配置时“提交反馈”中的截图上传会被微信拦截。
- 在开发者工具和真机确认远程图标字体加载成功；图标不得回退为空白或文本符号。
- 运行 `pnpm release:check`，确认首页、笔顺数据、用户协议、隐私政策均通过。

## 微信开发者工具

- 开启“安全设置 → 服务端口”，运行官方编译和构建 npm。
- 清缓存后重新构建 `hanzi-writer@3.7.3`，不得依赖本机旧的 `miniprogram_npm`。
- 检查主包、卡片分包、设置分包大小均低于微信当前发布限制。
- 开启 ES6 转 ES5、代码压缩、样式压缩、上传 Source Map。
- 使用体验版完成一次手机号登录和一次微信登录。

## 功能回归

- 底部四个 Tab 分别从其他三个页面首次点击进入，页面与选中图标必须在同一次点击内同步。
- 10 类卡片分别覆盖正面、背面、预览、只读、答题中、正确、错误、完成和重置。
- 认知交互卡预览必须展示完整动作按钮行；完整态逐个验证按钮内 Loading、主图保留、
  视频首帧淡入、缓冲恢复、播放结束反向淡出和主图复原，不得出现全卡 Loading 遮罩。
- 连线卡和分类卡分别完成一次拖拽操作和一次“先点选、再点目标”的操作；
  完成态不得继续改写答案，重置后必须回到初始状态。
- 识字卡对话抽屉覆盖打开、逐句播放、目标汉字高亮、点击蒙层关闭和退场动画；
  临摹覆盖描错、正确笔画、完成、退出与重新临摹。
- 拼图卡覆盖拼图/匹配两种模式、点击/拖拽放置、轮廓提示、结束、右下角补块、
  合缝、全卡放大、庆祝视频全屏淡入、播放结束、加载失败和保留模式/阶数的重新开始。
- 卡片数据中的相对图片、音频、视频路径在小程序端必须转换为 API 绝对地址。
- 学习页必须禁止 Swiper 抢占卡片手势；拼图、连线、分类、刮擦和描字分别完成一次真实操作。
- 卡片切换、翻面、退后台后，上一张卡片的音频和视频必须停止。
- 识字卡覆盖首次下载、缓存命中、清缓存、弱网、断网重试、描错和完成。
- AI 生成逐模板确认列表、详情表单、示例预览、余额不足、VIP 模板、断网幂等重试、
  后台生成、结果校验失败和退款；同一 `requestId` 的重试只能产生一条任务和一次扣费。
- Manager 的 AI 生成任务详情应显示来源 `appname` 与客户端幂等请求 ID，便于核查跨端下发和重复扣费问题。
- 卡包覆盖锁定、预览、解锁、指定卡片进入、学习时长和进度上报。
- 反馈中心覆盖列表筛选、详情、官方回复、截图选择/预览/移除、STS 上传和提交；
  提交后在管理端可查询到正确的类型、内容、截图与小程序设备信息。

## UI 与真机

- 在 375、390、430 三档宽度逐状态对比 Client 截图。
- 静态布局误差不超过 2px；排除动画和媒体画面后的感知差异不超过 2%。
- 覆盖至少一台 iOS 微信和一台 Android 微信，验证安全区、键盘、Canvas、拖拽和音视频中断。
- 覆盖弱网、前后台切换、系统来电/音频抢占和低内存恢复。

## 发布配置

- 微信公众平台已配置《小程序用户隐私保护指引》。
- 用户协议和隐私政策内容、公司主体、联系方式与当前版本一致。
- 审核截图、类目、服务内容和 AI 生成能力说明与实际功能一致。
- 上传前确认没有使用测试 AppID、测试 API、测试支付或管理员账号。
