'use strict';

/** Drop the separate dynamic-field-files table — file paths are stored
 *  directly inside the asset's dynamic_fields JSON column instead. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('asset_dynamic_field_files');
  },

  async down(queryInterface, Sequelize) {
    // Restore the table if needed
    await queryInterface.createTable('asset_dynamic_field_files', {
      id:            { type: Sequelize.UUID, defaultValue: Sequelize.literal('(UUID())'), primaryKey: true, allowNull: false },
      asset_id:      { type: Sequelize.UUID, allowNull: false, references: { model: 'assets', key: 'id' }, onDelete: 'CASCADE' },
      field_key:     { type: Sequelize.STRING(100), allowNull: false },
      field_index:   { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      file_path:     { type: Sequelize.STRING(500), allowNull: false },
      original_name: { type: Sequelize.STRING(500), allowNull: true },
      mime_type:     { type: Sequelize.STRING(100), allowNull: true },
      file_size:     { type: Sequelize.BIGINT.UNSIGNED, allowNull: true },
      created_at:    { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:    { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });
  },
};
