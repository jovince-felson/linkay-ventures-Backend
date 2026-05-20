export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

export const sendCreated = (res, data = null, message = 'Created successfully') =>
  sendSuccess(res, data, message, 201);

export const sendError = (res, message = 'An error occurred', statusCode = 500) =>
  res.status(statusCode).json({ success: false, message });

export const sendNotFound    = (res, message = 'Resource not found') => sendError(res, message, 404);
export const sendUnauthorized= (res, message = 'Unauthorized')        => sendError(res, message, 401);
export const sendForbidden   = (res, message = 'Forbidden')           => sendError(res, message, 403);
