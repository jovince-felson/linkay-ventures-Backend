import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const ComplianceRule = sequelize.define(
    "compliance_rules",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        asset_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        erc3643_contract: {
            type: DataTypes.STRING(42),
            allowNull: false,
        },
        allowed_countries: {
            type: DataTypes.JSON,
            allowNull: false,
            comment: "Array of ISO 3166-1 alpha-2 codes",
        },
        eligibility_level: {
            type: DataTypes.ENUM("RETAIL", "ACCREDITED", "PROFESSIONAL"),
            defaultValue: "RETAIL",
        },
        max_investment_usd: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true,
        },
        lock_up_days: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        on_chain_tx_hash: {
            type: DataTypes.STRING(66),
            allowNull: true,
        },
        set_by: {
            type: DataTypes.UUID,
            allowNull: false,
        },
    },
    {
        tableName: "compliance_rules",
        underscored: true,
    }
);

export default ComplianceRule;
