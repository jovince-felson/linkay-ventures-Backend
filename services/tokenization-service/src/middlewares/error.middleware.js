export function errorHandler(err, req, res, _next) {
  console.error(`[${req.method}] ${req.path} —`, err.message, err.stack);

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map((e) => ({ field: e.path, message: e.message }));
    return res.status(422).json({ success: false, message: 'Validation error', errors });
  }

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal server error',
  });
}
