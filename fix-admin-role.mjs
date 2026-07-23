import { config } from "dotenv";
import process from "node:process";
import { MongoClient } from "mongodb";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = dirname(currentFilePath);

config({
  path: resolve(currentDirectory, ".env"),
});

const mongoUri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB_NAME;
const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();

if (!mongoUri) {
  throw new Error("MONGODB_URI is missing from server/.env");
}

if (!databaseName) {
  throw new Error("MONGODB_DB_NAME is missing from server/.env");
}

if (!adminEmail) {
  throw new Error("INITIAL_ADMIN_EMAIL is missing from server/.env");
}

const client = new MongoClient(mongoUri);

try {
  await client.connect();

  const database = client.db(databaseName);
  const userCollection = database.collection("user");
  const sessionCollection = database.collection("session");

  const user = await userCollection.findOne(
    { email: adminEmail },
    {
      collation: {
        locale: "en",
        strength: 2,
      },
    },
  );

  if (!user) {
    throw new Error(`No user found with email: ${adminEmail}`);
  }

  await userCollection.updateOne(
    { _id: user._id },
    {
      $set: {
        role: "admin",
        status: "active",
        updatedAt: new Date(),
      },
    },
  );

  const possibleUserIds = [
    user.id,
    user._id,
    String(user._id),
    user.id ? String(user.id) : null,
  ].filter(Boolean);

  await sessionCollection.deleteMany({
    userId: {
      $in: possibleUserIds,
    },
  });

  process.stdout.write(
    `Admin role successfully applied to ${adminEmail}. Please log in again.\n`,
  );
} catch (error) {
  process.stderr.write(
    `Failed to apply admin role: ${error instanceof Error ? error.message : String(error)}\n`,
  );

  process.exitCode = 1;
} finally {
  await client.close();
}