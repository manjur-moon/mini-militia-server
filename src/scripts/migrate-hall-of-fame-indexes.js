import mongoose from "mongoose";
import { env } from "../config/env.js";
import { HallOfFameRecord } from "../models/hall-of-fame-record.model.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  await HallOfFameRecord.syncIndexes();
  console.log("Hall of Fame indexes synchronized successfully.");
}

main()
  .catch((error) => {
    console.error("Hall of Fame index migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
