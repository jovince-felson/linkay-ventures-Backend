import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },

    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    // ISO 3166-1 alpha-2
    country_of_residence: {
      type: DataTypes.CHAR(2),
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM(
        "SUPER_ADMIN",
        "MUSEUM_ADMIN",
        "COMPLIANCE_OFFICER",
        "CMS_EDITOR",
        "INVESTOR"
      ),
      allowNull: false,
      defaultValue: "INVESTOR",
    },

    status: {
      type: DataTypes.ENUM(
        "PENDING_VERIFICATION",
        "ACTIVE",
        "SUSPENDED",
        "DEACTIVATED"
      ),
      allowNull: false,
      defaultValue: "PENDING_VERIFICATION",
    },

    // EIP-55 checksummed Ethereum address — nullable until wallet is bound
    wallet_address: {
      type: DataTypes.STRING(42),
      allowNull: true,
      unique: true,
    },

    email_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // Cleared to NULL after successful verification — enforces single-use
    email_verification_token: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    kyc_status: {
      type: DataTypes.ENUM(
        "NOT_STARTED",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "RESUBMIT_REQUIRED"
      ),
      allowNull: false,
      defaultValue: "NOT_STARTED",
    },

    // Sumsub applicant reference — null until KYC is initiated
    kyc_applicant_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Rate-limit tracking — 5 failures triggers 15-min lockout
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "users",
    underscored: true,
  }
);

export default User;