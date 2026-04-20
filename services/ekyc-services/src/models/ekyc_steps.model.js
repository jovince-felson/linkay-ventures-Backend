import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const EkycSteps = sequelize.define("ekyc_user_steps",{
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

    step:{
        type: DataTypes.STRING,
        allowNull: true,
    },

    step_status:{
        type: DataTypes.ENUM,
        values: ["FAILED", "PASSED", "PENDING"],
        defaultValue: "PENDING"
    },

    created_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },

    updated_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },
},{
    timestamps: false,
    tableName: "ekyc_user_steps",
});

export default EkycSteps;