import { cloudinary } from "../../config/cloudinary.js";
import { env } from "../../config/env.js";
import { OCRProviderError } from "./ocr-provider.error.js";

function positiveInteger(value, fallback) {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

export function calculateOCRCrop(image, crop = env.ocrCrop) {
  const width = positiveInteger(image?.width, 1824);
  const height = positiveInteger(image?.height, 832);
  const x = Math.max(0, Math.round(width * crop.xRatio));
  const y = Math.max(0, Math.round(height * crop.yRatio));
  const cropWidth = Math.min(
    width - x,
    Math.max(1, Math.round(width * crop.widthRatio)),
  );
  const cropHeight = Math.min(
    height - y,
    Math.max(1, Math.round(height * crop.heightRatio)),
  );

  return { x, y, width: cropWidth, height: cropHeight };
}

export function buildOCRSourceUrl(image) {
  if (!image?.publicId) {
    throw new OCRProviderError("The stored screenshot has no Cloudinary public ID.", {
      code: "OCR_SOURCE_INVALID",
      retryable: false,
    });
  }

  const crop = calculateOCRCrop(image);
  return cloudinary.url(image.publicId, {
    secure: true,
    resource_type: "image",
    transformation: [
      {
        crop: "crop",
        gravity: "north_west",
        x: crop.x,
        y: crop.y,
        width: crop.width,
        height: crop.height,
      },
      { crop: "scale", width: env.OCR_UPSCALE_WIDTH },
      { fetch_format: "png", quality: "auto:best" },
    ],
  });
}
