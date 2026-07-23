import mongoose from "mongoose";
import { env } from "../config/env.js";
import { RivalryStatistics } from "../models/rivalry-statistics.model.js";

async function dropLegacyPairKeyIndex() {
  try {
    const indexes = await RivalryStatistics.collection.indexes();
    const legacy = indexes.find(
      (index) =>
        index.name === "pairKey_1" &&
        index.unique === true &&
        Object.keys(index.key).length === 1,
    );
    if (legacy) {
      await RivalryStatistics.collection.dropIndex(legacy.name);
      console.log(`Dropped legacy index rivalryStatistics.${legacy.name}`);
    }
  } catch (error) {
    if (error?.codeName !== "NamespaceNotFound") throw error;
  }
}

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  await dropLegacyPairKeyIndex();
  await RivalryStatistics.syncIndexes();
  console.log("Rivalry indexes synchronized successfully.");
}

main()
  .catch((error) => {
    console.error("Rivalry index migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
