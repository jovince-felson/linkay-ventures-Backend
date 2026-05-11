import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import gatewayV1Routes from "./src/routes/v1/gateway.routes.js";
import sequelize from "./src/config/database.js";
import { routeGatewayEvent } from "./src/events/gateway.events.js";
import helmet from "helmet";
import { apiLimiter } from "./src/middlewares/ratelimit.js";
import compression from "compression";
import { listenToEvent, Topics, logger } from "linkay-shared-utils";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // Allow rate limiter to accept X-Forwarded-For headers from proxy
// app.use(cors({
//   origin: (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()),
//   credentials: true,
// }));
app.use(cors({
  origin: function (origin, callback) {
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    if (!origin || allowed.includes(origin)) {
      callback(null, origin || true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));


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
      },
    );
  } catch (err) {
    console.error("Fatal Kafka Listener Error", err);
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
