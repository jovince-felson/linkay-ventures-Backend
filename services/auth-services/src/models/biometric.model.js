import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const BiometricCredential = sequelize.define(
    "biometric_credentials",
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },

        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },

        credential_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },

        public_key: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        platform: {
            type: DataTypes.ENUM("ANDROID", "IOS"),
            allowNull: false,
        },

        device_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        device_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },

        status: {
            type: DataTypes.TINYINT,
            defaultValue: 1,
        },

        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },

        last_used_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: "biometric_credentials",
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ["user_id", "device_id"],
            },
        ],
    }
);

export default BiometricCredential;
