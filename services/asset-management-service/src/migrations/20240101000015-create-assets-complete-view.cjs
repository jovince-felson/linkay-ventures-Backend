'use strict';

/**
 * Creates v_assets_complete VIEW — joins assets + asset_dynamic_fields
 * into one queryable view in phpMyAdmin / any DB browser.
 *
 * Each row = one dynamic field for an asset.
 * Assets with NO dynamic fields appear once with NULL field_* columns.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW v_assets_complete AS
      SELECT
        a.id                  AS asset_id,
        a.title,
        a.slug,
        a.description,
        a.asset_type,
        a.status,
        a.valuation,
        a.jurisdiction,
        a.custodian,
        a.ownership_entity,
        a.historical_context,
        a.condition_report,
        a.certification_ref,
        a.three_d_model_url,
        a.media_files,
        a.museum_id,
        a.created_by,
        a.created_by_name,
        a.published_at,
        a.created_at          AS asset_created_at,
        a.updated_at          AS asset_updated_at,

        -- dynamic field columns (NULL when asset has no custom fields)
        adf.id                AS field_id,
        adf.field_key,
        adf.field_label,
        adf.field_type,
        adf.field_value,
        adf.field_options,
        adf.is_required,
        adf.field_order

      FROM assets a
      LEFT JOIN asset_dynamic_fields adf
        ON  adf.asset_id   = a.id
        AND adf.deleted_at IS NULL

      WHERE a.deleted_at IS NULL
      ORDER BY a.created_at DESC, adf.field_order ASC;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP VIEW IF EXISTS v_assets_complete;`);
  },
};
