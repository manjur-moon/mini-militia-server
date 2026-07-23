import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Achievement } from "../models/achievement.model.js";
import { PlayerAchievement } from "../models/player-achievement.model.js";

async function dropIndexIfPresent(collection, indexName) {
  try {
    const indexes = await collection.indexes();
    if (indexes.some((index) => index.name === indexName)) {
      await collection.dropIndex(indexName);
      console.log(`Dropped legacy index ${collection.collectionName}.${indexName}`);
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

  await dropIndexIfPresent(Achievement.collection, "code_1");
  await dropIndexIfPresent(PlayerAchievement.collection, "playerId_1_achievementId_1");

  await Achievement.syncIndexes();
  await PlayerAchievement.syncIndexes();
  console.log("Achievement indexes synchronized successfully.");
}

main()
  .catch((error) => {
    console.error("Achievement index migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
