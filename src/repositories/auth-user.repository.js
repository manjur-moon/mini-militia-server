import { ObjectId } from "mongodb";
import { authDatabase } from "../config/auth-database.js";

const USER_COLLECTION = "user";
const SESSION_COLLECTION = "session";
const PLAYER_COLLECTION = "players";
const AUDIT_COLLECTION = "auditLogs";

const SAFE_USER_PROJECTION = Object.freeze({
  name: 1,
  email: 1,
  emailVerified: 1,
  image: 1,
  role: 1,
  status: 1,
  linkedPlayerId: 1,
  createdAt: 1,
  updatedAt: 1,
});

function buildIdCandidates(id) {
  const values = [id];
  if (ObjectId.isValid(id)) values.push(new ObjectId(id));
  return values;
}

export function createUserIdFilter(userId) {
  const candidates = buildIdCandidates(userId);
  return {
    $or: [{ _id: { $in: candidates } }, { id: { $in: candidates } }],
  };
}

export function serializeAuthUser(document) {
  if (!document) return null;

  return {
    id: String(document._id ?? document.id),
    name: document.name,
    email: document.email,
    emailVerified: Boolean(document.emailVerified),
    image: document.image ?? null,
    role: document.role,
    status: document.status,
    linkedPlayerId: document.linkedPlayerId ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const authUserRepository = Object.freeze({
  users: () => authDatabase.collection(USER_COLLECTION),
  sessions: () => authDatabase.collection(SESSION_COLLECTION),
  players: () => authDatabase.collection(PLAYER_COLLECTION),
  audits: () => authDatabase.collection(AUDIT_COLLECTION),

  async findById(userId, { session } = {}) {
    return authDatabase
      .collection(USER_COLLECTION)
      .findOne(createUserIdFilter(userId), {
        projection: SAFE_USER_PROJECTION,
        session,
      });
  },

  async list({ filter, sort, skip, limit }) {
    const collection = authDatabase.collection(USER_COLLECTION);
    const [documents, totalItems] = await Promise.all([
      collection
        .find(filter, { projection: SAFE_USER_PROJECTION })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return { documents, totalItems };
  },

  async countActiveAdminsExcluding(userId, { session } = {}) {
    return authDatabase.collection(USER_COLLECTION).countDocuments(
      {
        role: "admin",
        status: "active",
        $nor: [createUserIdFilter(userId)],
      },
      { session },
    );
  },

  async updateById(userId, update, { session } = {}) {
    return authDatabase
      .collection(USER_COLLECTION)
      .findOneAndUpdate(createUserIdFilter(userId), update, {
        projection: SAFE_USER_PROJECTION,
        returnDocument: "after",
        session,
      });
  },

  async revokeSessions(userId, { session } = {}) {
    const ids = buildIdCandidates(userId);
    return authDatabase
      .collection(SESSION_COLLECTION)
      .deleteMany({ userId: { $in: ids } }, { session });
  },
});
