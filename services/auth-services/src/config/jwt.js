export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'fallback_secret_change_in_production',
  accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
  refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  emailExpiry: process.env.JWT_EMAIL_EXPIRY || '24h',
  resetExpiry: process.env.JWT_RESET_EXPIRY || '1h',
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};
