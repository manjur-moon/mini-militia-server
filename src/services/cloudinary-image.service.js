import { randomUUID } from "node:crypto";
import { cloudinary } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

function ensureConfigured() {
  if (!env.cloudinaryConfigured) {
    throw new AppError({
      statusCode: 503,
      code: "IMAGE_STORAGE_NOT_CONFIGURED",
      message: "Image storage is not configured on the server.",
    });
  }
}

function storageError(message, cause) {
  return new AppError({
    statusCode: 502,
    code: "IMAGE_STORAGE_ERROR",
    message,
    cause,
  });
}

export const cloudinaryImageService = Object.freeze({
  async uploadPlayerPhoto({ buffer, playerId }) {
    ensureConfigured();

    const publicId = `${playerId.toLowerCase()}-${randomUUID()}`;

    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            folder: env.CLOUDINARY_PLAYER_FOLDER,
            public_id: publicId,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
          },
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error("Cloudinary returned an empty upload result."));
              return;
            }

            resolve(uploadResult);
          },
        );

        uploadStream.end(buffer);
      });

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (error) {
      throw storageError("Unable to upload the player photo.", error);
    }
  },

  async uploadMatchScreenshot({ buffer, matchCode }) {
    ensureConfigured();

    const publicId = `${matchCode.toLowerCase()}-${randomUUID()}`;

    try {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "image",
            folder: env.CLOUDINARY_MATCH_FOLDER,
            public_id: publicId,
            overwrite: false,
            unique_filename: false,
            use_filename: false,
            tags: ["mini-militia-match", "ocr-source"],
            context: {
              preserved_original: "true",
              match_code: matchCode,
            },
          },
          (error, uploadResult) => {
            if (error) {
              reject(error);
              return;
            }

            if (!uploadResult) {
              reject(new Error("Cloudinary returned an empty upload result."));
              return;
            }

            resolve(uploadResult);
          },
        );

        uploadStream.end(buffer);
      });

      return {
        publicId: result.public_id,
        secureUrl: result.secure_url,
        format: result.format,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      };
    } catch (error) {
      throw storageError("Unable to upload the match screenshot.", error);
    }
  },

  async deleteImage(publicId) {
    ensureConfigured();

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
      });

      if (!new Set(["ok", "not found"]).has(result.result)) {
        throw new Error(
          `Unexpected Cloudinary deletion result: ${result.result}`,
        );
      }

      return result;
    } catch (error) {
      throw storageError("Unable to remove the stored image.", error);
    }
  },
});