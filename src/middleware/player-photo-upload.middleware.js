import multer from "multer";
import { AppError } from "../utils/app-error.js";

const MAX_PLAYER_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PLAYER_PHOTO_BYTES,
    files: 1,
    fields: 0,
  },
  fileFilter: (_request, file, callback) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new AppError({
          statusCode: 400,
          code: "INVALID_FILE_TYPE",
          message: "Player photo must be a JPEG, PNG or WebP image.",
        }),
      );
      return;
    }
    callback(null, true);
  },
});

export const uploadPlayerPhoto = upload.single("image");

export function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (isJpeg) return "jpg";

  const pngSignature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") === pngSignature) return "png";

  const riff = buffer.subarray(0, 4).toString("ascii") === "RIFF";
  const webp = buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (riff && webp) return "webp";

  return null;
}

export function requireValidPlayerPhoto(request, _response, next) {
  if (!request.file) {
    next(
      new AppError({
        statusCode: 400,
        code: "PLAYER_PHOTO_REQUIRED",
        message: "Upload one image using the multipart field named image.",
      }),
    );
    return;
  }

  const detectedFormat = detectImageFormat(request.file.buffer);
  if (!detectedFormat) {
    next(
      new AppError({
        statusCode: 400,
        code: "INVALID_IMAGE_SIGNATURE",
        message: "The uploaded file content is not a supported image.",
      }),
    );
    return;
  }

  request.file.detectedFormat = detectedFormat;
  next();
}
