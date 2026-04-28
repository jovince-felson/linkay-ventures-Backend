import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const MailConfigs = sequelize.define("mail_configs",{
    id:{
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    smtp_mailer:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    smtp_encryption:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    smtp_host:{
        type: DataTypes.TEXT,
        allowNull: false,
    },

    smtp_user:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    smtp_password:{
        type: DataTypes.STRING,
        allowNull: false,
    },

    smtp_port:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    is_active:{
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
    },

    trash:{
        type: DataTypes.ENUM("NO","YES"),
        defaultValue: "NO",
    },

    created_by:{
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    created_at:{
        type: DataTypes.DATE,
        allowNull:false,
    },

    updated_at:{
        type: DataTypes.DATE,
        allowNull: true,
    },
    
},
{
    tableName: "mail_configs",
    underscored: true,
    timestamps: true,
    defaultScope: {
        attributes: { exclude: ['smtp_password'] }
    },
});

export default MailConfigs;