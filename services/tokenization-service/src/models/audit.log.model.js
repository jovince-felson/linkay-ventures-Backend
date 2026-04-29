import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const AuditLog = sequelize.define(
    "audit_logs",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        actor_id: {
            type: DataTypes.UUID,
            allowNull: true,
        },
        actor_role: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        action: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        target_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        target_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        previous_value: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        new_value: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        tx_hash: {
            type: DataTypes.STRING(66),
            allowNull: true,
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
        },
    },
    {
        tableName: "audit_logs",
        underscored: true,
        updatedAt: false,
    }
);

export default AuditLog;
