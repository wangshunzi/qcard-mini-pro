export {};

import { mediaCoordinator } from "../../../services/MediaCoordinator";
import {
  LISTENING_FEEDBACK_AUDIO,
  LISTENING_QUESTION_BUBBLE,
  resolveListeningBackground,
} from "../../assets/client-card-assets";
import { splitTranscriptParagraphs } from "./utils";

type CardPhase = "listening" | "answering";
type AnswerPhase = "idle" | "wrong" | "correct" | "transitioning" | "completed";

type Option = {
  id: string;
  letter: string;
  text: string;
  audio?: string;
  isCorrect: boolean;
  feedback: { text: string; audio?: string };
};

type Question = {
  id: string;
  text: string;
  audio?: string;
  options: Option[];
};

function audioSource(content: any): string {
  if (!content?.audio) return "";
  return typeof content.audio === "object"
    ? String(content.audio.audio ?? "")
    : String(content.audio);
}

function transcriptOf(content: any): string {
  if (content?.transcript) return String(content.transcript);
  if (typeof content?.audio === "object") {
    return String(content.audio.transcript ?? content.audio.text ?? "");
  }
  return "";
}

function titleOf(content: any): string {
  return String(content?.title ?? (typeof content?.audio === "object" ? content.audio.title : "") ?? "听力材料");
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function normalizeQuestions(input: any[]): Question[] {
  return (input ?? []).map((question, questionIndex) => {
    const questionId = String(question.id ?? `q${questionIndex + 1}`);
    return {
      id: questionId,
      text: String(question.text ?? question.question ?? ""),
      audio: question.audio,
      options: (question.options ?? []).slice(0, 4).map((option: any, optionIndex: number) => {
        const isCorrect = option.correct ?? option.isCorrect ?? false;
        return {
          id: String(option.id ?? option.value ?? `${questionId}-o${optionIndex + 1}`),
          letter: String.fromCharCode(65 + optionIndex),
          text: String(option.text ?? option.label ?? option),
          audio: option.audio,
          isCorrect: Boolean(isCorrect),
          feedback: {
            text: String(option.feedback?.text ?? (isCorrect ? "回答正确。" : "再听一遍试试。")),
            audio:
              option.feedback?.audio ??
              (isCorrect
                ? LISTENING_FEEDBACK_AUDIO.correct
                : LISTENING_FEEDBACK_AUDIO.wrong),
          },
        };
      }),
    };
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
    content: null as any,
    questions: [] as Question[],
    question: null as Question | null,
    questionIndex: 0,
    cardPhase: "listening" as CardPhase,
    phase: "idle" as AnswerPhase,
    selectedId: "",
    answeredMap: {} as Record<string, boolean>,
    hasListenedOnce: false,
    transcriptExpanded: false,
    passagePlaying: false,
    interactionPlayingId: "",
    progress: 0,
    progressDeg: 0,
    currentSeconds: 0,
    durationSeconds: 0,
    currentTimeText: "0:00",
    durationText: "0:00",
    playbackRate: 1,
    transcriptDefaultExpanded: false,
    requireListen: false,
    allowSkip: true,
    autoAdvance: true,
    primary: "#6f9b7b",
    success: "#5f9e73",
    error: "#c96a55",
    feedbackText: "",
    backgroundImage: "",
    questionBubbleImage: LISTENING_QUESTION_BUBBLE,
  },
  lifetimes: {
    detached() {
      this.clearTimers();
      mediaCoordinator.stopAudio();
      (this as any)._passageAudio = null;
      (this as any)._interactionAudio = null;
    },
  },
  observers: {
    "data, preview"(value: any) {
      const content = value?.content ?? value;
      const questions = normalizeQuestions(content?.questions ?? []);
      const mode = content?.mode ?? "story";
      const passage = typeof content?.audio === "object" ? content.audio : {};
      this.clearTimers();
      mediaCoordinator.stopAudio();
      (this as any)._passageAudio = null;
      (this as any)._interactionAudio = null;
      this.setData({
        content: {
          ...content,
          titleText: titleOf(content),
          audioSource: audioSource(content),
          transcriptText: transcriptOf(content),
          transcriptParagraphs: splitTranscriptParagraphs(transcriptOf(content)),
          completionText: content?.completion?.text ?? "全部答对啦！",
        },
        questions,
        question: questions[0] ?? null,
        questionIndex: 0,
        cardPhase: "listening",
        phase: "idle",
        selectedId: "",
        answeredMap: {},
        hasListenedOnce: false,
        transcriptExpanded:
          content?.showTranscriptDefault ??
          passage?.showTranscriptDefault ??
          false,
        passagePlaying: false,
        interactionPlayingId: "",
        progress: 0,
        progressDeg: 0,
        currentSeconds: 0,
        durationSeconds: 0,
        currentTimeText: "0:00",
        durationText: "0:00",
        playbackRate: 1,
        transcriptDefaultExpanded:
          content?.showTranscriptDefault ??
          passage?.showTranscriptDefault ??
          false,
        requireListen: content?.requireListenBeforeAnswer ?? mode === "exam",
        allowSkip: content?.allowSkipQuestions ?? mode === "story",
        autoAdvance: content?.autoAdvanceOnCorrect ?? true,
        primary: content?.theme?.primary ?? "#6f9b7b",
        success: content?.theme?.success ?? "#5f9e73",
        error: content?.theme?.error ?? "#c96a55",
        feedbackText: "",
        backgroundImage: resolveListeningBackground(content, "listening"),
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
    },
    togglePassage() {
      const state = this.data as any;
      if (state.readOnly || state.preview || !state.content?.audioSource) return;
      if (state.passagePlaying) {
        mediaCoordinator.stopAudio();
        (this as any)._passageAudio = null;
        this.setData({ passagePlaying: false });
        return;
      }
      this.playPassage();
    },
    playPassage() {
      const state = this.data as any;
      if (wx.getStorageSync("qcard.sound-enabled") === false) return;
      mediaCoordinator.stopAudio();
      (this as any)._interactionAudio = null;
      const audio = mediaCoordinator.createAudio(state.content.audioSource);
      const resumeAt = Math.max(0, Number(state.currentSeconds) || 0);
      let restoredPosition = false;
      audio.playbackRate = state.playbackRate;
      audio.onCanplay(() => {
        const duration = audio.duration || 0;
        this.setData({
          durationSeconds: duration,
          durationText: formatTime(duration),
        });
        if (
          !restoredPosition &&
          resumeAt > 0 &&
          (!duration || resumeAt < duration)
        ) {
          restoredPosition = true;
          audio.seek(resumeAt);
        }
      });
      audio.onTimeUpdate(() => {
        const duration = audio.duration || 0;
        const progress = duration > 0 ? Math.min(100, (audio.currentTime / duration) * 100) : 0;
        this.setData({
          progress,
          progressDeg: progress * 3.6,
          currentSeconds: audio.currentTime,
          durationSeconds: duration,
          currentTimeText: formatTime(audio.currentTime),
          durationText: formatTime(duration),
        });
      });
      const finish = () => {
        if ((this as any)._passageAudio !== audio) return;
        (this as any)._passageAudio = null;
        this.setData({
          passagePlaying: false,
          hasListenedOnce: true,
          progress: 100,
          progressDeg: 360,
          currentSeconds: audio.duration || audio.currentTime,
          durationSeconds: audio.duration || 0,
          currentTimeText: formatTime(audio.duration || audio.currentTime),
        });
      };
      audio.onEnded(finish);
      audio.onError(() => {
        if ((this as any)._passageAudio === audio) {
          (this as any)._passageAudio = null;
          this.setData({ passagePlaying: false });
        }
      });
      (this as any)._passageAudio = audio;
      this.setData({ passagePlaying: true, interactionPlayingId: "" });
      audio.play();
    },
    cycleRate() {
      const state = this.data as any;
      if (state.readOnly || state.preview) return;
      const rates = [0.75, 1, 1.25, 1.5];
      const currentIndex = rates.indexOf(state.playbackRate);
      const playbackRate = rates[(currentIndex + 1) % rates.length];
      const audio = (this as any)._passageAudio as WechatMiniprogram.InnerAudioContext | null;
      if (audio) audio.playbackRate = playbackRate;
      this.setData({ playbackRate });
    },
    toggleTranscript() {
      if ((this.data as any).readOnly) return;
      this.setData({ transcriptExpanded: !(this.data as any).transcriptExpanded });
    },
    startAnswering() {
      const state = this.data as any;
      if (state.readOnly || (state.requireListen && !state.hasListenedOnce)) {
        wx.showToast({ title: "请先听完材料", icon: "none" });
        return;
      }
      mediaCoordinator.stopAudio();
      (this as any)._passageAudio = null;
      this.setData({
        passagePlaying: false,
        cardPhase: "answering",
        backgroundImage: resolveListeningBackground(state.content, "answering"),
      });
    },
    backToListening() {
      if ((this.data as any).readOnly) return;
      mediaCoordinator.stopAudio();
      (this as any)._passageAudio = null;
      (this as any)._interactionAudio = null;
      this.setData({
        interactionPlayingId: "",
        cardPhase: "listening",
        backgroundImage: resolveListeningBackground(
          (this.data as any).content,
          "listening",
        ),
      });
    },
    selectQuestion(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      const index = Number(event.currentTarget.dataset.index);
      if (
        state.readOnly ||
        state.phase === "completed" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= state.questions.length ||
        index === state.questionIndex
      ) return;
      const target = state.questions[index] as Question;
      if (!state.allowSkip && !state.answeredMap[target.id]) return;
      this.goToQuestion(index);
    },
    goToQuestion(index: number) {
      const state = this.data as any;
      const interactionAudio = (this as any)._interactionAudio as
        | WechatMiniprogram.InnerAudioContext
        | null;
      if (interactionAudio && mediaCoordinator.isActive(interactionAudio)) {
        mediaCoordinator.stopAudio();
      }
      (this as any)._interactionAudio = null;
      this.clearTimers();
      this.setData({
        questionIndex: index,
        question: state.questions[index] ?? null,
        selectedId: "",
        phase: "idle",
        interactionPlayingId: "",
        feedbackText: "",
      });
    },
    answer(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (
        state.readOnly ||
        state.phase !== "idle"
      ) return;
      const id = String(event.currentTarget.dataset.id ?? "");
      const option = (state.question?.options ?? []).find((candidate: Option) => candidate.id === id) as Option | undefined;
      if (!option) return;
      this.clearTimers();
      mediaCoordinator.stopAudio();
      this.setData({
        selectedId: id,
        phase: option.isCorrect ? "correct" : "wrong",
        feedbackText: option.feedback.text,
        interactionPlayingId: `feedback:${id}`,
      });
      this.triggerEvent("cardevent", {
        type: option.isCorrect ? "correct" : "wrong",
        cardType: "listening_comprehension_card",
        payload: { questionId: state.question.id, option },
      });
      const done = option.isCorrect
        ? () => this.finishCorrectQuestion()
        : () => this.resetWrong();
      const played = this.playInteraction(option.feedback.audio, `feedback:${id}`, done);
      if (!played) {
        if (option.isCorrect) done();
        else this.later(done, 900);
      }
    },
    resetWrong() {
      if ((this.data as any).phase !== "wrong") return;
      this.setData({
        phase: "idle",
        selectedId: "",
        feedbackText: "",
        interactionPlayingId: "",
      });
    },
    finishCorrectQuestion() {
      const state = this.data as any;
      const answeredMap = { ...state.answeredMap, [state.question.id]: true };
      const allAnswered = (state.questions as Question[]).every((question) => answeredMap[question.id]);
      if (allAnswered) {
        this.setData({
          answeredMap,
          phase: "completed",
          interactionPlayingId: "",
          feedbackText: state.content?.completion?.text ?? "全部回答正确！",
        });
        const completionAudio =
          state.content?.completion?.audio ?? LISTENING_FEEDBACK_AUDIO.complete;
        this.playInteraction(completionAudio, "completion");
        if (!(this as any)._completeEmitted) {
          (this as any)._completeEmitted = true;
          this.triggerEvent("cardevent", { type: "complete", cardType: "listening_comprehension_card" });
        }
        return;
      }

      if (!state.autoAdvance) {
        this.setData({ answeredMap, phase: "idle", selectedId: "", feedbackText: "" });
        return;
      }
      this.setData({ answeredMap, phase: "transitioning", interactionPlayingId: "" });
      const questions = state.questions as Question[];
      let target = questions.findIndex((question, index) => index > state.questionIndex && !answeredMap[question.id]);
      if (target < 0) target = questions.findIndex((question) => !answeredMap[question.id]);
      this.later(() => this.goToQuestion(target >= 0 ? target : state.questionIndex), 520);
    },
    playQuestionAudio() {
      const state = this.data as any;
      if (!state.question?.audio || state.readOnly || state.phase !== "idle") return;
      const id = `question:${state.question.id}`;
      if (state.interactionPlayingId === id) {
        mediaCoordinator.stopAudio();
        this.setData({ interactionPlayingId: "" });
        return;
      }
      this.playInteraction(state.question.audio, id);
    },
    playOptionAudio(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly) return;
      const id = String(event.currentTarget.dataset.id ?? "");
      const option = (state.question?.options ?? []).find((candidate: Option) => candidate.id === id) as Option | undefined;
      if (!option?.audio) return;
      const tag = `option:${id}`;
      if (state.interactionPlayingId === tag) {
        mediaCoordinator.stopAudio();
        this.setData({ interactionPlayingId: "" });
        return;
      }
      this.playInteraction(option.audio, tag);
    },
    playInteraction(source?: string, tag = "", onDone?: () => void): boolean {
      if (!source || wx.getStorageSync("qcard.sound-enabled") === false) {
        this.setData({ interactionPlayingId: "" });
        return false;
      }
      mediaCoordinator.stopAudio();
      (this as any)._passageAudio = null;
      const audio = mediaCoordinator.createAudio(source);
      (this as any)._interactionAudio = audio;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        if ((this as any)._interactionAudio === audio) {
          (this as any)._interactionAudio = null;
        }
        this.setData({ interactionPlayingId: "" });
        onDone?.();
      };
      audio.onEnded(finish);
      audio.onError(finish);
      this.setData({ passagePlaying: false, interactionPlayingId: tag });
      audio.play();
      return true;
    },
    restart() {
      if ((this.data as any).readOnly) return;
      this.reset();
    },
    pause() {
      this.reset();
    },
    reset() {
      this.clearTimers();
      mediaCoordinator.stopAudio();
      (this as any)._passageAudio = null;
      (this as any)._interactionAudio = null;
      const state = this.data as any;
      this.setData({
        questionIndex: 0,
        question: state.questions[0] ?? null,
        cardPhase: "listening",
        phase: "idle",
        selectedId: "",
        answeredMap: {},
        hasListenedOnce: false,
        passagePlaying: false,
        interactionPlayingId: "",
        progress: 0,
        progressDeg: 0,
        currentSeconds: 0,
        durationSeconds: 0,
        currentTimeText: "0:00",
        durationText: "0:00",
        playbackRate: 1,
        transcriptExpanded: Boolean(state.transcriptDefaultExpanded),
        feedbackText: "",
        backgroundImage: resolveListeningBackground(state.content, "listening"),
      });
      (this as any)._completeEmitted = false;
    },
  },
});
