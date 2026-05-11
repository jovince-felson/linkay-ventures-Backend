require('dotenv').config();

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'linkay_files',
    host:     process.env.DB_HOST || '127.0.0.1',
    port:     Number(process.env.DB_PORT) || 3306,
    dialect:  'mysql',
    logging:  false,
  },
};
