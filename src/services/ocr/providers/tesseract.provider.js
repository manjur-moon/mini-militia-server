import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { OCRProviderError } from "../ocr-provider.error.js";


const REQUEST_TIMEOUT_MS = 30_000;

async function downloadImage(imageUrl) {
  let response;

  try {
    response = await fetch(imageUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "image/*",
      },
    });
  } catch (error) {
    const timedOut =
      error?.name === "TimeoutError" ||
      error?.name === "AbortError";

    throw new OCRProviderError(
      timedOut
        ? "Downloading the OCR source image timed out."
        : "Unable to download the OCR source image.",
      {
        code: timedOut
          ? "OCR_SOURCE_DOWNLOAD_TIMEOUT"
          : "OCR_SOURCE_DOWNLOAD_FAILED",
        retryable: true,
        cause: error,
      },
    );
  }

  if (!response.ok) {
    throw new OCRProviderError(
      "Unable to download the stored screenshot for OCR.",
      {
        code: "OCR_SOURCE_DOWNLOAD_FAILED",
        retryable: response.status >= 500,
      },
    );
  }

  const contentType =
    response.headers.get("content-type") ?? "";

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
  try {
    return await sharp(imageBuffer)
      .grayscale()
      .normalize()
      .sharpen()
      .png()
      .toBuffer();
  } catch (error) {
    throw new OCRProviderError(
      "Unable to prepare the screenshot for local OCR.",
      {
        code: "OCR_IMAGE_PREPROCESSING_FAILED",
        retryable: false,
        cause: error,
      },
    );
  }
}

export const tesseractProvider = Object.freeze({
  name: "tesseract",
  version: "tesseract.js-v1",

  async recognize({ imageUrl }) {
    let worker;

    try {
      const downloadedImage = await downloadImage(imageUrl);
      const preparedImage = await prepareImage(downloadedImage);

      worker = await createWorker("eng");

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      });

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
          engine: "tesseract.js",
          confidence: Number.isFinite(confidence)
            ? confidence
            : null,
        },
      };
    } catch (error) {
      if (error instanceof OCRProviderError) {
        throw error;
      }

      const timedOut =
        error?.name === "TimeoutError" ||
        error?.name === "AbortError";

      throw new OCRProviderError(
        timedOut
          ? "Local OCR processing timed out."
          : "Local OCR processing failed.",
        {
          code: timedOut
            ? "OCR_PROVIDER_TIMEOUT"
            : "TESSERACT_OCR_ERROR",
          retryable: timedOut,
          cause: error,
        },
      );
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          // Worker cleanup failure must not hide the OCR result.
        }
      }
    }
  },
});