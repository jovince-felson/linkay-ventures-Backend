import { DataTypes } from "sequelize";
import sequelize from ".././config/database.js";

const User = sequelize.define("User", {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    country_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    phone_number: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    password: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    is_tfa: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
    },

    biometric_enabling:{
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 1,
        comment: "1=> On , 0=> Off"
    },

    is_locked: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    ekyc_passed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    provider: {
        type: DataTypes.STRING,
        allowNull: true,
    },

    role: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: "1=> Normal User, 2=> Admin",
        defaultValue: "1",
    },

    uid: {
        type: DataTypes.TEXT,
        allowNull: true,
    },

    is_private_email: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
    },

    failed_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },

    locked_until: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    status: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false,
    },

    trash: {
        type: DataTypes.ENUM('NO', 'YES'),
        defaultValue: 'NO',
        allowNull: false,
    },
},
    {
        timestamps: true,
        tableName: "users",
        underscored: true,

    },
);

export default User;