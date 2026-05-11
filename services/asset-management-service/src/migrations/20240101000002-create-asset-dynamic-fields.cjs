'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_dynamic_fields', {
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
      field_key: {
        type:      Sequelize.DataTypes.STRING(100),
        allowNull: false,
      },
      field_label: {
        type:      Sequelize.DataTypes.STRING(200),
        allowNull: false,
      },
      field_type: {
        type: Sequelize.DataTypes.ENUM(
          'text', 'textarea', 'number', 'dropdown',
          'multi_select', 'date', 'checkbox', 'repeatable',
        ),
        allowNull: false,
      },
      field_options: {
        type:      Sequelize.DataTypes.JSON,
        allowNull: true,
      },
      field_value: {
        type:      Sequelize.DataTypes.JSON,
        allowNull: true,
      },
      field_order: {
        type:         Sequelize.DataTypes.INTEGER,
        defaultValue: 0,
      },
      is_required: {
        type:         Sequelize.DataTypes.BOOLEAN,
        defaultValue: false,
      },
      parent_id: {
        type:       Sequelize.DataTypes.UUID,
        allowNull:  true,
        references: { model: 'asset_dynamic_fields', key: 'id' },
        onDelete:   'SET NULL',
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

    await queryInterface.addIndex('asset_dynamic_fields', ['asset_id']);
    await queryInterface.addIndex('asset_dynamic_fields', ['asset_id', 'field_key']);
    await queryInterface.addIndex('asset_dynamic_fields', ['field_order']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_dynamic_fields');
  },
};
