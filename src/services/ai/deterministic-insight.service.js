function formatNumber(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value ?? 0);
}

function fallbackPeriod(source) {
  const leader = source.topPlayers[0] ?? null;
  const periodLabel = source.period.label;
  const headline = leader
    ? `${leader.name} sets the pace in ${periodLabel}`
    : `${periodLabel} league report`;
  const summary = source.totals.verifiedMatches
    ? `${source.totals.verifiedMatches} verified matches produced ${source.totals.totalKills} kills across ${source.totals.participatingPlayers} players. The league KDR was ${formatNumber(source.totals.leagueKdr)}.`
    : `No verified matches are available for ${periodLabel}, so the official analytics summary is still waiting for data.`;
  return {
    headline,
    summary,
    highlights: [
      `${formatNumber(source.totals.totalKills, 0)} total kills from verified results.`,
      `${formatNumber(source.totals.firstPlaces, 0)} first-place finishes were recorded.`,
      ...(source.mostImproved
        ? [
            `${source.mostImproved.name} improved by ${formatNumber(source.mostImproved.improvementRate)}%.`,
          ]
        : []),
    ].slice(0, 5),
    watchNext: leader
      ? [`Watch whether ${leader.name} can maintain the current performance score.`]
      : [
          "More verified matches are needed before a competitive trend can be identified.",
        ],
    topPerformerReasons: source.topPlayers.map((player) => ({
      playerId: player.playerId,
      reason: `${formatNumber(player.performanceScore)} performance points from ${player.matchesPlayed} verified matches.`,
    })),
  };
}

function fallbackPlayer(source) {
  const metrics = source.performance.metrics;
  const improvement = source.advanced.improvement;
  let trendAssessment = "insufficient_data";
  if (Number.isFinite(improvement.improvementRate)) {
    trendAssessment =
      improvement.improvementRate > 5
        ? "improving"
        : improvement.improvementRate < -5
          ? "declining"
          : "stable";
  }
  const strengths = [];
  if (metrics.kdr >= 2)
    strengths.push(`Strong ${formatNumber(metrics.kdr)} KDR in the selected range.`);
  if (metrics.winRate >= 30)
    strengths.push(
      `${formatNumber(metrics.winRate)}% win rate shows reliable placement conversion.`,
    );
  if (source.advanced.consistencyScore >= 70)
    strengths.push(
      `Consistency score of ${formatNumber(source.advanced.consistencyScore)} is a clear strength.`,
    );
  const improvements = [];
  if (metrics.averageDeaths > metrics.averageKills)
    improvements.push("Reduce average deaths before trying to increase aggression.");
  if (metrics.averageRank > 2.5)
    improvements.push(
      "Prioritize safer late-match positioning to improve average placement.",
    );
  if (!improvements.length)
    improvements.push(
      "Maintain current fundamentals while reviewing the lowest-scoring verified matches.",
    );
  return {
    headline: `${source.player.name} performance review`,
    summary: `${source.player.name} played ${metrics.matchesPlayed} verified matches with ${metrics.totalKills} kills, ${metrics.totalDeaths} deaths and a ${formatNumber(metrics.kdr)} KDR during ${source.performance.period.label}.`,
    trendAssessment,
    strengths: strengths.length
      ? strengths.slice(0, 4)
      : ["The available verified sample establishes a baseline for future comparison."],
    improvements: improvements.slice(0, 4),
    trainingFocus: [
      "Review the worst verified match and identify the first avoidable death.",
      "Track placement and KDR together instead of optimizing kills alone.",
      "Use the next five verified matches as a focused improvement sample.",
    ],
  };
}

function fallbackMatch(source) {
  const winner = source.results[0] ?? null;
  const highestKills =
    [...source.results].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)[0] ??
    null;
  return {
    headline: winner
      ? `${winner.name} wins ${source.match.matchCode}`
      : `${source.match.matchCode} match insight`,
    summary: winner
      ? `${winner.name} finished first with ${winner.kills} kills and ${winner.deaths} deaths. The verified scoreboard contains ${source.results.length} players.`
      : "The verified scoreboard does not contain enough result rows for a detailed match narrative.",
    turningPoints: highestKills
      ? [
          `${highestKills.name} recorded the highest kill total with ${highestKills.kills}.`,
        ]
      : [],
    standoutReasons: [winner, highestKills]
      .filter(Boolean)
      .filter(
        (item, index, items) =>
          items.findIndex((other) => other.playerId === item.playerId) === index,
      )
      .map((item) => ({
        playerId: item.playerId,
        reason:
          item.placement === 1
            ? "Finished first in the verified result."
            : "Recorded the match's highest kill total.",
      })),
    highlights: source.results
      .slice(0, 3)
      .map(
        (item) =>
          `${item.name}: ${item.kills} kills, ${item.deaths} deaths, placement ${item.placement}.`,
      ),
  };
}

function fallbackHighlight(source) {
  const leader = source.topPlayers[0] ?? null;
  return {
    title: leader
      ? `${leader.name} leads ${source.period.label}`
      : `${source.period.label} highlights`,
    caption: leader
      ? `${leader.name} heads the verified performance table while the league records ${source.totals.totalKills} kills across ${source.totals.verifiedMatches} matches.`
      : `The ${source.period.label} highlight reel is waiting for verified match data.`,
    bullets: [
      `${source.totals.verifiedMatches} verified matches`,
      `${source.totals.totalKills} total kills`,
      `${source.totals.firstPlaces} first-place finishes`,
    ],
  };
}

export const deterministicInsightService = Object.freeze({
  period: fallbackPeriod,
  player: fallbackPlayer,
  match: fallbackMatch,
  highlight: fallbackHighlight,
});
