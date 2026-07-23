import process from "node:process";
import { authDatabase, authMongoClient } from "../config/auth-database.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const requestedEmail = process.argv[2]?.trim().toLowerCase();

if (!requestedEmail) {
  process.stderr.write(
    "Usage: node ./src/scripts/promote-admin.js admin@minimilitia.com\n",
  );
  process.exit(1);
}

try {
  await authMongoClient.connect();

  const users = authDatabase.collection("user");
  const sessions = authDatabase.collection("session");

  const matchingUsers = await users
    .find({
      email: {
        $regex: `^${escapeRegex(requestedEmail)}$`,
        $options: "i",
      },
    })
    .toArray();

  if (matchingUsers.length === 0) {
    throw new Error(`No user found for ${requestedEmail}`);
  }

  const userDocumentIds = matchingUsers.map((user) => user._id);
  const sessionUserIds = matchingUsers
    .flatMap((user) => [
      user._id,
      String(user._id),
      user.id,
      user.id ? String(user.id) : null,
    ])
    .filter(Boolean);

  const updateResult = await users.updateMany(
    { _id: { $in: userDocumentIds } },
    {
      $set: {
        role: "admin",
        status: "active",
        updatedAt: new Date(),
      },
    },
  );

  const sessionResult = await sessions.deleteMany({
    userId: { $in: sessionUserIds },
  });

  const verifiedUsers = await users
    .find(
      { _id: { $in: userDocumentIds } },
      { projection: { email: 1, role: 1, status: 1 } },
    )
    .toArray();

  const failedVerification = verifiedUsers.some(
    (user) => user.role !== "admin" || user.status !== "active",
  );

  if (failedVerification) {
    throw new Error("Database verification failed after updating the role.");
  }

  process.stdout.write(
    [
      "ADMIN_ROLE_FIXED",
      `email=${requestedEmail}`,
      `matched=${updateResult.matchedCount}`,
      `modified=${updateResult.modifiedCount}`,
      `sessionsDeleted=${sessionResult.deletedCount}`,
      `verifiedRole=${verifiedUsers[0]?.role}`,
      `verifiedStatus=${verifiedUsers[0]?.status}`,
      "",
    ].join("\n"),
  );
} catch (error) {
  process.stderr.write(
    `ADMIN_ROLE_FIX_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
} finally {
  await authMongoClient.close();
}