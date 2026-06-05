'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('asset_dynamic_field_files', {
      id: {
        type:         Sequelize.UUID,
        defaultValue: Sequelize.literal('(UUID())'),
        primaryKey:   true,
        allowNull:    false,
      },
      asset_id: {
        type:       Sequelize.UUID,
        allowNull:  false,
        references: { model: 'assets', key: 'id' },
        onDelete:   'CASCADE',
        onUpdate:   'CASCADE',
      },
      field_key: {
        type:      Sequelize.STRING(100),
        allowNull: false,
        comment:   'Matches DField.fieldKey inside dynamicFields JSON',
      },
      field_index: {
        type:      Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment:   'Position of this field inside the dynamicFields array',
      },
      file_path: {
        type:      Sequelize.STRING(500),
        allowNull: false,
        comment:   'Relative path: /uploads/assets/<filename>',
      },
      original_name: {
        type:      Sequelize.STRING(500),
        allowNull: true,
      },
      mime_type: {
        type:      Sequelize.STRING(100),
        allowNull: true,
      },
      file_size: {
        type:      Sequelize.BIGINT.UNSIGNED,
        allowNull: true,
        comment:   'File size in bytes',
      },
      created_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type:      Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('asset_dynamic_field_files', ['asset_id'],    { name: 'idx_adff_asset_id' });
    await queryInterface.addIndex('asset_dynamic_field_files', ['field_key'],   { name: 'idx_adff_field_key' });
    await queryInterface.addIndex('asset_dynamic_field_files', ['field_index'], { name: 'idx_adff_field_index' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_dynamic_field_files');
  },
};
