import { describe, expect, it } from "vitest";
import { hmacSha1Base64 } from "../miniprogram/utils/hmacSha1";

describe("hmacSha1Base64", () => {
  it("matches the RFC 2202 HMAC-SHA1 vector", () => {
    expect(
      hmacSha1Base64(
        String.fromCharCode(...new Array(20).fill(0x0b)),
        "Hi There",
      ),
    ).toBe("thcxhlUFcmTii8C2+zeMjvFGvgA=");
  });

  it("matches the common text-key vector", () => {
    expect(
      hmacSha1Base64("Jefe", "what do ya want for nothing?"),
    ).toBe("7/zfauXrL6LSdBbV8YTfnCWafHk=");
  });
});
