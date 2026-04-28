import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const EkycAudit = sequelize.define("ekyc_audit_reports",{
    id:{
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    ekyc_profile_id:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    level_name:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    status:{
        type: DataTypes.ENUM,
        values: ["FAILED", "PASSED", "PENDING"],
        defaultValue: "PENDING"
    },

    reason:{
        type: DataTypes.TEXT,
        allowNull: true,
    },

    created_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },

    reviewed_by:{
        type: DataTypes.INTEGER,
        allowNull: true,
    },

    reviewed_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },

    updated_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },
},{
    timestamps: false,
    tableName: "ekyc_audit_reports",
});

export default EkycAudit;