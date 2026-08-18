# 游客首页内容化 Design QA

## Visual source

- 用户反馈截图：`/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/codex-clipboard-c65bcdea-eec0-4dfd-ae53-b745d1a431e9.png`
- 微信开发者工具首页实测：`/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/com.openai.sky.CUAService/微信开发者工具 Screenshot 2026-08-14 at 7.42.35 PM.jpeg`
- 微信开发者工具卡片预览实测：`/var/folders/qg/nksqszv52xd_n_lftjc7rlsm0000gn/T/com.openai.sky.CUAService/微信开发者工具 Screenshot 2026-08-14 at 7.43.15 PM.jpeg`

## Comparison

- P0/P1：无。首页可正常加载真实精选卡包与公开卡片，卡片详情可打开。
- P2：原页面只有卡包区域，首屏以下存在大块空白；现增加精选卡片区域，形成“卡包 → 卡片”的连续浏览层次。
- P2：原 Hero 的两行说明较像登录前教育文案；现只保留“随便逛逛”，并删除“无需登录”等提示。
- P2：原“查看全部”是普通文字，点击意图偏弱；现统一为文字加右箭头的轻量操作，卡包进入卡包 Tab，卡片进入灵感 Tab。
- P2：精选卡包保持原封面、名称、数量样式，调整为双行横向内容带；首屏可同时识别更多主题，仍保留继续滑动的发现感。
- P2：精选卡片调整为三行两列的静态网格，移除卡片下方标题，不再横向滚动；卡面均完整裁切在 9:16 容器内。

## Interaction verification

- “精选卡包 / 查看全部”切换到 `pages/resource/index`：通过。
- “精选卡片 / 查看全部”切换到 `pages/explore/index`：通过。
- 点击游客首页公开卡片打开统一卡片预览：通过。
- 卡包双行排列、卡片两列排列及卡面无标题状态：通过。
- 暗色模式下标题、辅助文字、边框和卡片阴影对比度：通过。

## Final result

Passed. No remaining P0/P1/P2 issues in the verified simulator state.
