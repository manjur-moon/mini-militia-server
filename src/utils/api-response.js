export function sendSuccess(
  response,
  { statusCode = 200, message = "Operation completed successfully.", data = null } = {},
) {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

export function sendPaginatedSuccess(
  response,
  {
    statusCode = 200,
    message = "Operation completed successfully.",
    data = [],
    pagination,
    meta,
  },
) {
  return response.status(statusCode).json({
    success: true,
    message,
    data,
    pagination,
    ...(meta === undefined ? {} : { meta }),
  });
}
