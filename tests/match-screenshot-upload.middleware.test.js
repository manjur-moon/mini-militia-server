import { describe, expect, it } from "vitest";
import { requireValidMatchScreenshot } from "../src/middleware/match-screenshot-upload.middleware.js";

function invoke(request) {
  return new Promise((resolve) =>
    requireValidMatchScreenshot(request, {}, (error) => resolve(error)),
  );
}

describe("match screenshot validation", () => {
  it("accepts a supported image signature", async () => {
    const request = {
      file: { buffer: Buffer.from("89504e470d0a1a0a00000000", "hex") },
    };
    const error = await invoke(request);

    expect(error).toBeUndefined();
    expect(request.file.detectedFormat).toBe("png");
  });

  it("rejects spoofed image content", async () => {
    const error = await invoke({ file: { buffer: Buffer.from("not-an-image") } });
    expect(error).toMatchObject({
      code: "INVALID_SCREENSHOT_SIGNATURE",
      statusCode: 400,
    });
  });
});
