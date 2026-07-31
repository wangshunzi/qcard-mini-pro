export interface AiGenerateLayoutInput {
  windowWidth: number;
  windowHeight: number;
  statusBarHeight: number;
  navigationHeight: number;
  safeInsetBottom: number;
}

export interface AiGenerateLayout {
  carouselHeight: number;
  carouselSideMargin: number;
  contentHeight: number;
  bottomBarHeight: number;
}

const CARD_HEIGHT_RATIO = 0.7;
const CARD_MAX_WIDTH_RATIO = 0.75;
const CARD_ASPECT_RATIO = 9 / 16;
const BOTTOM_BAR_BASE_RPX = 166;
const STAGE_VERTICAL_GUTTER_RPX = 28;

/**
 * Mirrors the Client sizing rules while also constraining the card to the
 * actual space between the immersive navigation and bottom action bar.
 */
export function computeAiGenerateLayout(input: AiGenerateLayoutInput): AiGenerateLayout {
  const width = Math.max(1, Number(input.windowWidth) || 1);
  const height = Math.max(1, Number(input.windowHeight) || 1);
  const rpx = width / 750;
  const bottomBarHeight =
    BOTTOM_BAR_BASE_RPX * rpx + Math.max(0, Number(input.safeInsetBottom) || 0);
  const contentHeight = Math.max(
    1,
    height -
      Math.max(0, Number(input.statusBarHeight) || 0) -
      Math.max(0, Number(input.navigationHeight) || 0) -
      bottomBarHeight,
  );
  const availableCardHeight = Math.max(1, contentHeight - STAGE_VERTICAL_GUTTER_RPX * rpx);

  let carouselHeight = Math.min(height * CARD_HEIGHT_RATIO, availableCardHeight);
  let carouselWidth = carouselHeight * CARD_ASPECT_RATIO;
  const maxWidth = width * CARD_MAX_WIDTH_RATIO;

  if (carouselWidth > maxWidth) {
    carouselWidth = maxWidth;
    carouselHeight = carouselWidth / CARD_ASPECT_RATIO;
  }

  return {
    carouselHeight: Math.max(1, Math.round(carouselHeight)),
    carouselSideMargin: Math.max(20, Math.round((width - carouselWidth) / 2)),
    contentHeight: Math.max(1, Math.round(contentHeight)),
    bottomBarHeight: Math.max(1, Math.round(bottomBarHeight)),
  };
}
