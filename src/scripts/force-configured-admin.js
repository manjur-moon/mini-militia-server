import { authDatabase } from "../config/auth-database.js";
import {
  connectToDatabase,
  disconnectFromDatabase,
} from "../config/database.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function forceConfiguredAdmin() {
  const configuredEmail = process.env.INITIAL_ADMIN_EMAIL?.trim();

  if (!configuredEmail) {
    throw new Error("INITIAL_ADMIN_EMAIL is missing from server/.env.");
  }

  await connectToDatabase();

  const users = authDatabase.collection("user");
  const sessions = authDatabase.collection("session");
  const audits = authDatabase.collection("auditLogs");
  const emailFilter = {
    email: {
      $regex: `^${escapeRegex(configuredEmail)}$`,
      $options: "i",
    },
  };

  const matchingUsers = await users.find(emailFilter).toArray();

  if (matchingUsers.length === 0) {
    throw new Error(`No Better Auth user was found for ${configuredEmail}.`);
  }

  const now = new Date();
  const userObjectIds = matchingUsers.map((user) => user._id);
  const sessionUserIds = matchingUsers
    .flatMap((user) => [
      user._id,
      String(user._id),
      user.id,
      user.id ? String(user.id) : null,
    ])
    .filter(Boolean);

  const updateResult = await users.updateMany(
    { _id: { $in: userObjectIds } },
    {
      $set: {
        role: "admin",
        status: "active",
        updatedAt: now,
      },
    },
  );

  await sessions.deleteMany({ userId: { $in: sessionUserIds } });

  await audits.insertMany(
    matchingUsers.map((user) => ({
      actorUserId: "system:force-configured-admin",
      action: "user.role_changed",
      entityType: "user",
      entityId: String(user._id ?? user.id),
      previousValue: {
        role: user.role ?? "player",
        status: user.status ?? "active",
      },
      newValue: { role: "admin", status: "active" },
      reason: "Configured administrator role repair",
      ipAddress: null,
      userAgent: null,
      requestId: null,
      createdAt: now,
    })),
  );

  console.log(
    `Admin role applied to ${updateResult.modifiedCount} account(s) matching ${configuredEmail}.`,
  );
  console.table(
    matchingUsers.map((user) => ({
      id: String(user._id ?? user.id),
      email: user.email,
      previousRole: user.role ?? "player",
      newRole: "admin",
    })),
  );
}

forceConfiguredAdmin()
  .catch((error) => {
    console.error("Admin role repair failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });