type Meta = Record<string, unknown>;

function write(
  level: "info" | "warn" | "error",
  message: string,
  meta?: Meta,
) {
  const payload = meta ? [message, meta] : [message];
  const realtime = wx.getRealtimeLogManager?.();
  if (level === "error") console.error(...payload);
  else if (level === "warn") console.warn(...payload);
  else console.info(...payload);
  if (level === "error") realtime?.error(...payload);
  else if (level === "warn") realtime?.warn(...payload);
  else realtime?.info(...payload);
}

export const logger = {
  info: (message: string, meta?: Meta) => write("info", message, meta),
  warn: (message: string, meta?: Meta) => write("warn", message, meta),
  error: (message: string, meta?: Meta) => write("error", message, meta),
};
