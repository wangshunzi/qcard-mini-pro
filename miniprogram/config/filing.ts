export const MINI_PROGRAM_FILING = {
  number: "沪ICP备2025146321号-3X",
  queryUrl: "https://beian.miit.gov.cn/",
} as const;

export function openMiniProgramFilingQuery() {
  wx.showModal({
    title: "备案信息查询",
    content: `${MINI_PROGRAM_FILING.number}\n${MINI_PROGRAM_FILING.queryUrl}`,
    confirmText: "复制网址",
    cancelText: "关闭",
    success: (result) => {
      if (!result.confirm) return;
      wx.setClipboardData({
        data: MINI_PROGRAM_FILING.queryUrl,
        success: () => {
          wx.showToast({ title: "查询网址已复制", icon: "success" });
        },
        fail: () => {
          wx.showToast({ title: "复制失败，请稍后重试", icon: "none" });
        },
      });
    },
  });
}
