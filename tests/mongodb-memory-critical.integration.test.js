import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuditLog } from "../src/models/audit-log.model.js";
import { PlayerCounter } from "../src/models/player-counter.model.js";
import { Player } from "../src/models/player.model.js";
import { createPlayerService } from "../src/services/player.service.js";

const runDatabaseTests = process.env.RUN_MONGODB_MEMORY_TESTS === "true";

describe.skipIf(!runDatabaseTests)("MongoDB replica-set critical integration", () => {
  let replicaSet;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    await mongoose.connect(replicaSet.getUri(), { dbName: "mini_militia_phase_13" });
    await Promise.all([Player.init(), PlayerCounter.init(), AuditLog.init()]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet?.stop();
  });

  it("creates unique sequential player IDs under real concurrent MongoDB writes", async () => {
    const service = createPlayerService({
      PlayerModel: Player,
      PlayerCounterModel: PlayerCounter,
      AuditLogModel: AuditLog,
      imageService: {},
    });
    const actor = { id: "atlas-test-admin" };
    const requestMeta = {
      requestId: "mongodb-memory-player-counter",
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    };

    const players = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        service.createPlayer({
          actor,
          requestMeta,
          input: {
            name: `Concurrent Player ${index + 1}`,
            aliases: [],
            joinDate: "2026-07-20T00:00:00.000Z",
            status: "active",
          },
        }),
      ),
    );

    const IDs = players.map((player) => player.playerId);
    expect(new Set(IDs)).toHaveLength(25);
    expect(IDs.sort()).toEqual(
      Array.from(
        { length: 25 },
        (_, index) => `MM${String(index + 1).padStart(3, "0")}`,
      ),
    );
    expect(await Player.countDocuments()).toBe(25);
    expect(await AuditLog.countDocuments({ action: "player.created" })).toBe(25);
  });
});
