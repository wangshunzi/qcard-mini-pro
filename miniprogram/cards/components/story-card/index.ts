export {};

import { mediaCoordinator } from "../../../services/MediaCoordinator";
import {
  normalizeStoryRoles,
  previewStoryRoles,
  storyMediaUrl,
} from "./model";

type Paragraph = {
  domId: string;
  index: number;
  imageId: number;
  role: number;
  roleName: string;
  avatar: string;
  startTime: number;
  text: string;
  side: "narrator" | "left" | "right";
  distanceClass: string;
};

function decorateParagraphs(paragraphs: Paragraph[], activeIndex: number): Paragraph[] {
  return paragraphs.map((paragraph, index) => ({
    ...paragraph,
    distanceClass: `distance-${Math.min(3, Math.abs(index - activeIndex))}`,
  }));
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

Component({
  properties: {
    data: { type: Object, value: {} },
    preview: { type: Boolean, value: false },
    readOnly: { type: Boolean, value: false },
    isVisible: { type: Boolean, value: true },
  },
  data: {
    paragraphs: [] as Paragraph[],
    roles: [] as any[],
    previewRoles: [] as any[],
    hasPreviewRoles: false,
    images: [] as any[],
    activeIndex: -1,
    activeImage: "",
    previewLayoutReady: false,
    previewSceneStyle: "aspect-ratio:4/3",
    dialogueScrollTop: 0,
    audioSource: "",
    playing: false,
    currentSeconds: 0,
    durationSeconds: 0,
    currentTimeText: "0:00",
    durationText: "0:00",
    progress: 0,
    playbackRate: 1,
  },
  observers: {
    data(value: any) {
      this.initialize(value);
    },
    preview(value: boolean) {
      if (value) this.preparePreviewImage((this.data as any).activeImage);
    },
    isVisible(value: boolean) {
      if (!value) this.reset();
    },
  },
  lifetimes: {
    detached() {
      mediaCoordinator.stopAudio();
      (this as any)._audio = null;
    },
  },
  methods: {
    initialize(value: any) {
      mediaCoordinator.stopAudio();
      const roles = normalizeStoryRoles(value?.roles);
      const images = (value?.images ?? []).map((image: any, index: number) => ({
        ...(typeof image === "object" ? image : {}),
        id: Number(image?.id ?? index),
        url: storyMediaUrl(image?.url ?? image),
      }));
      const sourceParagraphs = [...(value?.content ?? value?.pages ?? [])]
        .sort((left: any, right: any) => Number(left?.startTime ?? 0) - Number(right?.startTime ?? 0));
      const paragraphs: Paragraph[] = sourceParagraphs.map((item: any, index: number) => {
        const role = roles.find((candidate: any) => Number(candidate.id) === Number(item.role));
        return {
          domId: `story-p-${index}`,
          index,
          imageId: Number(item.imageId ?? images[index]?.id ?? images[0]?.id ?? 0),
          role: Number(item.role ?? 0),
          roleName: item.role === 0 ? "旁白" : String(role?.name ?? item.speaker ?? ""),
          avatar: String(role?.avatar ?? ""),
          startTime: Number(item.startTime ?? 0),
          text: String(item.text ?? item.content ?? ""),
          side:
            Number(item.role ?? 0) === 0
              ? "narrator"
              : Number(item.role) % 2 === 1
                ? "right"
                : "left",
          distanceClass: "distance-3",
        };
      });
      const firstImageId = paragraphs[0]?.imageId ?? images[0]?.id;
      const activeImage = String(
        storyMediaUrl(images.find((image: any) => Number(image.id) === Number(firstImageId))?.url) ||
        storyMediaUrl(images[0]?.url ?? images[0]),
      );
      const activeIndex = paragraphs.length ? 0 : -1;
      const visiblePreviewRoles = previewStoryRoles(roles);
      this.setData({
        paragraphs: decorateParagraphs(paragraphs, activeIndex),
        roles,
        previewRoles: visiblePreviewRoles,
        hasPreviewRoles: visiblePreviewRoles.length > 0,
        images,
        activeIndex,
        activeImage,
        previewLayoutReady: false,
        dialogueScrollTop: 0,
        audioSource: storyMediaUrl(value?.vtt?.src ?? value?.audio),
        playing: false,
        currentSeconds: 0,
        durationSeconds: 0,
        currentTimeText: "0:00",
        durationText: "0:00",
        progress: 0,
        playbackRate: 1,
      }, () => this.preparePreviewImage(activeImage));
      (this as any)._audio = null;
      (this as any)._completeEmitted = false;
    },
    preparePreviewImage(source: string) {
      const requestId = Number((this as any)._previewImageRequestId ?? 0) + 1;
      (this as any)._previewImageRequestId = requestId;
      if (!(this.data as any).preview) return;
      if (!source) {
        this.setData({
          previewSceneStyle: "aspect-ratio:4/3",
          previewLayoutReady: true,
        });
        return;
      }
      this.setData({ previewLayoutReady: false });
      wx.getImageInfo({
        src: source,
        success: (result) => {
          if ((this as any)._previewImageRequestId !== requestId) return;
          const width = Number(result.width);
          const height = Number(result.height);
          const valid = width > 0 && height > 0;
          this.setData({
            previewSceneStyle: valid ? `aspect-ratio:${width}/${height}` : "aspect-ratio:4/3",
            previewLayoutReady: true,
          });
        },
        fail: () => {
          if ((this as any)._previewImageRequestId !== requestId) return;
          this.setData({
            previewSceneStyle: "aspect-ratio:4/3",
            previewLayoutReady: true,
          });
        },
      });
    },
    ensureAudio(): WechatMiniprogram.InnerAudioContext | null {
      const state = this.data as any;
      if (!state.audioSource || wx.getStorageSync("qcard.sound-enabled") === false) return null;
      const existing = (this as any)._audio as WechatMiniprogram.InnerAudioContext | null;
      if (existing && mediaCoordinator.isActive(existing)) return existing;
      if (existing) {
        try {
          existing.destroy();
        } catch {
          // 已被全局媒体协调器销毁时直接创建新实例。
        }
        (this as any)._audio = null;
      }

      const audio = mediaCoordinator.createAudio(state.audioSource);
      audio.playbackRate = state.playbackRate;
      audio.onCanplay(() => {
        this.setData({
          durationSeconds: audio.duration || 0,
          durationText: formatTime(audio.duration || 0),
        });
      });
      audio.onTimeUpdate(() => {
        const duration = audio.duration || 0;
        this.setData({
          currentSeconds: audio.currentTime,
          durationSeconds: duration,
          currentTimeText: formatTime(audio.currentTime),
          durationText: formatTime(duration),
          progress: duration > 0 ? Math.min(100, (audio.currentTime / duration) * 100) : 0,
        });
        this.syncParagraph(audio.currentTime * 1000);
      });
      audio.onPlay(() => this.setData({ playing: true }));
      audio.onPause(() => this.setData({ playing: false }));
      audio.onStop(() => this.setData({ playing: false }));
      audio.onEnded(() => {
        if ((this as any)._audio === audio) (this as any)._audio = null;
        this.setData({ playing: false, progress: 100 });
        if (!(this as any)._completeEmitted) {
          (this as any)._completeEmitted = true;
          this.triggerEvent("cardevent", { type: "complete", cardType: "story_card" });
        }
      });
      audio.onError(() => {
        if ((this as any)._audio === audio) (this as any)._audio = null;
        this.setData({ playing: false });
      });
      (this as any)._audio = audio;
      return audio;
    },
    syncParagraph(positionMs: number) {
      const state = this.data as any;
      const paragraphs = state.paragraphs as Paragraph[];
      let activeIndex = -1;
      for (let index = paragraphs.length - 1; index >= 0; index -= 1) {
        if (paragraphs[index].startTime <= positionMs) {
          activeIndex = index;
          break;
        }
      }
      if (activeIndex === state.activeIndex) return;
      const paragraph = paragraphs[activeIndex];
      let activeImage = state.activeImage;
      if (paragraph) {
        activeImage = String(
          storyMediaUrl(state.images.find((image: any) => Number(image.id) === Number(paragraph.imageId))?.url) ||
          activeImage,
        );
      }
      this.setData({
        activeIndex,
        paragraphs: decorateParagraphs(paragraphs, Math.max(0, activeIndex)),
        activeImage,
      }, () => {
        if (paragraph) this.centerParagraph(paragraph.domId);
      });
    },
    togglePlay() {
      const state = this.data as any;
      if (state.readOnly || state.preview) return;
      const audio = this.ensureAudio();
      if (!audio) return;
      if (state.playing) audio.pause();
      else audio.play();
    },
    playParagraph(event: WechatMiniprogram.TouchEvent) {
      const state = this.data as any;
      if (state.readOnly || state.preview) return;
      const index = Number(event.currentTarget.dataset.index);
      const paragraph = state.paragraphs[index] as Paragraph | undefined;
      if (!paragraph) return;
      const audio = this.ensureAudio();
      if (!audio) return;
      this.setData({
        activeIndex: index,
        paragraphs: decorateParagraphs(state.paragraphs, index),
        activeImage: String(
          storyMediaUrl(state.images.find((image: any) => Number(image.id) === Number(paragraph.imageId))?.url) ||
          state.activeImage,
        ),
      }, () => this.centerParagraph(paragraph.domId));
      audio.seek(Math.max(0, paragraph.startTime / 1000));
      audio.play();
    },
    centerParagraph(domId: string) {
      if (!domId || (this.data as any).preview) return;
      wx.nextTick(() => {
        this.createSelectorQuery()
          .select(".dialogue-list")
          .boundingClientRect()
          .select(".dialogue-list")
          .scrollOffset()
          .select(`#${domId}`)
          .boundingClientRect()
          .select(".dialogue-content")
          .boundingClientRect()
          .exec((results: any[]) => {
            const viewport = results?.[0];
            const scrollOffset = results?.[1];
            const paragraph = results?.[2];
            const content = results?.[3];
            if (!viewport || !paragraph || !content || viewport.height <= 0) return;
            const currentScrollTop = Number(scrollOffset?.scrollTop) || 0;
            const centered =
              currentScrollTop +
              (paragraph.top - viewport.top) -
              (viewport.height - paragraph.height) / 2;
            const maxScrollTop = Math.max(0, content.height - viewport.height);
            this.setData({
              dialogueScrollTop: Math.max(0, Math.min(centered, maxScrollTop)),
            });
          });
      });
    },
    seek(event: WechatMiniprogram.SliderChange) {
      const state = this.data as any;
      if (state.readOnly || !state.durationSeconds) return;
      const audio = this.ensureAudio();
      if (!audio) return;
      const seconds = (Number(event.detail.value) / 100) * state.durationSeconds;
      audio.seek(seconds);
      this.syncParagraph(seconds * 1000);
    },
    cycleRate() {
      const state = this.data as any;
      if (state.readOnly) return;
      const rates = [1, 1.25, 1.5, 0.75];
      const index = rates.indexOf(state.playbackRate);
      const playbackRate = rates[(index + 1) % rates.length];
      const audio = (this as any)._audio as WechatMiniprogram.InnerAudioContext | null;
      if (audio) audio.playbackRate = playbackRate;
      this.setData({ playbackRate });
    },
    pause() {
      const audio = (this as any)._audio as WechatMiniprogram.InnerAudioContext | null;
      audio?.pause();
      this.setData({ playing: false });
    },
    reset() {
      mediaCoordinator.stopAudio();
      (this as any)._audio = null;
      const state = this.data as any;
      const first = state.paragraphs[0] as Paragraph | undefined;
      const activeImage = String(
        storyMediaUrl(state.images.find((image: any) => Number(image.id) === Number(first?.imageId))?.url) ||
        storyMediaUrl(state.images[0]?.url),
      );
      this.setData({
        activeIndex: first ? 0 : -1,
        paragraphs: decorateParagraphs(state.paragraphs, 0),
        activeImage,
        dialogueScrollTop: 0,
        playing: false,
        currentSeconds: 0,
        currentTimeText: "0:00",
        progress: 0,
        playbackRate: 1,
      }, () => this.preparePreviewImage(activeImage));
      (this as any)._completeEmitted = false;
    },
  },
});
