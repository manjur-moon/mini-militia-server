const OPERATORS = Object.freeze({
  eq: (actual, expected) => actual === expected,
  gte: (actual, expected) => actual >= expected,
  lte: (actual, expected) => actual <= expected,
  gt: (actual, expected) => actual > expected,
  lt: (actual, expected) => actual < expected,
});

export function getAchievementMetricValue(entry, metric) {
  if (Object.hasOwn(entry?.metrics ?? {}, metric)) {
    const value = Number(entry.metrics[metric]);
    return Number.isFinite(value) ? value : null;
  }
  if (Object.hasOwn(entry?.records ?? {}, metric)) {
    const value = Number(entry.records[metric]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

function conditionPercentage({ operator, actual, expected, passed }) {
  if (actual === null || !Number.isFinite(actual)) return 0;
  if (passed) return 100;
  if (["gte", "gt"].includes(operator)) {
    return expected > 0 ? Math.max(0, Math.min(100, (actual / expected) * 100)) : 0;
  }
  if (["lte", "lt"].includes(operator)) {
    if (actual <= 0) return 100;
    return Math.max(0, Math.min(100, (expected / actual) * 100));
  }
  return 0;
}

export function evaluateAchievementCondition(condition, entry) {
  const actual = getAchievementMetricValue(entry, condition.metric);
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
    percentage: Number(
      conditionPercentage({
        operator: condition.operator,
        actual,
        expected: condition.value,
        passed,
      }).toFixed(2),
    ),
    passed,
  };
}

export function evaluateAchievementDefinition(definition, entry) {
  const matchesPlayed = Number(entry?.metrics?.matchesPlayed ?? 0);
  const minimumMatchesMet = matchesPlayed >= definition.minimumMatches;
  const conditions = definition.criteria.conditions.map((condition) =>
    evaluateAchievementCondition(condition, entry),
  );
  const rulesMet =
    definition.criteria.combinator === "any"
      ? conditions.some((condition) => condition.passed)
      : conditions.every((condition) => condition.passed);
  const conditionPercentage =
    definition.criteria.combinator === "any"
      ? Math.max(...conditions.map((condition) => condition.percentage), 0)
      : Math.min(...conditions.map((condition) => condition.percentage), 100);
  const primaryCurrent = Math.max(
    0,
    Number(getAchievementMetricValue(entry, definition.progressMetric) ?? 0),
  );
  const primaryPercentage = Math.max(
    0,
    Math.min(100, (primaryCurrent / Number(definition.targetValue)) * 100),
  );
  return {
    unlocked: minimumMatchesMet && rulesMet,
    minimumMatches: definition.minimumMatches,
    matchesPlayed,
    minimumMatchesMet,
    combinator: definition.criteria.combinator,
    rulesMet,
    conditions,
    progress: {
      current: primaryCurrent,
      target: Number(definition.targetValue),
      percentage: Number(Math.min(primaryPercentage, conditionPercentage).toFixed(2)),
    },
  };
}
