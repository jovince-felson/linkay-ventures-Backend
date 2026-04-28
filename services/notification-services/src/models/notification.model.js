import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Notification = sequelize.define("user_notification", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    message: {
        type: DataTypes.TEXT,
        allowNull: false,
    },

    title: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    assigned_user: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    is_read: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
    },

    url: {
        type: Sequelize.TEXT,
        allowNull: false,
    },

    icon: {
        type: DataTypes.STRING,
        allowNull: false,
    },

}, {
    tableName: "user_notification",
    timestamps: true,
    underscored: true,
});


export default Notification;