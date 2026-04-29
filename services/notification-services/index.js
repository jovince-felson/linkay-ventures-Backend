import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import sequelize from "./src/config/database.js";
import { listenToEvent, Topics, logger } from "rhoam-shared-utils";
import { routeNotificationEvent } from "./src/events/notificationEvents.js";
import NotificationV1Routes from "./src/routes/v1/notification.routes.js";
import { startEmailConsumer } from "./src/consumers/email.consumer.js";

dotenv.config();
import "./src/queues/mail.worker.js";
const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1/notification", NotificationV1Routes);

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
    logger.error("Fatal Kafka Listener Error", err);
  }
})();

startEmailConsumer().catch((err) => {
  logger.error("Failed to start email consumer", err);
  process.exit(1);
});

sequelize
  .sync()
  .then(() => console.log("Database connected"))
  .catch((err) => {
    console.error("Database error:", err);
    logger.error("Database Error For Notification Service", err);
  });

const PORT = process.env.PORT || 4002;

app.listen(PORT, () => {
  console.log("Notification Service Running On PORT", PORT);
});
