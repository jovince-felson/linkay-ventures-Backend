import sequelize from "../src/config/database.js";
import "../src/models/tokenization.job.model.js";
import "../src/models/compliance.rule.model.js";
import "../src/models/audit.log.model.js";
import dotenv from "dotenv";
dotenv.config();

const initDB = async () => {
    try {
        await sequelize.authenticate();
        console.log("DB connected");

        // sync({ alter: true }) safely updates existing tables
        await sequelize.sync({ alter: true });
        console.log("All tokenization-service tables created/updated");

        process.exit(0);
    } catch (error) {
        console.error("DB init failed:", error.message);
        process.exit(1);
    }
};

initDB();
