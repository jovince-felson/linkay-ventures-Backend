import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const AuditLog = sequelize.define("user_audit_log", {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    audit_type: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    audit_event: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    description: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    session_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    device_id: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    device_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    ip: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    created_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },

    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    tableName: "user_audit_log",
    timestamps: false,
});

export default AuditLog;