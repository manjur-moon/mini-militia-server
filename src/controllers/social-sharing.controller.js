import sharp from "sharp";
import { playerCardService } from "../services/player-card.service.js";
import {
  renderAchievementShareSvg,
  renderPlayerProfileShareSvg,
  renderWeeklyMvpShareSvg,
} from "../services/social-card-renderer.service.js";
import { socialSharingService } from "../services/social-sharing.service.js";
import { sendSuccess } from "../utils/api-response.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setPublicCache(response, contentType) {
  response.set({
    "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
}

async function toPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

async function photoDataUri(photoUrl) {
  return playerCardService.fetchEmbeddedPhotoDataUri(photoUrl);
}

function shareHtml(data, { ogType = "website" } = {}) {
  const { title, description, urls } = data;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(urls.canonicalUrl)}" />
  <meta property="og:site_name" content="Mini Militia League &amp; Analytics" />
  <meta property="og:type" content="${escapeHtml(ogType)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(urls.shareUrl)}" />
  <meta property="og:image" content="${escapeHtml(urls.imageUrl)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(urls.imageUrl)}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(urls.imageUrl)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(title)}" />
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(urls.canonicalUrl)}">View on Mini Militia League</a></p>
    <img src="${escapeHtml(urls.imageUrl)}" width="1200" height="630" alt="${escapeHtml(title)}" />
  </main>
</body>
</html>`;
}

export async function getPlayerProfileShare(request, response) {
  const data = await socialSharingService.getPlayerProfile(
    request.validated.params.playerId,
  );
  return sendSuccess(response, {
    message: "Player profile sharing metadata retrieved successfully.",
    data,
  });
}

export async function getPlayerProfileShareImage(request, response) {
  const data = await socialSharingService.getPlayerProfile(
    request.validated.params.playerId,
  );
  const embeddedPhotoDataUri = await photoDataUri(data.player.photoUrl);
  const png = await toPng(renderPlayerProfileShareSvg(data, { embeddedPhotoDataUri }));
  setPublicCache(response, "image/png");
  response.set(
    "Content-Disposition",
    `inline; filename="${data.player.playerId}-profile-share.png"`,
  );
  return response.status(200).send(png);
}

export async function getAchievementShare(request, response) {
  const data = await socialSharingService.getAchievement(
    request.validated.params.playerId,
    request.validated.params.achievementCode,
  );
  return sendSuccess(response, {
    message: "Achievement sharing metadata retrieved successfully.",
    data,
  });
}

export async function getAchievementShareImage(request, response) {
  const data = await socialSharingService.getAchievement(
    request.validated.params.playerId,
    request.validated.params.achievementCode,
  );
  const embeddedPhotoDataUri = await photoDataUri(data.player.photoUrl);
  const png = await toPng(renderAchievementShareSvg(data, { embeddedPhotoDataUri }));
  setPublicCache(response, "image/png");
  response.set(
    "Content-Disposition",
    `inline; filename="${data.player.playerId}-${data.achievement.code}-achievement.png"`,
  );
  return response.status(200).send(png);
}

export async function getWeeklyMvpShare(request, response) {
  const data = await socialSharingService.getWeeklyMvp(request.validated.query);
  return sendSuccess(response, {
    message: "Weekly MVP sharing metadata retrieved successfully.",
    data,
  });
}

export async function getWeeklyMvpShareImage(request, response) {
  const data = await socialSharingService.getWeeklyMvp(request.validated.query);
  const embeddedPhotoDataUri = await photoDataUri(data.award.player.photoUrl);
  const png = await toPng(renderWeeklyMvpShareSvg(data, { embeddedPhotoDataUri }));
  setPublicCache(response, "image/png");
  response.set("Content-Disposition", "inline; filename=weekly-mvp-share.png");
  return response.status(200).send(png);
}

export async function getPlayerProfileSharePage(request, response) {
  const data = await socialSharingService.getPlayerProfile(
    request.validated.params.playerId,
  );
  setPublicCache(response, "text/html; charset=utf-8");
  return response.status(200).send(shareHtml(data, { ogType: "profile" }));
}

export async function getAchievementSharePage(request, response) {
  const data = await socialSharingService.getAchievement(
    request.validated.params.playerId,
    request.validated.params.achievementCode,
  );
  setPublicCache(response, "text/html; charset=utf-8");
  return response.status(200).send(shareHtml(data, { ogType: "article" }));
}

export async function getWeeklyMvpSharePage(request, response) {
  const data = await socialSharingService.getWeeklyMvp(request.validated.query);
  setPublicCache(response, "text/html; charset=utf-8");
  return response.status(200).send(shareHtml(data));
}
