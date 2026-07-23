import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { detectImageFormat } from "./player-photo-upload.middleware.js";

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MATCH_SCREENSHOT_MAX_BYTES,
    files: 1,
    fields: 8,
  },
  fileFilter: (_request, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new AppError({
          statusCode: 400,
          code: "INVALID_SCREENSHOT_TYPE",
          message: "Match screenshot must be a JPEG, PNG or WebP image.",
        }),
      );
      return;
    }
    callback(null, true);
  },
});

export const uploadMatchScreenshot = upload.single("screenshot");

export function requireValidMatchScreenshot(request, _response, next) {
  if (!request.file) {
    next(
      new AppError({
        statusCode: 400,
        code: "MATCH_SCREENSHOT_REQUIRED",
        message: "Upload one image using the multipart field named screenshot.",
      }),
    );
    return;
  }

  const detectedFormat = detectImageFormat(request.file.buffer);
  if (!detectedFormat) {
    next(
      new AppError({
        statusCode: 400,
        code: "INVALID_SCREENSHOT_SIGNATURE",
        message: "The uploaded screenshot content is not a supported image.",
      }),
    );
    return;
  }

  request.file.detectedFormat = detectedFormat;
  next();
}
