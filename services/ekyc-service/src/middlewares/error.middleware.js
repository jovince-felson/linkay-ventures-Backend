import logger from '../utils/logger.js';

export const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  if (!err.isOperational) {
    logger.error('Unhandled error:', err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(err.code && { code: err.code }),
  });
};
