import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import gatewayV1Routes from "./src/routes/v1/gateway.routes.js";
import sequelize from "./src/config/database.js";
import { routeGatewayEvent } from "./src/events/gateway.events.js";
import helmet from "helmet";
import { apiLimiter } from "./src/middlewares/ratelimit.js";
import compression from "compression";


dotenv.config();

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // Allow rate limiter to accept X-Forwarded-For headers from proxy
app.use(helmet());
app.use(compression());
app.use(apiLimiter);
app.use(morgan("dev"));

app.use("/", gatewayV1Routes);

(async () => {
  try {
    await listenToEvent(
      "api-gateway-service-group",
      Topics.USER_EVENTS,
      async (key, data) => {
        try {
          logger.info(`Kafka Event Received → Key: ${key}`);
          await routeGatewayEvent(key, data);
        } catch (err) {
          logger.error("Error inside routeGatewayEvent", err);
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
    logger.error("Database Error For API Gateway", err);
  });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
});
