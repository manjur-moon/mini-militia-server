import OpenAI from "openai";
import { AIProviderError } from "./ai-provider.error.js";

function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  for (const item of response?.output ?? []) {
    if (item?.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        return part.text;
      }
    }
  }
  return "";
}

export class OpenAIAIProvider {
  constructor({ apiKey, model, timeoutMs = 20_000, maxOutputTokens = 1_200 }) {
    this.name = "openai";
    this.model = model;
    this.maxOutputTokens = maxOutputTokens;
    this.client = new OpenAI({ apiKey, timeout: timeoutMs, maxRetries: 1 });
  }

  async generate({ instructions, input, schemaName, schema }) {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        store: false,
        max_output_tokens: this.maxOutputTokens,
        instructions,
        input: JSON.stringify(input),
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            description: "Validated Mini Militia analytics narrative.",
            strict: true,
            schema,
          },
        },
      });
      const outputText = extractOutputText(response);
      if (!outputText) {
        throw new AIProviderError("The AI provider returned no text output.", {
          code: "AI_EMPTY_OUTPUT",
          retryable: true,
        });
      }
      let data;
      try {
        data = JSON.parse(outputText);
      } catch (error) {
        throw new AIProviderError("The AI provider returned invalid JSON.", {
          code: "AI_INVALID_JSON",
          cause: error,
          retryable: true,
        });
      }
      return {
        data,
        providerRequestId: response.id ?? null,
        model: response.model ?? this.model,
        usage: {
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      const status = Number(error?.status ?? error?.statusCode ?? 0);
      throw new AIProviderError("OpenAI generation failed.", {
        code: status === 429 ? "AI_RATE_LIMITED" : "AI_PROVIDER_REQUEST_FAILED",
        cause: error,
        retryable: status === 408 || status === 409 || status === 429 || status >= 500,
      });
    }
  }
}
