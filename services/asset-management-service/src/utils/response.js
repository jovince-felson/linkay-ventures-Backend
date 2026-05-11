export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

export const sendCreated = (res, data = null, message = 'Created successfully') =>
  sendSuccess(res, data, message, 201);

export const sendPaginated = (res, items, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    pagination,
  });
};

export const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

export const sendNotFound = (res, message = 'Resource not found') =>
  sendError(res, message, 404);

export const sendUnauthorized = (res, message = 'Unauthorized') =>
  sendError(res, message, 401);

export const sendForbidden = (res, message = 'Forbidden') =>
  sendError(res, message, 403);

export const sendValidationError = (res, errors, message = 'Validation failed') =>
  sendError(res, message, 422, errors);
