import { sendSuccess } from "../utils/api-response.js";

function createSafeSessionPayload(authSession) {
  const { user, session } = authSession;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image ?? null,
      role: user.role,
      status: user.status,
      linkedPlayerId: user.linkedPlayerId ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
  };
}

export function getCurrentAccount(request, response) {
  return sendSuccess(response, {
    message: "Authenticated account retrieved successfully.",
    data: createSafeSessionPayload(request.auth),
  });
}
