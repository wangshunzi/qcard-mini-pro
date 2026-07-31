export type MiniProgramEnvVersion = "develop" | "trial" | "release";

export interface RuntimeEnvironment {
  envVersion: MiniProgramEnvVersion;
  apiBaseUrl: string;
  virtualPaymentEnv: 0 | 1;
}

const API_BASE_URL = "https://www.kolka.cn";

export function resolveRuntimeEnvironment(
  envVersion: MiniProgramEnvVersion,
): RuntimeEnvironment {
  if (envVersion === "release") {
    return {
      envVersion,
      apiBaseUrl: API_BASE_URL,
      virtualPaymentEnv: 0,
    };
  }
  return {
    envVersion,
    apiBaseUrl: API_BASE_URL,
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
