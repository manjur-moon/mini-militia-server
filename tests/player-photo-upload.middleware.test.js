import { describe, expect, it } from "vitest";
import { detectImageFormat } from "../src/middleware/player-photo-upload.middleware.js";

describe("player photo signature detection", () => {
  it("recognizes JPEG, PNG and WebP signatures", () => {
    expect(
      detectImageFormat(
        Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0]),
      ),
    ).toBe("jpg");
    expect(detectImageFormat(Buffer.from("89504e470d0a1a0a00000000", "hex"))).toBe(
      "png",
    );
    expect(detectImageFormat(Buffer.from("RIFF0000WEBP", "ascii"))).toBe("webp");
  });

  it("rejects spoofed or unsupported content", () => {
    expect(detectImageFormat(Buffer.from("this is not an image"))).toBeNull();
  });
});
