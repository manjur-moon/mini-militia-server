import { describe, expect, it, vi } from "vitest";
import { createPlayerService } from "../src/services/player.service.js";

function clone(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(clone);
  if (value instanceof Date) return new Date(value);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => typeof item !== "function")
        .map(([key, item]) => [key, clone(item)]),
    );
  }
  return value;
}

function createDocument(value) {
  return {
    ...value,
    toObject() {
      return clone({ ...this, toObject: undefined });
    },
  };
}

function matches(document, filter) {
  if (filter._id && String(document._id) !== String(filter._id)) return false;
  if (filter.playerId && document.playerId !== filter.playerId) return false;
  if (filter.status && document.status !== filter.status) return false;
  if (
    filter.updatedAt &&
    +new Date(document.updatedAt) !== +new Date(filter.updatedAt)
  ) {
    return false;
  }
  if (
    filter["profileImage.publicId"] &&
    document.profileImage?.publicId !== filter["profileImage.publicId"]
  ) {
    return false;
  }
  if (filter.$or) {
    const matchesSearch = filter.$or.some((condition) => {
      const [field, expected] = Object.entries(condition)[0];
      const value =
        field === "aliases" ? (document.aliases ?? []).join(" ") : document[field];
      return expected instanceof RegExp
        ? expected.test(value ?? "")
        : value === expected;
    });
    if (!matchesSearch) return false;
  }
  return true;
}

class FakeQuery {
  constructor(values, single = false) {
    this.values = values;
    this.single = single;
    this.skipValue = 0;
    this.limitValue = Infinity;
    this.sortValue = null;
  }
  select() {
    return this;
  }
  sort(sort) {
    this.sortValue = sort;
    return this;
  }
  skip(value) {
    this.skipValue = value;
    return this;
  }
  limit(value) {
    this.limitValue = value;
    return this;
  }
  result() {
    if (this.single) return this.values ?? null;
    let values = [...this.values];
    if (this.sortValue) {
      const [field, direction] = Object.entries(this.sortValue)[0];
      values.sort(
        (left, right) =>
          String(left[field] ?? "").localeCompare(String(right[field] ?? "")) *
          direction,
      );
    }
    return values.slice(this.skipValue, this.skipValue + this.limitValue);
  }
  lean() {
    return Promise.resolve(clone(this.result()));
  }
  then(resolve, reject) {
    return Promise.resolve(this.result()).then(resolve, reject);
  }
}

function createFakes() {
  const players = [];
  const audits = [];
  let sequence = 0;

  const PlayerCounterModel = {
    findOneAndUpdate: vi.fn(async () => ({ sequence: ++sequence })),
  };

  const PlayerModel = {
    async create(input) {
      if (players.some((player) => player.playerId === input.playerId)) {
        const error = new Error("duplicate");
        error.code = 11000;
        error.keyPattern = { playerId: 1 };
        throw error;
      }
      const now = new Date();
      const document = createDocument({
        _id: String(players.length + 1),
        ...clone(input),
        profileImage: input.profileImage ?? null,
        aliases: input.aliases ?? [],
        createdAt: now,
        updatedAt: now,
      });
      players.push(document);
      return document;
    },
    find(filter) {
      return new FakeQuery(players.filter((player) => matches(player, filter)));
    },
    countDocuments: vi.fn(
      async (filter) => players.filter((player) => matches(player, filter)).length,
    ),
    findOne(filter) {
      return new FakeQuery(
        players.find((player) => matches(player, filter)) ?? null,
        true,
      );
    },
    async findOneAndUpdate(filter, update) {
      const player = players.find((item) => matches(item, filter));
      if (!player) return null;
      Object.assign(player, clone(update.$set ?? {}), { updatedAt: new Date() });
      return player;
    },
    async updateOne(filter, update) {
      const player = players.find((item) => matches(item, filter));
      if (player)
        Object.assign(player, clone(update.$set ?? {}), { updatedAt: new Date() });
      return { matchedCount: player ? 1 : 0 };
    },
  };

  const AuditLogModel = {
    create: vi.fn(async (audit) => {
      audits.push(clone(audit));
      return audit;
    }),
  };

  const PlayerStatisticsModel = {
    findOne: () => new FakeQuery(null, true),
  };

  const MatchResultModel = {
    find: () => new FakeQuery([]),
  };

  const MatchModel = {
    find: () => new FakeQuery([]),
  };

  const imageService = {
    uploadPlayerPhoto: vi.fn(async () => ({
      publicId: "players/mm001-photo",
      secureUrl: "https://example.com/mm001.webp",
      format: "webp",
      width: 400,
      height: 400,
      bytes: 1200,
    })),
    deleteImage: vi.fn(async () => ({ result: "ok" })),
  };

  return {
    players,
    audits,
    imageService,
    service: createPlayerService({
      PlayerModel,
      PlayerCounterModel,
      PlayerStatisticsModel,
      MatchResultModel,
      MatchModel,
      AuditLogModel,
      imageService,
    }),
  };
}

const actor = { id: "admin-user-id" };
const requestMeta = {
  requestId: "request-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

function input(name, status = "active") {
  return {
    name,
    aliases: [`${name} alias`],
    joinDate: "2026-07-01T00:00:00.000Z",
    status,
  };
}

describe("player service", () => {
  it("generates unique sequential player IDs during concurrent creation", async () => {
    const { service, audits } = createFakes();
    const created = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        service.createPlayer({
          actor,
          input: input(`Player ${index + 1}`),
          requestMeta,
        }),
      ),
    );

    expect(created.map((player) => player.playerId).sort()).toEqual([
      "MM001",
      "MM002",
      "MM003",
      "MM004",
      "MM005",
      "MM006",
      "MM007",
      "MM008",
    ]);
    expect(audits.filter((audit) => audit.action === "player.created")).toHaveLength(8);
  });

  it("supports search, status filtering and pagination", async () => {
    const { service } = createFakes();
    await service.createPlayer({ actor, input: input("Alpha Soldier"), requestMeta });
    await service.createPlayer({
      actor,
      input: input("Bravo Soldier", "inactive"),
      requestMeta,
    });

    const result = await service.listPlayers({
      page: 1,
      limit: 10,
      search: "alpha",
      status: "active",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(result.players).toHaveLength(1);
    expect(result.players[0].name).toBe("Alpha Soldier");
    expect(result.pagination.totalItems).toBe(1);
  });

  it("deactivates without deleting the player", async () => {
    const { service, players, audits } = createFakes();
    const created = await service.createPlayer({
      actor,
      input: input("Status Player"),
      requestMeta,
    });
    const updated = await service.updateStatus({
      actor,
      playerId: created.playerId,
      status: "inactive",
      reason: "Temporary league suspension",
      requestMeta,
    });

    expect(updated.status).toBe("inactive");
    expect(players).toHaveLength(1);
    expect(audits.some((audit) => audit.action === "player.status_changed")).toBe(true);
  });

  it("uploads profile image metadata and stores a checksum", async () => {
    const { service, imageService } = createFakes();
    const created = await service.createPlayer({
      actor,
      input: input("Photo Player"),
      requestMeta,
    });
    const updated = await service.uploadPhoto({
      actor,
      playerId: created.playerId,
      file: { buffer: Buffer.from("valid-image-test-buffer") },
      requestMeta,
    });

    expect(updated.profileImage.publicId).toBe("players/mm001-photo");
    expect(updated.profileImage.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(imageService.uploadPlayerPhoto).toHaveBeenCalledOnce();
  });

  it("returns a public profile without private ownership fields", async () => {
    const { service, players } = createFakes();
    const created = await service.createPlayer({
      actor,
      input: input("Public Player"),
      requestMeta,
    });
    players[0].linkedUserId = "private-user-id";

    const profile = await service.getPublicProfile(created.playerId);
    expect(profile.player.linkedUserId).toBeUndefined();
    expect(profile.player.createdBy).toBeUndefined();
    expect(profile.statistics).toBeNull();
  });
});
