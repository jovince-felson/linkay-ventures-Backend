require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || 'root123',
    database: process.env.DB_NAME || 'linkay_assets',
    host:     process.env.DB_HOST || 'mysql',
    port:     Number(process.env.DB_PORT) || 3306,
    dialect:  'mysql',
    logging:  false,
  },
};
