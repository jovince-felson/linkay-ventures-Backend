import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import sequelize from "./src/config/database.js";
import { listenToEvent, Topics, logger } from "linkay-shared-utils";
import { routeNotificationEvent } from "./src/events/notificationEvents.js";
import NotificationV1Routes from "./src/routes/v1/notification.routes.js";
import InternalRoutes from "./src/routes/internal.routes.js";
import { startEmailConsumer } from "./src/consumers/email.consumer.js";

dotenv.config();

// Boot Bull mail worker — non-fatal if Redis is unavailable
import("./src/queues/mail.worker.js").catch((err) => {
  logger.error("Mail worker failed to load (Redis may not be running):", err.message);
});

const app = express();

app.use(cors());
app.use(express.json());

// Public + admin notification routes
app.use("/api/v1/notification", NotificationV1Routes);

// Internal service-to-service routes (auth → notification)
app.use("/internal", InternalRoutes);

// Kafka listener — non-fatal if Kafka is unavailable
(async () => {
  try {
    await listenToEvent(
      "notification-service-group",
      Topics.USER_EVENTS,
      async (key, data) => {
        try {
          logger.info(`Kafka Event Received → Key: ${key}`);
          await routeNotificationEvent(key, data);
        } catch (handlerErr) {
          logger.error("Error inside routeNotificationEvent", handlerErr);
        }
      },
    );
  } catch (err) {
    logger.warn("Kafka listener unavailable — continuing without it:", err.message);
  }
})();

// Email Kafka consumer — non-fatal if Kafka is unavailable
startEmailConsumer().catch((err) => {
  logger.warn("Email consumer unavailable — continuing without it:", err.message);
});

sequelize
  .sync()
  .then(() => logger.info("Notification service DB connected"))
  .catch((err) => logger.error("Notification service DB error:", err));

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => {
  logger.info(`Notification service running on port ${PORT}`);
});
