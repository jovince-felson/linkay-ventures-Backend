'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('assets', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      title: {
        type:      Sequelize.DataTypes.STRING(500),
        allowNull: false,
      },
      slug: {
        type:      Sequelize.DataTypes.STRING(600),
        allowNull: false,
        unique:    true,
      },
      description: {
        type:      Sequelize.DataTypes.TEXT,
        allowNull: true,
      },
      asset_type: {
        type:      Sequelize.DataTypes.ENUM('COLLECTIBLE', 'REAL_ESTATE'),
        allowNull: false,
      },
      status: {
        type:         Sequelize.DataTypes.ENUM('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED'),
        defaultValue: 'DRAFT',
        allowNull:    false,
      },
      museum_id: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: false,
      },
      created_by: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: false,
      },
      updated_by: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: true,
      },
      published_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: true,
      },
      archived_at: {
        type:      Sequelize.DataTypes.DATE,
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

    await queryInterface.addIndex('assets', ['status']);
    await queryInterface.addIndex('assets', ['asset_type']);
    await queryInterface.addIndex('assets', ['museum_id']);
    await queryInterface.addIndex('assets', ['created_by']);
    await queryInterface.addIndex('assets', ['deleted_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('assets');
  },
};
