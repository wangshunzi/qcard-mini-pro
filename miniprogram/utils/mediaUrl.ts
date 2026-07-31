import { ENV } from "../config/env";

export function resolveApiMediaUrl(value: unknown): string {
  const source = String(value ?? "").trim();
  if (!source || /^(?:https?:|data:|wxfile:|blob:)/i.test(source)) return source;
  return `${ENV.apiBaseUrl}/${source.replace(/^\/+/, "")}`;
}

function looksLikeMediaPath(value: string) {
  return (
    /^(?:\/|uploads\/|static\/|public\/)/i.test(value) ||
    /\.(?:png|jpe?g|webp|gif|svg|mp3|wav|m4a|aac|mp4|webm|vtt|json)(?:[?#].*)?$/i.test(value)
  );
}

export function resolveCardDataMedia<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => resolveCardDataMedia(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveCardDataMedia(item),
      ]),
    ) as T;
  }
  if (typeof value === "string" && looksLikeMediaPath(value)) {
    return resolveApiMediaUrl(value) as T;
  }
  return value;
}
