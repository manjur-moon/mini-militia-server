/**
 * Better Auth owns these MongoDB collections through its official MongoDB adapter.
 * Application code must not create a second password/session system or write password
 * hashes directly. Better Auth IDs are treated as strings by application collections.
 */
export const BETTER_AUTH_COLLECTIONS = Object.freeze({
  user: {
    collection: "user",
    coreFields: [
      "id",
      "name",
      "email",
      "emailVerified",
      "image",
      "createdAt",
      "updatedAt",
    ],
    applicationAdditionalFields: ["role", "status", "linkedPlayerId"],
    futureAdminPluginFields: ["banned", "banReason", "banExpires"],
  },
  session: {
    collection: "session",
    fields: [
      "id",
      "userId",
      "token",
      "expiresAt",
      "ipAddress",
      "userAgent",
      "createdAt",
      "updatedAt",
      "impersonatedBy",
    ],
  },
  account: {
    collection: "account",
    fields: [
      "id",
      "userId",
      "accountId",
      "providerId",
      "accessToken",
      "refreshToken",
      "accessTokenExpiresAt",
      "refreshTokenExpiresAt",
      "scope",
      "idToken",
      "password",
      "createdAt",
      "updatedAt",
    ],
  },
  verification: {
    collection: "verification",
    fields: ["id", "identifier", "value", "expiresAt", "createdAt", "updatedAt"],
  },
});
