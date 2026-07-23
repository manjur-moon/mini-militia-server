import mongoose from "mongoose";
import { authMongoClient } from "./auth-database.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);
/*
 * Request filters are built server-side from Zod-validated primitive values.
 * Global sanitizeFilter breaks legitimate operators such as $in, $gte and $or.
 */
mongoose.set("sanitizeFilter", false);

export async function connectToDatabase() {
  mongoose.connection.on("connected", () => {
    logger.info("MongoDB application connection established.");
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB application connection closed.");
  });

  mongoose.connection.on("error", (error) => {
    logger.error("MongoDB application connection error.", {
      error: error.message,
    });
  });

  try {
    await Promise.all([
      mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        autoIndex: !env.isProduction,
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
        minPoolSize: env.isProduction ? 2 : 0,
      }),
      authMongoClient.connect(),
    ]);

    logger.info("MongoDB Better Auth connection established.");
  } catch (error) {
    await Promise.allSettled([mongoose.disconnect(), authMongoClient.close()]);
    throw error;
  }
}

export async function disconnectFromDatabase() {
  await Promise.allSettled([
    mongoose.connection.readyState !== 0 ? mongoose.disconnect() : Promise.resolve(),
    authMongoClient.close(),
  ]);
}
