import jwt            from 'jsonwebtoken';
import { jwtConfig } from '../config/jwt.js';
import { sendUnauthorized } from '../utils/response.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Authorization token missing');
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, jwtConfig.secret);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return sendUnauthorized(res, msg);
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.split(' ')[1], jwtConfig.secret);
    } catch { /* ignore */ }
  }
  next();
}
