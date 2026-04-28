import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const APIS = sequelize.define("master_apis", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    api_category:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    api_name: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    api_credentials:{
        type: DataTypes.TEXT,
        allowNull: false,
    },

    status: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },

    trash: {
        type: DataTypes.ENUM("NO", "YES"),
        allowNull: false,
        defaultValue: "NO",
    },

    created_at:{
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },

    updated_at:{
        type: DataTypes.DATE,
        allowNull: true,
    }

},
    {
        timestamps: true,
        tableName: "master_apis",
        hooks:{
            beforeUpdate: (api,options) => {
                api.updated_at = new Date();
            }
        }

    });


export default APIS;