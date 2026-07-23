import { sendSuccess } from "../utils/api-response.js";
import { getHealthReport } from "../services/health.service.js";

export function getHealth(request, response) {
  const data = getHealthReport({
    verbose: request.validated.query.verbose,
  });

  return sendSuccess(response, {
    message: "API health check completed.",
    data,
  });
}
