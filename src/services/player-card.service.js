import { env } from "../config/env.js";
import { Player } from "../models/player.model.js";
import { PlayerStatistics } from "../models/player-statistics.model.js";
import { PlayerTitle } from "../models/player-title.model.js";
import { AppError } from "../utils/app-error.js";
import { ratingService } from "./rating.service.js";

const DEFAULT_TITLE = Object.freeze({
  code: "LEAGUE_COMPETITOR",
  name: "League Competitor",
  icon: null,
  source: "fallback",
});
const MAX_EMBEDDED_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_FETCH_TIMEOUT_MS = 5000;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function notFound() {
  return new AppError({
    statusCode: 404,
    code: "PLAYER_NOT_FOUND",
    message: "Player profile was not found.",
  });
}

function serializeTitle(playerTitle) {
  const snapshot = playerTitle?.titleSnapshot;
  if (snapshot?.code && snapshot?.name) {
    return {
      code: snapshot.code,
      name: snapshot.name,
      icon: snapshot.icon ?? null,
      source: "dynamic-title",
    };
  }
  const title = playerTitle?.titleId;
  if (!title || typeof title === "string") return DEFAULT_TITLE;
  return {
    code: title.code,
    name: title.name,
    icon: title.icon ?? null,
    source: "dynamic-title",
  };
}

function periodQueryString({ periodType, date, seasonId }) {
  const params = new URLSearchParams({ periodType });
  if (date) params.set("date", date);
  if (seasonId) params.set("seasonId", seasonId);
  return params.toString();
}

function cardUrls(playerId, periodInput) {
  const query = periodQueryString(periodInput);
  const encodedPlayerId = encodeURIComponent(playerId);
  return {
    publicProfileUrl: `${env.publicAppUrl}/players/${encodedPlayerId}`,
    cardPageUrl: `${env.publicAppUrl}/players/${encodedPlayerId}/card?${query}`,
    shareUrl: `${env.publicApiUrl}/share/players/${encodedPlayerId}/card?${query}`,
    imageUrl: `${env.publicApiUrl}/api/v1/players/${encodedPlayerId}/card/image.png?${query}`,
    svgUrl: `${env.publicApiUrl}/api/v1/players/${encodedPlayerId}/card/image.svg?${query}`,
  };
}

export function createPlayerCardService({
  PlayerModel = Player,
  PlayerStatisticsModel = PlayerStatistics,
  PlayerTitleModel = PlayerTitle,
  ratings = ratingService,
  fetchImpl = globalThis.fetch,
} = {}) {
  return Object.freeze({
    async getCard({ playerCode, periodType = "all_time", date, seasonId }) {
      const player = await PlayerModel.findOne({ playerId: playerCode })
        .select({
          playerId: 1,
          name: 1,
          profileImage: 1,
          status: 1,
          joinDate: 1,
        })
        .lean();
      if (!player) throw notFound();

      const [ratingResult, statistics, currentTitle] = await Promise.all([
        ratings.getPlayerRating({ playerCode, periodType, date, seasonId }),
        PlayerStatisticsModel.findOne({ playerId: player._id })
          .select({ "metrics.kdr": 1 })
          .lean(),
        PlayerTitleModel.findOne({
          playerId: player._id,
          isCurrent: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        })
          .populate({ path: "titleId", select: { code: 1, name: 1, icon: 1 } })
          .lean(),
      ]);

      const storedRating = ratingResult.rating;
      const ratingsPayload = storedRating?.ratings ?? {
        attack: 0,
        survival: 0,
        consistency: 0,
        activity: 0,
        overall: 0,
      };
      const periodInput = {
        periodType: ratingResult.period?.type ?? periodType,
        date,
        seasonId,
      };

      return {
        player: {
          id: String(player._id),
          playerId: player.playerId,
          name: player.name,
          profileImage: player.profileImage ?? null,
          status: player.status,
          joinDate: player.joinDate,
        },
        title: serializeTitle(currentTitle),
        ratings: ratingsPayload,
        kdr: statistics?.metrics?.kdr ?? 0,
        rank: storedRating?.rank ?? null,
        sampleSize: storedRating?.sampleSize ?? 0,
        minimumMatchesMet: storedRating?.minimumMatchesMet ?? false,
        confidenceFactor: storedRating?.confidenceFactor ?? 0,
        formulaVersion: ratingResult.formulaVersion,
        period: ratingResult.period,
        league: {
          name: "Mini Militia League & Analytics",
          shortName: "MML",
        },
        urls: cardUrls(player.playerId, periodInput),
      };
    },

    async fetchEmbeddedPhotoDataUri(photoUrl) {
      if (!photoUrl || typeof fetchImpl !== "function") return null;

      let parsed;
      try {
        parsed = new URL(photoUrl);
      } catch {
        return null;
      }
      if (
        parsed.protocol !== "https:" ||
        parsed.port ||
        !(
          parsed.hostname === "res.cloudinary.com" ||
          parsed.hostname.endsWith(".cloudinary.com")
        )
      ) {
        return null;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PHOTO_FETCH_TIMEOUT_MS);
      try {
        const response = await fetchImpl(parsed, {
          signal: controller.signal,
          redirect: "error",
          headers: { Accept: "image/avif,image/webp,image/png,image/jpeg" },
        });
        if (!response.ok) return null;

        const contentType = response.headers.get("content-type")?.split(";")[0];
        if (!contentType || !ALLOWED_PHOTO_TYPES.has(contentType)) return null;

        const declaredLength = Number(response.headers.get("content-length") ?? 0);
        if (declaredLength > MAX_EMBEDDED_PHOTO_BYTES) return null;

        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length === 0 || bytes.length > MAX_EMBEDDED_PHOTO_BYTES) return null;
        return `data:${contentType};base64,${bytes.toString("base64")}`;
      } catch {
        return null;
      } finally {
        clearTimeout(timeout);
      }
    },
  });
}

export const playerCardService = createPlayerCardService();
