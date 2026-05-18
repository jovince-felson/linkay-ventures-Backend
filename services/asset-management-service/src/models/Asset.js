import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Asset extends Model {}

Asset.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    title: {
      type:      DataTypes.STRING(500),
      allowNull: false,
      validate:  { notEmpty: true, len: [3, 500] },
    },
    slug: {
      type:      DataTypes.STRING(600),
      allowNull: false,
      unique:    true,
    },
    description: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    assetType: {
      type:         DataTypes.ENUM('COLLECTIBLE', 'REAL_ESTATE', 'FINE_ART', 'LUXURY_ASSET', 'LUXURY_WATCH', 'OTHER'),
      allowNull:    false,
      field:        'asset_type',
    },
    valuation: {
      type:      DataTypes.DECIMAL(20, 2),
      allowNull: true,
    },
    jurisdiction: {
      type:      DataTypes.STRING(200),
      allowNull: true,
    },
    mediaFiles: {
      type:      DataTypes.JSON,
      allowNull: true,
      field:     'media_files',
    },
    status: {
      type:         DataTypes.ENUM('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED'),
      defaultValue: 'DRAFT',
      allowNull:    false,
    },
    museumId: {
      type:      DataTypes.STRING(36),
      allowNull: false,
      field:     'museum_id',
    },
    createdBy: {
      type:      DataTypes.STRING(36),
      allowNull: false,
      field:     'created_by',
    },
    updatedBy: {
      type:      DataTypes.STRING(36),
      allowNull: true,
      field:     'updated_by',
    },
    publishedAt: {
      type:      DataTypes.DATE,
      allowNull: true,
      field:     'published_at',
    },
    archivedAt: {
      type:      DataTypes.DATE,
      allowNull: true,
      field:     'archived_at',
    },
  },
  {
    sequelize,
    modelName:  'Asset',
    tableName:  'assets',
    paranoid:   true,
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['asset_type'] },
      { fields: ['museum_id'] },
      { fields: ['created_by'] },
    ],
  },
);

export default Asset;
