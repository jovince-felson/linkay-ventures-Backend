'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── Input columns (read by tokenization worker) ──────────────────────────
    await queryInterface.addColumn('assets', 'historical_context', {
      type:      Sequelize.DataTypes.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('assets', 'total_fractions', {
      type:      Sequelize.DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    });

    await queryInterface.addColumn('assets', 'tokenized_percent', {
      type:      Sequelize.DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment:   'max 49 — percent of total fractions offered publicly',
    });

    await queryInterface.addColumn('assets', 'retained_percent', {
      type:      Sequelize.DataTypes.DECIMAL(5, 2),
      allowNull: true,
      comment:   'auto-calculated: 100 - tokenized_percent',
    });

    await queryInterface.addColumn('assets', 'price_per_fraction', {
      type:      Sequelize.DataTypes.DECIMAL(20, 2),
      allowNull: true,
      comment:   'auto-calculated: valuation / total_fractions',
    });

    await queryInterface.addColumn('assets', 'condition_report', {
      type:      Sequelize.DataTypes.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn('assets', 'certification_ref', {
      type:      Sequelize.DataTypes.STRING(200),
      allowNull: true,
    });

    await queryInterface.addColumn('assets', 'royalty_percent', {
      type:      Sequelize.DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment:   'basis points — max 1000 = 10%',
    });

    await queryInterface.addColumn('assets', 'royalty_wallet', {
      type:      Sequelize.DataTypes.STRING(42),
      allowNull: true,
      comment:   'ETH wallet address for royalty payments',
    });

    // ── Output columns (written by tokenization worker) ──────────────────────
    await queryInterface.addColumn('assets', 'ipfs_metadata_uri', {
      type:      Sequelize.DataTypes.STRING(500),
      allowNull: true,
      comment:   'Set by worker after Step 6 (IPFS upload)',
    });

    await queryInterface.addColumn('assets', 'nft_contract_address', {
      type:      Sequelize.DataTypes.STRING(42),
      allowNull: true,
      comment:   'Set by worker after Step 7 (mintNFT)',
    });

    await queryInterface.addColumn('assets', 'nft_token_id', {
      type:      Sequelize.DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      comment:   'Set by worker after Step 7 (mintNFT)',
    });

    await queryInterface.addColumn('assets', 'erc3643_contract_address', {
      type:      Sequelize.DataTypes.STRING(42),
      allowNull: true,
      comment:   'Set by worker after Step 8 (deployFractionalToken)',
    });

    await queryInterface.addColumn('assets', 'compliance_configured', {
      type:         Sequelize.DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
      comment:      'Set by worker after Step 10 (setComplianceRules)',
    });
  },

  async down(queryInterface) {
    const columns = [
      'historical_context',
      'total_fractions',
      'tokenized_percent',
      'retained_percent',
      'price_per_fraction',
      'condition_report',
      'certification_ref',
      'royalty_percent',
      'royalty_wallet',
      'ipfs_metadata_uri',
      'nft_contract_address',
      'nft_token_id',
      'erc3643_contract_address',
      'compliance_configured',
    ];

    for (const col of columns) {
      await queryInterface.removeColumn('assets', col);
    }
  },
};
