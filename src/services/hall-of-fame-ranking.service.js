function comparePlayerIdentity(left, right) {
  return String(left.player?.playerId ?? left.playerId ?? "").localeCompare(
    String(right.player?.playerId ?? right.playerId ?? ""),
  );
}

export function selectMostKills(entries) {
  return (
    [...entries]
      .filter((entry) => Number(entry.metrics?.matchesPlayed ?? 0) > 0)
      .sort(
        (left, right) =>
          Number(right.metrics?.totalKills ?? 0) -
            Number(left.metrics?.totalKills ?? 0) ||
          Number(right.metrics?.firstPlaceCount ?? 0) -
            Number(left.metrics?.firstPlaceCount ?? 0) ||
          Number(left.metrics?.totalDeaths ?? 0) -
            Number(right.metrics?.totalDeaths ?? 0) ||
          comparePlayerIdentity(left, right),
      )[0] ?? null
  );
}

export function selectBestKdr(entries, minimumMatches) {
  return (
    [...entries]
      .filter((entry) => Number(entry.metrics?.matchesPlayed ?? 0) >= minimumMatches)
      .sort(
        (left, right) =>
          Number(right.metrics?.kdr ?? 0) - Number(left.metrics?.kdr ?? 0) ||
          Number(right.metrics?.totalKills ?? 0) -
            Number(left.metrics?.totalKills ?? 0) ||
          Number(left.metrics?.totalDeaths ?? 0) -
            Number(right.metrics?.totalDeaths ?? 0) ||
          comparePlayerIdentity(left, right),
      )[0] ?? null
  );
}

export function selectLongestWinningStreak(entries) {
  return (
    [...entries]
      .filter((entry) => Number(entry.records?.longestFirstPlaceStreak ?? 0) > 0)
      .sort(
        (left, right) =>
          Number(right.records?.longestFirstPlaceStreak ?? 0) -
            Number(left.records?.longestFirstPlaceStreak ?? 0) ||
          Number(right.metrics?.firstPlaceCount ?? 0) -
            Number(left.metrics?.firstPlaceCount ?? 0) ||
          Number(right.metrics?.totalKills ?? 0) -
            Number(left.metrics?.totalKills ?? 0) ||
          comparePlayerIdentity(left, right),
      )[0] ?? null
  );
}

export function selectAllTimeLegend(entries) {
  return (
    [...entries]
      .filter((entry) => entry.minimumMatchesMet)
      .sort(
        (left, right) =>
          Number(left.rank ?? Number.MAX_SAFE_INTEGER) -
            Number(right.rank ?? Number.MAX_SAFE_INTEGER) ||
          Number(right.performanceScore ?? 0) - Number(left.performanceScore ?? 0) ||
          Number(right.metrics?.firstPlaceCount ?? 0) -
            Number(left.metrics?.firstPlaceCount ?? 0) ||
          Number(right.metrics?.totalKills ?? 0) -
            Number(left.metrics?.totalKills ?? 0) ||
          comparePlayerIdentity(left, right),
      )[0] ?? null
  );
}

export function selectSeasonChampion(entries) {
  return selectAllTimeLegend(entries);
}

export function selectMostMvpAwards(entries) {
  return (
    [...entries]
      .filter((entry) => Number(entry.awardCount ?? 0) > 0)
      .sort(
        (left, right) =>
          Number(right.awardCount ?? 0) - Number(left.awardCount ?? 0) ||
          Number(right.totalScore ?? 0) - Number(left.totalScore ?? 0) ||
          Number(right.latestAwardAt ? new Date(right.latestAwardAt).getTime() : 0) -
            Number(left.latestAwardAt ? new Date(left.latestAwardAt).getTime() : 0) ||
          comparePlayerIdentity(left, right),
      )[0] ?? null
  );
}
