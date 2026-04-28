import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Log = sequelize.define("Log",{
    id:{
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    userId:{
        type: DataTypes.INTEGER,
        allowNull:false,
    },

    session_id:{
        type: DataTypes.STRING,
        allowNull:false,
    },

    ip_address:{
        type: DataTypes.STRING,
        allowNull:false,
    },

    user_agent:{
        type: DataTypes.STRING,
        allowNull:false,
    },

    request_url:{
        type: DataTypes.STRING,
        allowNull:false,
    },

    date:{
        type: DataTypes.DATE,
        allowNull:false,
        defaultValue: DataTypes.NOW,
    },
},{
    timestamps: false,
    tableName: "authentication_logs",
    underscored: true,
    freezeTableName: true
});

export default Log;