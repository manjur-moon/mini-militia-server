import { authDatabase } from "../config/auth-database.js";
import { connectToDatabase, disconnectFromDatabase } from "../config/database.js";
import { env } from "../config/env.js";

const errors = [];
const warnings = [];

function requireCondition(condition, message) {
  if (!condition) errors.push(message);
}

function warnCondition(condition, message) {
  if (!condition) warnings.push(message);
}

function isHttps(value) {
  return value?.startsWith("https://");
}

async function runPreflight() {
  requireCondition(env.isProduction, "NODE_ENV must be production.");
  requireCondition(isHttps(env.publicAppUrl), "PUBLIC_APP_URL must use HTTPS.");
  requireCondition(isHttps(env.publicApiUrl), "PUBLIC_API_URL must use HTTPS.");
  requireCondition(isHttps(env.BETTER_AUTH_URL), "BETTER_AUTH_URL must use HTTPS.");
  requireCondition(
    env.TRUST_PROXY,
    "TRUST_PROXY must be true behind Render or Railway.",
  );
  requireCondition(
    env.clientOrigins.includes(env.publicAppUrl),
    "CLIENT_ORIGINS must include PUBLIC_APP_URL exactly.",
  );
  requireCondition(
    env.AUTH_COOKIE_SAME_SITE === "none",
    "AUTH_COOKIE_SAME_SITE must be none when frontend and backend use different origins.",
  );
  requireCondition(
    env.cloudinaryConfigured,
    "Cloudinary cloud name, API key and API secret are required in production.",
  );
  requireCondition(
    env.OCR_PROVIDER === "google-vision",
    "OCR_PROVIDER must be google-vision for the production OCR workflow.",
  );
  requireCondition(
    Boolean(env.GOOGLE_VISION_API_KEY),
    "GOOGLE_VISION_API_KEY is required for production OCR.",
  );
  warnCondition(
    env.AI_PROVIDER === "openai" || env.AI_PROVIDER === "disabled",
    "AI_PROVIDER should be openai or disabled.",
  );
  warnCondition(
    env.API_RATE_LIMIT_MAX_REQUESTS <= 1000,
    "API rate limit is unusually high for a public deployment.",
  );

  if (errors.length) {
    throw new Error(`Production configuration failed:\n- ${errors.join("\n- ")}`);
  }

  await connectToDatabase();
  await authDatabase.command({ ping: 1 });

  const safeSummary = {
    environment: env.NODE_ENV,
    databaseName: env.MONGODB_DB_NAME,
    publicAppUrl: env.publicAppUrl,
    publicApiUrl: env.publicApiUrl,
    clientOrigins: env.clientOrigins,
    cookieSameSite: env.AUTH_COOKIE_SAME_SITE,
    trustProxy: env.TRUST_PROXY,
    cloudinaryConfigured: env.cloudinaryConfigured,
    ocrProvider: env.OCR_PROVIDER,
    aiProvider: env.AI_PROVIDER,
    warnings,
  };

  console.log(JSON.stringify({ success: true, data: safeSummary }, null, 2));
}

runPreflight()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectFromDatabase();
  });
