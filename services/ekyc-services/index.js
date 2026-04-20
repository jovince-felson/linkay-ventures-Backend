import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import EkycV1Routes from "./src/routes/v1/ekyc.routes.js";
import sequelize from "./src/config/database.js";
import { logger,listenToEvent,Topics, } from "rhoam-shared-utils";
import { routeEkycEvent } from "./src/events/ekyc.events.js";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/v1/ekyc",EkycV1Routes);

(async () => {
    try {
        await listenToEvent(
            "ekyc-service-group",
            Topics.EKYC_EVENTS,
            async (key, data) => {
                try {
                    logger.info(`Kafka Event Received → Key: ${key}`);

                    await routeEkycEvent(key, data);

                } catch (handlerErr) {
                    logger.error("Error inside routeEkycEvent", handlerErr);
                }
            }
        );

    } catch (err) {
        logger.error("Fatal Kafka Listener Error", err);
    }
})();

sequelize.sync().then(() => console.log("Database Connected")).catch((error) =>{
    logger.error("Ekyc Service DataBase Error",error);
    console.error("DataBase Error In EKYC");
});

const PORT = process.env.PORT || 4004;

app.listen(PORT,()=>{
    console.log("Ekyc Service Running On Port",PORT);
});