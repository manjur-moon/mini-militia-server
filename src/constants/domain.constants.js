export const USER_ROLES = Object.freeze(["player", "moderator", "admin"]);
export const USER_STATUSES = Object.freeze(["active", "inactive"]);
export const DEFAULT_USER_ROLE = USER_ROLES[0];
export const ACTIVE_USER_STATUS = USER_STATUSES[0];
export const PLAYER_STATUSES = Object.freeze(["active", "inactive"]);

export const MATCH_STATUSES = Object.freeze([
  "uploaded",
  "processing",
  "extracted",
  "needs_review",
  "verified",
  "processing_failed",
  "rejected",
]);
export const MATCH_RESULT_STATUSES = Object.freeze(["pending", "verified", "rejected"]);
export const OCR_JOB_STATUSES = Object.freeze([
  "queued",
  "processing",
  "succeeded",
  "failed",
]);
export const OCR_PROVIDERS = Object.freeze(["google-vision", "mock", "disabled"]);
export const PLAYER_MATCH_STATUSES = Object.freeze([
  "exact",
  "alias",
  "probable",
  "ambiguous",
  "none",
  "confirmed",
]);
export const OCR_COLUMN_KEYS = Object.freeze(["placement", "name", "kills", "deaths"]);

export const PERIOD_TYPES = Object.freeze(["weekly", "monthly", "season", "all_time"]);
export const SEASON_STATUSES = Object.freeze([
  "draft",
  "upcoming",
  "active",
  "completed",
  "archived",
]);
export const MVP_AWARD_TYPES = Object.freeze([
  "weekly",
  "monthly",
  "season",
  "all_time",
]);
export const NOTIFICATION_TYPES = Object.freeze([
  "achievement_unlocked",
  "mvp_award",
  "challenge_completed",
  "title_earned",
  "match_verified",
  "match_rejected",
  "player_account_linked",
  "season_started",
  "season_completed",
  "system_announcement",
]);
export const CHALLENGE_TYPES = Object.freeze(["weekly", "monthly"]);
export const CHALLENGE_STATUSES = Object.freeze([
  "draft",
  "upcoming",
  "active",
  "completed",
  "archived",
]);
export const PLAYER_CHALLENGE_STATUSES = Object.freeze([
  "in_progress",
  "completed",
  "expired",
]);
export const AI_SUMMARY_TYPES = Object.freeze([
  "weekly",
  "monthly",
  "player_performance",
  "match_insight",
  "highlight",
]);
export const AI_SUMMARY_STATUSES = Object.freeze([
  "pending",
  "generated",
  "fallback_generated",
  "failed",
]);
export const RULE_OPERATORS = Object.freeze(["eq", "gte", "lte", "gt", "lt"]);
export const RULE_COMBINATORS = Object.freeze(["all", "any"]);
export const METRIC_KEYS = Object.freeze([
  "matchesPlayed",
  "totalKills",
  "totalDeaths",
  "kdr",
  "averageKills",
  "averageDeaths",
  "averageRank",
  "winRate",
  "firstPlaceCount",
  "lastPlaceCount",
  "mvpCount",
  "currentMvpStreak",
  "currentFirstPlaceStreak",
  "highestKillsInMatch",
  "highestDeathsInMatch",
  "bestMatchKdr",
  "longestMvpStreak",
  "longestFirstPlaceStreak",
  "mostMatchesInOneDay",
  "killStreak",
  "improvementRate",
]);
export const HALL_OF_FAME_CATEGORIES = Object.freeze([
  "season_champion",
  "all_time_legend",
  "most_kills",
  "most_mvp_awards",
  "best_kdr",
  "longest_winning_streak",
]);
export const AUDIT_ACTIONS = Object.freeze([
  "player.created",
  "player.updated",
  "player.status_changed",
  "player.photo_updated",
  "player.photo_removed",
  "user.role_changed",
  "user.account_status_changed",
  "user.player_linked",
  "user.player_unlinked",
  "match.uploaded",
  "match.ocr_completed",
  "match.ocr_failed",
  "match.reviewed",
  "match.verified",
  "match.rejected",
  "match.corrected",
  "match.correction_proposed",
  "match.correction_rejected",
  "match.statistics_recalculated",
  "statistics.recalculated",
  "match.retry_requested",
  "season.created",
  "season.updated",
  "season.completed",
  "mvp_config.created",
  "mvp_config.activated",
  "mvp_award.recalculated",
  "rating_config.created",
  "rating_config.activated",
  "rating.recalculated",
  "achievement.created",
  "achievement.updated",
  "achievement.activated",
  "achievement.deactivated",
  "achievement.recalculated",
  "achievement.unlocked",
  "title.created",
  "title.updated",
  "title.activated",
  "title.deactivated",
  "title.recalculated",
  "title.awarded",
  "title.revoked",
  "challenge.created",
  "challenge.updated",
  "challenge.status_changed",
  "challenge.recalculated",
  "challenge.completed",
  "hall_of_fame.recalculated",
  "hall_of_fame.record_created",
  "hall_of_fame.record_superseded",
  "notification.created",
  "ai_summary.generated",
  "ai_summary.regenerated",
]);
