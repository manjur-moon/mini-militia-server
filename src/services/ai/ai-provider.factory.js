import { env } from "../../config/env.js";
import { DisabledAIProvider } from "./disabled-ai.provider.js";
import { OpenAIAIProvider } from "./openai-ai.provider.js";

export function createAIProvider(configuration = env) {
  if (configuration.AI_PROVIDER === "openai" && configuration.OPENAI_API_KEY) {
    return new OpenAIAIProvider({
      apiKey: configuration.OPENAI_API_KEY,
      model: configuration.OPENAI_MODEL,
      timeoutMs: configuration.AI_REQUEST_TIMEOUT_MS,
      maxOutputTokens: configuration.AI_MAX_OUTPUT_TOKENS,
    });
  }
  return new DisabledAIProvider();
}
