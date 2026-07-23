import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Challenge } from "../models/challenge.model.js";
import { PlayerChallenge } from "../models/player-challenge.model.js";

async function main() {
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 10_000,
  });
  await Challenge.syncIndexes();
  await PlayerChallenge.syncIndexes();
  console.log("Challenge indexes synchronized successfully.");
}

main()
  .catch((error) => {
    console.error("Challenge index migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
