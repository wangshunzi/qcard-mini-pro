export {};

type Side = "left" | "right";

type MatchItem = {
  id: string;
  mode?: "image" | "text";
  image?: string;
  text?: string;
};

type Match = { leftId: string; rightId: string };

type NodeFrame = {
  id: string;
  side: Side;
  x: number;
  y: number;
  width: number;
  height: number;
  item: MatchItem;
};

type Point = { x: number; y: number };

type DragState = {
  sourceId: string;
  sourceSide: Side;
  start: Point;
  end: Point;
};

const DEFAULT_PRIMARY = "#4F8FEC";
const DEFAULT_LINE = "#4F8FEC";
const WRONG = "#E04F5F";

function idOf(value: unknown): string {
  return String(value ?? "");
}

function getCenter(frame: NodeFrame): Point {
  return { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
}

function hitTest(frames: NodeFrame[], point: Point): NodeFrame | undefined {
  return frames.find(
    (frame) =>
      point.x >= frame.x &&
      point.x <= frame.x + frame.width &&
      point.y >= frame.y &&
      point.y <= frame.y + frame.height,
  );
}

function isCorrect(data: any, match: Match): boolean {
  return (data?.pairs ?? []).some(
    (pair: any) =>
      idOf(pair.leftId) === match.leftId && idOf(pair.rightId) === match.rightId,
  );
}

function removeNodeConnection(matches: Match[], id: string): Match[] {
  return matches.filter((match) => match.leftId !== id && match.rightId !== id);
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    leftFrames: [] as NodeFrame[],
    rightFrames: [] as NodeFrame[],
    matches: [] as Match[],
    matchedMap: {} as Record<string, boolean>,
    incorrectMap: {} as Record<string, boolean>,
    activeId: "",
    hasChecked: false,
    allCorrect: false,
    pairCount: 0,
    boardWidth: 0,
    boardHeight: 0,
    groupLeftStyle: "",
    groupRightStyle: "",
    primary: DEFAULT_PRIMARY,
    panelBackground: "rgba(247,251,255,0.95)",
    panelTitle: "#14345c",
    panelText: "#31506f",
    itemBackground: "rgba(255,255,255,0.92)",
    itemText: "#1f3f5f",
    statusText: "",
  },
  lifetimes: {
    ready() {
      this.scheduleLayout();
    },
    detached() {
      (this as any)._canvas = null;
      (this as any)._ctx = null;
      (this as any)._drag = null;
    },
  },
  observers: {
    "data, preview"(value: any) {
      const theme = value?.theme ?? {};
      this.setData({
        matches: [],
        matchedMap: {},
        incorrectMap: {},
        activeId: "",
        hasChecked: false,
        allCorrect: false,
        pairCount: value?.pairs?.length ?? 0,
        primary: theme.primary ?? DEFAULT_PRIMARY,
        panelBackground: theme.panelBackground ?? "rgba(247,251,255,0.95)",
        panelTitle: theme.panelTitle ?? "#14345c",
        panelText: theme.panelText ?? "#31506f",
        itemBackground: theme.itemBackground ?? "rgba(255,255,255,0.92)",
        itemText: theme.itemText ?? "#1f3f5f",
        statusText: value?.prompt?.subtitle ?? "拖动连线完成配对，拖已连选项可取消重连",
      });
      (this as any)._drag = null;
      this.scheduleLayout();
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  methods: {
    scheduleLayout() {
      wx.nextTick(() => this.setupBoard());
    },
    setupBoard() {
      const query = wx.createSelectorQuery().in(this);
      query
        .select(".board")
        .boundingClientRect()
        .select("#matchingCanvas")
        .fields({ node: true, size: true })
        .exec((result: any[]) => {
          const rect = result?.[0];
          const canvasResult = result?.[1];
          if (!rect?.width || !rect?.height || !canvasResult?.node) return;

          const canvas = canvasResult.node;
          const dpr = wx.getWindowInfo().pixelRatio || 1;
          canvas.width = Math.round(rect.width * dpr);
          canvas.height = Math.round(rect.height * dpr);
          const ctx = canvas.getContext("2d");
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.lineCap = "round";

          (this as any)._boardRect = rect;
          (this as any)._canvas = canvas;
          (this as any)._ctx = ctx;

          const frames = this.buildFrames(rect.width, rect.height);
          const preview = Boolean((this.data as any).preview);
          const groupStyle = (side: Side) => {
            const sideFrames = frames.filter((frame) => frame.side === side);
            if (!sideFrames.length) return "";
            const minX = Math.min(...sideFrames.map((frame) => frame.x));
            const minY = Math.min(...sideFrames.map((frame) => frame.y));
            const maxX = Math.max(...sideFrames.map((frame) => frame.x + frame.width));
            const maxY = Math.max(...sideFrames.map((frame) => frame.y + frame.height));
            const x = Math.max(4, minX - (preview ? 8 : 12));
            const y = Math.max(18, minY - (preview ? 20 : 26));
            const groupWidth = Math.min(rect.width - x - 4, maxX - minX + (preview ? 16 : 24));
            const groupHeight = Math.min(rect.height - y - 6, maxY - minY + (preview ? 32 : 44));
            return `left:${x}px;top:${y}px;width:${groupWidth}px;height:${groupHeight}px`;
          };
          const previewMatches = (this.data as any).preview
            ? ((this.data as any).data?.pairs ?? []).map((pair: any) => ({
                leftId: idOf(pair.leftId),
                rightId: idOf(pair.rightId),
              }))
            : [];
          this.setData(
            {
              leftFrames: frames.filter((frame) => frame.side === "left"),
              rightFrames: frames.filter((frame) => frame.side === "right"),
              boardWidth: rect.width,
              boardHeight: rect.height,
              groupLeftStyle: groupStyle("left"),
              groupRightStyle: groupStyle("right"),
              matches: previewMatches,
            },
            () => this.commitState(previewMatches, false),
          );
        });
    },
    buildFrames(width: number, height: number): NodeFrame[] {
      const data = (this.data as any).data ?? {};
      const preview = Boolean((this.data as any).preview);
      const leftItems = (data.leftItems ?? []) as MatchItem[];
      const rightItems = (data.rightItems ?? []) as MatchItem[];
      const useColumns = Math.max(leftItems.length, rightItems.length) > 3;
      const frames: NodeFrame[] = [];

      if (useColumns) {
        const topPadding = preview ? 28 : 42;
        const bottomPadding = preview ? 22 : 34;
        const maxCount = Math.max(leftItems.length, rightItems.length, 1);
        const verticalGap = preview ? 6 : 9;
        const available =
          height - topPadding - bottomPadding - verticalGap * (maxCount - 1);
        const nodeHeight = Math.max(preview ? 30 : 48, Math.min(preview ? 42 : 64, available / maxCount));
        const nodeWidth = Math.max(preview ? 48 : 78, Math.min(preview ? 72 : 116, width * (preview ? 0.34 : 0.33)));
        const leftX = Math.max(preview ? 10 : 14, width * 0.19 - nodeWidth / 2);
        const rightX = Math.min(width - (preview ? 10 : 14) - nodeWidth, width * 0.81 - nodeWidth / 2);
        const appendColumn = (items: MatchItem[], side: Side, x: number) => {
          const columnHeight = nodeHeight * items.length + verticalGap * Math.max(0, items.length - 1);
          const startY = Math.max(topPadding, topPadding + (height - topPadding - bottomPadding - columnHeight) / 2);
          items.forEach((item, index) => frames.push({
            id: idOf(item.id),
            side,
            x,
            y: startY + index * (nodeHeight + verticalGap),
            width: nodeWidth,
            height: nodeHeight,
            item,
          }));
        };
        appendColumn(leftItems, "left", leftX);
        appendColumn(rightItems, "right", rightX);
        return frames;
      }

      const horizontalPadding = preview ? 10 : 14;
      const gap = preview ? 8 : 10;
      const appendRow = (items: MatchItem[], side: Side, centerY: number) => {
        const count = Math.max(items.length, 1);
        const available = width - horizontalPadding * 2 - gap * Math.max(0, count - 1);
        const nodeWidth = Math.max(preview ? 40 : 68, Math.min(preview ? 54 : 96, available / count));
        const nodeHeight = preview ? 44 : 74;
        const rowWidth = nodeWidth * items.length + gap * Math.max(0, items.length - 1);
        const startX = (width - rowWidth) / 2;
        items.forEach((item, index) => frames.push({
          id: idOf(item.id),
          side,
          x: startX + index * (nodeWidth + gap),
          y: centerY - nodeHeight / 2,
          width: nodeWidth,
          height: nodeHeight,
          item,
        }));
      };
      appendRow(leftItems, "left", height * 0.24);
      appendRow(rightItems, "right", height * 0.68);
      return frames;
    },
    pointFromEvent(event: WechatMiniprogram.TouchEvent): Point | null {
      const touch = event.touches?.[0] ?? event.changedTouches?.[0];
      const rect = (this as any)._boardRect;
      if (!touch || !rect) return null;
      const rawTouch = touch as any;
      const clientX = Number(rawTouch.clientX ?? rawTouch.pageX ?? rawTouch.x);
      const clientY = Number(rawTouch.clientY ?? rawTouch.pageY ?? rawTouch.y);
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    touchStart(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly || state.preview || !state.isVisible || state.allCorrect) return;
      const point = this.pointFromEvent(event);
      if (!point) return;
      const frames = [...state.leftFrames, ...state.rightFrames] as NodeFrame[];
      const source = hitTest(frames, point);
      if (!source) return;

      const matches = removeNodeConnection(state.matches as Match[], source.id);
      const drag: DragState = {
        sourceId: source.id,
        sourceSide: source.side,
        start: getCenter(source),
        end: point,
      };
      (this as any)._drag = drag;
      (this as any)._dragMoved = false;
      this.setData({ matches, activeId: source.id, hasChecked: false, allCorrect: false }, () => {
        this.commitState(matches, false);
        this.draw();
      });
    },
    touchMove(event: WechatMiniprogram.TouchEvent) {
      const drag = (this as any)._drag as DragState | null;
      if (!drag) return;
      const point = this.pointFromEvent(event);
      if (!point) return;
      if (
        Math.abs(point.x - drag.start.x) > 3 ||
        Math.abs(point.y - drag.start.y) > 3
      ) {
        (this as any)._dragMoved = true;
      }
      drag.end = point;
      this.draw();
    },
    touchEnd(event: WechatMiniprogram.TouchEvent) {
      const drag = (this as any)._drag as DragState | null;
      if (!drag) return;
      const point = this.pointFromEvent(event) ?? drag.end;
      const state = this.data as any;
      const frames = [...state.leftFrames, ...state.rightFrames] as NodeFrame[];
      const target = hitTest(frames, point);
      let matches = state.matches as Match[];

      if (target && target.side !== drag.sourceSide) {
        const leftId = drag.sourceSide === "left" ? drag.sourceId : target.id;
        const rightId = drag.sourceSide === "right" ? drag.sourceId : target.id;
        matches = removeNodeConnection(removeNodeConnection(matches, leftId), rightId);
        matches.push({ leftId, rightId });
      }

      (this as any)._drag = null;
      (this as any)._justDragged = Boolean((this as any)._dragMoved);
      const pairCount = state.data?.pairs?.length ?? 0;
      const hasChecked = pairCount > 0 && matches.length === pairCount;
      const allCorrect = hasChecked && matches.every((match) => isCorrect(state.data, match));
      this.setData({ matches, activeId: "", hasChecked, allCorrect }, () => {
        this.commitState(matches, hasChecked);
        if (!hasChecked) return;
        if (allCorrect) {
          this.triggerEvent("cardevent", { type: "correct", cardType: "matching_card" });
          this.triggerEvent("cardevent", { type: "complete", cardType: "matching_card" });
        } else {
          this.triggerEvent("cardevent", {
            type: "wrong",
            cardType: "matching_card",
            payload: { matches },
          });
        }
      });
    },
    touchCancel() {
      (this as any)._drag = null;
      (this as any)._dragMoved = false;
      this.setData({ activeId: "" }, () => this.draw());
    },
    nodeTap(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly || state.preview || !state.isVisible || state.allCorrect) return;
      if ((this as any)._justDragged) {
        (this as any)._justDragged = false;
        return;
      }
      const side = String(event.currentTarget.dataset.side ?? "") as Side;
      const id = idOf(event.currentTarget.dataset.id);
      if (!id || (side !== "left" && side !== "right")) return;
      const selectedSide = (this as any)._selectedSide as Side | undefined;
      const selectedId = idOf((this as any)._selectedId);
      if (!selectedId || !selectedSide || selectedSide === side) {
        (this as any)._selectedSide = side;
        (this as any)._selectedId = id;
        this.setData({ activeId: id });
        return;
      }
      const leftId = selectedSide === "left" ? selectedId : id;
      const rightId = selectedSide === "right" ? selectedId : id;
      let matches = state.matches as Match[];
      matches = removeNodeConnection(removeNodeConnection(matches, leftId), rightId);
      matches = [...matches, { leftId, rightId }];
      (this as any)._selectedSide = null;
      (this as any)._selectedId = "";
      const pairCount = state.data?.pairs?.length ?? 0;
      const hasChecked = pairCount > 0 && matches.length === pairCount;
      const allCorrect = hasChecked && matches.every((match) => isCorrect(state.data, match));
      this.setData({ matches, activeId: "", hasChecked, allCorrect }, () => {
        this.commitState(matches, hasChecked);
        if (!hasChecked) return;
        if (allCorrect) {
          this.triggerEvent("cardevent", { type: "correct", cardType: "matching_card" });
          this.triggerEvent("cardevent", { type: "complete", cardType: "matching_card" });
        } else {
          this.triggerEvent("cardevent", {
            type: "wrong",
            cardType: "matching_card",
            payload: { matches },
          });
        }
      });
    },
    commitState(matches: Match[], hasChecked: boolean) {
      const state = this.data as any;
      const matchedMap: Record<string, boolean> = {};
      const incorrectMap: Record<string, boolean> = {};
      matches.forEach((match) => {
        matchedMap[match.leftId] = true;
        matchedMap[match.rightId] = true;
        if (hasChecked && !isCorrect(state.data, match)) {
          incorrectMap[match.leftId] = true;
          incorrectMap[match.rightId] = true;
        }
      });
      const allCorrect = hasChecked && matches.every((match) => isCorrect(state.data, match));
      const statusText = allCorrect
        ? state.data?.prompt?.successText ?? "全部连对啦"
        : hasChecked
          ? "有几条还不对"
          : state.data?.prompt?.subtitle ?? "拖动连线完成配对，拖已连选项可取消重连";
      this.setData({ matchedMap, incorrectMap, allCorrect, statusText }, () => this.draw());
    },
    draw() {
      const ctx = (this as any)._ctx as CanvasRenderingContext2D | null;
      if (!ctx) return;
      const state = this.data as any;
      const frames = [...state.leftFrames, ...state.rightFrames] as NodeFrame[];
      const frameMap = new Map(frames.map((frame) => [frame.id, frame]));
      ctx.clearRect(0, 0, state.boardWidth, state.boardHeight);
      ctx.lineWidth = state.preview ? 3 : 5;

      (state.matches as Match[]).forEach((match) => {
        const left = frameMap.get(match.leftId);
        const right = frameMap.get(match.rightId);
        if (!left || !right) return;
        const start = getCenter(left);
        const end = getCenter(right);
        ctx.beginPath();
        ctx.strokeStyle = state.hasChecked && !isCorrect(state.data, match)
          ? WRONG
          : state.data?.theme?.line ?? state.primary ?? DEFAULT_LINE;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      });

      const drag = (this as any)._drag as DragState | null;
      if (drag) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = state.data?.theme?.line ?? state.primary ?? DEFAULT_LINE;
        ctx.setLineDash([10, 8]);
        ctx.moveTo(drag.start.x, drag.start.y);
        ctx.lineTo(drag.end.x, drag.end.y);
        ctx.stroke();
        ctx.restore();
      }
    },
    pause() {
      this.reset();
    },
    reset() {
      (this as any)._drag = null;
      (this as any)._dragMoved = false;
      (this as any)._justDragged = false;
      (this as any)._selectedSide = null;
      (this as any)._selectedId = "";
      const previewMatches = (this.data as any).preview
        ? ((this.data as any).data?.pairs ?? []).map((pair: any) => ({
            leftId: idOf(pair.leftId),
            rightId: idOf(pair.rightId),
          }))
        : [];
      this.setData(
        {
          matches: previewMatches,
          activeId: "",
          hasChecked: false,
          allCorrect: false,
        },
        () => this.commitState(previewMatches, false),
      );
    },
  },
});
