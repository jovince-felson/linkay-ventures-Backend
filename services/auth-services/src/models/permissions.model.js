import {DataTypes} from 'sequelize';
import sequelize from '../config/database.js';

const Permissions = sequelize.define("permissions",{
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    key: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    description:{
        type: DataTypes.STRING,
        allowNull: true,
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
},{
    tableName: "permissions",
    timestamps: false,
    freezeTableName: true,
});

export default Permissions;