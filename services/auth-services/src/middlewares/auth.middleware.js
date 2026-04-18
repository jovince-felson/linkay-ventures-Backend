const { verifyAccessToken } = require('../utils/jwt');
const { error }             = require('../utils/response');

const authenticate = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer '))
      return error(res, 'No token provided', 401);

    const token   = header.split(' ')[1];
    req.user      = verifyAccessToken(token);
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return error(res, 'Forbidden: insufficient permissions', 403);
  next();
};

module.exports = { authenticate, authorize };
