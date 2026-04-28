import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PasswordResets = sequelize.define("password_reset_tokens", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },

    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    tokens: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    otp: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    otp_expiry: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    device_id: {
        type: DataTypes.TEXT,
        allowNull: false,
    },

    is_used: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },

    is_verified: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },

    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },

    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    tableName: "password_reset_tokens",
    timestamps: false,

});

export default PasswordResets;