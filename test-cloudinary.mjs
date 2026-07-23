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

  try {
    await cloudinary.api.ping();

    process.stdout.write("Cloudinary connection successful.\n");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    process.stderr.write(`Cloudinary connection failed: ${message}\n`);
    process.exitCode = 1;
  }
}