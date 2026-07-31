export type MiniProgramEnvVersion = "develop" | "trial" | "release";

export interface RuntimeEnvironment {
  name: "development" | "staging" | "production";
  envVersion: MiniProgramEnvVersion;
  apiBaseUrl: string;
  virtualPaymentEnv: 0 | 1;
}

const PRODUCTION_API_BASE_URL = "https://www.kolka.cn";
// Development and trial builds deliberately share an isolated backend. This
// host must be added to the Mini Program request-domain allowlist before
// sandbox testing; never point non-release builds at the production database.
const STAGING_API_BASE_URL = "https://staging.kolka.cn";

export function resolveRuntimeEnvironment(
  envVersion: MiniProgramEnvVersion,
): RuntimeEnvironment {
  if (envVersion === "release") {
    return {
      name: "production",
      envVersion,
      apiBaseUrl: PRODUCTION_API_BASE_URL,
      virtualPaymentEnv: 0,
    };
  }
  return {
    name: envVersion === "trial" ? "staging" : "development",
    envVersion,
    apiBaseUrl: STAGING_API_BASE_URL,
    virtualPaymentEnv: 1,
  };
}

function readEnvVersion(): MiniProgramEnvVersion {
  try {
    const value = wx.getAccountInfoSync().miniProgram.envVersion;
    if (value === "trial" || value === "release") return value;
  } catch {
    // Unit tests and very old base libraries do not expose account info.
  }
  return "develop";
}

const runtime = resolveRuntimeEnvironment(readEnvVersion());

export const ENV = {
  ...runtime,
  requestTimeoutMs: 8000,
  requestRetryCount: 2,
  requestRetryDelayMs: 500,
  appName: "kolka-miniprogram",
} as const;
