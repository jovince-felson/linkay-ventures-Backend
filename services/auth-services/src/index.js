require('dotenv').config();
const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const morgan     = require('morgan');
const env        = require('./config/env');
const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth.routes');

const app = express();

// ─── Global Middlewares ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date() })
);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();
    app.listen(env.PORT, () =>
      console.log(`[auth-service] running on port ${env.PORT} — ${env.NODE_ENV}`)
    );
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
};

start();

module.exports = app;
