import { env } from "../../config/env.js";
import { AppError } from "../../utils/app-error.js";
import { disabledOCRProvider } from "./providers/disabled.provider.js";
import { googleVisionProvider } from "./providers/google-vision.provider.js";
import { mockOCRProvider } from "./providers/mock.provider.js";

const providers = Object.freeze({
  "google-vision": googleVisionProvider,
  mock: mockOCRProvider,
  disabled: disabledOCRProvider,
});

export function getOCRProvider(name = env.OCR_PROVIDER) {
  const provider = providers[name];
  if (!provider) {
    throw new AppError({
      statusCode: 500,
      code: "OCR_PROVIDER_UNKNOWN",
      message: "The configured OCR provider is not supported.",
      isOperational: false,
    });
  }
  return provider;
}
