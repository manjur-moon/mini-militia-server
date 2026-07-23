import { env } from "../../../config/env.js";
import { OCRProviderError } from "../ocr-provider.error.js";

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const REQUEST_TIMEOUT_MS = 25_000;

function collectConfidences(annotation) {
  const values = [];
  for (const page of annotation?.pages ?? []) {
    if (Number.isFinite(page.confidence)) values.push(page.confidence);
    for (const block of page.blocks ?? []) {
      if (Number.isFinite(block.confidence)) values.push(block.confidence);
      for (const paragraph of block.paragraphs ?? []) {
        if (Number.isFinite(paragraph.confidence)) values.push(paragraph.confidence);
        for (const word of paragraph.words ?? []) {
          if (Number.isFinite(word.confidence)) values.push(word.confidence);
        }
      }
    }
  }
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function downloadImage(imageUrl) {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: "image/*" },
  });
  if (!response.ok) {
    throw new OCRProviderError("Unable to download the stored screenshot for OCR.", {
      code: "OCR_SOURCE_DOWNLOAD_FAILED",
      retryable: response.status >= 500,
    });
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new OCRProviderError("The stored OCR source is not an image.", {
      code: "OCR_SOURCE_INVALID",
      retryable: false,
    });
  }
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

export const googleVisionProvider = Object.freeze({
  name: "google-vision",
  version: "v1",

  async recognize({ imageUrl }) {
    try {
      const content = await downloadImage(imageUrl);
      const response = await fetch(
        `${VISION_ENDPOINT}?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY)}`,
        {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            requests: [
              {
                image: { content },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                imageContext: {
                  textDetectionParams: { enableTextDetectionConfidenceScore: true },
                },
              },
            ],
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new OCRProviderError(
          payload?.error?.message ?? "Google Vision OCR request failed.",
          {
            code: payload?.error?.status ?? "GOOGLE_VISION_HTTP_ERROR",
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      const result = payload?.responses?.[0];
      if (result?.error) {
        throw new OCRProviderError(
          result.error.message ?? "Google Vision OCR failed.",
          {
            code: result.error.code
              ? `GOOGLE_VISION_${result.error.code}`
              : "GOOGLE_VISION_ERROR",
            retryable:
              Number(result.error.code) === 429 || Number(result.error.code) >= 500,
          },
        );
      }

      const annotation = result?.fullTextAnnotation;
      return {
        rawText: annotation?.text?.trim() ?? "",
        averageConfidence: collectConfidences(annotation),
        providerJobId: null,
        rawResponse: payload,
      };
    } catch (error) {
      if (error instanceof OCRProviderError) throw error;
      const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
      throw new OCRProviderError(
        timeout
          ? "Google Vision OCR request timed out."
          : "Google Vision OCR request failed.",
        {
          code: timeout ? "OCR_PROVIDER_TIMEOUT" : "OCR_PROVIDER_NETWORK_ERROR",
          retryable: true,
          cause: error,
        },
      );
    }
  },
});
