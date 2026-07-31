declare module "hanzi-writer" {
  export interface HanziWriterOptions {
    width?: number;
    height?: number;
    padding?: number;
    renderer?: "svg" | "canvas";
    showOutline?: boolean;
    showCharacter?: boolean;
    strokeColor?: string;
    outlineColor?: string;
    drawingColor?: string;
    drawingWidth?: number;
    highlightColor?: string;
    strokeAnimationSpeed?: number;
    delayBetweenStrokes?: number;
    onLoadCharDataSuccess?: (data: unknown) => void;
    onLoadCharDataError?: (error?: Error | string) => void;
    charDataLoader?: (
      character: string,
      onLoad: (data: unknown) => void,
      onError: (error?: unknown) => void,
    ) => void | Promise<unknown>;
    rendererOverride?: {
      createRenderTarget?: (...args: unknown[]) => unknown;
    };
  }

  export default class HanziWriter {
    static create(
      target: unknown,
      character: string,
      options?: HanziWriterOptions,
    ): HanziWriter;
    animateCharacter(options?: { onComplete?: () => void }): Promise<unknown>;
    quiz(options?: {
      leniency?: number;
      showHintAfterMisses?: number | false;
      highlightOnComplete?: boolean;
      onMistake?: (data: unknown) => void;
      onCorrectStroke?: (data: unknown) => void;
      onComplete?: (data: unknown) => void;
    }): Promise<unknown> | void;
    cancelQuiz(): void;
    setCharacter(character: string): Promise<unknown>;
    pauseAnimation(): void;
    resumeAnimation(): void;
    hideCharacter(): Promise<unknown>;
    showCharacter(): Promise<unknown>;
  }
}
