'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('media', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      asset_id: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: false,
        comment:   'UUID of the asset from asset-management-service (no FK — cross-service)',
      },
      file_key: {
        type:      Sequelize.DataTypes.STRING(500),
        allowNull: false,
      },
      file_url: {
        type:      Sequelize.DataTypes.STRING(1000),
        allowNull: false,
      },
      original_name: {
        type:      Sequelize.DataTypes.STRING(500),
        allowNull: true,
      },
      mime_type: {
        type:      Sequelize.DataTypes.STRING(100),
        allowNull: false,
      },
      file_size: {
        type:      Sequelize.DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
      },
      media_type: {
        type:      Sequelize.DataTypes.ENUM('IMAGE', 'VIDEO', '3D_MODEL', 'DOCUMENT'),
        allowNull: false,
      },
      is_primary: {
        type:         Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull:    false,
      },
      display_order: {
        type:         Sequelize.DataTypes.INTEGER,
        defaultValue: 0,
        allowNull:    false,
      },
      uploaded_by: {
        type:      Sequelize.DataTypes.INTEGER.UNSIGNED,
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
      deleted_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('media', ['asset_id']);
    await queryInterface.addIndex('media', ['asset_id', 'media_type']);
    await queryInterface.addIndex('media', ['asset_id', 'is_primary']);
    await queryInterface.addIndex('media', ['display_order']);
    await queryInterface.addIndex('media', ['deleted_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media');
  },
};
