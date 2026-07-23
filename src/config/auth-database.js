import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const authMongoClient = new MongoClient(env.MONGODB_URI, {
  maxPoolSize: 10,
  minPoolSize: env.isProduction ? 1 : 0,
  serverSelectionTimeoutMS: 10_000,
});

export const authDatabase = authMongoClient.db(env.MONGODB_DB_NAME);
