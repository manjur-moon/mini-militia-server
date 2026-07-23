import { Player } from "../../models/player.model.js";
import { normalizeText } from "../../models/model.helpers.js";

function levenshtein(left, right) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  rows[0] = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
  }
  return rows[left.length][right.length];
}

function similarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length);
}

export function createPlayerMatcher({ PlayerModel = Player } = {}) {
  return Object.freeze({
    async matchNames(names) {
      const players = await PlayerModel.find({ status: "active" })
        .select({ playerId: 1, name: 1, normalizedName: 1, aliases: 1 })
        .lean();

      return names.map((name) => {
        const normalized = normalizeText(name);
        const ranked = players
          .map((player) => {
            const aliasScores = (player.aliases ?? []).map((alias) =>
              similarity(normalized, normalizeText(alias)),
            );
            const nameScore = similarity(normalized, player.normalizedName);
            const score = Math.max(nameScore, ...aliasScores, 0);
            const exactName = normalized === player.normalizedName;
            const exactAlias = (player.aliases ?? []).some(
              (alias) => normalized === normalizeText(alias),
            );
            return { player, score, exactName, exactAlias };
          })
          .sort((left, right) => right.score - left.score);

        const top = ranked[0];
        const second = ranked[1];
        let status = "none";
        if (top?.exactName) status = "exact";
        else if (top?.exactAlias) status = "alias";
        else if (top?.score >= 0.78 && second && top.score - second.score <= 0.05)
          status = "ambiguous";
        else if (top?.score >= 0.78) status = "probable";

        const candidates = ranked
          .slice(0, 5)
          .filter((item) => item.score >= 0.55)
          .map((item) => ({
            playerId: item.player._id,
            playerCode: item.player.playerId,
            playerName: item.player.name,
            score: Number(item.score.toFixed(4)),
          }));

        return {
          status,
          suggestedPlayerId: ["exact", "alias", "probable"].includes(status)
            ? top.player._id
            : null,
          candidates,
        };
      });
    },
  });
}

export const playerMatcher = createPlayerMatcher();
