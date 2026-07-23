export const RIVALRY_CALCULATION_VERSION = "rivalry-v1";

export function calculateSafeKdr(kills, deaths) {
  const safeKills = Math.max(0, Number(kills) || 0);
  const safeDeaths = Math.max(0, Number(deaths) || 0);
  if (safeDeaths > 0) return Number((safeKills / safeDeaths).toFixed(4));
  return safeKills > 0 ? safeKills : 0;
}

export function compareHeadToHead(left, right) {
  const leftPlacement = Number(left.placement);
  const rightPlacement = Number(right.placement);
  if (leftPlacement < rightPlacement) return "left";
  if (rightPlacement < leftPlacement) return "right";

  const leftKills = Number(left.kills);
  const rightKills = Number(right.kills);
  if (leftKills > rightKills) return "left";
  if (rightKills > leftKills) return "right";
  return "draw";
}

export function normalizedPairKey(leftPlayerId, rightPlayerId) {
  return [String(leftPlayerId), String(rightPlayerId)].sort().join(":");
}

export function createEmptyRivalry(leftPlayerId, rightPlayerId) {
  const [playerAId, playerBId] = [String(leftPlayerId), String(rightPlayerId)].sort();
  return {
    pairKey: `${playerAId}:${playerBId}`,
    playerA: {
      playerId: playerAId,
      headToHeadWins: 0,
      totalKills: 0,
      totalDeaths: 0,
      kdr: 0,
    },
    playerB: {
      playerId: playerBId,
      headToHeadWins: 0,
      totalKills: 0,
      totalDeaths: 0,
      kdr: 0,
    },
    sharedMatches: 0,
    draws: 0,
    combinedKills: 0,
    winDifference: 0,
    competitivenessScore: 0,
    lastSharedMatchAt: null,
  };
}

export function addSharedMatch(rivalry, leftResult, rightResult, matchDate) {
  const leftId = String(leftResult.playerId);
  const leftSide =
    String(rivalry.playerA.playerId) === leftId ? rivalry.playerA : rivalry.playerB;
  const rightSide = leftSide === rivalry.playerA ? rivalry.playerB : rivalry.playerA;
  const outcome = compareHeadToHead(leftResult, rightResult);

  rivalry.sharedMatches += 1;
  leftSide.totalKills += Math.max(0, Number(leftResult.kills) || 0);
  leftSide.totalDeaths += Math.max(0, Number(leftResult.deaths) || 0);
  rightSide.totalKills += Math.max(0, Number(rightResult.kills) || 0);
  rightSide.totalDeaths += Math.max(0, Number(rightResult.deaths) || 0);

  if (outcome === "left") leftSide.headToHeadWins += 1;
  else if (outcome === "right") rightSide.headToHeadWins += 1;
  else rivalry.draws += 1;

  const date = new Date(matchDate);
  if (!rivalry.lastSharedMatchAt || date > rivalry.lastSharedMatchAt) {
    rivalry.lastSharedMatchAt = date;
  }
  return outcome;
}

export function finalizeRivalry(rivalry) {
  rivalry.playerA.kdr = calculateSafeKdr(
    rivalry.playerA.totalKills,
    rivalry.playerA.totalDeaths,
  );
  rivalry.playerB.kdr = calculateSafeKdr(
    rivalry.playerB.totalKills,
    rivalry.playerB.totalDeaths,
  );
  rivalry.combinedKills = rivalry.playerA.totalKills + rivalry.playerB.totalKills;
  rivalry.winDifference = Math.abs(
    rivalry.playerA.headToHeadWins - rivalry.playerB.headToHeadWins,
  );

  const closeness = rivalry.sharedMatches
    ? 1 - rivalry.winDifference / rivalry.sharedMatches
    : 0;
  const activity = Math.min(rivalry.sharedMatches / 5, 1);
  const drawIntensity = rivalry.sharedMatches
    ? rivalry.draws / rivalry.sharedMatches
    : 0;
  rivalry.competitivenessScore = Number(
    (closeness * 60 + activity * 30 + drawIntensity * 10).toFixed(4),
  );
  return rivalry;
}

export function buildRivalriesFromMatches(groupedMatchRows) {
  const pairs = new Map();
  for (const match of groupedMatchRows) {
    const rows = [...match.results].sort((left, right) =>
      String(left.playerId).localeCompare(String(right.playerId)),
    );
    for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
        const left = rows[leftIndex];
        const right = rows[rightIndex];
        const key = normalizedPairKey(left.playerId, right.playerId);
        const rivalry =
          pairs.get(key) ?? createEmptyRivalry(left.playerId, right.playerId);
        addSharedMatch(rivalry, left, right, match.matchDate);
        pairs.set(key, rivalry);
      }
    }
  }
  return [...pairs.values()].map(finalizeRivalry);
}

export function sortRivalries(items) {
  return [...items].sort((left, right) => {
    if (right.sharedMatches !== left.sharedMatches) {
      return right.sharedMatches - left.sharedMatches;
    }
    if (right.competitivenessScore !== left.competitivenessScore) {
      return right.competitivenessScore - left.competitivenessScore;
    }
    if (right.combinedKills !== left.combinedKills) {
      return right.combinedKills - left.combinedKills;
    }
    return (
      new Date(right.lastSharedMatchAt ?? 0).getTime() -
      new Date(left.lastSharedMatchAt ?? 0).getTime()
    );
  });
}

export function selectRivalOfPeriod(items, minimumSharedMatches = 2) {
  return (
    sortRivalries(
      items.filter((item) => item.sharedMatches >= minimumSharedMatches),
    )[0] ?? null
  );
}
