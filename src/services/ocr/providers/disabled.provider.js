import { OCRProviderError } from "../ocr-provider.error.js";

export const disabledOCRProvider = Object.freeze({
  name: "disabled",
  version: "v1",
  async recognize() {
    throw new OCRProviderError(
      "OCR is not configured. Configure a provider or enter the match rows manually.",
      { code: "OCR_NOT_CONFIGURED", retryable: false },
    );
  },
});
