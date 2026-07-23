import { app } from "./app.js";
import { connectToDatabase, disconnectFromDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

let httpServer;
let shuttingDown = false;

async function startServer() {
  await connectToDatabase();

  httpServer = app.listen(env.PORT, () => {
    logger.info("API server started.", {
      port: env.PORT,
      environment: env.NODE_ENV,
    });
  });
}

async function shutdown(signal, exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info("Graceful shutdown started.", { signal });

  const forceExitTimer = setTimeout(() => {
    logger.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  if (httpServer) {
    await new Promise((resolve, reject) => {
      httpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  await disconnectFromDatabase();
  logger.info("Graceful shutdown completed.");
  process.exit(exitCode);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection.", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
  void shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception.", {
    error: error.message,
    stack: env.isProduction ? undefined : error.stack,
  });
  void shutdown("uncaughtException", 1);
});

startServer().catch((error) => {
  logger.error("API server failed to start.", {
    error: error.message,
    stack: env.isProduction ? undefined : error.stack,
  });
  process.exit(1);
});
