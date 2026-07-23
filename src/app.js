import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth.js";
import { corsOptions } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorMiddleware } from "./middleware/error.middleware.js";
import { notFoundMiddleware } from "./middleware/not-found.middleware.js";
import { apiRateLimiter } from "./middleware/rate-limit.middleware.js";
import { requestIdMiddleware } from "./middleware/request-id.middleware.js";
import { requestLogger } from "./middleware/request-logger.middleware.js";
import { apiRouter } from "./routes/index.js";
import { shareRouter } from "./routes/share.routes.js";

export const app = express();

app.disable("x-powered-by");

if (env.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(cors(corsOptions));
app.use(compression());
app.use(apiRateLimiter);

// Better Auth must receive the raw request before Express body parsers.
app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json({ limit: env.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.JSON_BODY_LIMIT }));
app.use(cookieParser());

app.use(shareRouter);
app.use(apiRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
