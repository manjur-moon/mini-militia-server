import { connectToDatabase, disconnectFromDatabase } from "../config/database.js";
import { Notification } from "../models/notification.model.js";

async function run() {
  try {
    await connectToDatabase();
    await Notification.collection.createIndexes([
      {
        key: { userId: 1, isRead: 1, createdAt: -1 },
        name: "userId_1_isRead_1_createdAt_-1",
      },
      {
        key: { userId: 1, type: 1, createdAt: -1 },
        name: "userId_1_type_1_createdAt_-1",
      },
      {
        key: { createdAt: -1, type: 1 },
        name: "createdAt_-1_type_1",
      },
      {
        key: { deduplicationKey: 1 },
        name: "deduplicationKey_1",
        unique: true,
        partialFilterExpression: { deduplicationKey: { $type: "string" } },
      },
    ]);
    console.log("Notification indexes are ready.");
  } finally {
    await disconnectFromDatabase();
  }
}

run().catch((error) => {
  console.error("Notification index migration failed.", error);
  process.exitCode = 1;
});
