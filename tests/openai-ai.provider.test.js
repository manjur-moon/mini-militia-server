import { describe, expect, it, vi } from "vitest";
import { OpenAIAIProvider } from "../src/services/ai/openai-ai.provider.js";

function createProvider() {
  return new OpenAIAIProvider({
    apiKey: "test-key",
    model: "gpt-5.6-luna",
    timeoutMs: 1000,
    maxOutputTokens: 400,
  });
}

describe("OpenAIAIProvider", () => {
  it("uses the Responses API with strict JSON Schema output and storage disabled", async () => {
    const provider = createProvider();
    const create = vi.fn().mockResolvedValue({
      id: "resp_test",
      model: "gpt-5.6-luna",
      output_text: JSON.stringify({ headline: "Verified week" }),
      usage: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
    });
    provider.client = { responses: { create } };

    const schema = {
      type: "object",
      additionalProperties: false,
      required: ["headline"],
      properties: { headline: { type: "string" } },
    };
    const result = await provider.generate({
      instructions: "Use verified data only.",
      input: { verifiedMatches: 3 },
      schemaName: "weekly_summary",
      schema,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5.6-luna",
        store: false,
        max_output_tokens: 400,
        input: JSON.stringify({ verifiedMatches: 3 }),
        text: {
          format: expect.objectContaining({
            type: "json_schema",
            name: "weekly_summary",
            strict: true,
            schema,
          }),
        },
      }),
    );
    expect(result).toEqual({
      data: { headline: "Verified week" },
      providerRequestId: "resp_test",
      model: "gpt-5.6-luna",
      usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
    });
  });

  it("rejects malformed JSON as a validated provider error", async () => {
    const provider = createProvider();
    provider.client = {
      responses: {
        create: vi.fn().mockResolvedValue({ output_text: "not-json" }),
      },
    };

    await expect(
      provider.generate({
        instructions: "Test",
        input: {},
        schemaName: "test_schema",
        schema: { type: "object" },
      }),
    ).rejects.toMatchObject({ code: "AI_INVALID_JSON", retryable: true });
  });

  it("maps provider rate limits to a retryable application error", async () => {
    const provider = createProvider();
    provider.client = {
      responses: {
        create: vi.fn().mockRejectedValue({ status: 429 }),
      },
    };

    await expect(
      provider.generate({
        instructions: "Test",
        input: {},
        schemaName: "test_schema",
        schema: { type: "object" },
      }),
    ).rejects.toMatchObject({ code: "AI_RATE_LIMITED", retryable: true });
  });
});
