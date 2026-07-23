import sharp from "sharp";
import { playerCardService } from "../services/player-card.service.js";
import { renderPlayerCardSvg } from "../services/player-card-renderer.service.js";
import { sendSuccess } from "../utils/api-response.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function getPlayerCard(request, response) {
  const card = await playerCardService.getCard({
    playerCode: request.validated.params.playerId,
    ...request.validated.query,
  });
  return sendSuccess(response, {
    message: "Player card retrieved successfully.",
    data: card,
  });
}

export async function getPlayerCardImage(request, response) {
  const card = await playerCardService.getCard({
    playerCode: request.validated.params.playerId,
    ...request.validated.query,
  });
  const embeddedPhotoDataUri = await playerCardService.fetchEmbeddedPhotoDataUri(
    card.player.profileImage?.secureUrl,
  );
  const svg = renderPlayerCardSvg(card, { embeddedPhotoDataUri });

  response.set({
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "Content-Disposition": `inline; filename="${card.player.playerId}-player-card.svg"`,
    "Content-Type": "image/svg+xml; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  return response.status(200).send(svg);
}

export async function getPlayerCardPng(request, response) {
  const card = await playerCardService.getCard({
    playerCode: request.validated.params.playerId,
    ...request.validated.query,
  });
  const embeddedPhotoDataUri = await playerCardService.fetchEmbeddedPhotoDataUri(
    card.player.profileImage?.secureUrl,
  );
  const svg = renderPlayerCardSvg(card, { embeddedPhotoDataUri });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();

  response.set({
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "Content-Disposition": `inline; filename="${card.player.playerId}-player-card.png"`,
    "Content-Type": "image/png",
    "X-Content-Type-Options": "nosniff",
  });
  return response.status(200).send(png);
}

export async function getPlayerCardSharePage(request, response) {
  const card = await playerCardService.getCard({
    playerCode: request.validated.params.playerId,
    ...request.validated.query,
  });
  const title = `${card.player.name} — ${card.ratings.overall} OVR Mini Militia Player Card`;
  const description = `${card.player.name} (${card.player.playerId}) has an overall rating of ${card.ratings.overall}, ${card.ratings.attack} attack and ${card.ratings.survival} survival.`;

  response.set({
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "Content-Type": "text/html; charset=utf-8",
  });
  return response.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(card.urls.shareUrl)}" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(card.urls.shareUrl)}" />
  <meta property="og:image" content="${escapeHtml(card.urls.imageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="1500" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(card.urls.imageUrl)}" />
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(card.urls.cardPageUrl)}">View interactive player card</a></p>
    <img src="${escapeHtml(card.urls.imageUrl)}" width="600" height="750" alt="${escapeHtml(card.player.name)} player card" />
  </main>
</body>
</html>`);
}
