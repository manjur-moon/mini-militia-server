import crypto from "node:crypto";
import mongoose from "mongoose";
import { createPaginationMeta } from "@mini-militia/shared";
import { env } from "../config/env.js";
import { AISummary } from "../models/ai-summary.model.js";
import { AuditLog } from "../models/audit-log.model.js";
import { MVPAward } from "../models/mvp-award.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { analyticsService } from "./analytics.service.js";
import { matchReadService } from "./match-read.service.js";
import { createAIProvider } from "./ai/ai-provider.factory.js";
import { AIProviderError } from "./ai/ai-provider.error.js";
import {
  HIGHLIGHT_NARRATIVE_JSON_SCHEMA,
  MATCH_NARRATIVE_JSON_SCHEMA,
  PERIOD_NARRATIVE_JSON_SCHEMA,
  PLAYER_NARRATIVE_JSON_SCHEMA,
  highlightNarrativeSchema,
  matchNarrativeSchema,
  periodNarrativeSchema,
  playerNarrativeSchema,
  validateNarrativeSafety,
} from "./ai/ai-output.schemas.js";
import { deterministicInsightService } from "./ai/deterministic-insight.service.js";

export const AI_PROMPT_VERSION = "mini-militia-insights-v1";
const COMMON_INSTRUCTIONS = `You write concise Mini Militia league analytics.
Use only the verified structured data in the input JSON.
Never invent players, matches, rankings, scores, dates, causes, quotes or statistics.
Do not include email addresses, account details, secrets, URLs or personal information.
Do not claim that your narrative changes official statistics.
Avoid insults, medical claims, gambling language and certainty about future performance.
Use neutral, constructive competitive-gaming language.
Return only the requested JSON schema.`;

function hashSource(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ promptVersion: AI_PROMPT_VERSION, value }))
    .digest("hex");
}

function requestAuditFields(requestMeta = {}) {
  return {
    ipAddress: requestMeta.ipAddress ?? null,
    userAgent: requestMeta.userAgent ?? null,
    requestId: requestMeta.requestId ?? null,
  };
}

function toObjectId(value) {
  return value ? new mongoose.Types.ObjectId(value) : null;
}

function serializeSummary(document, cacheHit = false) {
  const value =
    typeof document?.toObject === "function" ? document.toObject() : document;
  if (!value) return null;
  return {
    id: String(value._id),
    type: value.type,
    period: {
      key: value.periodKey,
      startAt: value.startAt,
      endAt: value.endAt,
      timezone: value.timezone,
    },
    playerId: value.playerId ? String(value.playerId) : null,
    matchId: value.matchId ? String(value.matchId) : null,
    seasonId: value.seasonId ? String(value.seasonId) : null,
    status: value.status,
    provider: value.provider,
    model: value.model ?? null,
    isFallback: value.isFallback,
    content: value.content,
    structuredContent: value.structuredContent,
    promptVersion: value.promptVersion,
    generatedAt: value.generatedAt,
    validationWarnings: value.validationWarnings ?? [],
    sourceDataHash: value.sourceDataHash,
    usage: value.usage ?? { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    cacheHit,
    label: "AI-generated analysis",
  };
}

function compactPeriodSource(analytics, mvpAward = null) {
  return {
    period: analytics.period,
    totals: analytics.totals,
    topPlayers: analytics.topPlayers.map((entry) => ({
      playerId: entry.player.playerId,
      name: entry.player.name,
      rank: entry.rank,
      performanceScore: entry.performanceScore,
      matchesPlayed: entry.metrics.matchesPlayed,
      kills: entry.metrics.totalKills,
      deaths: entry.metrics.totalDeaths,
      kdr: entry.metrics.kdr,
      firstPlaces: entry.metrics.firstPlaceCount,
    })),
    mostImproved: analytics.mostImproved
      ? {
          playerId: analytics.mostImproved.player.playerId,
          name: analytics.mostImproved.player.name,
          improvementRate: analytics.mostImproved.improvementRate,
          currentRank: analytics.mostImproved.currentRank,
          previousRank: analytics.mostImproved.previousRank,
        }
      : null,
    mvp: mvpAward
      ? {
          playerId: mvpAward.player?.playerId ?? null,
          name: mvpAward.player?.name ?? null,
          score: mvpAward.score,
          formulaVersion: mvpAward.formulaVersion,
        }
      : null,
    calculationVersion: analytics.calculationVersion,
  };
}

function compactPlayerSource(performance, advanced) {
  return {
    player: {
      id: performance.player.id,
      playerId: performance.player.playerId,
      name: performance.player.name,
      status: performance.player.status,
    },
    performance: {
      period: performance.period,
      metrics: performance.metrics,
      rankings: performance.rankings,
      trend: performance.trend,
    },
    advanced: {
      bestMatch: advanced.bestMatch,
      worstMatch: advanced.worstMatch,
      mostActiveDay: advanced.mostActiveDay,
      bestWeek: advanced.bestWeek,
      bestMonth: advanced.bestMonth,
      killEfficiency: advanced.killEfficiency,
      consistencyScore: advanced.consistencyScore,
      improvement: advanced.improvement,
      formulaVersion: advanced.formulaVersion,
    },
  };
}

function compactMatchSource(result) {
  return {
    match: {
      id: result.match.id,
      matchCode: result.match.matchCode,
      matchDate: result.match.matchDate,
      timezone: result.match.timezone,
      participantCount: result.match.participantCount,
      verifiedAt: result.match.verifiedAt,
    },
    results: result.results.map((row) => ({
      playerId: row.player.playerId,
      name: row.player.name,
      kills: row.kills,
      deaths: row.deaths,
      kdr: row.kdr,
      placement: row.placement,
    })),
  };
}

function buildPeriodStructured(source, narrative) {
  return {
    headline: narrative.headline,
    summary: narrative.summary,
    officialKeyStats: [
      { label: "Verified matches", value: source.totals.verifiedMatches },
      { label: "Total kills", value: source.totals.totalKills },
      { label: "League KDR", value: source.totals.leagueKdr },
      { label: "Participating players", value: source.totals.participatingPlayers },
    ],
    topPerformers: source.topPlayers.map((player) => ({
      ...player,
      reason:
        narrative.topPerformerReasons.find((item) => item.playerId === player.playerId)
          ?.reason ?? null,
    })),
    highlights: narrative.highlights,
    watchNext: narrative.watchNext,
    disclaimer:
      "AI-generated narrative based only on verified league statistics. Official values remain unchanged.",
  };
}

function buildPlayerStructured(source, narrative) {
  return {
    ...narrative,
    player: source.player,
    officialMetrics: source.performance.metrics,
    rankings: source.performance.rankings,
    evidence: {
      bestMatch: source.advanced.bestMatch,
      worstMatch: source.advanced.worstMatch,
      killEfficiency: source.advanced.killEfficiency,
      consistencyScore: source.advanced.consistencyScore,
      improvement: source.advanced.improvement,
    },
    disclaimer:
      "AI-generated coaching suggestions based only on verified match statistics; they do not alter official records.",
  };
}

function buildMatchStructured(source, narrative) {
  return {
    headline: narrative.headline,
    summary: narrative.summary,
    officialScoreboard: source.results,
    turningPoints: narrative.turningPoints,
    standouts: source.results
      .filter((row) =>
        narrative.standoutReasons.some((item) => item.playerId === row.playerId),
      )
      .map((row) => ({
        playerId: row.playerId,
        name: row.name,
        reason: narrative.standoutReasons.find((item) => item.playerId === row.playerId)
          .reason,
      })),
    highlights: narrative.highlights,
    disclaimer:
      "AI-generated match narrative based only on the verified scoreboard; official results remain unchanged.",
  };
}

function buildHighlightStructured(source, narrative) {
  return {
    ...narrative,
    period: source.period,
    officialStats: {
      verifiedMatches: source.totals.verifiedMatches,
      totalKills: source.totals.totalKills,
      firstPlaces: source.totals.firstPlaces,
    },
    disclaimer: "AI-generated highlight text based on verified league data.",
  };
}

function providerConfiguration() {
  return {
    provider: env.AI_PROVIDER,
    model: env.AI_PROVIDER === "openai" ? env.OPENAI_MODEL : null,
    externalGenerationConfigured:
      env.AI_PROVIDER === "openai" && Boolean(env.OPENAI_API_KEY),
    deterministicFallbackEnabled: true,
    promptVersion: AI_PROMPT_VERSION,
  };
}

export function createAIInsightService({
  AISummaryModel = AISummary,
  PlayerModel = Player,
  MVPAwardModel = MVPAward,
  AuditLogModel = AuditLog,
  analytics = analyticsService,
  matchReader = matchReadService,
  provider = createAIProvider(),
  fallback = deterministicInsightService,
} = {}) {
  async function findCached({ type, periodKey, playerId, matchId, sourceDataHash }) {
    return AISummaryModel.findOne({
      type,
      periodKey,
      playerId: playerId ?? null,
      matchId: matchId ?? null,
      sourceDataHash,
    }).lean();
  }

  async function createOrReplace({
    type,
    period,
    playerId = null,
    matchId = null,
    seasonId = null,
    source,
    schemaName,
    schema,
    validator,
    fallbackBuilder,
    structuredBuilder,
    allowedPlayerIds,
    instructions,
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    const sourceDataHash = hashSource(source);
    const cached = await findCached({
      type,
      periodKey: period.key,
      playerId,
      matchId,
      sourceDataHash,
    });
    if (cached && !force) return serializeSummary(cached, true);

    let narrative;
    let providerName = provider.name;
    let providerModel = provider.model ?? null;
    let providerRequestId = null;
    let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    let isFallback = false;
    const validationWarnings = [];

    try {
      const generated = await provider.generate({
        instructions: `${COMMON_INSTRUCTIONS}\n${instructions}`,
        input: source,
        schemaName,
        schema,
      });
      narrative = validator.parse(generated.data);
      const safetyWarnings = validateNarrativeSafety(narrative, allowedPlayerIds);
      if (safetyWarnings.length) {
        throw new AIProviderError("AI output failed application safety validation.", {
          code: "AI_OUTPUT_VALIDATION_FAILED",
        });
      }
      providerRequestId = generated.providerRequestId;
      providerModel = generated.model;
      usage = generated.usage;
    } catch (error) {
      isFallback = true;
      providerName = "deterministic";
      providerModel = null;
      narrative = validator.parse(fallbackBuilder(source));
      validationWarnings.push(
        error instanceof AIProviderError ? error.code : "AI_OUTPUT_VALIDATION_FAILED",
      );
    }

    const structuredContent = structuredBuilder(source, narrative);
    const payload = {
      type,
      periodKey: period.key,
      startAt: period.startAt,
      endAt: period.endAt,
      timezone: period.timezone,
      playerId: playerId ?? null,
      matchId: matchId ?? null,
      seasonId: seasonId ?? null,
      status: isFallback ? "fallback_generated" : "generated",
      provider: providerName,
      model: providerModel,
      providerRequestId,
      isFallback,
      content: structuredContent.summary ?? structuredContent.caption,
      structuredContent,
      sourceMetrics: source,
      sourceDataHash,
      promptVersion: AI_PROMPT_VERSION,
      generatedAt: new Date(),
      generatedBy: actor?.id ?? "system:on-demand",
      generationReason: reason,
      usage,
      validationWarnings,
    };

    let saved;
    if (cached && force) {
      saved = await AISummaryModel.findByIdAndUpdate(
        cached._id,
        { $set: payload },
        {
          new: true,
          runValidators: true,
        },
      );
    } else {
      try {
        saved = await AISummaryModel.create(payload);
      } catch (error) {
        if (error?.code !== 11000) throw error;
        saved = await AISummaryModel.findOne({
          type,
          periodKey: period.key,
          playerId: playerId ?? null,
          matchId: matchId ?? null,
          sourceDataHash,
        });
      }
    }

    if (actor) {
      await AuditLogModel.create({
        actorUserId: actor.id,
        action: cached ? "ai_summary.regenerated" : "ai_summary.generated",
        entityType: "ai_summary",
        entityId: String(saved._id),
        previousValue: cached
          ? {
              provider: cached.provider,
              model: cached.model,
              generatedAt: cached.generatedAt,
              sourceDataHash: cached.sourceDataHash,
            }
          : null,
        newValue: {
          type,
          provider: providerName,
          model: providerModel,
          isFallback,
          generatedAt: payload.generatedAt,
          sourceDataHash,
        },
        reason,
        ...requestAuditFields(requestMeta),
      });
    }
    return serializeSummary(saved, false);
  }

  async function loadCurrentMvp(period) {
    const award = await MVPAwardModel.findOne({
      awardType: period.type,
      periodKey: period.key,
      status: "current",
    }).lean();
    if (!award) return null;
    const player = await PlayerModel.findById(award.playerId)
      .select({ playerId: 1, name: 1 })
      .lean();
    return { ...award, player };
  }

  async function periodSource(periodType, date) {
    const analyticsResult = await analytics.getPeriodAnalytics({ periodType, date });
    const mvpAward = await loadCurrentMvp(analyticsResult.period);
    return compactPeriodSource(analyticsResult, mvpAward);
  }

  async function generatePeriodSummary({
    periodType,
    date,
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    if (!new Set(["weekly", "monthly"]).has(periodType)) {
      throw new AppError({
        statusCode: 422,
        code: "INVALID_AI_PERIOD",
        message: "AI period summaries support weekly or monthly periods.",
      });
    }
    const source = await periodSource(periodType, date);
    return createOrReplace({
      type: periodType,
      period: source.period,
      seasonId: source.period.seasonId ? toObjectId(source.period.seasonId) : null,
      source,
      schemaName: `${periodType}_league_summary`,
      schema: PERIOD_NARRATIVE_JSON_SCHEMA,
      validator: periodNarrativeSchema,
      fallbackBuilder: fallback.period,
      structuredBuilder: buildPeriodStructured,
      allowedPlayerIds: source.topPlayers.map((player) => player.playerId),
      instructions:
        "Summarize the period. Discuss only the supplied top players and verified totals. Do not create new numeric statistics.",
      force,
      actor,
      reason,
      requestMeta,
    });
  }

  async function generateHighlight({
    periodType,
    date,
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    if (!new Set(["weekly", "monthly"]).has(periodType)) {
      throw new AppError({
        statusCode: 422,
        code: "INVALID_HIGHLIGHT_PERIOD",
        message: "AI highlights support weekly or monthly periods.",
      });
    }
    const source = await periodSource(periodType, date);
    return createOrReplace({
      type: "highlight",
      period: { ...source.period, key: `${periodType}:${source.period.key}` },
      source,
      schemaName: `${periodType}_league_highlight`,
      schema: HIGHLIGHT_NARRATIVE_JSON_SCHEMA,
      validator: highlightNarrativeSchema,
      fallbackBuilder: fallback.highlight,
      structuredBuilder: buildHighlightStructured,
      allowedPlayerIds: source.topPlayers.map((player) => player.playerId),
      instructions:
        "Create a short public highlight caption and factual bullet list. Do not add players or statistics that are absent from the input.",
      force,
      actor,
      reason,
      requestMeta,
    });
  }

  async function generatePlayerInsight({
    playerCode,
    range = "30d",
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    const [performance, advanced] = await Promise.all([
      analytics.getPlayerPerformance(playerCode, { range }),
      analytics.getAdvancedPlayerAnalytics(playerCode),
    ]);
    const source = compactPlayerSource(performance, advanced);
    return createOrReplace({
      type: "player_performance",
      period: {
        ...performance.period,
        key: `${playerCode}:${performance.period.key}`,
      },
      playerId: toObjectId(performance.player.id),
      source,
      schemaName: "player_performance_analysis",
      schema: PLAYER_NARRATIVE_JSON_SCHEMA,
      validator: playerNarrativeSchema,
      fallbackBuilder: fallback.player,
      structuredBuilder: buildPlayerStructured,
      allowedPlayerIds: [performance.player.playerId],
      instructions:
        "Provide constructive analysis and improvement suggestions for this one player. Base every observation on the supplied verified metrics. Do not diagnose personality or health.",
      force,
      actor,
      reason,
      requestMeta,
    });
  }

  async function generateMatchInsight({
    matchId,
    force = false,
    actor = null,
    reason = null,
    requestMeta = {},
  }) {
    const result = await matchReader.get({ matchId, actor: null });
    const source = compactMatchSource(result);
    return createOrReplace({
      type: "match_insight",
      period: {
        key: result.match.matchCode,
        startAt: result.match.matchDate,
        endAt: result.match.matchDate,
        timezone: result.match.timezone,
      },
      matchId: toObjectId(result.match.id),
      seasonId: result.match.seasonId ? toObjectId(result.match.seasonId) : null,
      source,
      schemaName: "verified_match_insight",
      schema: MATCH_NARRATIVE_JSON_SCHEMA,
      validator: matchNarrativeSchema,
      fallbackBuilder: fallback.match,
      structuredBuilder: buildMatchStructured,
      allowedPlayerIds: source.results.map((row) => row.playerId).filter(Boolean),
      instructions:
        "Explain the verified scoreboard without inventing unseen gameplay events. A turning point must be an observable scoreboard comparison, not a claim about what happened during play.",
      force,
      actor,
      reason,
      requestMeta,
    });
  }

  return Object.freeze({
    getConfiguration: providerConfiguration,
    generatePeriodSummary,
    generateHighlight,
    generatePlayerInsight,
    generateMatchInsight,

    async regenerate(input, actor, requestMeta) {
      const common = {
        force: true,
        actor,
        reason: input.reason,
        requestMeta,
      };
      if (input.type === "weekly" || input.type === "monthly") {
        return generatePeriodSummary({
          ...common,
          periodType: input.type,
          date: input.date,
        });
      }
      if (input.type === "highlight") {
        return generateHighlight({
          ...common,
          periodType: input.periodType,
          date: input.date,
        });
      }
      if (input.type === "player_performance") {
        return generatePlayerInsight({
          ...common,
          playerCode: input.playerId,
          range: input.range,
        });
      }
      return generateMatchInsight({ ...common, matchId: input.matchId });
    },

    async list({
      type,
      status,
      provider: providerFilter,
      playerId,
      page = 1,
      limit = 20,
    }) {
      const filter = {};
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (providerFilter) filter.provider = providerFilter;
      if (playerId) {
        const player = await PlayerModel.findOne({ playerId })
          .select({ _id: 1 })
          .lean();
        if (!player) {
          return {
            items: [],
            pagination: createPaginationMeta({ page, limit, totalItems: 0 }),
          };
        }
        filter.playerId = player._id;
      }
      const skip = (page - 1) * limit;
      const [items, totalItems] = await Promise.all([
        AISummaryModel.find(filter)
          .select({ sourceMetrics: 0 })
          .sort({ generatedAt: -1, _id: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AISummaryModel.countDocuments(filter),
      ]);
      return {
        items: items.map((item) => serializeSummary(item, false)),
        pagination: createPaginationMeta({ page, limit, totalItems }),
      };
    },
  });
}

export const aiInsightService = createAIInsightService();
