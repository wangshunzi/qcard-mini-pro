interface NavigationScrollPage {
  data: { navScrollTop?: number };
  setData(data: { navScrollTop: number }): void;
}

/**
 * Keeps scroll-driven navigation updates bounded and quantized so long lists
 * do not send an unbounded stream of high-frequency setData payloads.
 */
export function syncNavigationScroll(
  page: NavigationScrollPage,
  scrollTop: number,
) {
  const next = Math.max(
    0,
    Math.min(120, Math.round((Number(scrollTop) || 0) / 4) * 4),
  );
  if (next !== Number(page.data.navScrollTop || 0)) {
    page.setData({ navScrollTop: next });
  }
}
