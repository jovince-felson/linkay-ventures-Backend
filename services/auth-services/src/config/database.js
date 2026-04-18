const { Sequelize } = require('sequelize');
const env = require('./env');

const sequelize = new Sequelize(env.db.name, env.db.user, env.db.password, {
  host:    env.db.host,
  port:    env.db.port,
  dialect: 'mysql',
  logging: env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max:     10,
    min:     0,
    acquire: 30000,
    idle:    10000,
  },
  define: {
    timestamps:  true,
    underscored: true,  // snake_case columns
  },
});

const connectDB = async () => {
  await sequelize.authenticate();
  console.log('[DB] MySQL connected successfully');
};

module.exports = { sequelize, connectDB };
