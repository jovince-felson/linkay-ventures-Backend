import sequelize from "../config/database.js";
import { DataTypes } from "sequelize";

const NotificationPreferences = sequelize.define("notification_preferences", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    notification_type: {
        type: DataTypes.ENUM("PAYMENTS", "WALLETS", "SECURITY", "CRYPTO"),
        allowNull: false,
    },

    is_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },

    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },

    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    tableName: "notification_preferences",
    timestamps: true,
    freezeTableName: true,
});

export default NotificationPreferences;