export {};

import { mediaCoordinator } from "../../../services/MediaCoordinator";

type Phase = "idle" | "wrong" | "correct" | "science" | "completed" | "resetting" | "shuffling";

type Option = {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback?: { text?: string; audio?: string };
  explanation?: string;
};

function shuffleOptions(options: Option[], previous: string[] = []): Option[] {
  if (options.length < 2) return [...options];
  let result = [...options];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    result = [...options];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }
    if (!previous.length || result.some((option, index) => option.id !== previous[index])) break;
  }
  return result;
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    content: null as any,
    options: [] as Option[],
    phase: "idle" as Phase,
    selectedId: "",
    selectedOption: null as Option | null,
    questionPrompt: "",
    revealed: false,
    primary: "#4F8FEC",
    optionBackground: "rgba(255,255,255,0.94)",
    optionText: "#1f3f5f",
    promptText: "#ffffff",
    success: "#3f9b64",
    error: "#E04F5F",
    revealDuration: 1100,
    audioProgressDeg: 0,
  },
  lifetimes: {
    detached() {
      this.clearTimers();
      mediaCoordinator.stopAudio();
    },
  },
  observers: {
    "data, preview"(value: any) {
      const content = value?.content ?? value;
      const options = (content?.options ?? []).map((option: any) => ({
        ...option,
        id: String(option.id ?? option.value ?? option.text ?? ""),
        text: String(option.text ?? option.label ?? ""),
        isCorrect: option.isCorrect === true || option.correct === true,
      }));
      const theme = content?.theme ?? {};
      this.clearTimers();
      mediaCoordinator.stopAudio();
      this.setData({
        content: {
          ...content,
          backgroundUrl: content?.background?.url ?? content?.background,
          imageUrl: content?.question?.url ?? content?.silhouette,
          questionText: content?.question?.text ?? content?.question ?? "猜一猜，这是谁的轮廓？",
          questionAudio: content?.question?.audio,
          scienceText: content?.science?.text ?? content?.science ?? "",
          scienceAudio: content?.science?.audio,
          tintColor: content?.silhouette?.tintColor ?? "#16251f",
        },
        options: (this.data as any).preview ? options.slice(0, 4) : shuffleOptions(options),
        phase: "idle",
        selectedId: "",
        selectedOption: null,
        questionPrompt: content?.question?.text ?? content?.question ?? "猜一猜，这是谁的轮廓？",
        revealed: false,
        primary: theme.primary ?? "#4F8FEC",
        optionBackground: theme.optionBackground ?? "rgba(255,255,255,0.94)",
        optionText: theme.optionText ?? "#1f3f5f",
        promptText: theme.promptText ?? "#ffffff",
        success: theme.success ?? "#3f9b64",
        error: theme.error ?? "#E04F5F",
        revealDuration: Number(content?.silhouette?.revealDurationMs ?? 1100),
        audioProgressDeg: 0,
      });
      (this as any)._completeEmitted = false;
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  methods: {
    clearTimers() {
      const timers = ((this as any)._timers ?? []) as ReturnType<typeof setTimeout>[];
      timers.forEach((timer) => clearTimeout(timer));
      (this as any)._timers = [];
    },
    later(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        (this as any)._timers = (((this as any)._timers ?? []) as ReturnType<typeof setTimeout>[])
          .filter((candidate) => candidate !== timer);
        callback();
      }, delay);
      (this as any)._timers = [...(((this as any)._timers ?? []) as ReturnType<typeof setTimeout>[]), timer];
      return timer;
    },
    playQuestion() {
      const state = this.data as any;
      if (
        state.readOnly ||
        state.preview ||
        (state.phase !== "idle" && state.phase !== "wrong") ||
        !state.content?.questionAudio
      ) return;
      this.playTrackedAudio(state.content.questionAudio, "silhouette-question");
    },
    playTrackedAudio(source: string, scope: string, onEnded?: () => void) {
      if (!source || wx.getStorageSync("qcard.sound-enabled") === false) return undefined;
      this.setData({ audioProgressDeg: 0 });
      const audio = mediaCoordinator.playAudio(source, scope, () => {
        this.setData({ audioProgressDeg: 0 });
        onEnded?.();
      });
      audio?.onTimeUpdate(() => {
        const duration = audio.duration || 0;
        this.setData({
          audioProgressDeg: duration > 0
            ? Math.min(360, Math.round((audio.currentTime / duration) * 360))
            : 0,
        });
      });
      audio?.onError(() => {
        this.setData({ audioProgressDeg: 0 });
        onEnded?.();
      });
      return audio;
    },
    choose(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (
        state.readOnly ||
        state.preview ||
        state.phase !== "idle"
      ) return;
      const id = String(event.currentTarget.dataset.id ?? "");
      const option = (state.options as Option[]).find((candidate) => candidate.id === id);
      if (!option) return;
      this.clearTimers();
      mediaCoordinator.stopAudio();
      this.setData({
        selectedId: id,
        selectedOption: option,
        questionPrompt: option.isCorrect
          ? option.feedback?.text ?? state.content.questionText
          : state.content.questionText,
      });

      if (option.isCorrect) this.handleCorrect(option);
      else this.handleWrong(option);
    },
    handleWrong(option: Option) {
      this.setData({ phase: "wrong" });
      this.triggerEvent("cardevent", {
        type: "wrong",
        cardType: "silhouette_choice_card",
        payload: { option },
      });
      const reset = () => {
        if ((this.data as any).phase !== "wrong") return;
        this.setData({ phase: "idle", selectedId: "", selectedOption: null });
      };
      const audio = option.feedback?.audio
        ? this.playTrackedAudio(option.feedback.audio, "silhouette-wrong", reset)
        : undefined;
      if (!audio) this.later(reset, 960);
    },
    handleCorrect(option: Option) {
      const state = this.data as any;
      (this as any)._expansionDone = false;
      (this as any)._feedbackDone = false;
      (this as any)._scienceStarted = false;
      this.setData({ phase: "correct", revealed: true });
      this.triggerEvent("cardevent", {
        type: "correct",
        cardType: "silhouette_choice_card",
        payload: { option },
      });

      this.later(() => {
        (this as any)._expansionDone = true;
        this.maybeStartScience();
      }, 680);
      const feedbackDone = () => {
        (this as any)._feedbackDone = true;
        this.maybeStartScience();
      };
      const audio = option.feedback?.audio
        ? this.playTrackedAudio(option.feedback.audio, "silhouette-correct", feedbackDone)
        : undefined;
      if (!audio) feedbackDone();

      // Client 的轮廓揭示与选项展开并行，时长可由卡片数据覆盖。
      if (state.revealDuration > 680) {
        // 揭示动画不阻断后续科普，保持 Client 的反馈/展开双门槛语义。
      }
    },
    maybeStartScience() {
      if (
        (this as any)._scienceStarted ||
        !(this as any)._expansionDone ||
        !(this as any)._feedbackDone
      ) return;
      (this as any)._scienceStarted = true;
      this.setData({ phase: "science" });
      this.later(() => this.playScience(), 520);
    },
    playScience() {
      const state = this.data as any;
      if (state.phase !== "science" && state.phase !== "completed") return;
      this.setData({ phase: "science" });
      const done = () => this.finish();
      const audio = state.content?.scienceAudio
        ? this.playTrackedAudio(state.content.scienceAudio, "silhouette-science", done)
        : undefined;
      if (!audio) done();
    },
    toggleScience() {
      const state = this.data as any;
      if (state.readOnly || (state.phase !== "science" && state.phase !== "completed")) return;
      if (state.phase === "science") {
        mediaCoordinator.stopAudio();
        this.finish();
      } else {
        this.playScience();
      }
    },
    finish() {
      this.setData({ phase: "completed" });
      if (!(this as any)._completeEmitted) {
        (this as any)._completeEmitted = true;
        this.triggerEvent("cardevent", { type: "complete", cardType: "silhouette_choice_card" });
      }
    },
    restart() {
      const state = this.data as any;
      if (state.readOnly) return;
      this.clearTimers();
      mediaCoordinator.stopAudio();
      const previous = state.options.map((option: Option) => option.id);
      const source = (state.content?.options ?? []).map((option: any) => ({
        ...option,
        id: String(option.id ?? option.value ?? option.text ?? ""),
        text: String(option.text ?? option.label ?? ""),
        isCorrect: option.isCorrect === true || option.correct === true,
      }));
      this.setData({
        phase: "shuffling",
        revealed: false,
        selectedId: "",
        selectedOption: null,
        audioProgressDeg: 0,
      });
      this.later(() => {
        this.setData({ options: shuffleOptions(source, previous) });
      }, 260);
      this.later(() => {
        this.setData({
          phase: "idle",
          questionPrompt: (this.data as any).content.questionText,
        });
        (this as any)._completeEmitted = false;
      }, 560);
    },
    pause() {
      this.reset();
    },
    reset() {
      this.clearTimers();
      mediaCoordinator.stopAudio();
      const state = this.data as any;
      const source = (state.content?.options ?? state.options ?? []).map((option: any) => ({
        ...option,
        id: String(option.id ?? option.value ?? option.text ?? ""),
        text: String(option.text ?? option.label ?? ""),
        isCorrect: option.isCorrect === true || option.correct === true,
      }));
      this.setData({
        options: state.preview ? source.slice(0, 4) : shuffleOptions(source, state.options.map((option: Option) => option.id)),
        phase: "idle",
        selectedId: "",
        selectedOption: null,
        questionPrompt: state.content?.questionText ?? "",
        revealed: false,
        audioProgressDeg: 0,
      });
      (this as any)._completeEmitted = false;
    },
  },
});
