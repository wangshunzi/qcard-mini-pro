export {};

type AssignmentMap = Record<string, string | null>;
type AssignmentsByRule = Record<string, AssignmentMap>;

type ClassItem = {
  id: string;
  mode?: "image" | "text";
  image?: string;
  text?: string;
};

type Bucket = { id: string; title: string; description?: string };
type Rule = {
  id: string;
  title: string;
  buckets: Bucket[];
  answers: Array<{ itemId: string; bucketId: string }>;
};

type Frame = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ItemFrame = Frame & {
  itemId: string;
  bucketId: string | null;
  item: ClassItem;
};

type DragState = {
  itemId: string;
  originBucketId: string | null;
  wasSelected: boolean;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

const PRIMARY = "#4F8FEC";
const WRONG = "#E04F5F";
const MAX_VISIBLE_BUCKETS = 3;

function idOf(value: unknown): string {
  return String(value ?? "");
}

function emptyAssignments(items: ClassItem[]): AssignmentMap {
  return items.reduce<AssignmentMap>((acc, item) => {
    acc[idOf(item.id)] = null;
    return acc;
  }, {});
}

function hitTest<T extends Frame>(frames: T[], point: { x: number; y: number }): T | undefined {
  return frames.find(
    (frame) =>
      point.x >= frame.x &&
      point.x <= frame.x + frame.width &&
      point.y >= frame.y &&
      point.y <= frame.y + frame.height,
  );
}

function answerFor(rule: Rule | undefined, itemId: string): string | null {
  return idOf(rule?.answers?.find((answer) => idOf(answer.itemId) === itemId)?.bucketId) || null;
}

function isRuleCorrect(rule: Rule | undefined, items: ClassItem[], assignments: AssignmentMap): boolean {
  return Boolean(
    rule &&
      items.length &&
      items.every((item) => {
        const itemId = idOf(item.id);
        return Boolean(assignments[itemId]) && assignments[itemId] === answerFor(rule, itemId);
      }),
  );
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    rules: [] as Rule[],
    items: [] as ClassItem[],
    currentRuleIndex: 0,
    currentRule: null as Rule | null,
    buckets: [] as Bucket[],
    assignmentsByRule: {} as AssignmentsByRule,
    currentAssignments: {} as AssignmentMap,
    checkedByRule: {} as Record<string, boolean>,
    correctByRule: {} as Record<string, boolean>,
    itemFrames: [] as ItemFrame[],
    bucketFrames: [] as Array<Frame & { bucket: Bucket }>,
    poolFrame: null as Frame | null,
    incorrectMap: {} as Record<string, boolean>,
    incorrectBucketMap: {} as Record<string, boolean>,
    activeItem: null as ClassItem | null,
    activeStyle: "",
    selectedItemId: "",
    assignedCount: 0,
    cardComplete: false,
    primary: PRIMARY,
    bucketBackground: "rgba(255,255,255,0.9)",
    itemBackground: "rgba(255,255,255,0.94)",
    panelBackground: "rgba(247,251,255,0.95)",
    panelTitle: "#14345c",
    panelText: "#31506f",
    statusTitle: "",
    statusText: "",
    hasChecked: false,
  },
  lifetimes: {
    ready() {
      this.scheduleLayout();
    },
    detached() {
      this.clearTimer();
    },
  },
  observers: {
    "data, preview"(value: any) {
      this.initialize(value);
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  methods: {
    clearTimer() {
      const timer = (this as any)._successTimer;
      if (timer) clearTimeout(timer);
      (this as any)._successTimer = null;
    },
    initialize(value: any) {
      this.clearTimer();
      const rules = ((value?.rules ?? []) as Rule[]).map((rule) => ({
        ...rule,
        id: idOf(rule.id),
        buckets: (rule.buckets ?? []).slice(0, MAX_VISIBLE_BUCKETS).map((bucket) => ({
          ...bucket,
          id: idOf(bucket.id),
        })),
      }));
      const items = ((value?.items ?? []) as ClassItem[]).map((item) => ({
        ...item,
        id: idOf(item.id),
      }));
      const assignmentsByRule: AssignmentsByRule = {};
      rules.forEach((rule) => {
        assignmentsByRule[rule.id] = emptyAssignments(items);
      });
      const theme = value?.theme ?? {};
      const currentRule = rules[0] ?? null;
      const currentAssignments = currentRule ? assignmentsByRule[currentRule.id] : {};
      this.setData({
        rules,
        items,
        currentRuleIndex: 0,
        currentRule,
        buckets: currentRule?.buckets ?? [],
        assignmentsByRule,
        currentAssignments,
        checkedByRule: {},
        correctByRule: {},
        incorrectMap: {},
        incorrectBucketMap: {},
        activeItem: null,
        activeStyle: "",
        selectedItemId: "",
        assignedCount: Object.values(currentAssignments).filter(Boolean).length,
        cardComplete: false,
        hasChecked: false,
        primary: theme.primary ?? PRIMARY,
        bucketBackground: theme.bucketBackground ?? "rgba(255,255,255,0.9)",
        itemBackground: theme.itemBackground ?? "rgba(255,255,255,0.94)",
        panelBackground: theme.panelBackground ?? "rgba(247,251,255,0.95)",
        panelTitle: theme.panelTitle ?? "#14345c",
        panelText: theme.panelText ?? "#31506f",
      }, () => {
        this.updateStatus();
        this.scheduleLayout();
      });
    },
    scheduleLayout() {
      wx.nextTick(() => {
        wx.createSelectorQuery()
          .in(this)
          .select(".classification-board")
          .boundingClientRect((rect) => {
            if (!rect?.width || !rect?.height) return;
            (this as any)._boardRect = rect;
            this.rebuildFrames(rect.width, rect.height);
          })
          .exec();
      });
    },
    rebuildFrames(width: number, height: number) {
      const state = this.data as any;
      const preview = Boolean(state.preview);
      const inset = preview ? 7 : 10;
      const poolHeight = Math.max(preview ? 46 : 76, Math.min(height * (preview ? .33 : .31), height * .34));
      const poolFrame: Frame = {
        id: "pool",
        x: inset,
        y: preview ? 10 : 15,
        width: width - inset * 2,
        height: poolHeight,
      };
      const buckets = (state.buckets as Bucket[]).slice(0, MAX_VISIBLE_BUCKETS);
      const gap = preview ? 6 : 9;
      const bucketTop = poolFrame.y + poolFrame.height + (preview ? 28 : 48);
      const bucketWidth = (width - inset * 2 - gap * Math.max(0, buckets.length - 1)) / Math.max(1, buckets.length);
      const bucketHeight = Math.max(preview ? 66 : 124, height - bucketTop - (preview ? 5 : 8));
      const bucketFrames = buckets.map((bucket, index) => ({
        id: bucket.id,
        bucket,
        x: inset + index * (bucketWidth + gap),
        y: bucketTop,
        width: bucketWidth,
        height: bucketHeight,
      }));
      const itemFrames = this.buildItemFrames(poolFrame, bucketFrames);
      this.setData({ poolFrame, bucketFrames, itemFrames });
    },
    buildItemFrames(poolFrame: Frame, bucketFrames: Array<Frame & { bucket: Bucket }>): ItemFrame[] {
      const state = this.data as any;
      const items = state.items as ClassItem[];
      const assignments = state.currentAssignments as AssignmentMap;
      const activeId = (this as any)._drag?.itemId ?? "";
      const frames: ItemFrame[] = [];
      const preview = Boolean(state.preview);
      const poolItems = items.filter((item) => !assignments[item.id] && item.id !== activeId);
      const poolColumns = Math.max(3, Math.min(5, poolItems.length));
      const poolGap = preview ? 4 : 7;
      const maxPoolSize = preview ? 30 : 48;
      const poolSize = Math.max(
        preview ? 22 : 36,
        Math.min(
          maxPoolSize,
          (poolFrame.width - 24 - poolGap * Math.max(0, poolColumns - 1)) / Math.max(1, poolColumns),
          poolFrame.height - (preview ? 18 : 26),
        ),
      );
      const rows = Math.max(1, Math.ceil(poolItems.length / poolColumns));
      const rowHeight = Math.min(poolSize + poolGap, (poolFrame.height - (preview ? 14 : 24)) / rows);
      const rowWidth = poolColumns * poolSize + Math.max(0, poolColumns - 1) * poolGap;
      const poolStartX = poolFrame.x + Math.max(8, (poolFrame.width - rowWidth) / 2);
      const poolStartY = poolFrame.y + (preview ? 12 : 20);
      poolItems.forEach((item, index) => {
        frames.push({
          id: item.id,
          itemId: item.id,
          item,
          bucketId: null,
          x: poolStartX + (index % poolColumns) * (poolSize + poolGap),
          y: poolStartY + Math.floor(index / poolColumns) * rowHeight,
          width: poolSize,
          height: poolSize,
        });
      });

      bucketFrames.forEach((bucketFrame) => {
        const bucketItems = items.filter(
          (item) => assignments[item.id] === bucketFrame.id && item.id !== activeId,
        );
        const columns = bucketItems.length > 4 ? 2 : 1;
        const gap = preview ? 3 : 5;
        const innerWidth = bucketFrame.width - (preview ? 10 : 16);
        const innerHeight = bucketFrame.height - (preview ? 22 : 38);
        const rowsInBucket = Math.max(1, Math.ceil(bucketItems.length / columns));
        const size = Math.max(
          preview ? 18 : 30,
          Math.min(
            preview ? 28 : 44,
            (innerWidth - gap * (columns - 1)) / columns,
            (innerHeight - gap * Math.max(0, rowsInBucket - 1)) / rowsInBucket,
          ),
        );
        const usedWidth = columns * size + gap * Math.max(0, columns - 1);
        const startX = bucketFrame.x + (bucketFrame.width - usedWidth) / 2;
        const startY = bucketFrame.y + (preview ? 7 : 14);
        bucketItems.forEach((item, index) => {
          frames.push({
            id: item.id,
            itemId: item.id,
            item,
            bucketId: bucketFrame.id,
            x: startX + (index % columns) * (size + gap),
            y: startY + Math.floor(index / columns) * (size + gap),
            width: size,
            height: size,
          });
        });
      });
      return frames;
    },
    point(event: WechatMiniprogram.TouchEvent) {
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
      if (
        state.preview ||
        state.readOnly ||
        !state.isVisible ||
        state.cardComplete ||
        state.correctByRule[state.currentRule?.id]
      ) return;
      const point = this.point(event);
      if (!point) return;
      const source = hitTest(state.itemFrames as ItemFrame[], point);
      if (!source) return;
      const drag: DragState = {
        itemId: source.itemId,
        originBucketId: source.bucketId,
        wasSelected: state.selectedItemId === source.itemId,
        startX: point.x,
        startY: point.y,
        offsetX: point.x - source.x,
        offsetY: point.y - source.y,
        width: source.width,
        height: source.height,
      };
      (this as any)._drag = drag;
      (this as any)._dragMoved = false;
      const activeStyle = this.dragStyle(drag, point);
      this.setData({
        activeItem: source.item,
        activeStyle,
        selectedItemId: source.itemId,
        hasChecked: false,
        checkedByRule: { ...state.checkedByRule, [state.currentRule.id]: false },
        correctByRule: { ...state.correctByRule, [state.currentRule.id]: false },
        incorrectMap: {},
        incorrectBucketMap: {},
      }, () => {
        this.rebuildFrames(state.boardWidth ?? (this as any)._boardRect.width, (this as any)._boardRect.height);
      });
    },
    touchMove(event: WechatMiniprogram.TouchEvent) {
      const drag = (this as any)._drag as DragState | null;
      if (!drag) return;
      const point = this.point(event);
      if (!point) return;
      if (
        Math.abs(point.x - drag.startX) > 3 ||
        Math.abs(point.y - drag.startY) > 3
      ) {
        (this as any)._dragMoved = true;
      }
      this.setData({ activeStyle: this.dragStyle(drag, point) });
    },
    dragStyle(drag: DragState, point: { x: number; y: number }) {
      return `left:${point.x - drag.offsetX}px;top:${point.y - drag.offsetY}px;width:${drag.width}px;height:${drag.height}px`;
    },
    touchEnd(event: WechatMiniprogram.TouchEvent) {
      const drag = (this as any)._drag as DragState | null;
      if (!drag) return;
      if (!(this as any)._dragMoved) {
        (this as any)._drag = null;
        (this as any)._tapHandledFromTouch = true;
        this.setData({
          activeItem: null,
          activeStyle: "",
          selectedItemId: drag.wasSelected ? "" : drag.itemId,
        }, () => this.scheduleLayout());
        return;
      }
      const point = this.point(event);
      const state = this.data as any;
      const targetBucket = point
        ? hitTest(state.bucketFrames as Array<Frame & { bucket: Bucket }>, point)
        : undefined;
      const targetPool = point && state.poolFrame ? hitTest([state.poolFrame as Frame], point) : undefined;
      const nextBucketId = targetBucket
        ? targetBucket.id
        : targetPool
          ? null
          : drag.originBucketId;
      const assignments = {
        ...(state.currentAssignments as AssignmentMap),
        [drag.itemId]: nextBucketId,
      };
      const assignmentsByRule = {
        ...(state.assignmentsByRule as AssignmentsByRule),
        [state.currentRule.id]: assignments,
      };
      (this as any)._drag = null;
      (this as any)._justDragged = Boolean((this as any)._dragMoved);
      this.setData({
        activeItem: null,
        activeStyle: "",
        selectedItemId: "",
        currentAssignments: assignments,
        assignmentsByRule,
        assignedCount: Object.values(assignments).filter(Boolean).length,
      }, () => {
        this.scheduleLayout();
        this.evaluate(assignments);
      });
    },
    touchCancel() {
      (this as any)._drag = null;
      (this as any)._dragMoved = false;
      this.setData({ activeItem: null, activeStyle: "" }, () => this.scheduleLayout());
    },
    itemTap(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (
        state.preview ||
        state.readOnly ||
        !state.isVisible ||
        state.cardComplete ||
        state.correctByRule[state.currentRule?.id]
      ) return;
      if ((this as any)._tapHandledFromTouch) {
        (this as any)._tapHandledFromTouch = false;
        return;
      }
      if ((this as any)._justDragged) {
        (this as any)._justDragged = false;
        return;
      }
      const itemId = idOf(event.currentTarget.dataset.itemId);
      if (!itemId) return;
      this.setData({ selectedItemId: state.selectedItemId === itemId ? "" : itemId });
    },
    bucketTap(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      const itemId = idOf(state.selectedItemId);
      const bucketId = idOf(event.currentTarget.dataset.bucketId);
      if (!itemId || !bucketId || state.preview || state.readOnly || state.cardComplete) return;
      this.assignSelected(itemId, bucketId);
    },
    poolTap() {
      const state = this.data as any;
      const itemId = idOf(state.selectedItemId);
      if (!itemId || state.preview || state.readOnly || state.cardComplete) return;
      this.assignSelected(itemId, null);
    },
    assignSelected(itemId: string, bucketId: string | null) {
      const state = this.data as any;
      const assignments = {
        ...(state.currentAssignments as AssignmentMap),
        [itemId]: bucketId,
      };
      const assignmentsByRule = {
        ...(state.assignmentsByRule as AssignmentsByRule),
        [state.currentRule.id]: assignments,
      };
      this.setData({
        selectedItemId: "",
        currentAssignments: assignments,
        assignmentsByRule,
        assignedCount: Object.values(assignments).filter(Boolean).length,
      }, () => {
        this.scheduleLayout();
        this.evaluate(assignments);
      });
    },
    evaluate(assignments: AssignmentMap) {
      const state = this.data as any;
      const items = state.items as ClassItem[];
      const rule = state.currentRule as Rule | undefined;
      if (!rule || !items.length) return;
      const allAssigned = items.every((item) => Boolean(assignments[item.id]));
      if (!allAssigned) {
        this.clearTimer();
        this.setData({
          hasChecked: false,
          checkedByRule: { ...state.checkedByRule, [rule.id]: false },
          correctByRule: { ...state.correctByRule, [rule.id]: false },
          incorrectMap: {},
          incorrectBucketMap: {},
        }, () => this.updateStatus());
        return;
      }

      const correct = isRuleCorrect(rule, items, assignments);
      const checkedByRule = { ...state.checkedByRule, [rule.id]: true };
      const correctByRule = { ...state.correctByRule, [rule.id]: correct };
      const incorrectMap: Record<string, boolean> = {};
      const incorrectBucketMap: Record<string, boolean> = {};
      if (!correct) {
        items.forEach((item) => {
          if (assignments[item.id] !== answerFor(rule, item.id)) {
            incorrectMap[item.id] = true;
            const bucketId = assignments[item.id];
            if (bucketId) incorrectBucketMap[bucketId] = true;
          }
        });
      }
      this.setData({
        hasChecked: true,
        checkedByRule,
        correctByRule,
        incorrectMap,
        incorrectBucketMap,
      }, () => this.updateStatus());

      if (!correct) {
        this.triggerEvent("cardevent", {
          type: "wrong",
          cardType: "classification_card",
          payload: { ruleId: rule.id, assignments },
        });
        return;
      }

      this.triggerEvent("cardevent", {
        type: "correct",
        cardType: "classification_card",
        payload: { ruleId: rule.id },
      });
      this.clearTimer();
      (this as any)._successTimer = setTimeout(() => {
        (this as any)._successTimer = null;
        const latest = this.data as any;
        const allRulesCorrect = (latest.rules as Rule[]).every((candidate) =>
          isRuleCorrect(candidate, latest.items, latest.assignmentsByRule[candidate.id] ?? {}),
        );
        if (allRulesCorrect) {
          this.setData({ cardComplete: true }, () => this.updateStatus());
          this.triggerEvent("cardevent", { type: "complete", cardType: "classification_card" });
          return;
        }
        const rules = latest.rules as Rule[];
        let nextIndex = rules.findIndex((candidate, index) =>
          index !== latest.currentRuleIndex &&
          !isRuleCorrect(candidate, latest.items, latest.assignmentsByRule[candidate.id] ?? {}),
        );
        if (nextIndex < 0) nextIndex = Math.min(latest.currentRuleIndex + 1, rules.length - 1);
        this.activateRule(nextIndex);
      }, 1150);
    },
    switchRule(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly || state.cardComplete) return;
      const index = Number(event.currentTarget.dataset.index);
      if (!Number.isInteger(index) || index === state.currentRuleIndex) return;
      this.clearTimer();
      this.activateRule(index);
    },
    activateRule(index: number) {
      const state = this.data as any;
      const rule = state.rules[index] as Rule | undefined;
      if (!rule) return;
      const assignments = state.assignmentsByRule[rule.id] ?? emptyAssignments(state.items);
      (this as any)._drag = null;
      this.setData({
        currentRuleIndex: index,
        currentRule: rule,
        buckets: rule.buckets,
        currentAssignments: assignments,
        assignedCount: Object.values(assignments).filter(Boolean).length,
        hasChecked: Boolean(state.checkedByRule[rule.id]),
        incorrectMap: this.buildIncorrectMap(rule, assignments, Boolean(state.checkedByRule[rule.id])),
        incorrectBucketMap: this.buildIncorrectBucketMap(rule, assignments, Boolean(state.checkedByRule[rule.id])),
        activeItem: null,
        activeStyle: "",
        selectedItemId: "",
      }, () => {
        this.updateStatus();
        this.scheduleLayout();
      });
    },
    buildIncorrectMap(rule: Rule, assignments: AssignmentMap, checked: boolean) {
      const result: Record<string, boolean> = {};
      if (!checked) return result;
      ((this.data as any).items as ClassItem[]).forEach((item) => {
        if (assignments[item.id] !== answerFor(rule, item.id)) result[item.id] = true;
      });
      return result;
    },
    buildIncorrectBucketMap(rule: Rule, assignments: AssignmentMap, checked: boolean) {
      const result: Record<string, boolean> = {};
      if (!checked) return result;
      ((this.data as any).items as ClassItem[]).forEach((item) => {
        if (assignments[item.id] !== answerFor(rule, item.id)) {
          const bucketId = assignments[item.id];
          if (bucketId) result[bucketId] = true;
        }
      });
      return result;
    },
    updateStatus() {
      const state = this.data as any;
      const rule = state.currentRule as Rule | null;
      let statusTitle = "";
      let statusText = "";
      if (state.cardComplete) {
        statusTitle = state.data?.prompt?.successText ?? "全部规则都完成了";
        statusText = "做得很好，可以继续学习下一张。";
      } else if (state.hasChecked && rule && state.correctByRule[rule.id]) {
        statusTitle = `${rule?.title ?? "本轮"}分类正确`;
        statusText = "马上进入下一条规则。";
      } else if (state.hasChecked) {
        statusTitle = `${rule?.title ?? "本轮"}有几个还没分对`;
        statusText = "把红色物品拖到其他桶，或拖回物品池重新分类。";
      } else {
        statusText = state.assignedCount
          ? `${rule?.title ?? "当前规则"}：已分类 ${state.assignedCount}/${state.items.length}`
          : `${rule?.title ?? "当前规则"}：拖进桶分类，拖回物品池可取消`;
      }
      this.setData({ statusTitle, statusText });
    },
    pause() {
      this.reset();
    },
    reset() {
      this.initialize((this.data as any).data);
    },
  },
});
