import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Season } from "../models/season.model.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  await Season.syncIndexes();
  console.log("Season indexes synchronized successfully.");
}

main()
  .catch((error) => {
    console.error("Season index migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
