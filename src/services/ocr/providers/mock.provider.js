import { env } from "../../../config/env.js";

export const mockOCRProvider = Object.freeze({
  name: "mock",
  version: "v1",
  async recognize() {
    return {
      rawText: env.OCR_MOCK_TEXT,
      averageConfidence: env.OCR_MOCK_TEXT ? 0.99 : 0,
      providerJobId: `mock-${Date.now()}`,
      rawResponse: { source: "OCR_MOCK_TEXT" },
    };
  },
});
