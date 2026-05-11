import { AppError } from '../utils/AppError.js';

export const verifyInternalRequest = (req, _res, next) => {
  const key = req.headers['x-internal-service'];
  if (!key || key !== process.env.INTERNAL_SERVICE_KEY) {
    return next(new AppError('Forbidden: internal access only.', 403));
  }
  next();
};
