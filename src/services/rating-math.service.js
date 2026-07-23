import { formatLeagueDateKey } from "./period.service.js";
import { calculateKdr } from "./statistics.service.js";

export const RATING_CALCULATION_VERSION = "ratings-v1";
export const RATING_COMPONENTS = Object.freeze([
  "attack",
  "survival",
  "consistency",
  "activity",
]);
export const RATING_METRICS = Object.freeze([
  "averageKills",
  "kdr",
  "winRate",
  "averageDeaths",
  "averageRank",
  "lastPlaceRate",
  "killsCoefficientOfVariation",
  "placementStandardDeviation",
  "matchesPlayed",
  "activeDays",
]);

export function roundRating(value, precision = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function clampRating(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function coefficientOfVariation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return mean === 0 ? 0 : standardDeviation(values) / Math.abs(mean);
}

export function deriveRatingInputs(rows, timezone) {
  const matchesPlayed = rows.length;
  if (!matchesPlayed) {
    return {
      matchesPlayed: 0,
      totalKills: 0,
      totalDeaths: 0,
      averageKills: 0,
      averageDeaths: 0,
      kdr: 0,
      averageRank: 0,
      winRate: 0,
      lastPlaceRate: 0,
      killsCoefficientOfVariation: 0,
      placementStandardDeviation: 0,
      activeDays: 0,
    };
  }

  const kills = rows.map((row) => row.kills);
  const deaths = rows.map((row) => row.deaths);
  const placements = rows.map((row) => row.placement);
  const totalKills = kills.reduce((total, value) => total + value, 0);
  const totalDeaths = deaths.reduce((total, value) => total + value, 0);
  const firstPlaces = rows.filter((row) => row.placement === 1).length;
  const lastPlaces = rows.filter(
    (row) =>
      Number.isFinite(row.participantCount) &&
      row.participantCount > 0 &&
      row.placement === row.participantCount,
  ).length;
  const activeDays = new Set(
    rows.map((row) => formatLeagueDateKey(row.matchDate, timezone)),
  ).size;

  return {
    matchesPlayed,
    totalKills,
    totalDeaths,
    averageKills: roundRating(totalKills / matchesPlayed, 6),
    averageDeaths: roundRating(totalDeaths / matchesPlayed, 6),
    kdr: calculateKdr(totalKills, totalDeaths),
    averageRank: roundRating(average(placements), 6),
    winRate: roundRating((firstPlaces / matchesPlayed) * 100, 6),
    lastPlaceRate: roundRating((lastPlaces / matchesPlayed) * 100, 6),
    killsCoefficientOfVariation: roundRating(coefficientOfVariation(kills), 6),
    placementStandardDeviation: roundRating(standardDeviation(placements), 6),
    activeDays,
  };
}

function percentileRank(value, populationValues) {
  const finiteValues = populationValues.filter(Number.isFinite);
  if (!finiteValues.length) return 0;
  const lowerCount = finiteValues.filter((item) => item < value).length;
  const equalCount = finiteValues.filter((item) => item === value).length;
  return ((lowerCount + equalCount * 0.5) / finiteValues.length) * 100;
}

export function normalizeRatingMetric(value, definition, populationValues = []) {
  if (!Number.isFinite(value)) return 0;

  if (definition.method === "target") {
    return roundRating(clampRating((value / definition.target) * 100));
  }

  if (definition.method === "inverse_target") {
    if (value <= definition.target) return 100;
    return roundRating(clampRating((definition.target / value) * 100));
  }

  if (definition.method === "min_max") {
    const range = definition.maximum - definition.minimum;
    if (!Number.isFinite(range) || range <= 0) return 0;
    return roundRating(clampRating(((value - definition.minimum) / range) * 100));
  }

  if (definition.method === "percentile") {
    return roundRating(clampRating(percentileRank(value, populationValues)));
  }

  return 0;
}

export function calculateConfidenceFactor(sampleSize, minimumMatches, confidenceFloor) {
  if (!sampleSize) return 0;
  const progress = Math.min(1, sampleSize / minimumMatches);
  return roundRating(
    Math.min(1, Math.max(0, confidenceFloor + (1 - confidenceFloor) * progress)),
    6,
  );
}

export function applySampleConfidence(rawScore, confidenceFactor) {
  if (confidenceFactor <= 0) return 0;
  return roundRating(clampRating(50 + (rawScore - 50) * confidenceFactor));
}

export function calculatePlayerRating({
  rows,
  timezone,
  config,
  populationMetricValues = {},
}) {
  const inputs = deriveRatingInputs(rows, timezone);
  const confidenceFactor = calculateConfidenceFactor(
    inputs.matchesPlayed,
    config.minimumMatches,
    config.newPlayerConfidenceFloor,
  );
  const rawComponents = {};
  const normalizedMetrics = {};
  const components = {};

  for (const componentConfig of config.components) {
    let componentTotal = 0;
    normalizedMetrics[componentConfig.component] = {};
    for (const metricDefinition of componentConfig.metrics) {
      const value = inputs[metricDefinition.metric] ?? 0;
      const normalized = normalizeRatingMetric(
        value,
        metricDefinition,
        populationMetricValues[metricDefinition.metric] ?? [],
      );
      normalizedMetrics[componentConfig.component][metricDefinition.metric] = {
        input: value,
        normalized,
        weight: metricDefinition.weight,
        method: metricDefinition.method,
        minimum: metricDefinition.minimum ?? null,
        maximum: metricDefinition.maximum ?? null,
        target: metricDefinition.target ?? null,
      };
      componentTotal += normalized * metricDefinition.weight;
    }
    const rawScore = roundRating(clampRating(componentTotal));
    rawComponents[componentConfig.component] = rawScore;
    components[componentConfig.component] = applySampleConfidence(
      rawScore,
      confidenceFactor,
    );
  }

  const overall = roundRating(
    clampRating(
      RATING_COMPONENTS.reduce(
        (total, component) =>
          total + components[component] * config.overallWeights[component],
        0,
      ),
    ),
  );

  return {
    attack: components.attack,
    survival: components.survival,
    consistency: components.consistency,
    activity: components.activity,
    overall,
    sampleSize: inputs.matchesPlayed,
    minimumMatchesMet: inputs.matchesPlayed >= config.minimumMatches,
    confidenceFactor,
    inputSnapshot: {
      calculationVersion: RATING_CALCULATION_VERSION,
      inputs,
      normalizedMetrics,
      rawComponents,
      confidenceAdjustedComponents: components,
      confidenceRule: {
        neutralBaseline: 50,
        minimumMatches: config.minimumMatches,
        newPlayerConfidenceFloor: config.newPlayerConfidenceFloor,
      },
      overallWeights: config.overallWeights,
    },
  };
}
