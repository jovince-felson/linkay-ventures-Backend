'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add dynamic_fields JSON column to assets
    await queryInterface.addColumn('assets', 'dynamic_fields', {
      type:         Sequelize.JSON,
      allowNull:    true,
      defaultValue: null,
      after:        'three_d_model_url',
    });

    // 2. Read all existing dynamic field rows
    const [fields] = await queryInterface.sequelize.query(
      'SELECT * FROM asset_dynamic_fields WHERE deleted_at IS NULL ORDER BY asset_id, field_order',
    );

    // 3. Group by asset_id
    const grouped = {};
    for (const f of fields) {
      if (!grouped[f.asset_id]) grouped[f.asset_id] = [];
      grouped[f.asset_id].push({
        id:           f.id,
        fieldKey:     f.field_key,
        fieldLabel:   f.field_label,
        fieldType:    f.field_type,
        fieldOptions: f.field_options ? JSON.parse(f.field_options) : null,
        fieldValue:   f.field_value   ? JSON.parse(f.field_value)   : null,
        fieldOrder:   f.field_order,
        isRequired:   !!f.is_required,
      });
    }

    // 4. Write JSON into each asset row
    for (const [assetId, dynamicFields] of Object.entries(grouped)) {
      await queryInterface.sequelize.query(
        'UPDATE assets SET dynamic_fields = ? WHERE id = ?',
        { replacements: [JSON.stringify(dynamicFields), assetId] },
      );
    }

    console.log(`Migrated dynamic fields for ${Object.keys(grouped).length} assets`);

    // 5. Drop the now-redundant table
    await queryInterface.dropTable('asset_dynamic_fields');
  },

  async down(queryInterface, Sequelize) {
    // Recreate asset_dynamic_fields table
    await queryInterface.createTable('asset_dynamic_fields', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      asset_id:    { type: Sequelize.UUID, allowNull: false },
      field_key:   { type: Sequelize.STRING(100), allowNull: false },
      field_label: { type: Sequelize.STRING(200), allowNull: false },
      field_type:  { type: Sequelize.ENUM('text','textarea','number','dropdown','multi_select','date','checkbox','repeatable'), allowNull: false },
      field_options: { type: Sequelize.JSON, allowNull: true, defaultValue: null },
      field_value:   { type: Sequelize.JSON, allowNull: true, defaultValue: null },
      field_order:   { type: Sequelize.INTEGER, defaultValue: 0 },
      is_required:   { type: Sequelize.BOOLEAN, defaultValue: false },
      parent_id:     { type: Sequelize.UUID, allowNull: true },
      created_at:    { type: Sequelize.DATE, allowNull: false },
      updated_at:    { type: Sequelize.DATE, allowNull: false },
      deleted_at:    { type: Sequelize.DATE, allowNull: true },
    });

    // Remove the column
    await queryInterface.removeColumn('assets', 'dynamic_fields');
  },
};
