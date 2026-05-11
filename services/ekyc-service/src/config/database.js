import { Sequelize } from 'sequelize';
import mysql2 from 'mysql2/promise';
import logger from '../utils/logger.js';

const {
  DB_HOST = '127.0.0.1',
  DB_USER = 'root',
  DB_PASS = '',
  DB_PORT = '3306',
  DB_NAME = 'linkey_ekyc',
} = process.env;

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: Number(DB_PORT),
  dialect: 'mysql',
  logging: false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
});

const ensureDatabaseExists = async () => {
  const conn = await mysql2.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASS,
  });
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
  await conn.end();
};

export const connectDB = async () => {
  await ensureDatabaseExists();
  await sequelize.authenticate();
  await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  logger.info(`eKYC database "${DB_NAME}" connected`);
};

export default sequelize;
