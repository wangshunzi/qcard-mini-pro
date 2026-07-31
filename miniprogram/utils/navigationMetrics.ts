export interface ImmersiveNavigationMetrics {
  statusBarHeight: number;
  navigationHeight: number;
  controlRowTop: number;
  controlRowHeight: number;
  totalHeight: number;
  controlsMaxWidth: number;
  capsuleReservedWidth: number;
}

/**
 * Aligns application-owned controls with WeChat's native menu capsule while
 * reserving the capsule's complete hit area on the right.
 */
export function getImmersiveNavigationMetrics(): ImmersiveNavigationMetrics {
  const windowInfo = wx.getWindowInfo();
  let capsule: WechatMiniprogram.ClientRect | undefined;
  try {
    capsule = wx.getMenuButtonBoundingClientRect();
  } catch {
    capsule = undefined;
  }

  const statusBarHeight = Number(windowInfo.statusBarHeight || 20);
  const navigationHeight = capsule?.height
    ? Math.max(
        44,
        Number(capsule.height) +
          (Number(capsule.top) - statusBarHeight) * 2,
      )
    : 44;
  const controlRowTop = statusBarHeight;
  const totalHeight = statusBarHeight + navigationHeight;
  const windowWidth = Number(windowInfo.windowWidth || 375);
  const capsuleLeft = Number(capsule?.left || windowWidth - 104);
  const capsuleRight = Number(capsule?.right || windowWidth - 8);
  const capsuleReservedWidth = Math.max(96, windowWidth - capsuleLeft + 8);
  const controlsMaxWidth = Math.max(180, capsuleLeft - 12);

  return {
    statusBarHeight,
    navigationHeight,
    controlRowTop,
    controlRowHeight: navigationHeight,
    totalHeight,
    controlsMaxWidth,
    capsuleReservedWidth: Math.max(
      capsuleReservedWidth,
      windowWidth - capsuleRight + Number(capsule?.width || 87) + 8,
    ),
  };
}
