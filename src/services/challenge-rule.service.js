const OPERATORS = Object.freeze({
  eq: (actual, expected) => actual === expected,
  gte: (actual, expected) => actual >= expected,
  lte: (actual, expected) => actual <= expected,
  gt: (actual, expected) => actual > expected,
  lt: (actual, expected) => actual < expected,
});

export function getChallengeMetricValue(metrics, metric) {
  const value = Number(metrics?.[metric]);
  return Number.isFinite(value) ? value : 0;
}

export function evaluateChallengeEligibility(challenge, metrics) {
  const matchesPlayed = getChallengeMetricValue(metrics, "matchesPlayed");
  const minimumMatchesMet = matchesPlayed >= Number(challenge.minimumMatches ?? 0);
  const ruleSet = challenge.minimumEligibility;
  if (!ruleSet?.conditions?.length) {
    return {
      eligible: minimumMatchesMet,
      minimumMatches: Number(challenge.minimumMatches ?? 0),
      matchesPlayed,
      minimumMatchesMet,
      conditions: [],
    };
  }
  const conditions = ruleSet.conditions.map((condition) => {
    const actual = getChallengeMetricValue(metrics, condition.metric);
    const passed = Boolean(OPERATORS[condition.operator]?.(actual, condition.value));
    return {
      metric: condition.metric,
      operator: condition.operator,
      expected: condition.value,
      actual,
      passed,
    };
  });
  const rulesMet =
    ruleSet.combinator === "any"
      ? conditions.some((condition) => condition.passed)
      : conditions.every((condition) => condition.passed);
  return {
    eligible: minimumMatchesMet && rulesMet,
    minimumMatches: Number(challenge.minimumMatches ?? 0),
    matchesPlayed,
    minimumMatchesMet,
    combinator: ruleSet.combinator,
    rulesMet,
    conditions,
  };
}

export function evaluateChallengeProgress(challenge, metrics) {
  const currentValue = Math.max(0, getChallengeMetricValue(metrics, challenge.metric));
  const targetValue = Number(challenge.targetValue);
  const operator = challenge.targetOperator ?? "gte";
  const targetMet = Boolean(OPERATORS[operator]?.(currentValue, targetValue));
  let percentage;
  if (["lte", "lt"].includes(operator)) {
    percentage = targetMet
      ? 100
      : currentValue > 0
        ? Math.max(0, Math.min(100, (targetValue / currentValue) * 100))
        : 100;
  } else {
    percentage =
      targetValue > 0
        ? Math.max(0, Math.min(100, (currentValue / targetValue) * 100))
        : 0;
  }
  const eligibility = evaluateChallengeEligibility(challenge, metrics);
  return {
    completed: eligibility.eligible && targetMet,
    currentValue,
    targetValue,
    targetOperator: operator,
    targetMet,
    progressPercentage: Number(percentage.toFixed(2)),
    eligibility,
  };
}
