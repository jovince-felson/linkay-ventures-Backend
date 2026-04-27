import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ErrorLog = sequelize.define("error_logs", {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    service_name: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    error_origin: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    error_description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: "error_logs",
    timestamps: false
});

export default ErrorLog;