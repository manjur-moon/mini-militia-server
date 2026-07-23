import { describe, expect, it } from "vitest";
import { calculateOCRCrop } from "../src/services/ocr/ocr-image-source.service.js";

describe("Mini Militia scoreboard crop", () => {
  it("crops the score panel from the provided 1824x832 screenshots", () => {
    expect(
      calculateOCRCrop(
        { width: 1824, height: 832 },
        { xRatio: 0.205, yRatio: 0.3, widthRatio: 0.32, heightRatio: 0.51 },
      ),
    ).toEqual({ x: 374, y: 250, width: 584, height: 424 });
  });

  it("keeps crop bounds inside the image", () => {
    const crop = calculateOCRCrop(
      { width: 1000, height: 500 },
      { xRatio: 0.8, yRatio: 0.8, widthRatio: 0.4, heightRatio: 0.4 },
    );

    expect(crop).toEqual({ x: 800, y: 400, width: 200, height: 100 });
  });
});
