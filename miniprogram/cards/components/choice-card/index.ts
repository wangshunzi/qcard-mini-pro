import { mediaCoordinator } from "../../../services/MediaCoordinator";

type ChoicePhase = "idle" | "wrong" | "answered";

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    selected: "",
    phase: "idle" as ChoicePhase,
    correctOption: null as any,
    displayOptions: [] as any[],
    primary: "#4F8FEC",
    panelBackground: "rgba(247,251,255,0.95)",
    panelTitle: "#14345c",
    panelText: "#31506f",
    optionBackground: "rgba(255,255,255,0.9)",
    optionText: "#1f3f5f",
    questionPlaying: false,
  },
  observers: {
    data(value: any) {
      this.clearTimers();
      const theme = value?.theme ?? {};
      this.setData({
        selected: "",
        phase: "idle",
        correctOption: value?.options?.find((option: any) => option.isCorrect) ?? null,
        displayOptions: (value?.options ?? []).slice(0, 4),
        primary: theme.primary ?? "#4F8FEC",
        panelBackground: theme.panelBackground ?? "rgba(247,251,255,0.95)",
        panelTitle: theme.panelTitle ?? "#14345c",
        panelText: theme.panelText ?? "#31506f",
        optionBackground: theme.optionBackground ?? "rgba(255,255,255,0.9)",
        optionText: theme.optionText ?? "#1f3f5f",
        questionPlaying: false,
      });
    },
    isVisible(visible: boolean) {
      if (!visible) this.reset();
    },
  },
  lifetimes: {
    detached() {
      this.reset();
    },
  },
  methods: {
    clearTimers() {
      const instance = this as any;
      if (instance.wrongTimer) clearTimeout(instance.wrongTimer);
      if (instance.answerTimer) clearTimeout(instance.answerTimer);
      instance.wrongTimer = undefined;
      instance.answerTimer = undefined;
    },
    choose(event: WechatMiniprogram.TouchEvent) {
      if (
        (this.data as any).readOnly ||
        (this.data as any).preview ||
        (this.data as any).phase !== "idle"
      ) return;

      const option = event.currentTarget.dataset.option;
      const selected = option?.id ?? "";
      this.clearTimers();
      mediaCoordinator.pauseAll();

      if (option?.isCorrect === true) {
        this.setData({ selected, phase: "answered", questionPlaying: false });
        this.triggerEvent("cardevent", {
          type: "correct",
          cardType: "choice_card",
          payload: { option },
        });
        this.triggerEvent("cardevent", {
          type: "complete",
          cardType: "choice_card",
          payload: { option },
        });
        (this as any).answerTimer = setTimeout(() => {
          (this as any).answerTimer = undefined;
          this.setData({ selected: "", phase: "idle" });
        }, 3400);
        return;
      }

      this.setData({ selected, phase: "wrong", questionPlaying: false });
      this.triggerEvent("cardevent", {
        type: "wrong",
        cardType: "choice_card",
        payload: { option },
      });
      (this as any).wrongTimer = setTimeout(() => {
        (this as any).wrongTimer = undefined;
        this.setData({ selected: "", phase: "idle" });
      }, 760);
    },
    playQuestion() {
      const source = (this.data as any).data?.question?.audio;
      if (
        !source ||
        (this.data as any).readOnly ||
        (this.data as any).preview ||
        (this.data as any).phase !== "idle"
      ) return;
      mediaCoordinator.playAudio(source, "choice-question", () => {
        this.setData({ questionPlaying: false });
      });
      this.setData({ questionPlaying: true });
    },
    pause() {
      this.reset();
    },
    reset() {
      this.clearTimers();
      mediaCoordinator.pauseAll();
      this.setData({ selected: "", phase: "idle", questionPlaying: false });
    },
  },
});
