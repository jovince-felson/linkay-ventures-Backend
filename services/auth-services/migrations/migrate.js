require('dotenv').config();
const { sequelize } = require('../src/config/database');

// Import all models so Sequelize registers them
require('../src/models/index');

const run = async () => {
  const action = process.argv[2];

  try {
    await sequelize.authenticate();
    console.log('[Migration] DB connected');

    if (action === 'undo') {
      await sequelize.drop();
      console.log('[Migration] All tables dropped');
    } else {
      // force: false  → won't overwrite existing tables
      // alter: true   → adds new columns if model changed
      await sequelize.sync({ alter: true });
      console.log('[Migration] Tables synced successfully');
    }

    process.exit(0);
  } catch (err) {
    console.error('[Migration] Failed:', err);
    process.exit(1);
  }
};

run();
