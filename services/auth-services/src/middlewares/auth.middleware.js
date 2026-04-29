import { verifyToken } from '../utils/jwt.util.js';
import { AppError } from '../utils/AppError.js';

export const authenticate = (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Session expired. Please log in again.', 401, 'AUTH_006');
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return next(new AppError('Session expired. Please log in again.', 401, 'AUTH_006'));
    }
    next(error);
  }
};

export const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403, 'AUTH_007'));
    }
    next();
  };
};
