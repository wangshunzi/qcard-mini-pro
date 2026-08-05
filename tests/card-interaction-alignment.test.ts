import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { validateCardPayload } from "../miniprogram/cards/validation";
import { normalizePuzzleCardData } from "../miniprogram/cards/components/puzzle-card/model";
import {
  normalizeStoryRoles,
  previewStoryRoles,
} from "../miniprogram/cards/components/story-card/model";

declare const process: { cwd(): string };

const ROOT = resolve(process.cwd(), "miniprogram/cards/components");
const CARD_COMPONENTS = [
  "recognition-pic-card",
  "literacy-card",
  "puzzle-card",
  "story-card",
  "sound-object-card",
  "choice-card",
  "silhouette-choice-card",
  "listening-comprehension-card",
  "matching-card",
  "classification-card",
] as const;

function source(card: (typeof CARD_COMPONENTS)[number], extension: "ts" | "wxml" | "wxss") {
  return readFileSync(resolve(ROOT, card, `index.${extension}`), "utf8");
}

describe("card preview/full interaction alignment", () => {
  it.each(CARD_COMPONENTS)("%s exposes lifecycle reset and pause handling", (card) => {
    const logic = source(card, "ts");
    expect(logic).toMatch(/\bpause\s*\(\)/);
    expect(logic).toMatch(/\breset\s*\(\)/);
    expect(logic).toContain("isVisible");
  });

  it("matching supports drag, tap-to-connect, complete locking, and full preview pairs", () => {
    const logic = source("matching-card", "ts");
    const template = source("matching-card", "wxml");
    expect(logic).toContain("nodeTap(");
    expect(logic).toContain("state.allCorrect");
    expect(logic).not.toContain(".slice(0, 2)");
    expect(template).toContain('catchtap="nodeTap"');
    expect(template).toContain('catchtap="reset"');
  });

  it("classification supports drag and tap assignment with a visible reset path", () => {
    const logic = source("classification-card", "ts");
    const template = source("classification-card", "wxml");
    const styles = source("classification-card", "wxss");
    expect(logic).toContain("assignSelected(");
    expect(template).toContain('catchtap="itemTap"');
    expect(template).toContain('catchtap="bucketTap"');
    expect(template).toContain('catchtap="poolTap"');
    expect(template).toContain('catchtap="reset"');
    expect(styles.match(/pointer-events:\s*none/g) ?? []).toHaveLength(0);
  });

  it("keeps touch, media, and answer state transitions aligned with H5", () => {
    const literacy = source("literacy-card", "ts");
    const soundObject = source("sound-object-card", "ts");
    const silhouette = source("silhouette-choice-card", "ts");
    const listening = source("listening-comprehension-card", "ts");
    const matching = source("matching-card", "ts");
    const classification = source("classification-card", "ts");

    expect(literacy).toMatch(
      /changeVariant\([\s\S]*animating:\s*false[\s\S]*tracing:\s*false[\s\S]*mistakes:\s*0[\s\S]*completed:\s*false/,
    );
    expect(soundObject).toContain("Math.ceil(distance / step)");
    expect(soundObject).toContain(
      "rawTouch.clientX ?? rawTouch.pageX ?? rawTouch.x",
    );
    expect(silhouette).toMatch(
      /choose\([\s\S]*state\.phase !== "idle"[\s\S]*return;/,
    );
    expect(listening).toContain("const resumeAt");
    expect(listening).toContain("audio.seek(resumeAt)");
    expect(listening).toContain('state.phase === "completed"');
    expect(listening).toContain("transcriptDefaultExpanded");
    expect(listening).toContain("mediaCoordinator.isActive(interactionAudio)");
    expect(matching).toContain(
      "rawTouch.clientX ?? rawTouch.pageX ?? rawTouch.x",
    );
    expect(classification).toContain(
      "rawTouch.clientX ?? rawTouch.pageX ?? rawTouch.x",
    );
    expect(classification).toMatch(
      /if \(!allAssigned\)[\s\S]*hasChecked:\s*false/,
    );
  });

  it("recognition defaults to the H5 Chinese language and story disables read-only seeking", () => {
    const recognition = source("recognition-pic-card", "ts");
    const recognitionTemplate = source("recognition-pic-card", "wxml");
    const recognitionStyles = source("recognition-pic-card", "wxss");
    const story = source("story-card", "wxml");
    expect(recognition).toContain(
      'languages.find((item: Language) => item.value === "zh")',
    );
    expect(recognition).toContain(
      "const nextIndex = (state.activeLanguageIndex + 1) % state.languages.length",
    );
    expect(recognitionTemplate).toContain('catchtap="switchLanguage"');
    expect(recognitionTemplate).toContain("currentLanguageLabel");
    expect(recognitionTemplate).toContain("nextLanguageLabel");
    expect(recognitionTemplate).not.toContain("language-menu");
    expect(recognitionStyles).toContain(".language-box-current");
    expect(recognitionStyles).toContain(".language-box-next");
    expect(story).toMatch(/<slider[\s\S]*disabled="\{\{readOnly\}\}"/);
  });

  it("literacy keeps native Hanzi interaction and aligned animated conversation sheet", () => {
    const logic = source("literacy-card", "ts");
    const template = source("literacy-card", "wxml");
    const styles = source("literacy-card", "wxss");
    expect(template.match(/<hanzi-canvas/g)).toHaveLength(2);
    expect(template).toContain('stroke-color="#529917"');
    expect(template).toContain(
      'wx:if="{{!tracing && !conversationVisible}}"',
    );
    expect(template).toContain(
      'is-visible="{{isVisible && !tracing && !conversationVisible}}"',
    );
    expect(template).toContain("writer-fallback");
    expect(template).toContain("phrase-aligned");
    expect(logic).toContain("buildConversationLines");
    expect(logic).toContain("buildPhraseSegments");
    expect(logic).toMatch(
      /animate\(\)[\s\S]*state\.tracing[\s\S]*state\.conversationVisible/,
    );
    expect(logic).toMatch(
      /openTrace\(\)[\s\S]*selectComponent\("#mainWriter"\)[\s\S]*animating:\s*false/,
    );
    expect(logic).toMatch(
      /openConversation\(\)[\s\S]*selectComponent\("#mainWriter"\)[\s\S]*tracing:\s*false[\s\S]*animating:\s*false/,
    );
    expect(template).toContain("conversation-aligned");
    expect(styles).toMatch(/\.preview-character-grid\s*\{[^}]*width:52%/s);
    expect(styles).toMatch(/\.preview-character-grid\s*\{[^}]*max-width:194px/s);
    expect(styles).not.toContain("min-width:130px");
    expect(template).toContain('style="{{previewGridStyle}}"');
    expect(styles).toMatch(/\.side-tool\s*\{[^}]*align-self:flex-end/s);
    expect(styles).toMatch(/\.side-tool\s*\{[^}]*white-space:nowrap/s);
    expect(styles).toMatch(/\.conversation-panel\s*\{[^}]*overflow:visible/s);
    expect(styles).toMatch(/\.conversation-avatar\s*\{[^}]*border-radius:50%/s);
    expect(styles).toContain("@keyframes conversation-up");
    expect(styles).toContain("@keyframes conversation-down");
  });

  it("hanzi canvas supports mini program touch coordinates and readable trace strokes", () => {
    const logic = readFileSync(resolve(ROOT, "hanzi-canvas", "index.ts"), "utf8");
    const vendor = readFileSync(resolve(ROOT, "..", "..", "vendor", "hanzi-writer.js"), "utf8");
    expect(logic).toContain("touch.x");
    expect(logic).toContain("touch.pageX");
    expect(logic).toContain("drawingWidth: (this.data as any).quiz ? 40 : 7");
    expect(logic).toContain("_pendingAnimation");
    expect(logic).toContain('this.triggerEvent("error"');
    expect(vendor).not.toMatch(/(^|[^.])\bperformance\.now\(\)/m);
  });

  it("flip container fits 9:16 in both available dimensions and swaps real faces", () => {
    const root = resolve(ROOT, "..", "FlipCardContainer");
    const logic = readFileSync(resolve(root, "index.ts"), "utf8");
    const template = readFileSync(resolve(root, "index.wxml"), "utf8");
    const styles = readFileSync(resolve(root, "index.wxss"), "utf8");
    const cardStyles = readFileSync(resolve(ROOT, "..", "styles", "card.wxss"), "utf8");
    expect(logic).toContain("Math.min(rect.width, rect.height * 9 / 16)");
    expect(logic).toContain('fillContainer: { type: Boolean, value: false }');
    expect(logic).toContain('aspectStyle: "width:100%;height:100%;"');
    expect(logic).toContain('displaySide: isFlipped ? "back" : "front"');
    expect(template).toContain("displaySide === 'front'");
    expect(template).toContain("displaySide === 'back'");
    expect(styles).toContain(".flip-stage.flip-out");
    expect(styles).toContain("@keyframes flip-in");
    expect(template).toContain("preview ? 'preview-mode' : ''");
    expect(styles).toContain("--qcard-inner-radius: 0rpx");
    expect(styles).toMatch(
      /\.preview-mode \.flip-shell,[\s\S]*\.preview-mode \.unsupported\s*\{[^}]*border-radius:0/,
    );
    expect(cardStyles).toContain("var(--qcard-inner-radius, 34rpx)");
    expect(styles).not.toContain(".flip-stage.is-flipped");
  });

  it("recognition previews actions and crossfades background/action video without a global loader", () => {
    const logic = source("recognition-pic-card", "ts");
    const template = source("recognition-pic-card", "wxml");
    const styles = source("recognition-pic-card", "wxss");
    expect(template).toContain('mode="aspectFill"');
    expect(template).toContain("jingle-subtitle");
    expect(template).toContain("item.jingle.text");
    expect(template).toContain('wx:if="{{item.actionVideos.length}}"');
    expect(template).not.toContain(
      'wx:if="{{item.actionVideos.length && !preview}}"',
    );
    expect(template).not.toContain("video-loading");
    expect(template).toContain("action-loading-spinner");
    expect(template).toContain("videoVisible ? 'video-visible' : ''");
    expect(template).toContain("videoVisible ? 'visible' : ''");
    expect(template).toContain('object-fit="cover"');
    expect(template).toContain('bindplay="videoReady"');
    expect(template).toContain('bindtimeupdate="videoProgress"');
    expect(logic).toContain("const VIDEO_CROSSFADE_MS = 400");
    expect(logic).toContain("loadActionVideo(");
    expect(logic).toContain("fadeOutVideo()");
    expect(logic).toMatch(
      /videoReady\(\)[\s\S]*videoLoading:\s*false[\s\S]*videoVisible:\s*true/,
    );
    expect(logic).toMatch(
      /videoProgress\([\s\S]*currentTime[\s\S]*videoLoading:\s*false[\s\S]*videoVisible:\s*true/,
    );
    expect(logic).toMatch(
      /fadeOutVideo\(\)[\s\S]*videoVisible:\s*false[\s\S]*VIDEO_CROSSFADE_MS/,
    );
    expect(styles).toContain("top: 6%");
    expect(styles).toContain(".jingle-subtitle.with-actions");
    expect(styles).toMatch(
      /\.main-image\s*\{[^}]*transition:\s*opacity \.4s linear/s,
    );
    expect(styles).toMatch(
      /\.action-video-layer\s*\{[^}]*opacity:\s*0[^}]*transition:\s*opacity \.4s linear/s,
    );
    expect(styles).toMatch(
      /\.preview \.action-button\s*\{[^}]*width:\s*36px[^}]*height:\s*36px/s,
    );
    expect(styles).toContain("@keyframes action-loading-spin");
  });

  it("story preview preserves the source image ratio while full mode remains cover", () => {
    const logic = source("story-card", "ts");
    const template = source("story-card", "wxml");
    const styles = source("story-card", "wxss");
    expect(template).toMatch(/class="scene preview-scene"[\s\S]*mode="widthFix"/);
    expect(template).toMatch(/class="scene"[\s\S]*mode="aspectFill"/);
    expect(template).toContain("!previewLayoutReady");
    expect(template).toContain('wx:for="{{previewRoles}}"');
    expect(template).toContain('wx:if="{{hasPreviewRoles}}"');
    expect(template).toContain("preview-avatar-frame");
    expect(template).toContain("preview-dialogue-avatar");
    expect(template).toContain("preview-scene-skeleton");
    expect(template).not.toContain('class="preview-placeholder"');
    expect(template).not.toContain("<text>{{item.name}}</text>");
    expect(logic).toContain("wx.getImageInfo");
    expect(logic).toContain("normalizeStoryRoles");
    expect(styles).toMatch(/\.preview-scene\s*\{[^}]*height:auto/s);
    expect(styles).toMatch(/\.preview-scene\s*\{[^}]*aspect-ratio:auto/s);
    expect(styles).toMatch(/\.dialogue\s*\{[^}]*align-items:flex-start/s);
    expect(styles).toMatch(/\.preview-roles-inner\s*\{[^}]*flex-wrap:\s*nowrap/s);
    expect(styles).toMatch(/\.preview-body\s*\{[^}]*min-height:\s*116px/s);
    expect(styles).toMatch(/\.preview-roles\s*\{[^}]*flex:\s*0 0 38px/s);
    expect(template).toContain('scroll-top="{{dialogueScrollTop}}"');
    expect(template).not.toContain("scroll-into-view");
    expect(logic).toContain("centerParagraph(");
    expect(logic).toContain("(viewport.height - paragraph.height) / 2");
  });

  it("sound-object renders interactive controls in a dedicated Canvas 2D surface", () => {
    const logic = source("sound-object-card", "ts");
    const template = source("sound-object-card", "wxml");
    const styles = source("sound-object-card", "wxss");
    expect(template).toContain('id="controlCanvas"');
    expect(template).toContain('catchtouchstart="surfaceTouchStart"');
    expect(logic).toContain("drawControlOverlay()");
    expect(logic).toContain("isAudioControlPoint");
    expect(logic).toContain('ctx.strokeStyle = "rgba(255,255,255,.28)"');
    expect(logic).toContain('ctx.strokeStyle = "#ffffff"');
    expect(logic).toContain("state.audioProgressDeg");
    expect(logic).toContain("animateCoatingAway");
    expect(logic).toContain("REVEAL_DURATION = 360");
    expect(logic).toContain("this.setData({ coatingMounted: false }");
    expect(logic).toContain("this.animateCoatingAway(() => this.playScienceAudio())");
    expect(template.match(/wx:if="\{\{coatingMounted\}\}"/g)).toHaveLength(2);
    expect(styles).toMatch(/\.scratch-stage\s*\{[^}]*z-index:\s*1/s);
    expect(styles).toMatch(/\.control-canvas\s*\{[^}]*z-index:\s*9/s);
  });

  it("listening renders conic playback progress and offsets question copy above the bubble tail", () => {
    const logic = source("listening-comprehension-card", "ts");
    const template = source("listening-comprehension-card", "wxml");
    const styles = source("listening-comprehension-card", "wxss");
    expect(logic).toContain("progressDeg: progress * 3.6");
    expect(logic).toContain("progressDeg: 360");
    expect(template).toContain("conic-gradient({{primary}} {{progressDeg}}deg");
    expect(styles).toMatch(/\.glass-play\s*\{[^}]*border:\s*0/s);
    expect(styles).toMatch(/\.question-bubble-body\s*\{[^}]*inset:0 0 54rpx/s);
  });

  it("silhouette keeps its science icon still while the outer border tracks playback", () => {
    const logic = source("silhouette-choice-card", "ts");
    const template = source("silhouette-choice-card", "wxml");
    const styles = source("silhouette-choice-card", "wxss");
    expect(logic).toContain("(audio.currentTime / duration) * 360");
    expect(template).toContain(
      "conic-gradient(#ffffff {{audioProgressDeg}}deg,rgba(255,255,255,.28) 0)",
    );
    expect(template).toContain('class="mini-audio-button"');
    expect(styles).not.toContain("science-spin");
    expect(styles).not.toContain(".mini-audio-button.playing");
  });

  it("puzzle supports both modes, H5-aligned intro/completion sequences, and replay", () => {
    const logic = source("puzzle-card", "ts");
    const template = source("puzzle-card", "wxml");
    const styles = source("puzzle-card", "wxss");
    expect(logic).toContain('type PuzzleMode = "shuffle" | "fill"');
    expect(logic).toContain("const SPARE_FADE_MS = 800");
    expect(logic).toContain("const FILL_DROP_STAGGER_MS = 100");
    expect(logic).toContain("const FILL_DROP_DURATION_MS = 420");
    expect(logic).toContain("const INTRO_SCALE_MS = 400");
    expect(logic).toContain("const INTRO_BLUR_MS = 350");
    expect(logic).toContain("const CELEBRATION_MERGE_HOLD_MS = 220");
    expect(logic).toContain("const CELEBRATION_BLUR_MS = 450");
    expect(logic).toContain("const CELEBRATION_SCALE_MS = 500");
    expect(logic).toContain("const CELEBRATION_VIDEO_FADE_MS = 550");
    expect(logic).toContain("const CELEBRATION_RESET_MS = 380");
    expect(logic).toContain("Math.max(40, total * 5)");
    expect(logic).toContain("runShuffleStep()");
    expect(logic).toContain("runFillDropStep()");
    expect(logic).toContain("fillTouchStart(");
    expect(logic).toContain("drag.moved");
    expect(logic).toContain("slotFromPoint(");
    expect(logic).toContain("consumeIgnoredFillTap(");
    expect(logic).toContain('selectedTileIndex: source === "slot" ? -1 : state.selectedTileIndex');
    expect(logic).toContain("touch.clientX ?? touch.pageX ?? touch.x");
    expect(logic).toContain("placeSelected(");
    expect(logic).toContain("toggleOutline(");
    expect(logic).toContain("startCompletionMerge()");
    expect(logic).toContain("startCompletionZoom()");
    expect(logic).toContain("startCompletionCrossfade()");
    expect(logic).toContain("restartFromCelebration()");
    expect(logic).toContain('wx.createVideoContext("puzzleCelebrationVideo", this)');
    expect(logic).toMatch(
      /if \(shouldRestoreCorner\)[\s\S]*completedSlots\[state\.level \* state\.level - 1\]/,
    );
    expect(logic).toContain("this.playIntro()");
    expect(template).toContain('wx:if="{{preview}}"');
    expect(template).not.toContain('wx:if="{{preview || readOnly}}"');
    expect(template).toContain("preview-tile-image");
    expect(template).toContain("tile-image");
    expect(template).toContain("pool-tile-image");
    expect(template).toContain("wholeImageVisible");
    expect(template).toContain('wx:for="{{previewSlots}}"');
    expect(template).toContain("celebration-close");
    expect(template).toContain('id="puzzleCelebrationVideo"');
    expect(template).toContain('object-fit="cover"');
    expect(template).toContain('catchtap="restartFromCelebration"');
    expect(template).toContain("result-overlay");
    expect(template).toContain('catchtap="slotTap"');
    expect(template).toContain('bindtouchstart="fillTouchStart"');
    expect(template).not.toContain('catchtouchstart="fillTouchStart"');
    expect(template).toContain('wx:key="renderKey"');
    expect(template).toContain("spare-removing");
    expect(template).toContain("spare-restoring");
    expect(template).toContain("drop-to-pool");
    expect(template).toContain("dragging-source");
    expect(template).toContain("shuffle-hit-layer");
    expect(template).toContain("shuffle-hit-slot");
    expect(template).toContain("item.tileIndex === null ? 'missing' : ''");
    expect(template).toContain(
      "(mode !== 'shuffle' || !started || completed || wholeImageVisible)",
    );
    expect(template).toContain("hoveredSlotIndex === item.slotIndex");
    expect(template).toContain('wx:if="{{!started && !readOnly}}"');
    expect(template).toContain('wx:if="{{!started && showStartButton}}"');
    expect(template).toContain("拼图模式");
    expect(logic).toContain("cardRect.width - 16");
    expect(styles).toMatch(/\.outline-image\s*\{[^}]*opacity:\s*1/s);
    expect(styles).toMatch(/\.outline-image image\s*\{[^}]*filter:\s*grayscale\(1\) brightness\(0\)/s);
    expect(styles).toMatch(/\.slot\.outline-active\s*\{[^}]*background:\s*transparent/s);
    expect(styles).toMatch(
      /\.slot\.missing,[\s\S]*?\.slot\.missing\.outline-active\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;[^}]*backdrop-filter:\s*none;/s,
    );
    expect(styles).toMatch(
      /\.grid\.shuffle-playing\s*\{[^}]*background:\s*transparent;[^}]*backdrop-filter:\s*none;/s,
    );
    expect(styles).toContain("@keyframes spare-tile-out");
    expect(styles).toContain("@keyframes spare-tile-in");
    expect(styles).toContain("@keyframes tile-drop-to-pool");
    expect(styles).toContain("@keyframes pool-tile-land");
    expect(styles).toMatch(/\.tile\.dragging-source,[\s\S]*opacity:\s*0/s);
    expect(styles).toMatch(/\.shuffle-hit-layer\s*\{[^}]*z-index:\s*8/s);
    expect(styles).toMatch(/\.slot\.hovered\s*\{[^}]*box-shadow:/s);
    expect(styles).toMatch(
      /\.grid\s*\{[^}]*background:\s*rgba\(24,\s*42,\s*34,\s*\.42\)[^}]*backdrop-filter:\s*blur\(16px\)/s,
    );
    expect(styles).toMatch(
      /\.celebration-video-layer\s*\{[^}]*inset:\s*0[^}]*transition-property:\s*opacity/s,
    );
    expect(styles).toMatch(
      /\.celebration-video\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/s,
    );
    expect(styles).toMatch(
      /\.result-overlay\s*\{[^}]*inset:\s*0[^}]*backdrop-filter:\s*blur\(12px\)/s,
    );
  });

  it("normalizes the deployed story roles into four visible preview avatars", () => {
    const roles = normalizeStoryRoles([
      { id: 0, name: "旁白", avatar: "https://cdn.example.com/narrator.png" },
      { id: 1, name: "圆圆荷", avatar: "https://cdn.example.com/lotus.png" },
      { id: 2, name: "叮叮蜓", avatar: { url: "https://cdn.example.com/dragonfly.png" } },
      { id: 3, name: "呱呱蛙", avatar: "https://cdn.example.com/frog.png" },
      { id: 4, name: "朵朵", avatar: "https://cdn.example.com/girl.png" },
    ]);
    expect(previewStoryRoles(roles)).toEqual([
      expect.objectContaining({ id: 1, avatar: "https://cdn.example.com/lotus.png" }),
      expect.objectContaining({ id: 2, avatar: "https://cdn.example.com/dragonfly.png" }),
      expect.objectContaining({ id: 3, avatar: "https://cdn.example.com/frog.png" }),
      expect.objectContaining({ id: 4, avatar: "https://cdn.example.com/girl.png" }),
    ]);
  });

  it("accepts deployed puzzle data without level and matches H5 preview/full defaults", () => {
    const deployed = {
      content: {
        background: "https://cdn.example.com/background.png",
        object: "https://cdn.example.com/object.png",
        video: "https://cdn.example.com/result.mp4",
      },
    };
    expect(validateCardPayload("puzzle_card", deployed)).toEqual({
      valid: true,
      errors: [],
    });
    expect(normalizePuzzleCardData(deployed)).toEqual({
      objectUrl: deployed.content.object,
      backgroundUrl: deployed.content.background,
      videoUrl: deployed.content.video,
      previewLevel: 1,
      gameLevel: 3,
    });
  });

  it("answer cards render at most four reachable options", () => {
    const choice = validateCardPayload("choice_card", {
      backgroundImage: "https://cdn.example.com/background.jpg",
      question: { mode: "text", text: "请选择" },
      options: [
        { id: "1", text: "1", isCorrect: true },
        { id: "2", text: "2", isCorrect: false },
        { id: "3", text: "3", isCorrect: false },
        { id: "4", text: "4", isCorrect: false },
        { id: "5", text: "5", isCorrect: false },
      ],
    });
    expect(choice.valid).toBe(false);
    expect(choice.errors).toContain("options 最多支持四个选项");
  });

  it("classification rejects rules whose hidden buckets would make answers unreachable", () => {
    const result = validateCardPayload("classification_card", {
      backgroundImage: "https://cdn.example.com/background.jpg",
      items: [{ id: "apple", text: "苹果" }],
      rules: [{
        id: "rule",
        title: "分类",
        buckets: [
          { id: "a", title: "A" },
          { id: "b", title: "B" },
          { id: "c", title: "C" },
          { id: "d", title: "D" },
        ],
        answers: [{ itemId: "apple", bucketId: "d" }],
      }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("rules[0].buckets 最多支持三个分类桶");
  });
});
