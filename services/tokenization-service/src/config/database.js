import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import { logger } from "linkay-shared-utils";
dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 3306,
        dialect: process.env.DB_DIALECT || "mysql",
        logging: (msg) => logger.info(msg),
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
        define: {
            timestamps: true,
            underscored: true,
        },
    }
);

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        logger.info("MySQL DB connected — tokenization-service");
    } catch (error) {
        logger.error("DB Connection Failed:", error);
        process.exit(1);
    }
};

export default sequelize;
