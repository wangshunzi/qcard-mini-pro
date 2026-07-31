export {};

import { mediaCoordinator } from "../../../services/MediaCoordinator";
import {
  getRandomTraceFeedbackAudio,
  LITERACY_CONVERSATION_ASSETS,
  type TraceFeedbackType,
} from "../../assets/client-card-assets";

type ConversationSegment = {
  character: string;
  pinyin: string;
  target: boolean;
  punctuation: boolean;
};

type PhraseSegment = {
  character: string;
  pinyin: string;
};

function buildPhraseSegments(word: string, pinyin: string): PhraseSegment[] {
  const tokens = String(pinyin ?? "").trim().split(/\s+/).filter(Boolean);
  let tokenIndex = 0;
  return Array.from(String(word ?? "")).map((character) => {
    const punctuation = /\s|[.,，。？！?!、；;：:]/.test(character);
    return {
      character,
      pinyin: punctuation
        ? ""
        : (tokens[tokenIndex++] ?? "").replace(/[.,，。？！?!、；;：:]/g, ""),
    };
  });
}

function normalizeVariant(variant: any) {
  if (!variant) return variant;
  return {
    ...variant,
    phrases: (variant.phrases ?? []).map((phrase: any) => ({
      ...phrase,
      segments: buildPhraseSegments(phrase?.word, phrase?.pinyin),
    })),
  };
}

function buildConversationLines(conversation: any[], targetCharacter: string) {
  return (conversation ?? []).map((item) => {
    const characters = Array.from(String(item?.text ?? ""));
    const pinyinTokens = String(item?.pinyin ?? "").trim().split(/\s+/).filter(Boolean);
    let pinyinIndex = 0;
    const segments = characters.map((character): ConversationSegment => {
      const punctuation = /\s|[.,，。？！?!、；;：:]/.test(character);
      const rawPinyin = punctuation ? "" : (pinyinTokens[pinyinIndex++] ?? "");
      return {
        character,
        pinyin: rawPinyin.replace(/[.,，。？！?!、；;：:]/g, ""),
        target: character === targetCharacter,
        punctuation,
      };
    });
    return { ...item, segments };
  });
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    variantIndex: 0,
    variant: null as any,
    tracing: false,
    conversationVisible: false,
    conversationClosing: false,
    conversationLines: [] as any[],
    mistakes: 0,
    completed: false,
    playingSource: "",
    animating: false,
    conversationAssets: LITERACY_CONVERSATION_ASSETS,
    compactLayout: false,
    previewGridStyle: "",
    writerStyle: "",
    toolIconSize: 27,
  },
  observers: {
    data(value: any) {
      mediaCoordinator.stopAudio();
      this.setData({
        variantIndex: 0,
        variant: normalizeVariant(value?.variants?.[0] ?? null),
        tracing: false,
        conversationVisible: false,
        conversationClosing: false,
        conversationLines: buildConversationLines(value?.variants?.[0]?.conversation ?? [], String(value?.character ?? "")),
        mistakes: 0,
        completed: false,
        playingSource: "",
        animating: false,
      });
      (this as any)._lastTraceFeedbackAt = 0;
      this.scheduleLayoutSync();
    },
    preview() {
      this.scheduleLayoutSync();
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
      else this.scheduleLayoutSync();
    },
  },
  lifetimes: {
    ready() {
      this.scheduleLayoutSync();
    },
    detached() {
      const timer = (this as any)._conversationCloseTimer;
      if (timer) clearTimeout(timer);
      (this as any)._conversationCloseTimer = null;
      const layoutTimer = (this as any)._layoutTimer;
      if (layoutTimer) clearTimeout(layoutTimer);
      (this as any)._layoutTimer = null;
      mediaCoordinator.stopAudio();
    },
  },
  methods: {
    scheduleLayoutSync() {
      const timer = (this as any)._layoutTimer;
      if (timer) clearTimeout(timer);
      wx.nextTick(() => this.syncLayoutMetrics());
      (this as any)._layoutTimer = setTimeout(() => {
        (this as any)._layoutTimer = null;
        this.syncLayoutMetrics();
      }, 80);
    },
    syncLayoutMetrics() {
      this.createSelectorQuery()
        .select(".literacy")
        .boundingClientRect((rect) => {
          const width = Number(rect?.width ?? 0);
          if (!width) return;
          const previewGridSize = Math.min(194, Math.max(1, Math.round(width * 0.52)));
          const writerSize = Math.min(148, Math.max(96, Math.round(width * 0.42)));
          const compactLayout = width < 320;
          this.setData({
            compactLayout,
            previewGridStyle: `font-size:${Math.round(previewGridSize * 0.56)}px`,
            writerStyle: `width:${writerSize}px;height:${writerSize}px`,
            toolIconSize: compactLayout ? 20 : 27,
          });
        })
        .exec();
    },
    changeVariant(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly || state.preview) return;
      const index = Number(event.currentTarget.dataset.index);
      const variant = normalizeVariant(state.data?.variants?.[index]);
      if (!variant) return;
      mediaCoordinator.stopAudio();
      (this.selectComponent("#mainWriter") as any)?.pause?.();
      (this.selectComponent("#traceWriter") as any)?.pause?.();
      this.setData({
        variantIndex: index,
        variant,
        playingSource: "",
        animating: false,
        tracing: false,
        mistakes: 0,
        completed: false,
        conversationVisible: false,
        conversationClosing: false,
        conversationLines: buildConversationLines(variant?.conversation ?? [], String(state.data?.character ?? "")),
      });
      (this as any)._lastTraceFeedbackAt = 0;
    },
    toggleAudio(source?: string) {
      const state = this.data as any;
      if (state.readOnly || state.preview || !source) return;
      if (state.playingSource === source) {
        mediaCoordinator.stopAudio();
        this.setData({ playingSource: "" });
        return;
      }
      mediaCoordinator.stopAudio();
      this.setData({ playingSource: source });
      const audio = mediaCoordinator.playAudio(source, "literacy", () => {
        if ((this.data as any).playingSource === source) this.setData({ playingSource: "" });
      });
      if (!audio) this.setData({ playingSource: "" });
    },
    playPinyin() {
      this.toggleAudio((this.data as any).variant?.pinyin_audio);
    },
    playMeaning() {
      this.toggleAudio((this.data as any).variant?.meaning_audio);
    },
    playPhrase(event: WechatMiniprogram.TouchEvent) {
      const index = Number(event.currentTarget.dataset.index);
      this.toggleAudio((this.data as any).variant?.phrases?.[index]?.audio_url);
    },
    playConversation(event: WechatMiniprogram.TouchEvent) {
      const index = Number(event.currentTarget.dataset.index);
      this.toggleAudio((this.data as any).variant?.conversation?.[index]?.audio_url);
    },
    animate() {
      const state = this.data as any;
      if (
        state.readOnly ||
        state.preview ||
        state.animating ||
        state.tracing ||
        state.conversationVisible
      ) return;
      mediaCoordinator.stopAudio();
      this.setData({ animating: true, playingSource: "" });
      const writer = this.selectComponent("#mainWriter") as any;
      const accepted = writer?.animate?.();
      if (!writer || accepted === false) {
        this.setData({ animating: false });
        wx.showToast({ title: "笔画加载中，请稍后重试", icon: "none" });
      }
    },
    onAnimationComplete() {
      this.setData({ animating: false });
    },
    onWriterError() {
      if ((this.data as any).animating) this.setData({ animating: false });
    },
    openTrace() {
      const state = this.data as any;
      if (state.readOnly || state.preview || state.tracing) return;
      mediaCoordinator.stopAudio();
      (this.selectComponent("#mainWriter") as any)?.pause?.();
      const closeTimer = (this as any)._conversationCloseTimer;
      if (closeTimer) clearTimeout(closeTimer);
      (this as any)._conversationCloseTimer = null;
      this.setData({
        tracing: true,
        conversationVisible: false,
        conversationClosing: false,
        animating: false,
        mistakes: 0,
        completed: false,
        playingSource: "",
      }, () => {
        wx.nextTick(() => (this.selectComponent("#traceWriter") as any)?.reset?.());
      });
    },
    closeTrace() {
      mediaCoordinator.stopAudio();
      (this.selectComponent("#traceWriter") as any)?.pause?.();
      this.setData({ tracing: false, mistakes: 0, completed: false });
    },
    retryTrace() {
      this.setData({ mistakes: 0, completed: false }, () => {
        wx.nextTick(() => (this.selectComponent("#traceWriter") as any)?.reset?.());
      });
    },
    onMistake(event: WechatMiniprogram.CustomEvent) {
      const mistakes = Number((this.data as any).mistakes) + 1;
      this.setData({ mistakes });
      this.playTraceFeedback("mistake");
      this.triggerEvent("cardevent", {
        type: "wrong",
        cardType: "literacy_card",
        payload: { mistakes, detail: event.detail },
      });
    },
    onCorrect(event: WechatMiniprogram.CustomEvent) {
      this.playTraceFeedback("correct");
      this.triggerEvent("cardevent", {
        type: "correct",
        cardType: "literacy_card",
        payload: { detail: event.detail },
      });
    },
    onComplete(event: WechatMiniprogram.CustomEvent) {
      if ((this.data as any).completed) return;
      this.setData({ completed: true });
      this.playTraceFeedback("complete");
      this.triggerEvent("cardevent", {
        type: "complete",
        cardType: "literacy_card",
        payload: { mistakes: (this.data as any).mistakes, detail: event.detail },
      });
    },
    openConversation() {
      const state = this.data as any;
      if (state.readOnly || state.preview || !state.variant?.conversation?.length) return;
      mediaCoordinator.stopAudio();
      (this.selectComponent("#mainWriter") as any)?.pause?.();
      (this.selectComponent("#traceWriter") as any)?.pause?.();
      const timer = (this as any)._conversationCloseTimer;
      if (timer) clearTimeout(timer);
      (this as any)._conversationCloseTimer = null;
      this.setData({
        tracing: false,
        conversationVisible: true,
        conversationClosing: false,
        animating: false,
        mistakes: 0,
        completed: false,
        playingSource: "",
      });
    },
    closeConversation() {
      mediaCoordinator.stopAudio();
      const state = this.data as any;
      if (!state.conversationVisible || state.conversationClosing) return;
      this.setData({ conversationClosing: true, playingSource: "" });
      const timer = (this as any)._conversationCloseTimer;
      if (timer) clearTimeout(timer);
      (this as any)._conversationCloseTimer = setTimeout(() => {
        (this as any)._conversationCloseTimer = null;
        this.setData({ conversationVisible: false, conversationClosing: false });
      }, 260);
    },
    playTraceFeedback(type: TraceFeedbackType) {
      if (wx.getStorageSync("qcard.sound-enabled") === false) return;
      const now = Date.now();
      const lastAt = Number((this as any)._lastTraceFeedbackAt ?? 0);
      if (type !== "complete" && now - lastAt < 800) return;
      (this as any)._lastTraceFeedbackAt = now;
      const source = getRandomTraceFeedbackAudio(type);
      if (source) mediaCoordinator.playAudio(source, `literacy-trace:${type}`);
    },
    pause() {
      mediaCoordinator.stopAudio();
      (this.selectComponent("#mainWriter") as any)?.pause?.();
      (this.selectComponent("#traceWriter") as any)?.pause?.();
      this.setData({ playingSource: "", animating: false });
    },
    reset() {
      const timer = (this as any)._conversationCloseTimer;
      if (timer) clearTimeout(timer);
      (this as any)._conversationCloseTimer = null;
      this.pause();
      this.setData({
        tracing: false,
        conversationVisible: false,
        conversationClosing: false,
        mistakes: 0,
        completed: false,
      });
      (this as any)._lastTraceFeedbackAt = 0;
      (this.selectComponent("#mainWriter") as any)?.reset?.();
    },
  },
});
