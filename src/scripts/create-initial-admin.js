import { z } from "zod";
import { auth } from "../config/auth.js";
import { authDatabase } from "../config/auth-database.js";
import { connectToDatabase, disconnectFromDatabase } from "../config/database.js";
import { logger } from "../config/logger.js";
import { createUserIdFilter } from "../repositories/auth-user.repository.js";

const bootstrapSchema = z.object({
  INITIAL_ADMIN_NAME: z.string().trim().min(2).max(80),
  INITIAL_ADMIN_EMAIL: z.email().transform((value) => value.trim().toLowerCase()),
  INITIAL_ADMIN_PASSWORD: z.string().min(12).max(128),
});

async function createInitialAdmin() {
  const variables = bootstrapSchema.parse(process.env);
  await connectToDatabase();

  const users = authDatabase.collection("user");
  let user = await users.findOne({ email: variables.INITIAL_ADMIN_EMAIL });

  if (!user) {
    const result = await auth.api.signUpEmail({
      body: {
        name: variables.INITIAL_ADMIN_NAME,
        email: variables.INITIAL_ADMIN_EMAIL,
        password: variables.INITIAL_ADMIN_PASSWORD,
      },
    });

    user = await users.findOne(createUserIdFilter(result.user.id));
  }

  if (!user) {
    throw new Error("Unable to create or locate the configured admin account.");
  }

  const userId = String(user._id ?? user.id);
  const now = new Date();
  const previousValue = {
    role: user.role ?? "player",
    status: user.status ?? "active",
  };

  const updateResult = await users.updateOne(createUserIdFilter(userId), {
    $set: {
      name: variables.INITIAL_ADMIN_NAME,
      role: "admin",
      status: "active",
      updatedAt: now,
    },
  });

  if (updateResult.matchedCount !== 1) {
    throw new Error("The configured admin account could not be updated.");
  }

  await authDatabase
    .collection("session")
    .deleteMany({ userId: { $in: [userId, user._id] } });

  if (previousValue.role !== "admin" || previousValue.status !== "active") {
    await authDatabase.collection("auditLogs").insertOne({
      actorUserId: "system:initial-admin-bootstrap",
      action: "user.role_changed",
      entityType: "user",
      entityId: userId,
      previousValue,
      newValue: { role: "admin", status: "active" },
      reason: "Initial admin bootstrap",
      ipAddress: null,
      userAgent: null,
      requestId: null,
      createdAt: now,
    });
  }

  logger.info("Configured admin account is ready. Sign in again to refresh the role.", {
    userId,
    email: variables.INITIAL_ADMIN_EMAIL,
  });
}

createInitialAdmin()
  .catch((error) => {
    logger.error("Initial admin bootstrap failed.", {
      error: error.message,
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
