import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";


const UserTracking = sequelize.define("user_tracking", {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
    },

    session_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
    },

    requested_url: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    user_agent: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    ip: {
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
    timestamps: false,
    tableName: "user_tracking",
});

export default UserTracking;