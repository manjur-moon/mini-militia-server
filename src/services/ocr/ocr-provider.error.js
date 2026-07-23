export class OCRProviderError extends Error {
  constructor(message, { code = "OCR_PROVIDER_ERROR", retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = "OCRProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
