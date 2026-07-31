import { UI_ASSETS } from "../config/uiAssets";

let loadingPromise: Promise<void> | null = null;

export function ensureIconFontLoaded() {
  if (loadingPromise) return loadingPromise;
  loadingPromise = new Promise((resolve) => {
    wx.loadFontFace({
      global: true,
      family: "MaterialCommunityIcons",
      source: `url("${UI_ASSETS.materialCommunityIcons}?v=20260725") format("truetype")`,
      scopes: ["webview", "native"],
      success: () => resolve(),
      fail: () => {
        loadingPromise = null;
        resolve();
      },
    });
  });
  return loadingPromise;
}
