import { env } from "../config/env.js";
import { PlayerAchievement } from "../models/player-achievement.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { Player } from "../models/player.model.js";
import { AppError } from "../utils/app-error.js";
import { mvpService } from "./mvp.service.js";

function playerNotFound() {
  return new AppError({
    statusCode: 404,
    code: "PLAYER_NOT_FOUND",
    message: "Player profile was not found.",
  });
}

function achievementNotFound() {
  return new AppError({
    statusCode: 404,
    code: "ACHIEVEMENT_UNLOCK_NOT_FOUND",
    message: "This verified achievement unlock was not found for the player.",
  });
}

function noWeeklyMvp() {
  return new AppError({
    statusCode: 404,
    code: "WEEKLY_MVP_NOT_AVAILABLE",
    message: "No eligible weekly MVP award is available for this period.",
  });
}

function publicPlayer(player) {
  return {
    id: String(player._id),
    playerId: player.playerId,
    name: player.name,
    photoUrl: player.profileImage?.secureUrl ?? null,
    status: player.status,
    joinDate: player.joinDate,
  };
}

function profileUrls(playerId) {
  const encoded = encodeURIComponent(playerId);
  return {
    canonicalUrl: `${env.publicAppUrl}/players/${encoded}`,
    shareUrl: `${env.publicApiUrl}/share/players/${encoded}/profile`,
    imageUrl: `${env.publicApiUrl}/api/v1/share/players/${encoded}/image.png`,
  };
}

function achievementUrls(playerId, achievementCode) {
  const encodedPlayer = encodeURIComponent(playerId);
  const encodedAchievement = encodeURIComponent(achievementCode);
  return {
    canonicalUrl: `${env.publicAppUrl}/players/${encodedPlayer}/achievements`,
    shareUrl: `${env.publicApiUrl}/share/players/${encodedPlayer}/achievements/${encodedAchievement}`,
    imageUrl: `${env.publicApiUrl}/api/v1/share/players/${encodedPlayer}/achievements/${encodedAchievement}/image.png`,
  };
}

function weeklyMvpUrls(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return {
    canonicalUrl: `${env.publicAppUrl}/mvp`,
    shareUrl: `${env.publicApiUrl}/share/mvp/weekly${query}`,
    imageUrl: `${env.publicApiUrl}/api/v1/share/mvp/weekly/image.png${query}`,
  };
}

export function createSocialSharingService({
  PlayerModel = Player,
  PlayerStatisticsModel = PlayerStatistics,
  PlayerAchievementModel = PlayerAchievement,
  mvp = mvpService,
} = {}) {
  return Object.freeze({
    async getPlayerProfile(playerCode) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1, joinDate: 1 })
        .lean();
      if (!player) throw playerNotFound();

      const statistics = await PlayerStatisticsModel.findOne({ playerId: player._id })
        .select({ metrics: 1, globalRank: 1 })
        .lean();
      const metrics = statistics?.metrics ?? {};
      const title = `${player.name} — Mini Militia League Profile`;
      const description = `${player.name} (${player.playerId}) has ${Number(metrics.totalKills ?? 0)} verified kills across ${Number(metrics.matchesPlayed ?? 0)} official matches.`;

      return {
        type: "player_profile",
        title,
        description,
        player: publicPlayer(player),
        statistics: {
          matchesPlayed: Number(metrics.matchesPlayed ?? 0),
          totalKills: Number(metrics.totalKills ?? 0),
          totalDeaths: Number(metrics.totalDeaths ?? 0),
          kdr: Number(metrics.kdr ?? 0),
          firstPlaceCount: Number(metrics.firstPlaceCount ?? 0),
          winRate: Number(metrics.winRate ?? 0),
          globalRank: statistics?.globalRank ?? null,
        },
        urls: profileUrls(player.playerId),
      };
    },

    async getAchievement(playerCode, achievementCode) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({ playerId: 1, name: 1, profileImage: 1, status: 1, joinDate: 1 })
        .lean();
      if (!player) throw playerNotFound();

      const progress = await PlayerAchievementModel.findOne({
        playerId: player._id,
        achievementCode,
        isUnlocked: true,
      })
        .select({ achievementSnapshot: 1, unlockedAt: 1 })
        .lean();
      if (!progress) throw achievementNotFound();

      const achievement = progress.achievementSnapshot;
      return {
        type: "achievement",
        title: `${player.name} unlocked ${achievement.name}`,
        description: achievement.description,
        player: publicPlayer(player),
        achievement,
        unlockedAt: progress.unlockedAt,
        urls: achievementUrls(player.playerId, achievement.code),
      };
    },

    async getWeeklyMvp({ date } = {}) {
      const result = await mvp.getCurrentAward({
        periodType: "weekly",
        date,
      });
      if (!result.award?.player) throw noWeeklyMvp();

      return {
        type: "weekly_mvp",
        title: `${result.award.player.name} — ${result.period.label} MVP`,
        description: `${result.award.player.name} earned ${Number(result.award.score).toFixed(2)} MVP points using formula ${result.award.formulaVersion}.`,
        period: result.period,
        award: result.award,
        urls: weeklyMvpUrls(date),
      };
    },
  });
}

export const socialSharingService = createSocialSharingService();
