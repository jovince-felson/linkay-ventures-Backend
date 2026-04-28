import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const FileLogs = sequelize.define("file_details",{
    id:{
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },

    user_id:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    context_type :{
        type : DataTypes.ENUM("USER","PAYMENTS","SUPPORT","EKYC","ACCOUNT","CARD"),
        allowNull : false,
    },

    context_id :{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    file_key:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_path:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_size:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_original_name:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_name:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_extension:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    status:{
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },

    trash:{
        type: DataTypes.ENUM("NO","YES"),
        allowNull: false,
        defaultValue: "NO"
    },

    created_by:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    updated_by:{
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    created_at:{
        type: DataTypes.DATE,
        allowNull: false,
    },

    updated_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },

},{
    tableName: "file_details",
    timestamps: false,
});


export default FileLogs;