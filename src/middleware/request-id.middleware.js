import { randomUUID } from "node:crypto";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestIdMiddleware(request, response, next) {
  const incomingRequestId = request.get("x-request-id");
  const requestId =
    incomingRequestId && UUID_PATTERN.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  request.id = requestId;
  response.setHeader("X-Request-ID", requestId);
  next();
}
