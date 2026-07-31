const DOCUMENTS = {
  user_agreement: {
    title: "用户协议",
    url: "https://www.kolka.cn/user_agreement.html",
  },
  privacy_policy: {
    title: "隐私政策",
    url: "https://www.kolka.cn/privacy.html",
  },
} as const;

type DocumentKey = keyof typeof DOCUMENTS;

Page({
  data: {
    src: "",
  },

  onLoad(query: Record<string, string | undefined>) {
    const key = String(query.doc ?? "") as DocumentKey;
    const document = DOCUMENTS[key];
    if (!document) {
      wx.showToast({ title: "文档参数无效", icon: "none" });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }
    wx.setNavigationBarTitle({ title: document.title });
    this.setData({ src: document.url });
  },
});
