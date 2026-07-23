import mongoose from "mongoose";
import { createPaginationMeta } from "@mini-militia/shared";
import { AuditLog } from "../models/audit-log.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { MatchRevision } from "../models/match-revision.model.js";
import { Match } from "../models/match.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { CORE_STATISTICS_VERSION, statisticsService } from "./statistics.service.js";
import { achievementService } from "./achievement.service.js";
import { rivalryService } from "./rivalry.service.js";
import { challengeService } from "./challenge.service.js";
import { hallOfFameService } from "./hall-of-fame.service.js";
import { seasonService } from "./season.service.js";

function matchNotFound() {
  return new AppError({
    statusCode: 404,
    code: "MATCH_NOT_FOUND",
    message: "Match was not found.",
  });
}

function revisionNotFound() {
  return new AppError({
    statusCode: 404,
    code: "REVISION_NOT_FOUND",
    message: "Match correction revision was not found.",
  });
}

function auditMeta(actor, requestMeta) {
  return {
    actorUserId: actor.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
    requestId: requestMeta.requestId,
  };
}

function serialize(value) {
  const document = typeof value?.toObject === "function" ? value.toObject() : value;
  return {
    ...document,
    id: String(document._id),
    _id: undefined,
    matchId: String(document.matchId),
  };
}

export function validateCorrectionRows(rows, participantCount) {
  const playerIds = rows.map((row) => String(row.playerId));
  const resultIds = rows.map((row) => String(row.resultId));
  const placements = rows.map((row) => row.placement);
  if (
    new Set(playerIds).size !== rows.length ||
    new Set(resultIds).size !== rows.length ||
    new Set(placements).size !== rows.length
  ) {
    throw new AppError({
      statusCode: 422,
      code: "CORRECTION_INVALID",
      message:
        "Correction rows must contain unique result IDs, players and placements.",
    });
  }
  if (rows.length !== participantCount) {
    throw new AppError({
      statusCode: 422,
      code: "PARTICIPANT_COUNT_MISMATCH",
      message: "The corrected participant count must equal the result row count.",
    });
  }
  const expectedPlacements = Array.from(
    { length: participantCount },
    (_, index) => index + 1,
  );
  const orderedPlacements = [...placements].sort((left, right) => left - right);
  if (expectedPlacements.some((value, index) => value !== orderedPlacements[index])) {
    throw new AppError({
      statusCode: 422,
      code: "PLACEMENT_SEQUENCE_INVALID",
      message: "Placements must form a complete sequence from 1 to participant count.",
    });
  }
}

function matchSnapshot(match) {
  return {
    matchCode: match.matchCode,
    matchDate: match.matchDate,
    timezone: match.timezone,
    seasonId: match.seasonId ?? null,
    participantCount: match.participantCount,
    currentRevision: match.currentRevision,
  };
}

function officialResultSnapshot(result) {
  return {
    resultId: String(result._id),
    playerId: String(result.official.playerId),
    playerName: result.official.playerName,
    kills: result.official.kills,
    deaths: result.official.deaths,
    placement: result.official.placement,
  };
}

export function createMatchRevisionService({
  MatchModel = Match,
  MatchResultModel = MatchResult,
  MatchRevisionModel = MatchRevision,
  PlayerModel = Player,
  AuditLogModel = AuditLog,
  statsService = statisticsService,
  achievementEvaluator = achievementService,
  rivalryUpdater = rivalryService,
  challengeEvaluator = challengeService,
  hallOfFameUpdater = hallOfFameService,
  seasonManager = seasonService,
} = {}) {
  return Object.freeze({
    async list(matchId, query) {
      const exists = await MatchModel.exists({ _id: matchId });
      if (!exists) throw matchNotFound();
      const filter = { matchId };
      if (query.status) filter.status = query.status;
      const skip = (query.page - 1) * query.limit;
      const [items, totalItems] = await Promise.all([
        MatchRevisionModel.find(filter)
          .select({
            previousResultSnapshots: 0,
            proposedResultSnapshots: 0,
            previousMatchSnapshot: 0,
            proposedMatchSnapshot: 0,
          })
          .sort({ revisionNumber: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        MatchRevisionModel.countDocuments(filter),
      ]);
      return {
        items: items.map(serialize),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async get(matchId, revisionNumber) {
      const revision = await MatchRevisionModel.findOne({
        matchId,
        revisionNumber,
      }).lean();
      if (!revision) throw revisionNotFound();
      return serialize(revision);
    },

    async propose({ actor, matchId, input, requestMeta }) {
      const match = await MatchModel.findById(matchId).lean();
      if (!match) throw matchNotFound();
      if (match.status !== "verified") {
        throw new AppError({
          statusCode: 409,
          code: "MATCH_NOT_VERIFIED",
          message: "Only verified matches can use the controlled correction workflow.",
        });
      }
      if (match.currentRevision !== input.expectedRevision) {
        throw new AppError({
          statusCode: 409,
          code: "REVISION_CONFLICT",
          message: "The verified match changed. Refresh before proposing a correction.",
        });
      }
      const openRevision = await MatchRevisionModel.exists({
        matchId,
        status: "proposed",
      });
      if (openRevision) {
        throw new AppError({
          statusCode: 409,
          code: "OPEN_REVISION_EXISTS",
          message: "This match already has an open correction revision.",
        });
      }

      const currentResults = await MatchResultModel.find({
        matchId,
        status: "verified",
      })
        .sort({ "official.placement": 1 })
        .lean();
      const participantCount =
        input.matchChanges?.participantCount ?? match.participantCount;
      validateCorrectionRows(input.results, participantCount);
      const currentResultIds = new Set(currentResults.map((row) => String(row._id)));
      if (
        currentResults.length !== input.results.length ||
        input.results.some((row) => !currentResultIds.has(String(row.resultId)))
      ) {
        throw new AppError({
          statusCode: 422,
          code: "CORRECTION_RESULT_SET_INVALID",
          message:
            "Correction must provide every current verified result exactly once.",
        });
      }

      const playerIds = input.results.map((row) => row.playerId);
      const players = await PlayerModel.find({ _id: { $in: playerIds } })
        .select({ _id: 1, name: 1 })
        .lean();
      if (players.length !== new Set(playerIds.map(String)).size) {
        throw new AppError({
          statusCode: 422,
          code: "PLAYER_REFERENCE_INVALID",
          message: "One or more selected players do not exist.",
        });
      }
      const playerMap = new Map(players.map((player) => [String(player._id), player]));
      const latestRevision = await MatchRevisionModel.findOne({ matchId })
        .sort({ revisionNumber: -1 })
        .select({ revisionNumber: 1 })
        .lean();
      const proposedMatchDate = input.matchChanges?.matchDate
        ? new Date(input.matchChanges.matchDate)
        : match.matchDate;
      const requestedSeasonId =
        input.matchChanges?.seasonId !== undefined
          ? input.matchChanges.seasonId || null
          : match.seasonId;
      const assignedSeason = await seasonManager.resolveForMatch({
        matchDate: proposedMatchDate,
        requestedSeasonId,
      });
      const proposedMatchSnapshot = {
        ...matchSnapshot(match),
        matchDate: proposedMatchDate,
        timezone: input.matchChanges?.timezone ?? match.timezone,
        seasonId: assignedSeason?._id ?? null,
        participantCount,
      };
      const proposedResultSnapshots = input.results
        .map((row) => ({
          resultId: String(row.resultId),
          playerId: String(row.playerId),
          playerName: playerMap.get(String(row.playerId)).name,
          kills: row.kills,
          deaths: row.deaths,
          placement: row.placement,
        }))
        .sort((left, right) => left.placement - right.placement);

      const revision = await MatchRevisionModel.create({
        matchId: match._id,
        revisionNumber: (latestRevision?.revisionNumber ?? 0) + 1,
        status: "proposed",
        reason: input.reason,
        requestedBy: actor.id,
        requestedAt: new Date(),
        previousMatchSnapshot: matchSnapshot(match),
        previousResultSnapshots: currentResults.map(officialResultSnapshot),
        proposedMatchSnapshot,
        proposedResultSnapshots,
      });
      await AuditLogModel.create({
        ...auditMeta(actor, requestMeta),
        action: "match.correction_proposed",
        entityType: "matchRevision",
        entityId: String(revision._id),
        previousValue: revision.previousMatchSnapshot,
        newValue: revision.proposedMatchSnapshot,
        reason: input.reason,
      });
      return serialize(revision);
    },

    async approve({ actor, matchId, revisionNumber, input, requestMeta }) {
      const session = await mongoose.startSession();
      let affectedPlayerIds = [];
      let revisionId;
      let previousMatchDate = null;
      try {
        await session.withTransaction(async () => {
          const revision = await MatchRevisionModel.findOne({
            matchId,
            revisionNumber,
          }).session(session);
          if (!revision) throw revisionNotFound();
          if (revision.status !== "proposed") {
            throw new AppError({
              statusCode: 409,
              code: "REVISION_NOT_PENDING",
              message: "Only proposed revisions can be approved.",
            });
          }
          const match = await MatchModel.findById(matchId).session(session);
          if (!match) throw matchNotFound();
          previousMatchDate =
            revision.previousMatchSnapshot?.matchDate ?? match.matchDate;
          if (
            match.currentRevision !== input.expectedMatchRevision ||
            match.currentRevision !== revision.previousMatchSnapshot.currentRevision
          ) {
            throw new AppError({
              statusCode: 409,
              code: "MATCH_CHANGED",
              message: "The match changed after this correction was proposed.",
            });
          }

          const proposedRows = revision.proposedResultSnapshots;
          const assignedSeason = await seasonManager.resolveForMatch({
            matchDate: revision.proposedMatchSnapshot.matchDate,
            requestedSeasonId: revision.proposedMatchSnapshot.seasonId ?? null,
            session,
          });
          revision.proposedMatchSnapshot.seasonId = assignedSeason?._id ?? null;
          validateCorrectionRows(
            proposedRows,
            revision.proposedMatchSnapshot.participantCount,
          );
          const results = await MatchResultModel.find({
            matchId,
            status: "verified",
          }).session(session);
          const resultMap = new Map(
            results.map((result) => [String(result._id), result]),
          );
          if (results.length !== proposedRows.length) {
            throw new AppError({
              statusCode: 422,
              code: "CORRECTION_INVALID",
              message: "The verified result set no longer matches the proposal.",
            });
          }

          const oldPlayerIds = results.map((result) =>
            String(result.official.playerId),
          );
          const now = new Date();
          for (const proposed of proposedRows) {
            const result = resultMap.get(String(proposed.resultId));
            if (!result) {
              throw new AppError({
                statusCode: 422,
                code: "CORRECTION_INVALID",
                message: "A proposed result no longer exists.",
              });
            }
            result.official.playerId = proposed.playerId;
            result.official.playerName = proposed.playerName;
            result.official.kills = proposed.kills;
            result.official.deaths = proposed.deaths;
            result.official.placement = proposed.placement;
            result.official.lastCorrectedBy = actor.id;
            result.official.lastCorrectedAt = now;
            result.officialMatchDate = revision.proposedMatchSnapshot.matchDate;
            result.officialSeasonId = revision.proposedMatchSnapshot.seasonId ?? null;
            await result.save({ session });
          }

          match.matchDate = revision.proposedMatchSnapshot.matchDate;
          match.timezone = revision.proposedMatchSnapshot.timezone;
          match.seasonId = revision.proposedMatchSnapshot.seasonId ?? null;
          match.participantCount = revision.proposedMatchSnapshot.participantCount;
          match.currentRevision += 1;
          match.statisticsRecalculation = {
            status: "pending",
            calculationVersion: CORE_STATISTICS_VERSION,
            requestedAt: now,
            completedAt: null,
            errorCode: null,
          };
          await match.save({ session });

          revision.status = "approved";
          revision.reviewedBy = actor.id;
          revision.reviewedAt = now;
          revision.appliedAt = now;
          revision.recalculationJobKey = `match:${matchId}:revision:${match.currentRevision}`;
          await revision.save({ session });
          revisionId = String(revision._id);
          affectedPlayerIds = [
            ...new Set([
              ...oldPlayerIds,
              ...proposedRows.map((row) => String(row.playerId)),
            ]),
          ];
          await AuditLogModel.create(
            [
              {
                ...auditMeta(actor, requestMeta),
                action: "match.corrected",
                entityType: "match",
                entityId: String(match._id),
                previousValue: {
                  match: revision.previousMatchSnapshot,
                  results: revision.previousResultSnapshots,
                },
                newValue: {
                  match: revision.proposedMatchSnapshot,
                  results: revision.proposedResultSnapshots,
                },
                reason: input.approvalReason || revision.reason,
              },
            ],
            { session },
          );
        });
      } finally {
        await session.endSession();
      }

      let recalculation;
      try {
        recalculation = await statsService.recalculateForPlayerIds(affectedPlayerIds);
        await MatchModel.updateOne(
          { _id: matchId },
          {
            $set: {
              "statisticsRecalculation.status": "completed",
              "statisticsRecalculation.calculationVersion": CORE_STATISTICS_VERSION,
              "statisticsRecalculation.completedAt": new Date(),
              "statisticsRecalculation.errorCode": null,
            },
          },
        );
      } catch {
        recalculation = {
          updatedPlayers: 0,
          status: "failed",
          errorCode: "STATISTICS_RECALCULATION_FAILED",
        };
        await MatchModel.updateOne(
          { _id: matchId },
          {
            $set: {
              "statisticsRecalculation.status": "failed",
              "statisticsRecalculation.errorCode": "STATISTICS_RECALCULATION_FAILED",
            },
          },
        );
      }
      let achievementEvaluation = {
        status: "skipped",
        newlyUnlocked: 0,
      };
      if (recalculation.status !== "failed") {
        try {
          const result = await achievementEvaluator.evaluatePlayerIds(
            affectedPlayerIds,
            {
              actor,
              reason: `Re-evaluate achievements after approved correction for match ${matchId}.`,
              requestMeta,
            },
          );
          achievementEvaluation = { status: "completed", ...result };
        } catch {
          achievementEvaluation = {
            status: "failed",
            newlyUnlocked: 0,
            errorCode: "ACHIEVEMENT_EVALUATION_FAILED",
          };
        }
      }
      let rivalryRecalculation = { status: "skipped" };
      if (recalculation.status !== "failed") {
        try {
          const correctedMatch = await MatchModel.findById(matchId)
            .select({ matchDate: 1 })
            .lean();
          rivalryRecalculation = {
            status: "completed",
            ...(await rivalryUpdater.refreshAfterMatch({
              matchDate: correctedMatch?.matchDate ?? new Date(),
              previousMatchDate,
            })),
          };
        } catch {
          rivalryRecalculation = {
            status: "failed",
            errorCode: "RIVALRY_RECALCULATION_FAILED",
          };
        }
      }
      let challengeEvaluation = { status: "skipped", newlyCompleted: 0 };
      if (recalculation.status !== "failed") {
        try {
          const correctedMatch = await MatchModel.findById(matchId)
            .select({ matchDate: 1 })
            .lean();
          const result = await challengeEvaluator.evaluatePlayerIds(affectedPlayerIds, {
            actor,
            dates: [correctedMatch?.matchDate ?? new Date(), previousMatchDate].filter(
              Boolean,
            ),
            reason: `Re-evaluate challenges after approved correction for match ${matchId}.`,
            requestMeta,
          });
          challengeEvaluation = { status: "completed", ...result };
        } catch {
          challengeEvaluation = {
            status: "failed",
            newlyCompleted: 0,
            errorCode: "CHALLENGE_EVALUATION_FAILED",
          };
        }
      }
      let hallOfFameRecalculation = { status: "skipped" };
      if (recalculation.status !== "failed") {
        try {
          hallOfFameRecalculation = {
            status: "completed",
            ...(await hallOfFameUpdater.refreshAfterVerifiedData({
              actor,
              requestMeta,
              reason: `Refresh Hall of Fame after approved correction for match ${matchId}.`,
            })),
          };
        } catch {
          hallOfFameRecalculation = {
            status: "failed",
            errorCode: "HALL_OF_FAME_RECALCULATION_FAILED",
          };
        }
      }
      return {
        revisionId,
        revisionNumber,
        matchId,
        recalculation,
        achievementEvaluation,
        rivalryRecalculation,
        challengeEvaluation,
        hallOfFameRecalculation,
      };
    },

    async reject({ actor, matchId, revisionNumber, reason, requestMeta }) {
      const revision = await MatchRevisionModel.findOne({ matchId, revisionNumber });
      if (!revision) throw revisionNotFound();
      if (revision.status !== "proposed") {
        throw new AppError({
          statusCode: 409,
          code: "REVISION_NOT_PENDING",
          message: "Only proposed revisions can be rejected.",
        });
      }
      revision.status = "rejected";
      revision.reviewedBy = actor.id;
      revision.reviewedAt = new Date();
      await revision.save();
      await AuditLogModel.create({
        ...auditMeta(actor, requestMeta),
        action: "match.correction_rejected",
        entityType: "matchRevision",
        entityId: String(revision._id),
        previousValue: { status: "proposed" },
        newValue: { status: "rejected" },
        reason,
      });
      return serialize(revision);
    },
  });
}

export const matchRevisionService = createMatchRevisionService();
