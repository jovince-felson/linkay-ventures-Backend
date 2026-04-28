import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const PassKeys = sequelize.define("user_passkeys", {
  id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  device_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  device_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  pin_hash: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  is_active: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    allowNull: false,
  },

  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

}, {
  timestamps: false,
  tableName: "user_passkeys",
});

export default PassKeys;