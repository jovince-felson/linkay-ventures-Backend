import sequelize          from '../config/database.js';
import Asset              from './Asset.js';
import AssetDynamicField  from './AssetDynamicField.js';
import AssetOwnership     from './AssetOwnership.js';
import AssetTokenization  from './AssetTokenization.js';

// ── Associations ────────────────────────────────────────────────────────────────

Asset.hasMany(AssetDynamicField,  { foreignKey: 'assetId', as: 'dynamicFields', onDelete: 'CASCADE' });
AssetDynamicField.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Asset.hasMany(AssetOwnership, { foreignKey: 'assetId', as: 'ownershipSplit', onDelete: 'CASCADE' });
AssetOwnership.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Asset.hasOne(AssetTokenization, { foreignKey: 'assetId', as: 'tokenization', onDelete: 'CASCADE' });
AssetTokenization.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

// self-referential for repeatable nested fields
AssetDynamicField.hasMany(AssetDynamicField, { foreignKey: 'parentId', as: 'children' });
AssetDynamicField.belongsTo(AssetDynamicField, { foreignKey: 'parentId', as: 'parent' });

export { sequelize, Asset, AssetDynamicField, AssetOwnership, AssetTokenization };
