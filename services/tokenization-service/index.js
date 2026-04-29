import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

import { connectDB } from "./src/config/database.js";
import tokenizationRoutes from "./src/routes/v1/tokenization.routes.js";

// Register Bull job processor
import "./src/jobs/tokenization.processor.js";

// Kafka listeners (non-blocking)
import { startTokenizationEventListeners } from "./src/events/tokenization.events.js";

import { logger, RESPONSE_CODES } from "linkay-shared-utils";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4005;

// ── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: RESPONSE_CODES.RATE_LIMITED, message: "Too many requests" },
});
app.use(limiter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.status(200).json({
        success: true,
        service: "tokenization-service",
        status: "healthy",
        timestamp: new Date().toISOString(),
        port: PORT,
    });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/v1/tokenization", tokenizationRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({
        success: false,
        code: RESPONSE_CODES.NOT_FOUND,
        message: `Route ${req.method} ${req.path} not found`,
    });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    logger.error("Unhandled error:", err.message);
    res.status(500).json({
        success: false,
        code: RESPONSE_CODES.SERVER_ERROR,
        message: "Internal server error",
    });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const start = async () => {
    await connectDB();
    await startTokenizationEventListeners();

    app.listen(PORT, () => {
        logger.info(`Tokenization Service running on port ${PORT}`);
        logger.info(`Health: http://localhost:${PORT}/health`);
        logger.info(`API:    http://localhost:${PORT}/api/v1/tokenization`);
    });
};

start();
