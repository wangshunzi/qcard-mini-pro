export {};

import { normalizePuzzleCardData } from "./model";

type PuzzleMode = "shuffle" | "fill";
type SlotValue = number | null;

type RenderSlot = {
  renderKey: string;
  slotIndex: number;
  slotX: number;
  slotY: number;
  tileIndex: number | null;
  sourceX: number;
  sourceY: number;
  dropY: number;
};

type PoolTile = {
  tileIndex: number;
  sourceX: number;
  sourceY: number;
};

type FillDrag = {
  tileIndex: number;
  source: "pool" | "slot";
  sourceSlot: number;
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  moved: boolean;
  offsetX: number;
  offsetY: number;
  size: number;
};

const LEVELS = [2, 3, 4];
const START_FULL_IMAGE_HOLD_MS = 220;
const PIECE_SPLIT_TRANSITION_MS = 260;
const SPARE_FADE_MS = 800;
const SLIDE_MOVE_MS = 160;
const FILL_DROP_STAGGER_MS = 100;
const FILL_DROP_DURATION_MS = 420;
const FILL_POOL_FADE_MS = 200;
const INTRO_SCALE_MS = 400;
const INTRO_BLUR_MS = 350;
const INTRO_BUTTON_DELAY_MS = INTRO_SCALE_MS + INTRO_BLUR_MS;
const CELEBRATION_MERGE_HOLD_MS = 220;
const CELEBRATION_BLUR_MS = 450;
const CELEBRATION_SCALE_MS = 500;
const CELEBRATION_VIDEO_FADE_MS = 550;
const CELEBRATION_RESET_MS = 380;

function clampLevel(value: unknown): number {
  const level = Math.floor(Number(value));
  return LEVELS.includes(level) ? level : 3;
}

function shuffled<T>(input: T[]): T[] {
  const output = [...input];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[randomIndex]] = [output[randomIndex], output[index]];
  }
  return output;
}

function neighbors(slot: number, level: number): number[] {
  const row = Math.floor(slot / level);
  const column = slot % level;
  const values: number[] = [];
  if (row > 0) values.push(slot - level);
  if (row < level - 1) values.push(slot + level);
  if (column > 0) values.push(slot - 1);
  if (column < level - 1) values.push(slot + 1);
  return values;
}

function createSolvedSlots(level: number): SlotValue[] {
  return Array.from({ length: level * level }, (_, index) => index);
}

function renderSlots(
  slots: SlotValue[],
  level: number,
  boardSize = 0,
): RenderSlot[] {
  const tileSize = boardSize > 0 ? boardSize / level : 0;
  return slots.map((tileIndex, slotIndex) => ({
    renderKey: tileIndex == null ? `empty-${slotIndex}` : `tile-${tileIndex}`,
    slotIndex,
    slotX: slotIndex % level,
    slotY: Math.floor(slotIndex / level),
    tileIndex,
    sourceX: tileIndex == null ? 0 : tileIndex % level,
    sourceY: tileIndex == null ? 0 : Math.floor(tileIndex / level),
    dropY:
      boardSize > 0
        ? boardSize - Math.floor(slotIndex / level) * tileSize + 82
        : 0,
  }));
}

function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

function touchPoint(touch: any): { x: number; y: number } | null {
  if (!touch) return null;
  const x = Number(touch.clientX ?? touch.pageX ?? touch.x);
  const y = Number(touch.clientY ?? touch.pageY ?? touch.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    mode: "shuffle" as PuzzleMode,
    level: 3,
    previewLevel: 1,
    levels: LEVELS,
    levelMenuVisible: false,
    started: false,
    starting: false,
    animationPhase: "intro",
    phaseText: "",
    wholeImageVisible: true,
    showStartButton: false,
    boardSeamless: true,
    removingSpare: false,
    restoringSpare: false,
    spareTileIndex: -1,
    droppingTileMap: {} as Record<number, boolean>,
    shuffling: false,
    completed: false,
    slots: [] as SlotValue[],
    renderSlots: [] as RenderSlot[],
    hitSlots: [] as number[],
    previewSlots: [] as RenderSlot[],
    emptySlot: -1,
    poolTiles: [] as PoolTile[],
    selectedTileIndex: -1,
    hoveredSlotIndex: -1,
    activeTile: null as PoolTile | null,
    activeStyle: "",
    activeSize: 0,
    activeBgSize: 0,
    activeBgX: 0,
    activeBgY: 0,
    elapsed: 0,
    elapsedText: "00:00",
    boardSize: 280,
    tileSize: 140,
    poolTileSize: 72,
    objectUrl: "",
    backgroundUrl: "",
    videoUrl: "",
    videoEnded: false,
    celebrationPhase: "idle",
    celebrationVideoPlaying: false,
    celebrationResetting: false,
    boardScale: 1,
    boardOpacity: 1,
    boardTransitionMs: 0,
    boardOpacityTransitionMs: 0,
    videoOpacity: 0,
    videoTransitionMs: 0,
    blurOpacity: 1,
    blurTransitionMs: 0,
    showOutline: false,
    hasUserMoved: false,
  },
  lifetimes: {
    ready() {
      this.measure();
    },
    detached() {
      this.stopTimer();
      this.clearShuffleTimer();
      this.clearStartTimers();
      this.stopCelebrationVideo();
    },
  },
  observers: {
    "data, preview, readOnly"(value: any) {
      const normalized = normalizePuzzleCardData(value);
      const level = normalized.gameLevel;
      const boardSize = Math.min(330, Math.max(180, wx.getWindowInfo().windowWidth - 56));
      this.stopTimer();
      this.clearShuffleTimer();
      this.clearStartTimers();
      this.setData({
        objectUrl: normalized.objectUrl,
        backgroundUrl: normalized.backgroundUrl,
        videoUrl: normalized.videoUrl,
        level,
        hitSlots: Array.from({ length: level * level }, (_, index) => index),
        previewLevel: normalized.previewLevel,
        previewSlots: renderSlots(
          createSolvedSlots(normalized.previewLevel),
          normalized.previewLevel,
        ),
        boardSize,
        tileSize: boardSize / level,
      }, () => this.resetGame(false));
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  methods: {
    measure() {
      wx.nextTick(() => {
        this.createSelectorQuery()
          .select(".puzzle-card")
          .boundingClientRect()
          .exec((results: any[]) => {
            const cardRect = results?.[0];
            if (!cardRect) return;
            (this as any)._cardRect = cardRect;
            if ((this.data as any).preview) return;
            const state = this.data as any;
            const availableWidth = Math.max(0, cardRect.width - 16);
            const availableHeight = Math.max(0, cardRect.height - 24);
            const boardSize = Math.max(160, Math.floor(Math.min(344, availableWidth, availableHeight)));
            const poolTileSize = Math.max(
              56,
              Math.min(96, (cardRect.width - 24 - 36) / 3),
            );
            this.setData({
              boardSize,
              tileSize: boardSize / state.level,
              poolTileSize,
              renderSlots: renderSlots(state.slots, state.level, boardSize),
            }, () => {
              wx.nextTick(() => {
                this.createSelectorQuery()
                  .select(".grid")
                  .boundingClientRect()
                  .exec((gridResults: any[]) => {
                    if (gridResults?.[0]) (this as any)._gridRect = gridResults[0];
                  });
              });
            });
          });
      });
    },
    clearShuffleTimer() {
      const timer = (this as any)._shuffleTimer;
      if (timer) clearTimeout(timer);
      (this as any)._shuffleTimer = null;
    },
    clearStartTimers() {
      const timers = ((this as any)._startTimers ?? []) as ReturnType<typeof setTimeout>[];
      timers.forEach((timer) => clearTimeout(timer));
      (this as any)._startTimers = [];
    },
    stopCelebrationVideo() {
      try {
        wx.createVideoContext("puzzleCelebrationVideo", this).stop();
      } catch {
        // Video may not be mounted yet.
      }
    },
    scheduleStart(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        const timers = ((this as any)._startTimers ?? []) as ReturnType<typeof setTimeout>[];
        (this as any)._startTimers = timers.filter((candidate) => candidate !== timer);
        callback();
      }, delay);
      (this as any)._startTimers = [
        ...(((this as any)._startTimers ?? []) as ReturnType<typeof setTimeout>[]),
        timer,
      ];
    },
    startTimer() {
      this.stopTimer();
      (this as any)._timer = setInterval(() => {
        const elapsed = Number((this.data as any).elapsed) + 1;
        this.setData({ elapsed, elapsedText: formatElapsed(elapsed) });
      }, 1000);
    },
    stopTimer() {
      const timer = (this as any)._timer;
      if (timer) clearInterval(timer);
      (this as any)._timer = null;
    },
    toggleMode(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.started || state.readOnly || state.preview) return;
      const mode = String(event.currentTarget.dataset.mode) as PuzzleMode;
      if (mode !== "shuffle" && mode !== "fill") return;
      this.setData({ mode }, () => this.resetGame(true));
    },
    toggleLevelMenu() {
      const state = this.data as any;
      if (state.started || state.readOnly || state.preview) return;
      this.setData({ levelMenuVisible: !state.levelMenuVisible });
    },
    chooseLevel(event: WechatMiniprogram.TouchEvent) {
      const level = clampLevel(event.currentTarget.dataset.level);
      this.setData({ level, levelMenuVisible: false }, () => this.resetGame(true));
    },
    start() {
      const state = this.data as any;
      if (state.started || state.readOnly || state.preview) return;
      this.stopTimer();
      this.clearStartTimers();
      this.setData({
        started: true,
        starting: true,
        animationPhase: "intro",
        phaseText: "正在准备…",
        wholeImageVisible: true,
        showStartButton: false,
        boardSeamless: true,
        removingSpare: false,
        spareTileIndex: state.level * state.level - 1,
        droppingTileMap: {},
        shuffling: false,
        completed: false,
        videoEnded: false,
        showOutline: false,
        elapsed: 0,
        elapsedText: "00:00",
        selectedTileIndex: -1,
        poolTiles: [],
        hasUserMoved: false,
      });
      this.scheduleStart(() => {
        if (!(this.data as any).started) return;
        const current = this.data as any;
        const slots = createSolvedSlots(current.level);
        this.setData({
          wholeImageVisible: false,
          boardSeamless: false,
          animationPhase: "split",
          phaseText: "正在拆分…",
          slots,
          renderSlots: renderSlots(slots, current.level, current.boardSize),
        });
      }, START_FULL_IMAGE_HOLD_MS);

      this.scheduleStart(() => {
        if (!(this.data as any).started) return;
        if ((this.data as any).mode === "shuffle") {
          this.setData({
            animationPhase: "remove-spare",
            phaseText: "正在移除右下角拼图…",
            removingSpare: true,
          });
          this.scheduleStart(
            () => this.beginShuffle(),
            SPARE_FADE_MS,
          );
        } else {
          this.beginFill();
        }
      }, START_FULL_IMAGE_HOLD_MS + PIECE_SPLIT_TRANSITION_MS);
    },
    beginShuffle() {
      const state = this.data as any;
      if (!state.started || state.mode !== "shuffle") return;
      const level = state.level as number;
      const total = level * level;
      const slots = createSolvedSlots(level);
      const spare = total - 1;
      slots[spare] = null;
      (this as any)._shuffleStepsRemaining = Math.max(40, total * 5);
      (this as any)._shufflePreviousEmpty = -1;
      this.setData({
        animationPhase: "shuffling",
        phaseText: "正在打乱…",
        removingSpare: false,
        shuffling: true,
        slots,
        renderSlots: renderSlots(slots, level, state.boardSize),
        emptySlot: spare,
      }, () => this.runShuffleStep());
    },
    runShuffleStep() {
      const state = this.data as any;
      if (!state.started || state.mode !== "shuffle" || !state.shuffling) return;
      const remaining = Number((this as any)._shuffleStepsRemaining ?? 0);
      if (remaining <= 0) {
        this.setData({
          animationPhase: "playing",
          phaseText: "",
          shuffling: false,
          starting: false,
        });
        this.startTimer();
        return;
      }

      const slots = [...(state.slots as SlotValue[])];
      const empty = Number(state.emptySlot);
      const previousEmpty = Number((this as any)._shufflePreviousEmpty ?? -1);
      const possible = neighbors(empty, state.level);
      const candidates = possible.filter((slot) => slot !== previousEmpty);
      const source =
        candidates[Math.floor(Math.random() * candidates.length)] ??
        possible[0];
      if (source === undefined) return;
      slots[empty] = slots[source];
      slots[source] = null;
      (this as any)._shufflePreviousEmpty = empty;
      (this as any)._shuffleStepsRemaining = remaining - 1;
      this.setData({
        slots,
        renderSlots: renderSlots(slots, state.level, state.boardSize),
        emptySlot: source,
      });
      this.scheduleStart(
        () => this.runShuffleStep(),
        SLIDE_MOVE_MS + 16,
      );
    },
    moveShuffleTile(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (
        state.mode !== "shuffle" ||
        !state.started ||
        state.shuffling ||
        state.completed ||
        state.readOnly
      ) return;
      const slotIndex = Number(event.currentTarget.dataset.slot);
      if (!neighbors(state.emptySlot, state.level).includes(slotIndex)) return;
      const slots = [...(state.slots as SlotValue[])];
      slots[state.emptySlot] = slots[slotIndex];
      slots[slotIndex] = null;
      const emptySlot = slotIndex;
      this.setData({
        slots,
        renderSlots: renderSlots(slots, state.level, state.boardSize),
        emptySlot,
        hasUserMoved: true,
      }, () => {
        const spare = state.level * state.level - 1;
        const solved = emptySlot === spare && slots.every((tile, index) => index === spare || tile === index);
        if (solved) {
          slots[spare] = spare;
          this.setData({
            slots,
            renderSlots: renderSlots(slots, state.level, state.boardSize),
            emptySlot: -1,
            restoringSpare: true,
          }, () => this.complete(true));
        }
      });
    },
    slotTap(event: WechatMiniprogram.TouchEvent) {
      if ((this.data as any).mode === "shuffle") {
        this.moveShuffleTile(event);
      } else {
        this.placeSelected(event);
      }
    },
    beginFill() {
      const state = this.data as any;
      if (!state.started || state.mode !== "fill") return;
      const total = state.level * state.level;
      const order = shuffled(Array.from({ length: total }, (_, index) => index));
      const slots = createSolvedSlots(state.level);
      (this as any)._fillDropOrder = order;
      (this as any)._fillDropIndex = 0;
      this.setData({
        animationPhase: "dropping",
        phaseText: "碎片正在落入底部池…",
        starting: true,
        slots,
        renderSlots: renderSlots(slots, state.level, state.boardSize),
        poolTiles: [],
        droppingTileMap: {},
      }, () => this.runFillDropStep());
    },
    runFillDropStep() {
      const state = this.data as any;
      if (!state.started || state.mode !== "fill" || state.animationPhase !== "dropping") return;
      const order = ((this as any)._fillDropOrder ?? []) as number[];
      const orderIndex = Number((this as any)._fillDropIndex ?? 0);
      if (orderIndex >= order.length) {
        this.scheduleStart(() => {
          if (!(this.data as any).started) return;
          this.setData({
            animationPhase: "playing",
            phaseText: "",
            starting: false,
            droppingTileMap: {},
          }, () => {
            this.measure();
            this.startTimer();
          });
        }, FILL_DROP_DURATION_MS + FILL_POOL_FADE_MS - FILL_DROP_STAGGER_MS);
        return;
      }

      const tileIndex = order[orderIndex];
      (this as any)._fillDropIndex = orderIndex + 1;
      this.setData({
        [`droppingTileMap.${tileIndex}`]: true,
      });
      this.scheduleStart(() => {
        const current = this.data as any;
        if (!current.started || current.mode !== "fill") return;
        const slots = [...(current.slots as SlotValue[])];
        const slotIndex = slots.findIndex((value) => value === tileIndex);
        if (slotIndex >= 0) slots[slotIndex] = null;
        const poolTiles = [
          ...(current.poolTiles as PoolTile[]),
          {
            tileIndex,
            sourceX: tileIndex % current.level,
            sourceY: Math.floor(tileIndex / current.level),
          },
        ];
        this.setData({
          slots,
          renderSlots: renderSlots(slots, current.level, current.boardSize),
          poolTiles,
          [`droppingTileMap.${tileIndex}`]: false,
        });
      }, FILL_DROP_DURATION_MS);
      this.scheduleStart(
        () => this.runFillDropStep(),
        FILL_DROP_STAGGER_MS,
      );
    },
    selectPool(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (!state.started || state.starting || state.completed || state.readOnly) return;
      if (this.consumeIgnoredFillTap()) return;
      const tileIndex = Number(event.currentTarget.dataset.tile);
      this.setData({
        selectedTileIndex: state.selectedTileIndex === tileIndex ? -1 : tileIndex,
      });
    },
    placeSelected(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (
        state.mode !== "fill" ||
        !state.started ||
        state.starting ||
        state.completed ||
        state.readOnly
      ) return;
      if (this.consumeIgnoredFillTap()) return;
      const slotIndex = Number(event.currentTarget.dataset.slot);
      const slots = [...(state.slots as SlotValue[])];
      if (state.selectedTileIndex >= 0) {
        this.placeFillTile(state.selectedTileIndex, slotIndex, -1);
        return;
      }
      if (slots[slotIndex] != null) {
        this.returnSlotToPool(slotIndex);
        return;
      }
    },
    fillTouchStart(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (
        state.mode !== "fill" ||
        !state.started ||
        state.starting ||
        state.completed ||
        state.readOnly
      ) return;
      const touch = event.touches?.[0];
      const point = touchPoint(touch);
      const cardRect = (this as any)._cardRect;
      if (!point || !cardRect) return;
      const tileIndex = Number(event.currentTarget.dataset.tile);
      const source = String(event.currentTarget.dataset.source) === "slot" ? "slot" : "pool";
      const sourceSlot = Number(event.currentTarget.dataset.slot ?? -1);
      const size = source === "slot"
        ? state.tileSize
        : Math.min(state.poolTileSize, state.tileSize);
      const drag: FillDrag = {
        tileIndex,
        source,
        sourceSlot,
        originX: point.x,
        originY: point.y,
        currentX: point.x,
        currentY: point.y,
        moved: false,
        offsetX: size / 2,
        offsetY: size / 2,
        size,
      };
      (this as any)._fillDrag = drag;
      this.setData({
        selectedTileIndex: source === "slot" ? -1 : state.selectedTileIndex,
        activeTile: {
          tileIndex,
          sourceX: tileIndex % state.level,
          sourceY: Math.floor(tileIndex / state.level),
        },
        activeStyle: this.activeStyle(drag, point.x, point.y),
        activeSize: size,
        activeBgSize: state.level * size,
        activeBgX: (tileIndex % state.level) * size,
        activeBgY: Math.floor(tileIndex / state.level) * size,
      });
    },
    fillTouchMove(event: WechatMiniprogram.TouchEvent) {
      const drag = (this as any)._fillDrag as FillDrag | null;
      const touch = event.touches?.[0];
      const point = touchPoint(touch);
      if (!drag || !point) return;
      drag.currentX = point.x;
      drag.currentY = point.y;
      drag.moved =
        drag.moved ||
        Math.hypot(point.x - drag.originX, point.y - drag.originY) > 5;
      (this as any)._fillDrag = drag;
      this.setData({
        activeStyle: this.activeStyle(drag, point.x, point.y),
        hoveredSlotIndex: drag.moved ? this.slotFromPoint(point.x, point.y) : -1,
      });
    },
    activeStyle(drag: FillDrag, clientX: number, clientY: number) {
      const cardRect = (this as any)._cardRect;
      if (!cardRect) return "";
      return `left:${clientX - cardRect.left - drag.offsetX}px;top:${clientY - cardRect.top - drag.offsetY}px;width:${drag.size}px;height:${drag.size}px`;
    },
    fillTouchEnd(event: WechatMiniprogram.TouchEvent) {
      const drag = (this as any)._fillDrag as FillDrag | null;
      const touch = event.changedTouches?.[0];
      const point = touchPoint(touch) ?? (drag ? { x: drag.currentX, y: drag.currentY } : null);
      if (!drag || !point) {
        this.clearDrag();
        return;
      }
      if (!drag.moved) {
        this.clearDrag();
        return;
      }
      (this as any)._ignoreFillTapUntil = Date.now() + 360;
      const slotIndex = this.slotFromPoint(point.x, point.y);
      if (slotIndex >= 0) {
        this.placeFillTile(
          drag.tileIndex,
          slotIndex,
          drag.source === "slot" ? drag.sourceSlot : -1,
        );
      } else if (drag.source === "slot") {
        this.returnSlotToPool(drag.sourceSlot);
      }
      this.clearDrag();
    },
    fillTouchCancel() {
      this.clearDrag();
    },
    clearDrag() {
      (this as any)._fillDrag = null;
      this.setData({
        activeTile: null,
        activeStyle: "",
        hoveredSlotIndex: -1,
      });
    },
    consumeIgnoredFillTap() {
      const ignoreUntil = Number((this as any)._ignoreFillTapUntil ?? 0);
      if (Date.now() >= ignoreUntil) return false;
      (this as any)._ignoreFillTapUntil = 0;
      return true;
    },
    slotFromPoint(clientX: number, clientY: number) {
      const state = this.data as any;
      const gridRect = (this as any)._gridRect;
      if (
        !gridRect ||
        clientX < gridRect.left ||
        clientX > gridRect.right ||
        clientY < gridRect.top ||
        clientY > gridRect.bottom
      ) return -1;
      const slotSize = gridRect.width / state.level;
      const column = Math.min(
        state.level - 1,
        Math.max(0, Math.floor((clientX - gridRect.left) / slotSize)),
      );
      const row = Math.min(
        state.level - 1,
        Math.max(0, Math.floor((clientY - gridRect.top) / slotSize)),
      );
      return row * state.level + column;
    },
    placeFillTile(tileIndex: number, slotIndex: number, sourceSlot: number) {
      const state = this.data as any;
      const slots = [...(state.slots as SlotValue[])];
      if (slots[slotIndex] != null && slotIndex !== sourceSlot) return;
      if (sourceSlot >= 0) slots[sourceSlot] = null;
      slots[slotIndex] = tileIndex;
      const poolTiles = (state.poolTiles as PoolTile[]).filter((tile) => tile.tileIndex !== tileIndex);
      this.setData({
        slots,
        renderSlots: renderSlots(slots, state.level, state.boardSize),
        poolTiles,
        selectedTileIndex: -1,
      }, () => this.checkFillComplete());
    },
    returnSlotToPool(slotIndex: number) {
      const state = this.data as any;
      const slots = [...(state.slots as SlotValue[])];
      const tileIndex = slots[slotIndex];
      if (tileIndex == null) return;
      slots[slotIndex] = null;
      const poolTiles = [
        ...(state.poolTiles as PoolTile[]).filter((tile) => tile.tileIndex !== tileIndex),
        {
          tileIndex,
          sourceX: tileIndex % state.level,
          sourceY: Math.floor(tileIndex / state.level),
        },
      ];
      this.setData({
        slots,
        renderSlots: renderSlots(slots, state.level, state.boardSize),
        poolTiles,
        selectedTileIndex: -1,
      });
    },
    checkFillComplete() {
      const state = this.data as any;
      const solved = (state.slots as SlotValue[]).every((tile, index) => tile === index);
      if (solved) this.complete(false);
    },
    complete(restoreCorner?: boolean) {
      const state = this.data as any;
      if (state.completed) return;
      this.stopTimer();
      this.clearStartTimers();
      const shouldRestoreCorner =
        typeof restoreCorner === "boolean"
          ? restoreCorner
          : state.mode === "shuffle";
      const completedSlots = [...(state.slots as SlotValue[])];
      if (shouldRestoreCorner) {
        completedSlots[state.level * state.level - 1] =
          state.level * state.level - 1;
      }
      this.setData({
        completed: true,
        starting: false,
        shuffling: false,
        animationPhase: shouldRestoreCorner ? "finish-restore-corner" : "finish-merge",
        phaseText: "",
        slots: completedSlots,
        renderSlots: renderSlots(completedSlots, state.level, state.boardSize),
        emptySlot: -1,
        restoringSpare: shouldRestoreCorner,
        videoEnded: false,
        celebrationPhase: shouldRestoreCorner ? "restore" : "merge-wait",
        celebrationVideoPlaying: false,
        celebrationResetting: false,
        selectedTileIndex: -1,
        hoveredSlotIndex: -1,
        activeTile: null,
        activeStyle: "",
        showOutline: false,
        blurTransitionMs: CELEBRATION_BLUR_MS,
        blurOpacity: 0,
        boardScale: 1,
        boardOpacity: 1,
        boardTransitionMs: 0,
        boardOpacityTransitionMs: 0,
        videoOpacity: 0,
        videoTransitionMs: 0,
      }, () => {
        this.scheduleStart(
          () => this.startCompletionMerge(),
          shouldRestoreCorner ? SPARE_FADE_MS : FILL_POOL_FADE_MS,
        );
      });
      this.triggerEvent("cardevent", {
        type: "complete",
        cardType: "puzzle_card",
        payload: { mode: state.mode, level: state.level, elapsed: state.elapsed },
      });
    },
    startCompletionMerge() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting) return;
      this.setData({
        celebrationPhase: "merge",
        animationPhase: "finish-merge",
        boardSeamless: true,
        removingSpare: false,
        restoringSpare: false,
        wholeImageVisible: false,
      });
      this.scheduleStart(
        () => this.startCompletionZoom(),
        PIECE_SPLIT_TRANSITION_MS + CELEBRATION_MERGE_HOLD_MS,
      );
    },
    startCompletionZoom() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting) return;
      const cardWidth = Number((this as any)._cardRect?.width || state.boardSize || 1);
      const boardWidth = Number(state.boardSize || 1);
      const boardScale = boardWidth > 0 ? Math.max(1, cardWidth / boardWidth) : 1;
      this.setData({
        celebrationPhase: "zoom",
        animationPhase: "finish-zoom",
        boardTransitionMs: CELEBRATION_SCALE_MS,
        boardScale,
      });
      this.scheduleStart(
        () => this.startCompletionCrossfade(),
        CELEBRATION_SCALE_MS,
      );
    },
    startCompletionCrossfade() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting) return;
      if (!state.videoUrl) {
        this.showCompletionResult();
        return;
      }
      this.setData({
        celebrationPhase: "crossfade",
        animationPhase: "finish-crossfade",
        boardOpacityTransitionMs: CELEBRATION_VIDEO_FADE_MS,
        boardOpacity: 0,
        videoTransitionMs: CELEBRATION_VIDEO_FADE_MS,
        videoOpacity: 1,
      });
      this.scheduleStart(
        () => this.playCelebrationVideo(),
        CELEBRATION_VIDEO_FADE_MS,
      );
    },
    playCelebrationVideo() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting || !state.videoUrl) return;
      this.setData({
        celebrationPhase: "video",
        animationPhase: "video-playing",
        celebrationVideoPlaying: true,
      }, () => {
        wx.nextTick(() => {
          try {
            const video = wx.createVideoContext("puzzleCelebrationVideo", this);
            video.seek(0);
            video.play();
          } catch {
            this.showCompletionResult();
          }
        });
      });
    },
    videoEnd() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting) return;
      this.showCompletionResult();
    },
    videoError() {
      this.showCompletionResult();
    },
    showCompletionResult() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting) return;
      this.setData({
        celebrationPhase: "result",
        animationPhase: "result",
        celebrationVideoPlaying: false,
        videoEnded: true,
      });
    },
    restartFromCelebration() {
      const state = this.data as any;
      if (!state.completed || state.celebrationResetting || state.readOnly) return;
      this.clearStartTimers();
      this.stopCelebrationVideo();
      this.setData({
        celebrationResetting: true,
        celebrationVideoPlaying: false,
        videoTransitionMs: CELEBRATION_RESET_MS,
        videoOpacity: 0,
      }, () => {
        this.scheduleStart(
          () => this.resetGame(true),
          CELEBRATION_RESET_MS,
        );
      });
    },
    toggleOutline() {
      const state = this.data as any;
      if (
        state.mode !== "fill" ||
        !state.started ||
        state.starting ||
        state.completed ||
        state.readOnly
      ) return;
      this.setData({ showOutline: !state.showOutline });
    },
    stop() {
      this.resetGame(true);
    },
    restart() {
      this.restartFromCelebration();
    },
    playIntro() {
      const state = this.data as any;
      if (state.preview || state.readOnly || state.started || state.completed) return;
      this.setData({
        animationPhase: "intro",
        wholeImageVisible: true,
        showStartButton: false,
        boardSeamless: true,
        boardTransitionMs: 0,
        boardScale: 0,
        blurTransitionMs: 0,
        blurOpacity: 0,
      });
      this.scheduleStart(() => {
        const current = this.data as any;
        if (current.started || current.completed) return;
        this.setData({
          boardTransitionMs: INTRO_SCALE_MS,
          boardScale: 1,
        });
      }, 16);
      this.scheduleStart(() => {
        const current = this.data as any;
        if (current.started || current.completed) return;
        this.setData({
          boardSeamless: false,
          blurTransitionMs: INTRO_BLUR_MS,
          blurOpacity: 1,
        });
      }, INTRO_SCALE_MS + 16);
      this.scheduleStart(() => {
        const current = this.data as any;
        if (current.started || current.completed) return;
        this.setData({ showStartButton: true });
      }, INTRO_BUTTON_DELAY_MS + 16);
    },
    resetGame(keepMode: boolean) {
      this.stopTimer();
      this.clearShuffleTimer();
      this.clearStartTimers();
      this.stopCelebrationVideo();
      (this as any)._fillDrag = null;
      const state = this.data as any;
      const level = clampLevel(state.level);
      const slots = createSolvedSlots(level);
      this.setData({
        mode: keepMode ? state.mode : "shuffle",
        level,
        levelMenuVisible: false,
        started: false,
        starting: false,
        animationPhase: "intro",
        phaseText: "",
        wholeImageVisible: true,
        showStartButton: false,
        boardSeamless: true,
        removingSpare: false,
        restoringSpare: false,
        spareTileIndex: level * level - 1,
        droppingTileMap: {},
        shuffling: false,
        completed: false,
        videoEnded: false,
        celebrationPhase: "idle",
        celebrationVideoPlaying: false,
        celebrationResetting: false,
        boardScale: 1,
        boardOpacity: 1,
        boardTransitionMs: 0,
        boardOpacityTransitionMs: 0,
        videoOpacity: 0,
        videoTransitionMs: 0,
        blurOpacity: 1,
        blurTransitionMs: 0,
        showOutline: false,
        slots,
        renderSlots: renderSlots(slots, level, state.boardSize),
        hitSlots: Array.from({ length: level * level }, (_, index) => index),
        emptySlot: -1,
        poolTiles: [],
        selectedTileIndex: -1,
        hoveredSlotIndex: -1,
        activeTile: null,
        activeStyle: "",
        activeSize: 0,
        activeBgSize: 0,
        activeBgX: 0,
        activeBgY: 0,
        elapsed: 0,
        elapsedText: "00:00",
        hasUserMoved: false,
      }, () => {
        this.measure();
        this.playIntro();
      });
    },
    pause() {
      this.reset();
    },
    reset() {
      this.resetGame(false);
    },
  },
});
