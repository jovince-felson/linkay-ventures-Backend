import { DataTypes } from "sequelize";
import sequelie from "../config/database.js";

const EkycProfiles = sequelie.define("ekyc_profiles",{
    id:{
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    user_id:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    attempts:{
        type: DataTypes.INTEGER,
        defaultValue: 1,
    },

    ekyc_status:{
        type: DataTypes.INTEGER,
        comment: "0-> Initial Stage,1-> Verified, 2-> Rejected, 3->Mannual Approval Needed",
        defaultValue: 0,
    },

    applicant_id:{
        type: DataTypes.STRING,
        allowNull: true,
    },

    inspection_id:{
        type: DataTypes.STRING,
        allowNull: true,
    },

    status:{
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
    },

    trash:{
        type: DataTypes.ENUM("NO","YES"),
        defaultValue: "NO",
    },

    created_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },

    updated_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },

    last_submitted_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },


},{
    timestamps: false,
    tableName: "ekyc_profiles",
});

export default EkycProfiles;