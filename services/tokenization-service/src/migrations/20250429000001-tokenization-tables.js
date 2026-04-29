/**
 * Migration: 20250429000001-tokenization-tables
 * Creates: tokenization_jobs, compliance_rules, audit_logs
 * Run via: node scripts/db_init.js
 */

export const up = async (queryInterface, Sequelize) => {
    // 1. tokenization_jobs
    await queryInterface.createTable("tokenization_jobs", {
        id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.UUIDV4,
            primaryKey: true,
        },
        asset_id: { type: Sequelize.UUID, allowNull: false },
        initiated_by: { type: Sequelize.UUID, allowNull: false },
        status: {
            type: Sequelize.ENUM("QUEUED", "PROCESSING", "COMPLETED", "FAILED", "PARTIAL"),
            defaultValue: "QUEUED",
        },
        total_fractions: { type: Sequelize.INTEGER, allowNull: false },
        price_per_fraction: { type: Sequelize.DECIMAL(18, 6), allowNull: false },
        jurisdictions: { type: Sequelize.JSON },
        lock_up_days: { type: Sequelize.INTEGER, defaultValue: 0 },
        current_step: { type: Sequelize.INTEGER, defaultValue: 0 },
        steps_completed: { type: Sequelize.JSON, defaultValue: [] },
        ipfs_metadata_uri: { type: Sequelize.STRING(500) },
        nft_token_id: { type: Sequelize.STRING(78) },
        nft_contract_address: { type: Sequelize.STRING(42) },
        nft_mint_tx_hash: { type: Sequelize.STRING(66) },
        erc3643_contract_address: { type: Sequelize.STRING(42) },
        erc3643_deploy_tx_hash: { type: Sequelize.STRING(66) },
        compliance_tx_hash: { type: Sequelize.STRING(66) },
        issue_tx_hash: { type: Sequelize.STRING(66) },
        error_message: { type: Sequelize.TEXT },
        retry_count: { type: Sequelize.INTEGER, defaultValue: 0 },
        completed_at: { type: Sequelize.DATE },
        created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });

    // 2. compliance_rules
    await queryInterface.createTable("compliance_rules", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        asset_id: { type: Sequelize.UUID, allowNull: false },
        erc3643_contract: { type: Sequelize.STRING(42), allowNull: false },
        allowed_countries: { type: Sequelize.JSON, allowNull: false },
        eligibility_level: {
            type: Sequelize.ENUM("RETAIL", "ACCREDITED", "PROFESSIONAL"),
            defaultValue: "RETAIL",
        },
        max_investment_usd: { type: Sequelize.DECIMAL(18, 2) },
        lock_up_days: { type: Sequelize.INTEGER, defaultValue: 0 },
        on_chain_tx_hash: { type: Sequelize.STRING(66) },
        set_by: { type: Sequelize.UUID, allowNull: false },
        created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
        updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });

    // 3. audit_logs
    await queryInterface.createTable("audit_logs", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        actor_id: { type: Sequelize.UUID },
        actor_role: { type: Sequelize.STRING(50) },
        action: { type: Sequelize.STRING(100), allowNull: false },
        target_type: { type: Sequelize.STRING(50) },
        target_id: { type: Sequelize.STRING(255) },
        previous_value: { type: Sequelize.JSON },
        new_value: { type: Sequelize.JSON },
        tx_hash: { type: Sequelize.STRING(66) },
        ip_address: { type: Sequelize.STRING(45) },
        metadata: { type: Sequelize.JSON },
        created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
    });

    // Indexes
    await queryInterface.addIndex("tokenization_jobs", ["asset_id"]);
    await queryInterface.addIndex("tokenization_jobs", ["status"]);
    await queryInterface.addIndex("compliance_rules", ["asset_id"]);
    await queryInterface.addIndex("audit_logs", ["actor_id"]);
    await queryInterface.addIndex("audit_logs", ["action"]);
    await queryInterface.addIndex("audit_logs", ["target_id"]);
};

export const down = async (queryInterface) => {
    await queryInterface.dropTable("audit_logs");
    await queryInterface.dropTable("compliance_rules");
    await queryInterface.dropTable("tokenization_jobs");
};
