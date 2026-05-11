import { logger } from 'linkay-shared-utils';

export function errorHandler(err, req, res, _next) {
  logger.error(`[${req.method}] ${req.path} — ${err.message}`, { stack: err.stack });

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return res.status(422).json({ success: false, message: 'Validation error', errors });
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(409).json({ success: false, message: 'Related resource not found or conflict' });
  }

  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  err.details?.map((d) => d.message) || [err.message],
    });
  }

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}
