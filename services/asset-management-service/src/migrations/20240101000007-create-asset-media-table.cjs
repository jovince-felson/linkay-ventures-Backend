'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_media', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey:   true,
      },
      asset_id: {
        type:       Sequelize.UUID,
        allowNull:  false,
        references: { model: 'assets', key: 'id' },
        onDelete:   'CASCADE',
      },
      filename: {
        type:      Sequelize.STRING(500),
        allowNull: false,
      },
      mime_type: {
        type:      Sequelize.STRING(100),
        allowNull: false,
      },
      size: {
        type:      Sequelize.INTEGER,
        allowNull: true,
      },
      data: {
        type:      Sequelize.BLOB('long'),
        allowNull: false,
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });
    await queryInterface.addIndex('asset_media', ['asset_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_media');
  },
};
