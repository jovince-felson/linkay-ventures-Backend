import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const Session = sequelize.define("sessions", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  otp: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  otp_expiry: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  otp_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  otp_request_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  ip: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  is_ip_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  is_device_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },

  user_agent: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  device_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  device_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  logged_in_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },

  logged_out_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  revoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
},
  {
    underscored: true,
    timestamps: false,
    tableName: 'sessions',

  });

export default Session;