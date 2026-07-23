const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1500;

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

function finiteRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function finiteDecimal(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0.00";
  return number.toFixed(digits);
}

function renderPortrait(card, embeddedPhotoDataUri) {
  if (embeddedPhotoDataUri) {
    return `
      <image href="${escapeXml(embeddedPhotoDataUri)}" x="250" y="250" width="700" height="700"
        preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)" />`;
  }

  return `
    <circle cx="600" cy="600" r="350" fill="#111827" />
    <text x="600" y="650" text-anchor="middle" class="portrait-initials">${escapeXml(
      initials(card.player.name),
    )}</text>`;
}

export function renderPlayerCardSvg(card, { embeddedPhotoDataUri = null } = {}) {
  const rating = card.ratings ?? {};
  const playerName = escapeXml(card.player.name);
  const playerCode = escapeXml(card.player.playerId);
  const title = escapeXml(card.title?.name ?? "League Competitor");
  const formulaVersion = escapeXml(card.formulaVersion ?? "unrated");
  const overall = finiteRating(rating.overall);
  const attack = finiteRating(rating.attack);
  const survival = finiteRating(rating.survival);
  const consistency = finiteRating(rating.consistency);
  const activity = finiteRating(rating.activity);
  const kdr = finiteDecimal(card.kdr);
  const statusLabel = card.minimumMatchesMet ? "RANK ELIGIBLE" : "PROVISIONAL";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-labelledby="cardTitle cardDescription">
  <title id="cardTitle">${playerName} player card</title>
  <desc id="cardDescription">Mini Militia League player card for ${playerName}, overall rating ${overall}.</desc>
  <defs>
    <linearGradient id="cardBackground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#020617" />
      <stop offset="0.58" stop-color="#111827" />
      <stop offset="1" stop-color="#451a03" />
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fde68a" />
      <stop offset="0.5" stop-color="#f59e0b" />
      <stop offset="1" stop-color="#b45309" />
    </linearGradient>
    <radialGradient id="spotlight" cx="50%" cy="38%" r="60%">
      <stop offset="0" stop-color="#f59e0b" stop-opacity="0.28" />
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0" />
    </radialGradient>
    <clipPath id="portraitClip">
      <circle cx="600" cy="600" r="350" />
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="28" stdDeviation="35" flood-color="#000000" flood-opacity="0.58" />
    </filter>
    <style>
      .label { font: 800 28px Inter, Arial, sans-serif; letter-spacing: 5px; fill: #fbbf24; }
      .value { font: 900 62px Inter, Arial, sans-serif; fill: #f8fafc; }
      .name { font: 900 78px Inter, Arial, sans-serif; fill: #f8fafc; }
      .meta { font: 800 30px Inter, Arial, sans-serif; fill: #cbd5e1; }
      .rating-label { font: 800 25px Inter, Arial, sans-serif; letter-spacing: 3px; fill: #94a3b8; }
      .rating-value { font: 900 62px Inter, Arial, sans-serif; fill: #f8fafc; }
      .portrait-initials { font: 900 220px Inter, Arial, sans-serif; fill: #f59e0b; }
      .footer { font: 700 23px Inter, Arial, sans-serif; fill: #94a3b8; }
    </style>
  </defs>

  <rect width="1200" height="1500" rx="90" fill="url(#cardBackground)" />
  <rect x="28" y="28" width="1144" height="1444" rx="72" fill="none" stroke="url(#gold)" stroke-width="8" />
  <path d="M70 305 L70 120 Q70 70 120 70 H420 L335 150 H150 V305 Z" fill="url(#gold)" opacity="0.95" />
  <path d="M1130 1195 V1380 Q1130 1430 1080 1430 H780 L865 1350 H1050 V1195 Z" fill="url(#gold)" opacity="0.85" />
  <circle cx="600" cy="555" r="510" fill="url(#spotlight)" />

  <g filter="url(#shadow)">
    <circle cx="600" cy="600" r="374" fill="#020617" stroke="url(#gold)" stroke-width="14" />
    ${renderPortrait(card, embeddedPhotoDataUri)}
  </g>

  <g transform="translate(88 105)">
    <text class="label">OVERALL</text>
    <text y="95" class="value">${overall}</text>
  </g>

  <g transform="translate(850 112)">
    <text text-anchor="end" class="label">${playerCode}</text>
    <text y="58" text-anchor="end" class="meta">${escapeXml(statusLabel)}</text>
  </g>

  <g transform="translate(600 1010)">
    <text text-anchor="middle" class="name">${playerName}</text>
    <text y="58" text-anchor="middle" class="label">${title}</text>
  </g>

  <g transform="translate(95 1150)">
    <rect width="1010" height="225" rx="42" fill="#020617" fill-opacity="0.72" stroke="#334155" stroke-width="2" />

    <g transform="translate(82 58)">
      <text class="rating-label">ATT</text>
      <text y="73" class="rating-value">${attack}</text>
    </g>
    <g transform="translate(285 58)">
      <text class="rating-label">SUR</text>
      <text y="73" class="rating-value">${survival}</text>
    </g>
    <g transform="translate(495 58)">
      <text class="rating-label">CON</text>
      <text y="73" class="rating-value">${consistency}</text>
    </g>
    <g transform="translate(705 58)">
      <text class="rating-label">ACT</text>
      <text y="73" class="rating-value">${activity}</text>
    </g>
    <g transform="translate(890 58)">
      <text text-anchor="middle" class="rating-label">KDR</text>
      <text y="73" text-anchor="middle" class="rating-value">${escapeXml(kdr)}</text>
    </g>
  </g>

  <text x="95" y="1432" class="footer">MINI MILITIA LEAGUE &amp; ANALYTICS</text>
  <text x="1105" y="1432" text-anchor="end" class="footer">FORMULA ${formulaVersion}</text>
</svg>`;
}

export const PLAYER_CARD_DIMENSIONS = Object.freeze({
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
});
