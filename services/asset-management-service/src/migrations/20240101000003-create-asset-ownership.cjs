'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_ownership', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
      },
      asset_id: {
        type:       Sequelize.DataTypes.UUID,
        allowNull:  false,
        references: { model: 'assets', key: 'id' },
        onUpdate:   'CASCADE',
        onDelete:   'CASCADE',
      },
      owner_type: {
        type:      Sequelize.DataTypes.ENUM('MUSEUM', 'INVESTOR', 'PLATFORM'),
        allowNull: false,
      },
      owner_id: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: true,
      },
      owner_name: {
        type:      Sequelize.DataTypes.STRING(200),
        allowNull: true,
      },
      percentage: {
        type:      Sequelize.DataTypes.DECIMAL(5, 2),
        allowNull: false,
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

    await queryInterface.addIndex('asset_ownership', ['asset_id']);
    await queryInterface.addIndex('asset_ownership', ['asset_id', 'owner_type']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_ownership');
  },
};
