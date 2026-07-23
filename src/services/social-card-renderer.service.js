const WIDTH = 1200;
const HEIGHT = 630;

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function initials(name) {
  return String(name ?? "Player")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function finite(value, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return digits ? Number(0).toFixed(digits) : "0";
  return digits ? parsed.toFixed(digits) : String(Math.round(parsed));
}

function truncate(value, maximum) {
  const text = String(value ?? "").trim();
  return text.length <= maximum ? text : `${text.slice(0, maximum - 1)}…`;
}

function portrait(player, embeddedPhotoDataUri) {
  if (embeddedPhotoDataUri) {
    return `<image href="${escapeXml(embeddedPhotoDataUri)}" x="70" y="150" width="270" height="270" preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)" />`;
  }
  return `<circle cx="205" cy="285" r="135" fill="#111827" />
    <text x="205" y="320" text-anchor="middle" class="initials">${escapeXml(initials(player?.name))}</text>`;
}

function baseSvg({ title, description, eyebrow, player, embeddedPhotoDataUri, body }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617" />
      <stop offset="0.58" stop-color="#111827" />
      <stop offset="1" stop-color="#451a03" />
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="70%">
      <stop offset="0" stop-color="#f59e0b" stop-opacity="0.34" />
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0" />
    </radialGradient>
    <clipPath id="portraitClip"><circle cx="205" cy="285" r="135" /></clipPath>
    <style>
      .eyebrow { font: 800 22px Inter, Arial, sans-serif; letter-spacing: 5px; fill: #fbbf24; }
      .title { font: 900 56px Inter, Arial, sans-serif; fill: #f8fafc; }
      .description { font: 600 25px Inter, Arial, sans-serif; fill: #cbd5e1; }
      .name { font: 900 35px Inter, Arial, sans-serif; fill: #f8fafc; }
      .code { font: 800 20px Inter, Arial, sans-serif; letter-spacing: 3px; fill: #fbbf24; }
      .metric-label { font: 800 18px Inter, Arial, sans-serif; letter-spacing: 2px; fill: #94a3b8; }
      .metric-value { font: 900 38px Inter, Arial, sans-serif; fill: #f8fafc; }
      .initials { font: 900 82px Inter, Arial, sans-serif; fill: #f59e0b; }
      .footer { font: 700 18px Inter, Arial, sans-serif; letter-spacing: 2px; fill: #94a3b8; }
    </style>
  </defs>
  <rect width="1200" height="630" rx="40" fill="url(#background)" />
  <rect width="1200" height="630" rx="40" fill="url(#glow)" />
  <rect x="24" y="24" width="1152" height="582" rx="30" fill="none" stroke="#f59e0b" stroke-width="3" opacity="0.72" />
  <text x="405" y="88" class="eyebrow">${escapeXml(eyebrow)}</text>
  <text x="405" y="158" class="title">${escapeXml(truncate(title, 31))}</text>
  <text x="405" y="202" class="description">${escapeXml(truncate(description, 66))}</text>
  <circle cx="205" cy="285" r="146" fill="#020617" stroke="#f59e0b" stroke-width="8" />
  ${portrait(player, embeddedPhotoDataUri)}
  <text x="205" y="475" text-anchor="middle" class="name">${escapeXml(truncate(player?.name ?? "League Player", 18))}</text>
  <text x="205" y="510" text-anchor="middle" class="code">${escapeXml(player?.playerId ?? "MML")}</text>
  ${body}
  <text x="56" y="575" class="footer">MINI MILITIA LEAGUE &amp; ANALYTICS</text>
  <text x="1144" y="575" text-anchor="end" class="footer">VERIFIED DATA ONLY</text>
</svg>`;
}

function metric(x, label, value) {
  return `<g transform="translate(${x} 292)">
    <text class="metric-label">${escapeXml(label)}</text>
    <text y="54" class="metric-value">${escapeXml(value)}</text>
  </g>`;
}

export function renderPlayerProfileShareSvg(data, options = {}) {
  const metrics = data.statistics ?? {};
  return baseSvg({
    title: data.title,
    description: data.description,
    eyebrow: "PUBLIC PLAYER PROFILE",
    player: data.player,
    embeddedPhotoDataUri: options.embeddedPhotoDataUri,
    body: `${metric(405, "MATCHES", finite(metrics.matchesPlayed))}
      ${metric(590, "KILLS", finite(metrics.totalKills))}
      ${metric(750, "KDR", finite(metrics.kdr, 2))}
      ${metric(905, "WINS", finite(metrics.firstPlaceCount))}
      ${metric(1050, "RANK", metrics.globalRank ? `#${finite(metrics.globalRank)}` : "—")}`,
  });
}

export function renderAchievementShareSvg(data, options = {}) {
  const achievement = data.achievement;
  const unlockedDate = data.unlockedAt
    ? new Date(data.unlockedAt).toISOString().slice(0, 10)
    : "Verified";
  return baseSvg({
    title: achievement.name,
    description: achievement.description,
    eyebrow: "ACHIEVEMENT UNLOCKED",
    player: data.player,
    embeddedPhotoDataUri: options.embeddedPhotoDataUri,
    body: `${metric(405, "CATEGORY", String(achievement.category ?? "milestone").toUpperCase())}
      ${metric(660, "TARGET", finite(achievement.targetValue))}
      ${metric(835, "UNLOCKED", unlockedDate)}
      ${metric(1050, "VERSION", achievement.version ?? "v1")}`,
  });
}

export function renderWeeklyMvpShareSvg(data, options = {}) {
  const award = data.award;
  return baseSvg({
    title: `${award.player.name} is Weekly MVP`,
    description: `${data.period.label} champion with ${finite(award.score, 2)} MVP points.`,
    eyebrow: "WEEKLY MVP CHAMPION",
    player: award.player,
    embeddedPhotoDataUri: options.embeddedPhotoDataUri,
    body: `${metric(405, "MVP SCORE", finite(award.score, 2))}
      ${metric(640, "KILL SCORE", finite(award.scoreBreakdown?.killScore, 2))}
      ${metric(855, "PLACEMENT", finite(award.scoreBreakdown?.placementBonus, 2))}
      ${metric(1050, "FORMULA", award.formulaVersion ?? "v1")}`,
  });
}

export const SOCIAL_SHARE_IMAGE_DIMENSIONS = Object.freeze({
  width: WIDTH,
  height: HEIGHT,
});
