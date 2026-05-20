import jwt from 'jsonwebtoken';
import { sendUnauthorized } from '../utils/response.js';

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Authorization token missing');
  }

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return sendUnauthorized(res, msg);
  }
}
