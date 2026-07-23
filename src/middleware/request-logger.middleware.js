import morgan from "morgan";
import { logger } from "../config/logger.js";

morgan.token("request-id", (request) => request.id ?? "unknown");

export const requestLogger = morgan(
  ":method :url :status :response-time ms requestId=:request-id",
  {
    stream: {
      write(message) {
        logger.info("HTTP request", {
          detail: message.trim(),
        });
      },
    },
  },
);
