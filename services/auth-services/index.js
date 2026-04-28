import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import sequelize from "./src/config/database.js";
import authV1Routes from "./src/routes/v1/auth.routes.js";
import { logger, listenToEvent, Topics } from "rhoam-shared-utils";
import { routeAuthEvents } from "./src/events/auth.events.js";
import cookieParser from "cookie-parser";
import redis from "./src/config/redis.js";



dotenv.config();

const app = express();

(async () => {
  try {
    await redis.ping();
    console.log("Redis ready");
  } catch (err) {
    console.error("Redis not reachable", err);
    process.exit(1);
  }
})();

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', authV1Routes);

(async () => {
  try {
    await listenToEvent(
      "ekyc-service-group",
      Topics.EKYC_EVENTS,
      async (key, data) => {
        try {
          logger.info(`Kafka Event Received → Key: ${key}`);

          await routeAuthEvents(key, data);

        } catch (handlerErr) {
          logger.error("Error inside routeAuthEvents", handlerErr);
        }
      }
    );

  } catch (err) {
    logger.error("Fatal Kafka Listener Error", err);
  }
})();

sequelize
  .sync()
  .then(() => console.log("Database connected"))
  .catch((err) => {
    console.error("Database error:", err);
    logger.error("Database Error For Authentication Service", err);
  });


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("Auth Service Running On PORT", PORT);
});