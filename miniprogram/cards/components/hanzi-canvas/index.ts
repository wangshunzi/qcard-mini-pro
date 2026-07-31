import HanziWriter from "../../../vendor/hanzi-writer";
import { getHanziCharacterData } from "../../../services/hanzi";

type Point = { x: number; y: number };
type PointerHandler = (event: { getPoint: () => Point; preventDefault: () => void }) => void;

class MiniProgramCanvasTarget {
  private startHandlers: PointerHandler[] = [];
  private moveHandlers: PointerHandler[] = [];
  private endHandlers: Array<() => void> = [];
  private context: WechatMiniprogram.CanvasRenderingContext.CanvasRenderingContext2D;
  private pixelRatio: number;

  constructor(
    private node: WechatMiniprogram.Canvas,
    private bounds: WechatMiniprogram.BoundingClientRectCallbackResult,
  ) {
    this.context = this.node.getContext("2d");
    this.pixelRatio = Math.max(1, wx.getWindowInfo().pixelRatio || 1);
    this.updateDimensions(Math.round(bounds.width), Math.round(bounds.height));
  }

  getContext() {
    return this.context;
  }

  getBoundingClientRect() {
    return this.bounds;
  }

  updateDimensions(width: number, height: number) {
    this.node.width = Math.round(width * this.pixelRatio);
    this.node.height = Math.round(height * this.pixelRatio);
    this.context = this.node.getContext("2d");
    this.context.scale(this.pixelRatio, this.pixelRatio);
    this.bounds.width = width;
    this.bounds.height = height;
  }

  addPointerStartListener(handler: PointerHandler) {
    this.startHandlers.push(handler);
  }

  addPointerMoveListener(handler: PointerHandler) {
    this.moveHandlers.push(handler);
  }

  addPointerEndListener(handler: () => void) {
    this.endHandlers.push(handler);
  }

  emit(type: "start" | "move" | "end", point?: Point) {
    if (type === "end") {
      this.endHandlers.forEach((handler) => handler());
      return;
    }
    const event = {
      getPoint: () => point ?? { x: 0, y: 0 },
      preventDefault: () => undefined,
    };
    const handlers = type === "start" ? this.startHandlers : this.moveHandlers;
    handlers.forEach((handler) => handler(event));
  }
}

Component({
  properties: {
    character: { type: String, value: "" },
    quiz: { type: Boolean, value: true },
    showCharacter: { type: Boolean, value: false },
    strokeColor: { type: String, value: "#529917" },
    outlineColor: { type: String, value: "#d9e5cf" },
    drawingColor: { type: String, value: "#529917" },
    highlightColor: { type: String, value: "#529917" },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    ready: false,
    error: "",
  },
  observers: {
    character(character: string) {
      if (character && (this as any).writer) {
        (this as any)._preparingCharacter = "";
        this.setData({ ready: false, error: "" });
        void (this as any).writer
          .setCharacter(character)
          .then(() => this.onCharacterReady())
          .catch((reason: unknown) => this.onCharacterError(reason));
      }
    },
    isVisible(visible: boolean) {
      if (!visible) {
        this.pause();
        return;
      }
      const writer = (this as any).writer as HanziWriter | undefined;
      writer?.resumeAnimation();
      this.startQuiz();
    },
    readOnly(readOnly: boolean) {
      const writer = (this as any).writer as HanziWriter | undefined;
      if (readOnly) writer?.cancelQuiz();
      else if ((this.data as any).isVisible) this.startQuiz();
    },
    quiz(enabled: boolean) {
      const writer = (this as any).writer as HanziWriter | undefined;
      if (!enabled) writer?.cancelQuiz();
      else if ((this.data as any).isVisible && !(this.data as any).readOnly) this.startQuiz();
    },
    showCharacter(show: boolean) {
      const writer = (this as any).writer as HanziWriter | undefined;
      if (!writer) return;
      void (show ? writer.showCharacter() : writer.hideCharacter());
    },
  },
  lifetimes: {
    ready() {
      this.initialize();
    },
    detached() {
      this.pause();
    },
  },
  methods: {
    initialize() {
      const query = this.createSelectorQuery();
      query.select("#hanziCanvas").fields({ node: true, size: true });
      query.select("#hanziCanvas").boundingClientRect();
      query.exec((result) => {
        const fields = result?.[0];
        const bounds = result?.[1];
        if (!fields?.node || !bounds) {
          this.setData({ error: "画布初始化失败" });
          return;
        }
        const target = new MiniProgramCanvasTarget(fields.node, bounds);
        (this as any).target = target;
        try {
          (this as any).writer = HanziWriter.create(fields.node, (this.data as any).character, {
            width: Math.round(bounds.width),
            height: Math.round(bounds.height),
            padding: 10,
            renderer: "canvas",
            showOutline: true,
            showCharacter: Boolean((this.data as any).showCharacter),
            strokeColor: String((this.data as any).strokeColor || "#529917"),
            outlineColor: String((this.data as any).outlineColor || "#d9e5cf"),
            drawingColor: String((this.data as any).drawingColor || "#529917"),
            drawingWidth: (this.data as any).quiz ? 40 : 7,
            highlightColor: String((this.data as any).highlightColor || "#529917"),
            rendererOverride: { createRenderTarget: () => target },
            onLoadCharDataSuccess: () => {
              wx.nextTick(() => this.onCharacterReady());
            },
            onLoadCharDataError: (reason) => {
              this.onCharacterError(reason);
            },
            charDataLoader: (character, onLoad, onError) => {
              const cacheKey = `qcard.hanzi.${character}`;
              const cached = wx.getStorageSync(cacheKey);
              if (cached) {
                onLoad(cached);
                return;
              }
              void getHanziCharacterData(character)
                .then((data) => {
                  try {
                    wx.setStorageSync(cacheKey, data);
                  } catch {
                    // 存储空间不足时仍可继续本次描字。
                  }
                  onLoad(data);
                })
                .catch(onError);
            },
          });
        } catch (error) {
          this.onCharacterError(error);
        }
      });
    },
    onCharacterReady() {
      const writer = (this as any).writer as HanziWriter | undefined;
      if (!writer) {
        wx.nextTick(() => this.onCharacterReady());
        return;
      }
      const character = String((this.data as any).character || "");
      if ((this as any)._preparingCharacter === character) return;
      (this as any)._preparingCharacter = character;
      const displayAction = (this.data as any).showCharacter
        ? writer.showCharacter()
        : writer.hideCharacter();
      void displayAction
        .then(() => {
          if (String((this.data as any).character || "") !== character) return;
          (this as any)._preparingCharacter = "";
          this.setData({ ready: true, error: "" });
          this.triggerEvent("ready");
          if ((this as any)._pendingAnimation) {
            (this as any)._pendingAnimation = false;
            this.animate();
          } else {
            this.startQuiz();
          }
        })
        .catch((reason: unknown) => this.onCharacterError(reason));
    },
    onCharacterError(reason: unknown) {
      const message = reason instanceof Error ? reason.message : String(reason || "汉字加载失败");
      (this as any)._pendingAnimation = false;
      (this as any)._preparingCharacter = "";
      this.setData({ ready: false, error: message });
      this.triggerEvent("error", { message });
    },
    startQuiz() {
      const writer = (this as any).writer as HanziWriter | undefined;
      if (
        !writer ||
        !(this.data as any).ready ||
        !(this.data as any).quiz ||
        (this.data as any).readOnly ||
        !(this.data as any).isVisible
      ) return;
      writer.quiz({
        leniency: 1.1,
        showHintAfterMisses: 2,
        highlightOnComplete: true,
        onMistake: (detail) => this.triggerEvent("mistake", detail),
        onCorrectStroke: (detail) => this.triggerEvent("correctstroke", detail),
        onComplete: (detail) => this.triggerEvent("complete", detail),
      });
    },
    localPoint(event: WechatMiniprogram.TouchEvent): Point | undefined {
      const touch = (event.touches?.[0] ?? event.changedTouches?.[0]) as any;
      const bounds = (this as any).target?.getBoundingClientRect();
      if (!touch || !bounds) return undefined;
      const localX = Number(touch.x);
      const localY = Number(touch.y);
      if (Number.isFinite(localX) && Number.isFinite(localY)) {
        return { x: localX, y: localY };
      }
      const clientX = Number(touch.clientX ?? touch.pageX);
      const clientY = Number(touch.clientY ?? touch.pageY);
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return undefined;
      return { x: clientX - bounds.left, y: clientY - bounds.top };
    },
    touchStart(event: WechatMiniprogram.TouchEvent) {
      if (
        !(this.data as any).ready ||
        !(this.data as any).quiz ||
        (this.data as any).readOnly ||
        !(this.data as any).isVisible
      ) return;
      const point = this.localPoint(event);
      if (point) (this as any).target?.emit("start", point);
    },
    touchMove(event: WechatMiniprogram.TouchEvent) {
      if (!(this.data as any).ready || !(this.data as any).quiz) return;
      const point = this.localPoint(event);
      if (point) (this as any).target?.emit("move", point);
    },
    touchEnd() {
      (this as any).target?.emit("end");
    },
    animate() {
      const writer = (this as any).writer as HanziWriter | undefined;
      if ((this.data as any).readOnly || !(this.data as any).isVisible) return false;
      if (!writer || !(this.data as any).ready) {
        (this as any)._pendingAnimation = true;
        return true;
      }
      writer.cancelQuiz();
      void writer
        .animateCharacter({
          onComplete: () => {
            this.startQuiz();
            this.triggerEvent("animationcomplete");
          },
        })
        .catch((reason: unknown) => {
          const message = reason instanceof Error ? reason.message : String(reason || "笔画播放失败");
          this.triggerEvent("error", { message, operation: "animate" });
          this.triggerEvent("animationcomplete");
        });
      return true;
    },
    pause() {
      const writer = (this as any).writer as HanziWriter | undefined;
      writer?.cancelQuiz();
      writer?.pauseAnimation();
    },
    reset() {
      const writer = (this as any).writer as HanziWriter | undefined;
      writer?.cancelQuiz();
      const action = (this.data as any).showCharacter
        ? writer?.showCharacter()
        : writer?.hideCharacter();
      void action
        ?.then(() => this.startQuiz())
        .catch((reason: unknown) => {
          const message = reason instanceof Error ? reason.message : String(reason || "临摹重置失败");
          this.triggerEvent("error", { message, operation: "reset" });
        });
    },
  },
});
