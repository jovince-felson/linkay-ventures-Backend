import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Roles = sequelize.define("roles", {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    role_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },

    trash: {
        type: DataTypes.ENUM(["NO", "YES"]),
        allowNull: false,
        defaultValue: "NO"
    },

    data_scope: {
        type: DataTypes.ENUM(["CREATED", "ASSIGNED", "ALL"]),
        allowNull: false
    },

    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },

    updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },


}, {
    tableName: "roles",
    timestamps: false,
    freezeTableName: true,
});

export default Roles;