import { AIProviderError } from "./ai-provider.error.js";

export class DisabledAIProvider {
  constructor() {
    this.name = "disabled";
    this.model = null;
  }

  async generate() {
    throw new AIProviderError("External AI generation is not configured.", {
      code: "AI_PROVIDER_DISABLED",
      retryable: false,
    });
  }
}
