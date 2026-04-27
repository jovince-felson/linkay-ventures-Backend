import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, _next) => {
  logger.error(`${err.message}`, { stack: err.stack, path: req.path, method: req.method });

  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      errorCode: err.errorCode || null,
      message: err.message,
    });
  }

  // Sequelize unique constraint
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'A record with this value already exists.',
    });
  }

  // Sequelize validation
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: err.errors?.[0]?.message || 'Validation error.',
    });
  }

  // Generic
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again.',
  });
};
