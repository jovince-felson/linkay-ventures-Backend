import {DataTypes} from "sequelize";
import sequelize from "../config/database.js";

const FCMTokens = sequelize.define("fcm_tokens",{
    id:{
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    fcm_key:{
        type: DataTypes.TEXT,
        allowNull: false,
    },

    user_id:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

},{
    tableName: "fcm_tokens",
    timestamps: false,
    underscored: true,
});


export default FCMTokens;