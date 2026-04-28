import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const RolePermission = sequelize.define("role_permissions", {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    menu_key: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    permissions: {
        type: DataTypes.JSON,
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
    tableName: "role_permissions",
    timestamps: false,
    freezeTableName: true,
});


export default RolePermission;