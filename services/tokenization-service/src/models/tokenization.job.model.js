import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const TokenizationJob = sequelize.define(
    "tokenization_jobs",
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
        initiated_by: {
            type: DataTypes.UUID,
            allowNull: false,
            comment: "Museum Admin user ID",
        },
        status: {
            type: DataTypes.ENUM(
                "QUEUED",
                "PROCESSING",
                "COMPLETED",
                "FAILED",
                "PARTIAL"
            ),
            defaultValue: "QUEUED",
            allowNull: false,
        },
        total_fractions: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        price_per_fraction: {
            type: DataTypes.DECIMAL(18, 6),
            allowNull: false,
        },
        jurisdictions: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: "Array of ISO country codes",
        },
        lock_up_days: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        // Step tracking
        current_step: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: "0=queued,1=ipfs,2=nft,3=erc3643,4=compliance,5=issue",
        },
        steps_completed: {
            type: DataTypes.JSON,
            defaultValue: [],
            comment: "Array of completed step names",
        },
        // Step results
        ipfs_metadata_uri: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        nft_token_id: {
            type: DataTypes.STRING(78),
            allowNull: true,
        },
        nft_contract_address: {
            type: DataTypes.STRING(42),
            allowNull: true,
        },
        nft_mint_tx_hash: {
            type: DataTypes.STRING(66),
            allowNull: true,
        },
        erc3643_contract_address: {
            type: DataTypes.STRING(42),
            allowNull: true,
        },
        erc3643_deploy_tx_hash: {
            type: DataTypes.STRING(66),
            allowNull: true,
        },
        compliance_tx_hash: {
            type: DataTypes.STRING(66),
            allowNull: true,
        },
        issue_tx_hash: {
            type: DataTypes.STRING(66),
            allowNull: true,
        },
        error_message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        retry_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        completed_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: "tokenization_jobs",
        underscored: true,
    }
);

export default TokenizationJob;
