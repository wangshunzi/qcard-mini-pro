export const BOTTOM_SHEET_SETTLE_MS = 220;

type BottomSheetHost = {
  data: Record<string, any>;
  setData(data: Record<string, unknown>): void;
};

type CloseHandler = () => void;

function stateKeys(prefix: string) {
  return prefix
    ? {
        closing: `${prefix}Closing`,
        dragging: `${prefix}Dragging`,
        settling: `${prefix}DragSettling`,
        offset: `${prefix}DragOffset`,
      }
    : {
        closing: "closing",
        dragging: "dragging",
        settling: "dragSettling",
        offset: "dragOffset",
      };
}

function privateKeys(prefix: string) {
  const name = prefix || "default";
  return {
    closeTimer: `_bottomSheet_${name}_closeTimer`,
    settleTimer: `_bottomSheet_${name}_settleTimer`,
    startY: `_bottomSheet_${name}_startY`,
    startedAt: `_bottomSheet_${name}_startedAt`,
  };
}

export function bottomSheetDragOffset(
  startY: number,
  currentY: number,
  maximum: number,
) {
  if (!Number.isFinite(startY) || !Number.isFinite(currentY)) return 0;
  return Math.min(Math.max(0, maximum), Math.max(0, currentY - startY));
}

export function shouldDismissBottomSheet(offset: number, elapsedMs: number) {
  return offset >= 88 || (offset >= 40 && elapsedMs <= 260);
}

export function clearBottomSheetGesture(host: BottomSheetHost, prefix = "") {
  const keys = privateKeys(prefix);
  const closeTimer = (host as any)[keys.closeTimer];
  const settleTimer = (host as any)[keys.settleTimer];
  if (closeTimer) clearTimeout(closeTimer);
  if (settleTimer) clearTimeout(settleTimer);
  (host as any)[keys.closeTimer] = null;
  (host as any)[keys.settleTimer] = null;
}

export function resetBottomSheetGesture(host: BottomSheetHost, prefix = "") {
  clearBottomSheetGesture(host, prefix);
  const state = stateKeys(prefix);
  const keys = privateKeys(prefix);
  (host as any)[keys.startY] = null;
  host.setData({
    [state.closing]: false,
    [state.dragging]: false,
    [state.settling]: false,
    [state.offset]: 0,
  });
}

function finishClose(
  host: BottomSheetHost,
  prefix: string,
  onClosed: CloseHandler,
) {
  const keys = privateKeys(prefix);
  (host as any)[keys.closeTimer] = setTimeout(() => {
    (host as any)[keys.closeTimer] = null;
    onClosed();
  }, BOTTOM_SHEET_SETTLE_MS);
}

export function closeBottomSheet(
  host: BottomSheetHost,
  prefix: string,
  onClosed: CloseHandler,
  blocked = false,
) {
  const state = stateKeys(prefix);
  if (blocked || host.data[state.closing]) return;
  clearBottomSheetGesture(host, prefix);
  const keys = privateKeys(prefix);
  (host as any)[keys.startY] = null;
  host.setData({
    [state.closing]: true,
    [state.dragging]: false,
    [state.settling]: false,
    [state.offset]: 0,
  });
  finishClose(host, prefix, onClosed);
}

export function startBottomSheetDrag(
  host: BottomSheetHost,
  event: WechatMiniprogram.TouchEvent,
  prefix = "",
  blocked = false,
) {
  const state = stateKeys(prefix);
  if (blocked || host.data[state.closing]) return;
  const touch = event.touches?.[0];
  if (!touch) return;
  const keys = privateKeys(prefix);
  const settleTimer = (host as any)[keys.settleTimer];
  if (settleTimer) clearTimeout(settleTimer);
  (host as any)[keys.settleTimer] = null;
  (host as any)[keys.startY] = touch.clientY;
  (host as any)[keys.startedAt] = Date.now();
  host.setData({
    [state.dragging]: true,
    [state.settling]: false,
    [state.offset]: 0,
  });
}

export function moveBottomSheetDrag(
  host: BottomSheetHost,
  event: WechatMiniprogram.TouchEvent,
  prefix = "",
) {
  const state = stateKeys(prefix);
  const touch = event.touches?.[0];
  if (!host.data[state.dragging] || !touch) return;
  const keys = privateKeys(prefix);
  const windowHeight = wx.getWindowInfo?.().windowHeight || 800;
  host.setData({
    [state.offset]: bottomSheetDragOffset(
      Number((host as any)[keys.startY]),
      touch.clientY,
      windowHeight,
    ),
  });
}

export function endBottomSheetDrag(
  host: BottomSheetHost,
  prefix: string,
  onClosed: CloseHandler,
) {
  const state = stateKeys(prefix);
  if (!host.data[state.dragging]) return;
  const keys = privateKeys(prefix);
  const offset = Number(host.data[state.offset] || 0);
  const elapsed = Date.now() - Number((host as any)[keys.startedAt] || 0);
  (host as any)[keys.startY] = null;
  if (shouldDismissBottomSheet(offset, elapsed)) {
    clearBottomSheetGesture(host, prefix);
    host.setData({
      [state.closing]: true,
      [state.dragging]: false,
      [state.settling]: true,
      [state.offset]: wx.getWindowInfo?.().windowHeight || 800,
    });
    finishClose(host, prefix, onClosed);
    return;
  }
  host.setData({
    [state.dragging]: false,
    [state.settling]: true,
    [state.offset]: 0,
  });
  (host as any)[keys.settleTimer] = setTimeout(() => {
    (host as any)[keys.settleTimer] = null;
    if (!host.data[state.closing]) host.setData({ [state.settling]: false });
  }, BOTTOM_SHEET_SETTLE_MS);
}
