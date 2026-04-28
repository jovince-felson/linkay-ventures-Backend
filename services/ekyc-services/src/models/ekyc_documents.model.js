import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const EkycDocs = sequelize.define("ekyc_documents", {
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    ekyc_profile_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    ekyc_step: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    file_path: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_key: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    file_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    document_type: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: "1-> Passport , 2-> Driving License, 3-> Residental ID, 4-> Other, 5-> Selfie",
    },

    ekyc_meta_data: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
    },

    trash: {
        type: DataTypes.ENUM("NO", "YES"),
        defaultValue: "NO",
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
    tableName: "ekyc_documents",
});

export default EkycDocs;