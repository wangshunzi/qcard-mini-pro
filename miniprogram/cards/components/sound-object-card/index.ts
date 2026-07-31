export {};

import { mediaCoordinator } from "../../../services/MediaCoordinator";
import { ensureIconFontLoaded } from "../../../utils/iconFont";

type Phase = "idle" | "questionPlaying" | "scratching" | "sciencePlaying" | "revealed";
type Point = { x: number; y: number };

const COLUMNS = 12;
const ROWS = 16;
const BRUSH = 42;
const COMPLETE_THRESHOLD = 0.45;
const REVEAL_DURATION = 360;
const REVEAL_STEPS = 9;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.arcTo(x + width, y, x + width, y + height, safeRadius);
  ctx.arcTo(x + width, y + height, x, y + height, safeRadius);
  ctx.arcTo(x, y + height, x, y, safeRadius);
  ctx.arcTo(x, y, x + width, y, safeRadius);
  ctx.closePath();
}

function fitCanvasText(
  ctx: CanvasRenderingContext2D,
  value: string,
  maxWidth: number,
): string {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let output = value;
  while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}…`;
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    phase: "idle" as Phase,
    content: null as any,
    promptText: "",
    primary: "#2f8f6b",
    coating: "#9ca3af",
    promptColor: "#17392d",
    coatingHidden: false,
    coatingMounted: true,
    scratchProgress: 0,
    audioProgressDeg: 0,
    volumeGlyph: String.fromCodePoint(984446),
  },
  lifetimes: {
    attached() {
      void ensureIconFontLoaded().then(() => this.drawControlOverlay());
    },
    ready() {
      this.setupCanvas();
    },
    detached() {
      mediaCoordinator.stopAudio();
      this.cancelRevealTransition();
      (this as any)._ctx = null;
      (this as any)._canvas = null;
      (this as any)._controlCtx = null;
      (this as any)._controlCanvas = null;
    },
  },
  observers: {
    "data, preview"(value: any) {
      this.cancelRevealTransition();
      const content = value?.content ?? value;
      const normalized = {
        ...content,
        imageUrl: content?.image?.url ?? content?.image,
        questionAudioUrl: content?.questionAudio?.url ?? content?.questionAudio,
        scienceText: content?.science?.script ?? content?.science?.text ?? "",
        scienceAudioUrl: content?.science?.audio ?? content?.scienceAudio,
      };
      this.setData({
        content: normalized,
        phase: "idle",
        primary: content?.theme?.primary ?? "#2f8f6b",
        coating: content?.theme?.coating ?? "#9ca3af",
        promptColor: content?.theme?.promptText ?? "#17392d",
        coatingHidden: false,
        coatingMounted: true,
        scratchProgress: 0,
        audioProgressDeg: 0,
      }, () => {
        (this as any)._completeEmitted = false;
        this.updatePrompt();
        this.setupCanvas();
      });
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  methods: {
    setupCanvas() {
      if ((this.data as any).preview || !(this.data as any).coatingMounted) return;
      wx.nextTick(() => {
        wx.createSelectorQuery()
          .in(this)
          .select(".scratch-stage")
          .boundingClientRect()
          .select("#scratchCanvas")
          .fields({ node: true, size: true })
          .select("#controlCanvas")
          .fields({ node: true, size: true })
          .exec((results: any[]) => {
            const rect = results?.[0];
            const canvasResult = results?.[1];
            const controlResult = results?.[2];
            if (
              !rect?.width ||
              !rect?.height ||
              !canvasResult?.node ||
              !controlResult?.node
            ) return;
            const canvas = canvasResult.node;
            const controlCanvas = controlResult.node;
            const dpr = wx.getWindowInfo().pixelRatio || 1;
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            controlCanvas.width = Math.round(rect.width * dpr);
            controlCanvas.height = Math.round(rect.height * dpr);
            const ctx = canvas.getContext("2d");
            const controlCtx = controlCanvas.getContext("2d");
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            controlCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            (this as any)._canvas = canvas;
            (this as any)._ctx = ctx;
            (this as any)._controlCanvas = controlCanvas;
            (this as any)._controlCtx = controlCtx;
            (this as any)._stageRect = rect;
            this.paintCoating();
            this.drawControlOverlay();
          });
      });
    },
    drawControlOverlay() {
      const ctx = (this as any)._controlCtx as CanvasRenderingContext2D | null;
      const rect = (this as any)._stageRect;
      if (!ctx || !rect) return;
      ctx.clearRect(0, 0, rect.width, rect.height);
      const state = this.data as any;
      if (
        state.coatingHidden ||
        !["idle", "questionPlaying", "scratching"].includes(state.phase)
      ) return;

      ctx.save();
      ctx.font = "700 15px -apple-system, BlinkMacSystemFont, sans-serif";
      const prompt = fitCanvasText(
        ctx,
        String(state.promptText || ""),
        Math.max(80, rect.width - 88),
      );
      const promptWidth = Math.min(
        rect.width - 32,
        Math.max(124, ctx.measureText(prompt).width + 36),
      );
      const promptX = (rect.width - promptWidth) / 2;
      const promptY = 26;
      ctx.shadowColor = "rgba(20, 55, 38, .14)";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      roundedRect(ctx, promptX, promptY, promptWidth, 40, 20);
      ctx.fillStyle = "rgba(255,255,255,.91)";
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = String(state.promptColor || "#17392d");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(prompt, rect.width / 2, promptY + 20);
      ctx.restore();

      const centerX = rect.width / 2;
      const centerY = rect.height - 61;
      const radius = 31;
      ctx.save();
      ctx.shadowColor = "rgba(22, 65, 45, .24)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 7;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.shadowColor = "transparent";
      if (state.audioProgressDeg > 0) {
        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY,
          radius - 2,
          -Math.PI / 2,
          -Math.PI / 2 + (Number(state.audioProgressDeg) / 180) * Math.PI,
        );
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 7, 0, Math.PI * 2);
      ctx.fillStyle = String(state.primary || "#2f8f6b");
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "28px MaterialCommunityIcons";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(state.volumeGlyph || ""), centerX, centerY + 1);
      ctx.restore();
    },
    paintCoating() {
      const ctx = (this as any)._ctx as CanvasRenderingContext2D | null;
      const rect = (this as any)._stageRect;
      if (!ctx || !rect) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.fillStyle = String((this.data as any).coating);
      ctx.fillRect(0, 0, rect.width, rect.height);

      ctx.globalAlpha = .16;
      ctx.fillStyle = "#ffffff";
      for (let y = 18; y < rect.height; y += 42) {
        for (let x = 16 + ((y / 42) % 2) * 13; x < rect.width; x += 38) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      (this as any)._scratchedCells = new Set<string>();
      (this as any)._scratchComplete = false;
      (this as any)._lastPoint = null;
      this.setData(
        { coatingHidden: false, scratchProgress: 0 },
        () => this.drawControlOverlay(),
      );
    },
    updatePrompt() {
      const state = this.data as any;
      const prompt = state.content?.prompt ?? {};
      const promptText =
        state.phase === "questionPlaying"
          ? prompt.playingText ?? "认真听声音"
          : state.phase === "scratching"
            ? prompt.scratchingText ?? "猜一猜，刮开看看"
            : state.phase === "sciencePlaying"
              ? prompt.revealedText ?? "答对啦，听听小知识"
              : state.phase === "revealed"
                ? prompt.revealedText ?? state.content?.name ?? "发现啦"
                : prompt.idleText ?? "听一听，猜一猜";
      this.setData({ promptText }, () => this.drawControlOverlay());
    },
    setPhase(phase: Phase) {
      this.setData({ phase }, () => this.updatePrompt());
    },
    playTrackedAudio(source: string, onEnded: () => void) {
      if (!source || wx.getStorageSync("qcard.sound-enabled") === false) return null;
      const audio = mediaCoordinator.createAudio(source);
      this.setData({ audioProgressDeg: 0 }, () => this.drawControlOverlay());
      audio.onTimeUpdate(() => {
        const duration = audio.duration || 0;
        this.setData({
          audioProgressDeg: duration > 0
            ? Math.min(360, Math.round((audio.currentTime / duration) * 360))
            : 0,
        }, () => this.drawControlOverlay());
      });
      audio.onEnded(() => {
        this.setData({ audioProgressDeg: 360 }, () => this.drawControlOverlay());
        onEnded();
      });
      audio.onError(() => {
        this.setData({ audioProgressDeg: 0 }, () => this.drawControlOverlay());
        onEnded();
      });
      audio.play();
      return audio;
    },
    toggleQuestion() {
      const state = this.data as any;
      if (
        state.readOnly ||
        state.preview ||
        state.phase === "sciencePlaying" ||
        state.phase === "revealed"
      ) return;

      if (state.phase === "questionPlaying") {
        mediaCoordinator.stopAudio();
        this.setData({ audioProgressDeg: 0 });
        this.setPhase((this as any)._questionReturnPhase ?? "idle");
        return;
      }

      const returnPhase: Phase = state.phase === "scratching" ? "scratching" : "idle";
      (this as any)._questionReturnPhase = returnPhase;
      const source = state.content?.questionAudioUrl;
      if (!source) {
        this.setPhase("scratching");
        return;
      }
      this.setPhase("questionPlaying");
      const audio = this.playTrackedAudio(source, () => {
        if ((this.data as any).phase === "questionPlaying") this.setPhase("scratching");
      });
      if (!audio) this.setPhase("scratching");
    },
    point(event: WechatMiniprogram.TouchEvent): Point | null {
      const touch = event.touches?.[0] ?? event.changedTouches?.[0];
      const rect = (this as any)._stageRect;
      if (!touch || !rect) return null;
      const rawTouch = touch as any;
      const clientX = Number(rawTouch.clientX ?? rawTouch.pageX ?? rawTouch.x);
      const clientY = Number(rawTouch.clientY ?? rawTouch.pageY ?? rawTouch.y);
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    isAudioControlPoint(point: Point): boolean {
      const rect = (this as any)._stageRect;
      if (!rect) return false;
      return Math.hypot(point.x - rect.width / 2, point.y - (rect.height - 61)) <= 42;
    },
    surfaceTouchStart(event: WechatMiniprogram.TouchEvent) {
      const point = this.point(event);
      if (!point) return;
      if (this.isAudioControlPoint(point)) {
        (this as any)._controlTouch = true;
        this.toggleQuestion();
        return;
      }
      (this as any)._controlTouch = false;
      this.scratchStart(event);
    },
    surfaceTouchMove(event: WechatMiniprogram.TouchEvent) {
      if ((this as any)._controlTouch) return;
      this.scratchMove(event);
    },
    surfaceTouchEnd() {
      (this as any)._controlTouch = false;
      this.scratchEnd();
    },
    scratchStart(event: WechatMiniprogram.TouchEvent) {
      if ((this.data as any).phase !== "scratching" || (this.data as any).readOnly) return;
      const point = this.point(event);
      if (!point) return;
      (this as any)._lastPoint = point;
      this.erase(point, point);
    },
    scratchMove(event: WechatMiniprogram.TouchEvent) {
      if ((this.data as any).phase !== "scratching" || (this.data as any).readOnly) return;
      const point = this.point(event);
      if (!point) return;
      const previous = ((this as any)._lastPoint as Point | null) ?? point;
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 4) return;
      this.erase(previous, point);
      (this as any)._lastPoint = point;
    },
    scratchEnd() {
      (this as any)._lastPoint = null;
    },
    erase(from: Point, to: Point) {
      if ((this as any)._scratchComplete) return;
      const ctx = (this as any)._ctx as CanvasRenderingContext2D | null;
      const rect = (this as any)._stageRect;
      if (!ctx || !rect) return;
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = BRUSH;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(to.x, to.y, BRUSH / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const cellWidth = rect.width / COLUMNS;
      const cellHeight = rect.height / ROWS;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      const step = Math.max(4, Math.min(BRUSH / 4, cellWidth / 2, cellHeight / 2));
      const samples = Math.max(1, Math.ceil(distance / step));
      for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples;
        this.markCells({
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress,
        }, false);
      }
      this.updateScratchProgress();
    },
    markCells(point: Point, update = true) {
      const rect = (this as any)._stageRect;
      const cells = (this as any)._scratchedCells as Set<string>;
      if (!rect || !cells) return;
      const cellWidth = rect.width / COLUMNS;
      const cellHeight = rect.height / ROWS;
      const radius = BRUSH / 2;
      const startColumn = Math.max(0, Math.floor((point.x - radius) / cellWidth));
      const endColumn = Math.min(COLUMNS - 1, Math.floor((point.x + radius) / cellWidth));
      const startRow = Math.max(0, Math.floor((point.y - radius) / cellHeight));
      const endRow = Math.min(ROWS - 1, Math.floor((point.y + radius) / cellHeight));
      for (let row = startRow; row <= endRow; row += 1) {
        for (let column = startColumn; column <= endColumn; column += 1) {
          const x = (column + .5) * cellWidth;
          const y = (row + .5) * cellHeight;
          if (Math.hypot(x - point.x, y - point.y) <= radius + Math.max(cellWidth, cellHeight) / 2) {
            cells.add(`${row}:${column}`);
          }
        }
      }
      if (update) this.updateScratchProgress();
    },
    updateScratchProgress() {
      const cells = (this as any)._scratchedCells as Set<string>;
      if (!cells) return;
      const progress = cells.size / (COLUMNS * ROWS);
      this.setData({ scratchProgress: Math.min(1, progress) });
      if (progress >= COMPLETE_THRESHOLD) {
        (this as any)._scratchComplete = true;
        this.startScience();
      }
    },
    cancelRevealTransition() {
      (this as any)._revealToken = Number((this as any)._revealToken || 0) + 1;
      const timers = ((this as any)._revealTimers || []) as number[];
      timers.forEach((timer) => clearTimeout(timer));
      (this as any)._revealTimers = [];
      (this as any)._revealPending = false;
    },
    scheduleRevealFrame(callback: () => void, delay: number) {
      const timer = setTimeout(callback, delay) as unknown as number;
      const timers = ((this as any)._revealTimers || []) as number[];
      timers.push(timer);
      (this as any)._revealTimers = timers;
    },
    clearControlCanvas() {
      const controlCtx = (this as any)._controlCtx as CanvasRenderingContext2D | null;
      const rect = (this as any)._stageRect;
      if (!controlCtx || !rect) return;
      controlCtx.clearRect(0, 0, rect.width, rect.height);
    },
    animateCoatingAway(onFinished: () => void) {
      this.cancelRevealTransition();
      (this as any)._revealPending = true;
      const token = Number((this as any)._revealToken || 0);
      const ctx = (this as any)._ctx as CanvasRenderingContext2D | null;
      const rect = (this as any)._stageRect;
      this.clearControlCanvas();

      const finish = () => {
        if (token !== Number((this as any)._revealToken || 0)) return;
        if (ctx && rect) {
          ctx.globalCompositeOperation = "source-over";
          ctx.globalAlpha = 1;
          ctx.clearRect(0, 0, rect.width, rect.height);
        }
        (this as any)._revealPending = false;
        (this as any)._revealTimers = [];
        this.setData({ coatingMounted: false }, () => {
          if (token !== Number((this as any)._revealToken || 0)) return;
          (this as any)._ctx = null;
          (this as any)._canvas = null;
          (this as any)._controlCtx = null;
          (this as any)._controlCanvas = null;
          onFinished();
        });
      };

      this.setData({ coatingHidden: true, scratchProgress: 1 }, () => {
        if (!ctx || !rect) {
          finish();
          return;
        }
        let step = 0;
        const eraseFrame = () => {
          if (token !== Number((this as any)._revealToken || 0)) return;
          ctx.save();
          ctx.globalCompositeOperation = "destination-out";
          ctx.globalAlpha = .32;
          ctx.fillStyle = "#000000";
          ctx.fillRect(0, 0, rect.width, rect.height);
          ctx.restore();
          step += 1;
          if (step >= REVEAL_STEPS) {
            finish();
            return;
          }
          this.scheduleRevealFrame(
            eraseFrame,
            REVEAL_DURATION / REVEAL_STEPS,
          );
        };
        this.scheduleRevealFrame(
          eraseFrame,
          REVEAL_DURATION / REVEAL_STEPS,
        );
      });
    },
    startScience() {
      if ((this as any)._revealPending) return;
      mediaCoordinator.stopAudio();
      this.animateCoatingAway(() => this.playScienceAudio());
    },
    playScienceAudio() {
      const state = this.data as any;
      if (!state.isVisible) return;
      mediaCoordinator.stopAudio();
      this.setData({ phase: "sciencePlaying", audioProgressDeg: 0 }, () => {
        this.updatePrompt();
        const source = (this.data as any).content?.scienceAudioUrl;
        if (!source) {
          this.finishScience();
          return;
        }
        const audio = this.playTrackedAudio(source, () => this.finishScience());
        if (!audio) this.finishScience();
      });
    },
    toggleScience() {
      const state = this.data as any;
      if (state.readOnly || !state.content?.scienceAudioUrl) return;
      if (state.phase === "sciencePlaying") {
        mediaCoordinator.stopAudio();
        this.setData({ audioProgressDeg: 0 });
        this.finishScience();
        return;
      }
      if (state.phase === "revealed") this.playScienceAudio();
    },
    finishScience() {
      if ((this.data as any).phase !== "sciencePlaying") return;
      this.setPhase("revealed");
      if (!(this as any)._completeEmitted) {
        (this as any)._completeEmitted = true;
        this.triggerEvent("cardevent", { type: "complete", cardType: "sound_object_card" });
      }
    },
    restart() {
      if ((this.data as any).readOnly) return;
      this.reset();
    },
    pause() {
      this.reset();
    },
    reset() {
      mediaCoordinator.stopAudio();
      this.cancelRevealTransition();
      (this as any)._questionReturnPhase = "idle";
      (this as any)._completeEmitted = false;
      (this as any)._ctx = null;
      (this as any)._canvas = null;
      (this as any)._controlCtx = null;
      (this as any)._controlCanvas = null;
      this.setData({ phase: "idle", coatingHidden: false, coatingMounted: true, scratchProgress: 0, audioProgressDeg: 0 }, () => {
        this.updatePrompt();
        this.setupCanvas();
      });
    },
  },
});
