export const jwtConfig = {
  secret:          process.env.JWT_SECRET || 'change-me-in-production',
  expiresIn:       process.env.JWT_EXPIRES_IN || '24h',
  refreshSecret:   process.env.JWT_REFRESH_SECRET || 'refresh-change-me',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};
