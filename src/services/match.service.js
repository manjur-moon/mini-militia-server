import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { createPaginationMeta } from "@mini-militia/shared";
import { env } from "../config/env.js";
import { AuditLog } from "../models/audit-log.model.js";
import { MatchResult } from "../models/match-result.model.js";
import { Match } from "../models/match.model.js";
import { OCRJob } from "../models/ocr-job.model.js";
import { Player } from "../models/player.model.js";
import { normalizeText } from "../models/model.helpers.js";
import { AppError } from "../utils/app-error.js";
import { cloudinaryImageService } from "./cloudinary-image.service.js";
import { ocrProcessingService } from "./ocr/ocr-processing.service.js";
import { CORE_STATISTICS_VERSION, statisticsService } from "./statistics.service.js";
import { achievementService } from "./achievement.service.js";
import { rivalryService } from "./rivalry.service.js";
import { challengeService } from "./challenge.service.js";
import { hallOfFameService } from "./hall-of-fame.service.js";
import { seasonService } from "./season.service.js";
import { notificationService } from "./notification.service.js";

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "MATCH_NOT_FOUND",
    message: "Match was not found.",
  });
}
function serializeMatch(value) {
  const match = typeof value?.toObject === "function" ? value.toObject() : value;
  if (!match) return null;
  return { ...match, id: String(match._id), _id: undefined };
}
function serializeResult(value) {
  const result = typeof value?.toObject === "function" ? value.toObject() : value;
  return {
    ...result,
    id: String(result._id),
    _id: undefined,
    matchId: String(result.matchId),
  };
}
function matchCode(id, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  return `MT-${day}-${String(id).slice(-8).toUpperCase()}`;
}
function auditMeta(actor, requestMeta) {
  return {
    actorUserId: actor.id,
    ipAddress: requestMeta.ipAddress,
    userAgent: requestMeta.userAgent,
    requestId: requestMeta.requestId,
  };
}

export function createMatchService({
  MatchModel = Match,
  MatchResultModel = MatchResult,
  OCRJobModel = OCRJob,
  PlayerModel = Player,
  AuditLogModel = AuditLog,
  imageService = cloudinaryImageService,
  processingService = ocrProcessingService,
  statsService = statisticsService,
  achievementEvaluator = achievementService,
  rivalryUpdater = rivalryService,
  challengeEvaluator = challengeService,
  hallOfFameUpdater = hallOfFameService,
  seasonManager = seasonService,
  notificationDelivery = notificationService,
} = {}) {
  return Object.freeze({
    async upload({ actor, input, file, requestMeta }) {
      const sha256 = createHash("sha256").update(file.buffer).digest("hex");
      const duplicate = await MatchModel.findOne({ "screenshot.sha256": sha256 })
        .select({ matchCode: 1, status: 1 })
        .lean();
      if (duplicate) {
        throw new AppError({
          statusCode: 409,
          code: "DUPLICATE_SCREENSHOT",
          message: `This exact screenshot already exists as ${duplicate.matchCode}.`,
          errors: [
            { path: "screenshot", message: "Exact SHA-256 duplicate detected." },
          ],
        });
      }

      const assignedSeason = await seasonManager.resolveForMatch({
        matchDate: input.matchDate,
        requestedSeasonId: input.seasonId ?? null,
      });
      const id = new mongoose.Types.ObjectId();
      const code = matchCode(id);
      const asset = await imageService.uploadMatchScreenshot({
        buffer: file.buffer,
        matchCode: code,
      });
      asset.sha256 = sha256;
      let match;
      try {
        match = await MatchModel.create({
          _id: id,
          matchCode: code,
          status: "uploaded",
          screenshot: asset,
          uploadMetadata: {
            originalFilename: file.originalname,
            detectedFormat: file.detectedFormat,
            mimeType: file.mimetype,
          },
          matchDate: new Date(input.matchDate),
          timezone: input.timezone,
          seasonId: assignedSeason?._id ?? null,
          participantCount: input.participantCount,
          uploadedBy: actor.id,
        });
        const job = await OCRJobModel.create({
          matchId: match._id,
          provider: env.OCR_PROVIDER,
          status: "queued",
          maxAttempts: env.OCR_MAX_ATTEMPTS,
          parserProfile: env.OCR_PARSER_PROFILE,
          columnOrder: env.ocrColumnOrder,
        });
        match.ocrJobId = job._id;
        await match.save();
        await AuditLogModel.create({
          ...auditMeta(actor, requestMeta),
          action: "match.uploaded",
          entityType: "match",
          entityId: String(match._id),
          newValue: { matchCode: code, status: "uploaded", sha256 },
          reason: "Match screenshot uploaded for OCR processing.",
        });
        processingService.enqueue(job._id);
        return {
          match: serializeMatch(match),
          ocrJob: { id: String(job._id), status: job.status },
        };
      } catch (error) {
        await imageService.deleteImage(asset.publicId).catch(() => undefined);
        if (match?._id)
          await MatchModel.deleteOne({ _id: match._id }).catch(() => undefined);
        throw error;
      }
    },

    async list(query) {
      const filter = {};
      if (query.status) filter.status = query.status;
      if (query.search)
        filter.matchCode = new RegExp(
          query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i",
        );
      if (query.dateFrom || query.dateTo) {
        filter.matchDate = {};
        if (query.dateFrom) filter.matchDate.$gte = new Date(query.dateFrom);
        if (query.dateTo) filter.matchDate.$lte = new Date(query.dateTo);
      }
      const skip = (query.page - 1) * query.limit;
      const [items, totalItems] = await Promise.all([
        MatchModel.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        MatchModel.countDocuments(filter),
      ]);
      return {
        items: items.map(serializeMatch),
        pagination: createPaginationMeta({
          page: query.page,
          limit: query.limit,
          totalItems,
        }),
      };
    },

    async get(matchId) {
      const match = await MatchModel.findById(matchId).lean();
      if (!match) throw notFound();
      const [results, job] = await Promise.all([
        MatchResultModel.find({ matchId }).sort({ rowIndex: 1 }).lean(),
        OCRJobModel.findOne({ matchId }).lean(),
      ]);
      return {
        match: serializeMatch(match),
        results: results.map(serializeResult),
        ocrJob: job ? { ...job, id: String(job._id), _id: undefined } : null,
      };
    },

    async getOCRJob(jobId) {
      const job = await OCRJobModel.findById(jobId).lean();
      if (!job)
        throw new AppError({
          statusCode: 404,
          code: "OCR_JOB_NOT_FOUND",
          message: "OCR job was not found.",
        });
      return {
        ...job,
        id: String(job._id),
        _id: undefined,
        matchId: String(job.matchId),
      };
    },

    async retryOCR({ actor, jobId, requestMeta }) {
      const job = await OCRJobModel.findById(jobId);
      if (!job)
        throw new AppError({
          statusCode: 404,
          code: "OCR_JOB_NOT_FOUND",
          message: "OCR job was not found.",
        });
      if (job.status !== "failed")
        throw new AppError({
          statusCode: 409,
          code: "OCR_JOB_NOT_FAILED",
          message: "Only failed OCR jobs can be retried.",
        });
      if (job.attempts >= job.maxAttempts)
        throw new AppError({
          statusCode: 409,
          code: "OCR_RETRY_LIMIT_REACHED",
          message: "The OCR retry limit has been reached.",
        });
      job.status = "queued";
      job.nextRetryAt = null;
      await job.save();
      await AuditLogModel.create({
        ...auditMeta(actor, requestMeta),
        action: "match.retry_requested",
        entityType: "ocrJob",
        entityId: String(job._id),
        newValue: { status: "queued", attempts: job.attempts },
        reason: "Moderator requested OCR retry.",
      });
      processingService.enqueue(job._id);
      return {
        id: String(job._id),
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
      };
    },

    async saveReview({ actor, matchId, input, requestMeta }) {
      const match = await MatchModel.findById(matchId);
      if (!match) throw notFound();
      if (["verified", "rejected"].includes(match.status))
        throw new AppError({
          statusCode: 409,
          code: "MATCH_LOCKED",
          message: "A verified or rejected match cannot be edited here.",
        });

      const playerIds = [...new Set(input.rows.map((row) => row.playerId))];
      const players = await PlayerModel.find({ _id: { $in: playerIds } }).lean();
      if (players.length !== playerIds.length)
        throw new AppError({
          statusCode: 422,
          code: "PLAYER_REFERENCE_INVALID",
          message: "One or more selected players do not exist.",
        });
      const playerMap = new Map(players.map((player) => [String(player._id), player]));
      const duplicatePlayers = playerIds.length !== input.rows.length;
      const placements = input.rows.map((row) => row.placement);
      const duplicatePlacements = new Set(placements).size !== placements.length;
      if (duplicatePlayers || duplicatePlacements)
        throw new AppError({
          statusCode: 422,
          code: "DUPLICATE_MATCH_RESULT",
          message: "Each player and placement must be unique within a match.",
        });
      if (input.participantCount !== input.rows.length)
        throw new AppError({
          statusCode: 422,
          code: "PARTICIPANT_COUNT_MISMATCH",
          message: "Participant count must equal the number of included result rows.",
        });

      const existing = await MatchResultModel.find({ matchId });
      const byId = new Map(existing.map((row) => [String(row._id), row]));
      const now = new Date();
      let nextRowIndex =
        existing.reduce((max, row) => Math.max(max, row.rowIndex), -1) + 1;
      const includedIds = new Set();
      for (const row of input.rows) {
        const player = playerMap.get(row.playerId);
        if (row.resultId) {
          const document = byId.get(row.resultId);
          if (!document)
            throw new AppError({
              statusCode: 422,
              code: "MATCH_RESULT_NOT_FOUND",
              message: "A reviewed result row does not belong to this match.",
            });
          document.status = "pending";
          document.corrected = {
            playerId: player._id,
            playerName: player.name,
            normalizedPlayerName: normalizeText(player.name),
            kills: row.kills,
            deaths: row.deaths,
            placement: row.placement,
            correctedBy: actor.id,
            correctedAt: now,
            reason: row.reason ?? null,
          };
          document.playerMatch.status = "confirmed";
          document.playerMatch.suggestedPlayerId = player._id;
          document.playerMatch.confirmedBy = actor.id;
          document.playerMatch.confirmedAt = now;
          document.rejectedReason = null;
          await document.save();
          includedIds.add(String(document._id));
        } else {
          const document = await MatchResultModel.create({
            matchId: match._id,
            rowIndex: nextRowIndex++,
            source: "manual",
            status: "pending",
            extracted: {
              playerName: player.name,
              normalizedPlayerName: normalizeText(player.name),
              kills: row.kills,
              deaths: row.deaths,
              placement: row.placement,
              confidence: 1,
              rawText: "Manual entry",
            },
            playerMatch: {
              status: "confirmed",
              suggestedPlayerId: player._id,
              candidates: [],
              confirmedBy: actor.id,
              confirmedAt: now,
            },
            corrected: {
              playerId: player._id,
              playerName: player.name,
              normalizedPlayerName: normalizeText(player.name),
              kills: row.kills,
              deaths: row.deaths,
              placement: row.placement,
              correctedBy: actor.id,
              correctedAt: now,
              reason: row.reason ?? "Manual row",
            },
          });
          includedIds.add(String(document._id));
        }
      }
      for (const document of existing) {
        if (!includedIds.has(String(document._id))) {
          document.status = "rejected";
          document.rejectedReason = "Excluded during moderator review";
          await document.save();
        }
      }
      const assignedSeason = await seasonManager.resolveForMatch({
        matchDate: input.matchDate,
        requestedSeasonId: input.seasonId ?? null,
      });
      match.participantCount = input.participantCount;
      match.matchDate = new Date(input.matchDate);
      match.timezone = input.timezone;
      match.seasonId = assignedSeason?._id ?? null;
      match.status = "needs_review";
      match.reviewStartedBy = actor.id;
      match.reviewStartedAt = now;
      match.resultCount = input.rows.length;
      await match.save();
      await AuditLogModel.create({
        ...auditMeta(actor, requestMeta),
        action: "match.reviewed",
        entityType: "match",
        entityId: String(match._id),
        newValue: { participantCount: input.rows.length },
        reason: input.reason,
      });
      return this.get(matchId);
    },

    async verify({ actor, matchId, reason, requestMeta }) {
      const session = await mongoose.startSession();
      let verifiedMatch;
      let affectedPlayerIds = [];
      try {
        await session.withTransaction(async () => {
          const match = await MatchModel.findById(matchId).session(session);
          if (!match) throw notFound();
          if (match.status === "verified")
            throw new AppError({
              statusCode: 409,
              code: "MATCH_ALREADY_VERIFIED",
              message: "This match is already verified.",
            });
          const assignedSeason = await seasonManager.resolveForMatch({
            matchDate: match.matchDate,
            requestedSeasonId: match.seasonId ?? null,
            session,
          });
          match.seasonId = assignedSeason?._id ?? null;
          const results = await MatchResultModel.find({
            matchId,
            status: "pending",
          }).session(session);
          if (results.length !== match.participantCount || !results.length)
            throw new AppError({
              statusCode: 422,
              code: "MATCH_RESULTS_INCOMPLETE",
              message: "All participant rows must be reviewed before verification.",
            });
          if (results.some((result) => !result.corrected?.playerId))
            throw new AppError({
              statusCode: 422,
              code: "PLAYER_MATCH_INCOMPLETE",
              message: "Every result row must be linked to a registered player.",
            });
          const players = results.map((row) => String(row.corrected.playerId));
          const placements = results.map((row) => row.corrected.placement);
          const orderedPlacements = [...placements].sort((left, right) => left - right);
          const placementSequenceValid = orderedPlacements.every(
            (placement, index) => placement === index + 1,
          );
          if (
            new Set(players).size !== players.length ||
            new Set(placements).size !== placements.length ||
            !placementSequenceValid
          )
            throw new AppError({
              statusCode: 422,
              code: "DUPLICATE_MATCH_RESULT",
              message:
                "Players must be unique and placements must run from 1 to participant count.",
            });
          const now = new Date();
          await MatchResultModel.bulkWrite(
            results.map((row) => ({
              updateOne: {
                filter: { _id: row._id },
                update: {
                  $set: {
                    status: "verified",
                    official: {
                      playerId: row.corrected.playerId,
                      playerName: row.corrected.playerName,
                      kills: row.corrected.kills,
                      deaths: row.corrected.deaths,
                      placement: row.corrected.placement,
                      verifiedBy: actor.id,
                      verifiedAt: now,
                      lastCorrectedBy: null,
                      lastCorrectedAt: null,
                    },
                    officialMatchDate: match.matchDate,
                    officialSeasonId: match.seasonId,
                  },
                },
              },
            })),
            { session },
          );
          match.status = "verified";
          match.verification.verifiedBy = actor.id;
          match.verification.verifiedAt = now;
          match.verifiedResultCount = results.length;
          match.currentRevision = Math.max(1, match.currentRevision);
          match.statisticsRecalculation = {
            status: "pending",
            calculationVersion: CORE_STATISTICS_VERSION,
            requestedAt: now,
            completedAt: null,
            errorCode: null,
          };
          await match.save({ session });
          await AuditLogModel.create(
            [
              {
                ...auditMeta(actor, requestMeta),
                action: "match.verified",
                entityType: "match",
                entityId: String(match._id),
                previousValue: { status: "needs_review" },
                newValue: {
                  status: "verified",
                  verifiedResultCount: results.length,
                  currentRevision: match.currentRevision,
                },
                reason,
              },
            ],
            { session },
          );
          affectedPlayerIds = players;
          verifiedMatch = serializeMatch(match);
        });
      } finally {
        await session.endSession();
      }

      let notificationDeliveryResult = { status: "skipped", created: 0 };
      try {
        notificationDeliveryResult = {
          status: "completed",
          ...(await notificationDelivery.createForLinkedPlayers(
            affectedPlayerIds,
            (player) => ({
              type: "match_verified",
              title: `Match verified: ${verifiedMatch.matchCode}`,
              message: `${player.name}'s result is now included in official statistics.`,
              relatedEntity: { entityType: "match", entityId: verifiedMatch.id },
              actionUrl: `/matches/${verifiedMatch.id}`,
              data: { matchId: verifiedMatch.id, matchCode: verifiedMatch.matchCode },
              deduplicationKey: `match-verified:${verifiedMatch.id}:${player.linkedUserId}`,
            }),
          )),
        };
      } catch {
        notificationDeliveryResult = {
          status: "failed",
          created: 0,
          errorCode: "MATCH_NOTIFICATION_FAILED",
        };
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
        verifiedMatch.statisticsRecalculation = {
          ...verifiedMatch.statisticsRecalculation,
          status: "completed",
          completedAt: new Date(),
        };
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
        verifiedMatch.statisticsRecalculation = {
          ...verifiedMatch.statisticsRecalculation,
          status: "failed",
          errorCode: "STATISTICS_RECALCULATION_FAILED",
        };
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
              reason: `Automatically evaluate achievements after verifying match ${verifiedMatch.matchCode}.`,
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
          rivalryRecalculation = {
            status: "completed",
            ...(await rivalryUpdater.refreshAfterMatch({
              matchDate: verifiedMatch.matchDate,
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
          const result = await challengeEvaluator.evaluatePlayerIds(affectedPlayerIds, {
            actor,
            date: verifiedMatch.matchDate,
            reason: `Automatically update challenges after verifying match ${verifiedMatch.matchCode}.`,
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
              reason: `Refresh Hall of Fame after verifying match ${verifiedMatch.matchCode}.`,
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
        match: verifiedMatch,
        recalculation,
        achievementEvaluation,
        rivalryRecalculation,
        challengeEvaluation,
        hallOfFameRecalculation,
        notificationDelivery: notificationDeliveryResult,
      };
    },

    async reject({ actor, matchId, reason, requestMeta }) {
      const match = await MatchModel.findById(matchId);
      if (!match) throw notFound();
      if (match.status === "verified")
        throw new AppError({
          statusCode: 409,
          code: "VERIFIED_MATCH_REQUIRES_REVISION",
          message: "Verified matches require the controlled correction workflow.",
        });
      const previousStatus = match.status;
      const now = new Date();
      const rejectedResults = await MatchResultModel.find({
        matchId,
        status: "pending",
        "corrected.playerId": { $ne: null },
      })
        .select({ "corrected.playerId": 1 })
        .lean();
      const rejectedPlayerIds = rejectedResults.map((item) =>
        String(item.corrected.playerId),
      );
      await MatchResultModel.updateMany(
        { matchId, status: "pending" },
        { $set: { status: "rejected", rejectedReason: reason } },
      );
      match.status = "rejected";
      match.verification.rejectedBy = actor.id;
      match.verification.rejectedAt = now;
      match.verification.rejectionReason = reason;
      await match.save();
      await AuditLogModel.create({
        ...auditMeta(actor, requestMeta),
        action: "match.rejected",
        entityType: "match",
        entityId: String(match._id),
        previousValue: { status: previousStatus },
        newValue: { status: "rejected" },
        reason,
      });
      await notificationDelivery
        .createForLinkedPlayers(rejectedPlayerIds, (player) => ({
          type: "match_rejected",
          title: `Match rejected: ${match.matchCode}`,
          message: `${player.name}'s submitted match result was rejected after review.`,
          relatedEntity: { entityType: "match", entityId: String(match._id) },
          actionUrl: `/matches/${String(match._id)}`,
          data: { matchId: String(match._id), matchCode: match.matchCode },
          deduplicationKey: `match-rejected:${String(match._id)}:${player.linkedUserId}`,
        }))
        .catch(() => undefined);
      return serializeMatch(match);
    },
  });
}

export const matchService = createMatchService();
