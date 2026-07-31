type StopHandler = () => void;

class MediaCoordinator {
  private activeAudio: WechatMiniprogram.InnerAudioContext | null = null;
  private stoppers = new Set<StopHandler>();

  createAudio(src: string, options?: { loop?: boolean; volume?: number }) {
    this.stopAudio();
    const audio = wx.createInnerAudioContext({ useWebAudioImplement: true });
    audio.src = src;
    audio.loop = options?.loop ?? false;
    audio.volume =
      wx.getStorageSync("qcard.sound-enabled") === false
        ? 0
        : options?.volume ?? 1;
    const cleanup = () => {
      if (this.activeAudio === audio) this.activeAudio = null;
    };
    audio.onEnded(cleanup);
    audio.onError(cleanup);
    this.activeAudio = audio;
    return audio;
  }

  play(src: string) {
    const audio = this.createAudio(src);
    audio.play();
    return audio;
  }

  playAudio(src: string, _scope?: string, onEnded?: () => void) {
    if (wx.getStorageSync("qcard.sound-enabled") === false) return undefined;
    const audio = this.createAudio(src);
    if (onEnded) audio.onEnded(onEnded);
    audio.play();
    return audio;
  }

  isActive(audio: WechatMiniprogram.InnerAudioContext | null | undefined) {
    return !!audio && this.activeAudio === audio;
  }

  stopAudio() {
    if (!this.activeAudio) return;
    this.activeAudio.stop();
    this.activeAudio.destroy();
    this.activeAudio = null;
  }

  registerStopper(handler: StopHandler) {
    this.stoppers.add(handler);
    return () => this.stoppers.delete(handler);
  }

  pauseAll() {
    this.stopAudio();
    this.stoppers.forEach((handler) => handler());
  }
}

export const mediaCoordinator = new MediaCoordinator();
