export {};

import { mediaCoordinator } from "../../../services/MediaCoordinator";

type Language = { label: string; value: string };
type TitleSegment = { pinyin: string; character: string };
type ActionVideo = {
  name: string;
  icon: string;
  iconIsImage: boolean;
  videoUrl: string;
};

const VIDEO_CROSSFADE_MS = 400;
const LANGUAGE_SWITCH_ANIMATION_MS = 300;

function buildSegments(pronunciation: string, subject: string): TitleSegment[] {
  const characters = Array.from(subject.trim());
  const pinyin = pronunciation.trim().split(/\s+/).filter(Boolean);
  if (!characters.length || pinyin.length !== characters.length) return [];
  return characters.map((character, index) => ({ character, pinyin: pinyin[index] }));
}

function isImageSource(value: unknown): boolean {
  const source = String(value ?? "").trim();
  return /^(https?:\/\/|wxfile:\/\/|cloud:\/\/|\/|data:image\/)/i.test(source);
}

function normalizeItem(item: any) {
  if (!item) return null;
  const actionVideos = (item.actionVideos ?? []).map((action: any): ActionVideo => ({
    name: String(action?.name ?? action?.title ?? ""),
    icon: String(action?.icon ?? ""),
    iconIsImage: isImageSource(action?.icon),
    videoUrl: String(action?.url ?? action?.video ?? ""),
  }));
  return {
    ...item,
    actionVideos,
    mainAudio: String(item.soundAudio ?? item.jingle?.audio ?? ""),
  };
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    languages: [] as Language[],
    activeLanguage: "",
    activeLanguageIndex: 0,
    currentLanguageLabel: "",
    nextLanguageLabel: "",
    languageSwitchAnimating: false,
    item: null as any,
    titleSegments: [] as TitleSegment[],
    videoIndex: -1,
    currentVideoUrl: "",
    videoLoading: false,
    videoVisible: false,
    videoClosing: false,
    videoErrorIndex: -1,
    playingTag: "",
    jingleLabel: "顺口溜",
    backgroundColor: "#ffffff",
    themeColor: "#1f2937",
  },
  observers: {
    data(value: any) {
      const rawLanguages = value?.uiData?.langItems?.length
        ? value.uiData.langItems
        : (value?.content ?? []).map((item: any) => ({ label: item.lang, value: item.lang }));
      const languages = rawLanguages.map((item: any) => ({
        label: String(item.label ?? item.value ?? item),
        value: String(item.value ?? item.label ?? item),
      }));
      const activeLanguage =
        languages.find((item: Language) => item.value === "zh")?.value ??
        languages[0]?.value ??
        value?.content?.[0]?.lang ??
        "";
      this.applyLanguage(value, languages, activeLanguage);
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  lifetimes: {
    detached() {
      this.clearVideoExitTimer();
      this.clearLanguageSwitchTimer();
      mediaCoordinator.pauseAll();
    },
  },
  methods: {
    clearVideoExitTimer() {
      const timer = (this as any)._videoExitTimer;
      if (timer) clearTimeout(timer);
      (this as any)._videoExitTimer = null;
    },
    clearLanguageSwitchTimer() {
      const timer = (this as any)._languageSwitchTimer;
      if (timer) clearTimeout(timer);
      (this as any)._languageSwitchTimer = null;
    },
    applyLanguage(value: any, languages: Language[], language: string) {
      this.clearVideoExitTimer();
      mediaCoordinator.pauseAll();
      try {
        wx.createVideoContext("recognitionVideo", this).stop();
      } catch {
        // Video may not be mounted.
      }
      const rawItem = value?.content?.find((candidate: any) => candidate.lang === language) ?? value?.content?.[0] ?? null;
      const item = normalizeItem(rawItem);
      const resolvedLanguage = item?.lang ?? language;
      const activeLanguageIndex = Math.max(
        0,
        languages.findIndex((candidate: Language) => candidate.value === resolvedLanguage),
      );
      const nextLanguageIndex = languages.length
        ? (activeLanguageIndex + 1) % languages.length
        : 0;
      this.setData({
        languages,
        activeLanguage: resolvedLanguage,
        activeLanguageIndex,
        currentLanguageLabel: languages[activeLanguageIndex]?.label ?? resolvedLanguage,
        nextLanguageLabel: languages[nextLanguageIndex]?.label ?? "",
        item,
        titleSegments: buildSegments(item?.pronunciation?.text ?? "", item?.subject ?? ""),
        videoIndex: -1,
        currentVideoUrl: "",
        videoLoading: false,
        videoVisible: false,
        videoClosing: false,
        videoErrorIndex: -1,
        playingTag: "",
        jingleLabel: (item?.lang ?? language).startsWith("en") ? "Jingle" : "顺口溜",
        backgroundColor: (this.data as any).preview ? "#ffffff" : (value?.environmentTheme ?? "#f0f0f0"),
        themeColor: typeof value?.theme === "string" ? value.theme : (value?.theme?.primary ?? "#1f2937"),
      });
    },
    switchLanguage() {
      const state = this.data as any;
      if (state.readOnly || state.preview || state.languages.length < 2) return;
      const nextIndex = (state.activeLanguageIndex + 1) % state.languages.length;
      const nextLanguage = state.languages[nextIndex]?.value;
      if (!nextLanguage) return;
      this.clearLanguageSwitchTimer();
      this.applyLanguage(state.data, state.languages, nextLanguage);
      this.setData({ languageSwitchAnimating: true });
      (this as any)._languageSwitchTimer = setTimeout(() => {
        (this as any)._languageSwitchTimer = null;
        this.setData({ languageSwitchAnimating: false });
      }, LANGUAGE_SWITCH_ANIMATION_MS);
    },
    toggleAudio(source: string, tag: "title" | "jingle") {
      const state = this.data as any;
      if (
        state.readOnly ||
        state.preview ||
        !source ||
        state.videoIndex >= 0 ||
        state.currentVideoUrl
      ) return;
      if (state.playingTag === tag) {
        mediaCoordinator.stopAudio();
        this.setData({ playingTag: "" });
        return;
      }
      mediaCoordinator.stopAudio();
      this.setData({ playingTag: tag });
      const audio = mediaCoordinator.playAudio(source, `recognition-${tag}`, () => {
        if ((this.data as any).playingTag === tag) this.setData({ playingTag: "" });
      });
      if (!audio) this.setData({ playingTag: "" });
    },
    playPronunciation() {
      this.toggleAudio((this.data as any).item?.pronunciation?.audio, "title");
    },
    playJingle() {
      this.toggleAudio((this.data as any).item?.mainAudio, "jingle");
    },
    toggleVideo(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly || state.preview) return;
      const index = Number(event.currentTarget.dataset.index);
      const videoUrl = state.item?.actionVideos?.[index]?.videoUrl;
      if (!Number.isInteger(index) || !videoUrl) return;
      mediaCoordinator.stopAudio();
      if (state.videoIndex === index) {
        if (state.videoLoading && state.videoErrorIndex !== index) return;
        if (state.videoErrorIndex === index) {
          this.loadActionVideo(index, videoUrl);
        } else {
          this.fadeOutVideo();
        }
        return;
      }
      this.loadActionVideo(index, videoUrl);
    },
    loadActionVideo(index: number, videoUrl: string) {
      this.clearVideoExitTimer();
      try {
        wx.createVideoContext("recognitionVideo", this).stop();
      } catch {
        // Video may not be mounted.
      }
      this.setData({
        videoIndex: index,
        currentVideoUrl: "",
        videoLoading: true,
        videoVisible: false,
        videoClosing: false,
        videoErrorIndex: -1,
        playingTag: "",
      }, () => {
        wx.nextTick(() => {
          if ((this.data as any).videoIndex !== index) return;
          this.setData({ currentVideoUrl: videoUrl }, () => {
            wx.nextTick(() => {
              if ((this.data as any).videoIndex !== index) return;
              try {
                wx.createVideoContext("recognitionVideo", this).play();
              } catch {
                this.videoError();
              }
            });
          });
        });
      });
    },
    videoReady() {
      const state = this.data as any;
      if (state.videoIndex < 0 || state.videoClosing) return;
      this.setData({
        videoLoading: false,
        videoVisible: true,
        videoErrorIndex: -1,
      });
    },
    videoWaiting() {
      const state = this.data as any;
      if (state.videoIndex < 0 || state.videoClosing) return;
      this.setData({ videoLoading: true });
    },
    videoProgress(event: WechatMiniprogram.CustomEvent) {
      const state = this.data as any;
      const currentTime = Number((event.detail as any)?.currentTime ?? 0);
      if (
        state.videoIndex < 0 ||
        state.videoClosing ||
        !Number.isFinite(currentTime) ||
        currentTime <= 0
      ) return;
      if (state.videoLoading || !state.videoVisible) {
        this.setData({
          videoLoading: false,
          videoVisible: true,
          videoErrorIndex: -1,
        });
      }
    },
    videoError() {
      const state = this.data as any;
      if (state.videoIndex < 0 || state.videoClosing) return;
      this.setData({
        videoLoading: false,
        videoVisible: false,
        videoErrorIndex: state.videoIndex,
      });
      wx.showToast({ title: "视频加载失败，请重试", icon: "none" });
    },
    videoEnded() {
      this.fadeOutVideo();
    },
    fadeOutVideo() {
      const state = this.data as any;
      if (!state.currentVideoUrl && state.videoIndex < 0) return;
      this.clearVideoExitTimer();
      this.setData({
        videoIndex: -1,
        videoLoading: false,
        videoVisible: false,
        videoClosing: true,
        videoErrorIndex: -1,
      });
      (this as any)._videoExitTimer = setTimeout(() => {
        (this as any)._videoExitTimer = null;
        try {
          wx.createVideoContext("recognitionVideo", this).stop();
        } catch {
          // Video may already be unmounted.
        }
        this.setData({
          currentVideoUrl: "",
          videoClosing: false,
        });
      }, VIDEO_CROSSFADE_MS);
    },
    stopVideo() {
      this.clearVideoExitTimer();
      try {
        wx.createVideoContext("recognitionVideo", this).stop();
      } catch {
        // Video may not be mounted.
      }
      this.setData({
        videoIndex: -1,
        currentVideoUrl: "",
        videoLoading: false,
        videoVisible: false,
        videoClosing: false,
        videoErrorIndex: -1,
      });
    },
    pause() {
      mediaCoordinator.pauseAll();
      wx.createVideoContext("recognitionVideo", this).pause();
      this.setData({ playingTag: "" });
    },
    reset() {
      this.pause();
      this.stopVideo();
      this.clearLanguageSwitchTimer();
      this.setData({ languageSwitchAnimating: false });
    },
  },
});
