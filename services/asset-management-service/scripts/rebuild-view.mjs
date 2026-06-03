import sequelize from '../src/config/database.js';

await sequelize.query(`DROP VIEW IF EXISTS v_assets_complete`);

await sequelize.query(`
  CREATE VIEW v_assets_complete AS
  SELECT
    id, title, slug, description,
    asset_type, status, valuation, jurisdiction,
    custodian, ownership_entity, historical_context,
    condition_report, certification_ref,
    three_d_model_url,
    dynamic_fields,
    media_files, total_fractions,
    tokenized_percent, retained_percent, price_per_fraction,
    royalty_percent, royalty_wallet,
    museum_id, created_by, created_by_name,
    published_at, created_at, updated_at
  FROM assets
  WHERE deleted_at IS NULL
  ORDER BY created_at DESC
`);

console.log('✅ v_assets_complete view updated — reads directly from assets.dynamic_fields');

const [rows] = await sequelize.query(
  `SELECT title, asset_type, status, dynamic_fields FROM v_assets_complete LIMIT 5`
);

rows.forEach(r => {
  const fields = Array.isArray(r.dynamic_fields)
    ? r.dynamic_fields
    : (r.dynamic_fields ? JSON.parse(r.dynamic_fields) : []);
  console.log(`\n📦 [${r.title}] ${r.asset_type} — ${r.status}`);
  if (fields.length === 0) {
    console.log('   dynamic_fields: (none)');
  } else {
    fields.forEach(f => console.log(`   • ${f.fieldLabel} [${f.fieldType}] = ${JSON.stringify(f.fieldValue)}`));
  }
});

await sequelize.close();
process.exit(0);
