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
  const capsuleHeight = Number(capsule?.height || 32);
  const capsuleTop = Number(
    capsule?.top || statusBarHeight + Math.max(0, (44 - capsuleHeight) / 2),
  );
  const capsuleVerticalGap = Math.max(0, capsuleTop - statusBarHeight);
  const navigationHeight = Math.max(
    44,
    capsuleHeight + capsuleVerticalGap * 2,
  );
  const controlRowTop = capsuleTop;
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
    // App-owned navigation controls use the native capsule's exact height and
    // top edge. The surrounding navigation bar may be taller to preserve the
    // same vertical breathing room above and below the capsule.
    controlRowHeight: capsuleHeight,
    totalHeight,
    controlsMaxWidth,
    capsuleReservedWidth: Math.max(
      capsuleReservedWidth,
      windowWidth - capsuleRight + Number(capsule?.width || 87) + 8,
    ),
  };
}
