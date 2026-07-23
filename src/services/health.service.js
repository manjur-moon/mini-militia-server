import mongoose from "mongoose";
import { env } from "../config/env.js";

const DATABASE_STATES = Object.freeze({
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
});

export function getHealthReport({ verbose = false } = {}) {
  const databaseState = DATABASE_STATES[mongoose.connection.readyState] ?? "unknown";

  const report = {
    service: "mini-militia-api",
    status: "ok",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      status: databaseState,
    },
  };

  if (verbose && !env.isProduction) {
    report.runtime = {
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      leagueTimezone: env.LEAGUE_TIMEZONE,
    };
  }

  return report;
}
