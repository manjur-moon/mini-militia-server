const OPERATORS = Object.freeze({
  eq: (actual, expected) => actual === expected,
  gte: (actual, expected) => actual >= expected,
  lte: (actual, expected) => actual <= expected,
  gt: (actual, expected) => actual > expected,
  lt: (actual, expected) => actual < expected,
});

export function getTitleMetricValue(entry, metric) {
  if (Object.hasOwn(entry?.metrics ?? {}, metric)) {
    return Number(entry.metrics[metric] ?? 0);
  }
  if (metric === "improvementRate") {
    return Number.isFinite(entry?.improvementRate) ? entry.improvementRate : null;
  }
  if (metric === "currentMvpStreak") return 0;
  if (metric === "currentFirstPlaceStreak") return 0;
  if (metric === "highestKillsInMatch") return 0;
  if (metric === "highestDeathsInMatch") return 0;
  if (metric === "bestMatchKdr") return 0;
  if (metric === "longestMvpStreak") return 0;
  if (metric === "longestFirstPlaceStreak") return 0;
  if (metric === "mostMatchesInOneDay") return 0;
  if (metric === "killStreak") return 0;
  return null;
}

export function evaluateTitleCondition(condition, entry) {
  const actual = getTitleMetricValue(entry, condition.metric);
  const evaluator = OPERATORS[condition.operator];
  const passed =
    actual !== null &&
    Number.isFinite(actual) &&
    Boolean(evaluator?.(actual, condition.value));
  return {
    metric: condition.metric,
    operator: condition.operator,
    expected: condition.value,
    actual,
    passed,
  };
}

export function evaluateTitleDefinition(definition, entry) {
  const matchesPlayed = Number(entry?.metrics?.matchesPlayed ?? 0);
  const minimumMatchesMet = matchesPlayed >= definition.minimumMatches;
  const conditions = definition.rules.conditions.map((condition) =>
    evaluateTitleCondition(condition, entry),
  );
  const rulesMet =
    definition.rules.combinator === "any"
      ? conditions.some((condition) => condition.passed)
      : conditions.every((condition) => condition.passed);
  return {
    qualified: minimumMatchesMet && rulesMet,
    minimumMatches: definition.minimumMatches,
    matchesPlayed,
    minimumMatchesMet,
    combinator: definition.rules.combinator,
    conditions,
  };
}

export function calculateTitleExpiration({ awardedAt, periodEndAt, durationDays }) {
  const awarded = new Date(awardedAt);
  const durationEnd = new Date(
    awarded.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000,
  );
  const periodEnd = new Date(periodEndAt);
  return durationEnd < periodEnd ? durationEnd : periodEnd;
}

export function chooseCurrentTitle(candidates) {
  return (
    [...candidates].sort(
      (left, right) =>
        right.titleSnapshot.priority - left.titleSnapshot.priority ||
        new Date(right.awardedAt) - new Date(left.awardedAt) ||
        left.titleSnapshot.code.localeCompare(right.titleSnapshot.code),
    )[0] ?? null
  );
}
