export class AIProviderError extends Error {
  constructor(
    message,
    { code = "AI_PROVIDER_ERROR", cause = null, retryable = false } = {},
  ) {
    super(message, { cause });
    this.name = "AIProviderError";
    this.code = code;
    this.retryable = retryable;
  }
}
