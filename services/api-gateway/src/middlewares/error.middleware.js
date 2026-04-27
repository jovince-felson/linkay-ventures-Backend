import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  logger.error(`Gateway error: ${err.message}`, { stack: err.stack });
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'An unexpected error occurred.',
  });
};
