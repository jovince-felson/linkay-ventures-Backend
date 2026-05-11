'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_tokenizations', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      asset_id: {
        type:       Sequelize.DataTypes.UUID,
        allowNull:  false,
        unique:     true,
        references: { model: 'assets', key: 'id' },
        onUpdate:   'CASCADE',
        onDelete:   'CASCADE',
      },
      ipfs_cid: {
        type:      Sequelize.DataTypes.STRING(100),
        allowNull: true,
      },
      metadata_url: {
        type:      Sequelize.DataTypes.STRING(500),
        allowNull: true,
      },
      metadata_json: {
        type:      Sequelize.DataTypes.JSON,
        allowNull: true,
      },
      mint_payload: {
        type:      Sequelize.DataTypes.JSON,
        allowNull: true,
      },
      token_address: {
        type:      Sequelize.DataTypes.STRING(100),
        allowNull: true,
      },
      token_id: {
        type:      Sequelize.DataTypes.STRING(100),
        allowNull: true,
      },
      transaction_hash: {
        type:      Sequelize.DataTypes.STRING(100),
        allowNull: true,
      },
      tokenization_status: {
        type:         Sequelize.DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
        defaultValue: 'PENDING',
        allowNull:    false,
      },
      blockchain_network: {
        type:         Sequelize.DataTypes.STRING(50),
        defaultValue: 'ethereum',
        allowNull:    false,
      },
      requested_by: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: true,
      },
      error_message: {
        type:      Sequelize.DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('asset_tokenizations', ['asset_id'], { unique: true });
    await queryInterface.addIndex('asset_tokenizations', ['tokenization_status']);
    await queryInterface.addIndex('asset_tokenizations', ['ipfs_cid']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_tokenizations');
  },
};
