import { Sequelize } from 'sequelize';

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host:    process.env.DB_HOST || 'localhost',
    port:    Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    pool: {
      max:     10,
      min:     0,
      acquire: 30000,
      idle:    10000,
    },
    define: {
      timestamps:  true,
      underscored: true,
    },
  },
);

export async function connectDatabase() {
  await sequelize.authenticate();
  if (process.env.DB_SYNC === 'true') {
    await sequelize.sync({ alter: true });
  }
}

export default sequelize;
