import logger from '../utils/logger.js';

export const requestLogger = (req, _res, next) => {
  logger.info(`→ ${req.method} ${req.originalUrl} [${req.ip}]`);
  next();
};
