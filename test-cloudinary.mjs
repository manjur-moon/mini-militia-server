import { inspect } from "node:util";
import "dotenv/config";
import process from "node:process";
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  process.stderr.write(
    "Cloudinary credentials are missing from server/.env\n",
  );

  process.exitCode = 1;
} else {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  const testImageBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQ3sAAAAASUVORK5CYII=",
    "base64",
  );

  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "mini-militia/test",
          public_id: `cloudinary-test-${Date.now()}`,
          overwrite: false,
        },
        (error, uploadResult) => {
          if (error) {
            reject(error);
            return;
          }

          if (!uploadResult) {
            reject(
              new Error("Cloudinary returned an empty upload result."),
            );
            return;
          }

          resolve(uploadResult);
        },
      );

      uploadStream.on("error", reject);
      uploadStream.end(testImageBuffer);
    });

    process.stdout.write("Cloudinary image upload successful.\n");
    process.stdout.write(`Public ID: ${result.public_id}\n`);
    process.stdout.write(`Image URL: ${result.secure_url}\n`);

    await cloudinary.uploader.destroy(result.public_id);

    process.stdout.write("Cloudinary test image deleted successfully.\n");
  } catch (error) {
  process.stderr.write("Cloudinary image upload failed.\n");

  process.stderr.write(
    `${inspect(error, {
      depth: 10,
      colors: false,
      compact: false,
    })}\n`,
  );

  process.exitCode = 1;
}
}