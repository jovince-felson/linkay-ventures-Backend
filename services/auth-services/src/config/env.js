require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3003,

  db: {
    host:             process.env.DB_HOST || 'localhost',
    port:             parseInt(process.env.DB_PORT, 10) || 3306,
    name:             process.env.DB_NAME || 'linkay_auth',
    user:             process.env.DB_USER || 'root',
    password:         process.env.DB_PASSWORD || '',
  },

  jwt: {
    secret:           process.env.JWT_SECRET           || 'changeme',
    expiresIn:        process.env.JWT_EXPIRES_IN        || '15m',
    refreshSecret:    process.env.JWT_REFRESH_SECRET    || 'changeme_refresh',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
};

module.exports = env;
