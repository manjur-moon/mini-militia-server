import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { OCRProviderError } from "../ocr-provider.error.js";

const REQUEST_TIMEOUT_MS = 30_000;

async function downloadImage(imageUrl) {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new OCRProviderError(
      "Unable to download the stored screenshot for OCR.",
      {
        code: "OCR_SOURCE_DOWNLOAD_FAILED",
        retryable: response.status >= 500,
      },
    );
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.startsWith("image/")) {
    throw new OCRProviderError(
      "The stored OCR source is not a valid image.",
      {
        code: "OCR_SOURCE_INVALID",
        retryable: false,
      },
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

async function prepareImage(imageBuffer) {
  return sharp(imageBuffer)
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export const tesseractProvider = Object.freeze({
  name: "tesseract",
  version: "v1",

  async recognize({ imageUrl }) {
    let worker;

    try {
      const downloadedImage = await downloadImage(imageUrl);
      const preparedImage = await prepareImage(downloadedImage);

      worker = await createWorker("eng");

      const result = await worker.recognize(preparedImage);

      const rawText = result.data.text?.trim() ?? "";
      const confidence = Number(result.data.confidence);

      return {
        rawText,

        averageConfidence: Number.isFinite(confidence)
          ? confidence / 100
          : null,

        providerJobId: null,

        rawResponse: {
          provider: "tesseract.js",
          confidence: Number.isFinite(confidence)
            ? confidence
            : null,
        },
      };
    } catch (error) {
      if (error instanceof OCRProviderError) {
        throw error;
      }

      const isTimeout =
        error?.name === "TimeoutError" ||
        error?.name === "AbortError";

      throw new OCRProviderError(
        isTimeout
          ? "Local OCR processing timed out."
          : "Local OCR processing failed.",
        {
          code: isTimeout
            ? "OCR_PROVIDER_TIMEOUT"
            : "TESSERACT_OCR_ERROR",

          retryable: isTimeout,
          cause: error,
        },
      );
    } finally {
      if (worker) {
        await worker.terminate().catch(() => undefined);
      }
    }
  },
});