import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class AssetOwnership extends Model {}

AssetOwnership.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    assetId: {
      type:      DataTypes.UUID,
      allowNull: false,
      field:     'asset_id',
    },
    ownerType: {
      type:      DataTypes.ENUM('MUSEUM', 'INVESTOR', 'PLATFORM'),
      allowNull: false,
      field:     'owner_type',
    },
    ownerId: {
      type:      DataTypes.STRING(36),
      allowNull: true,
      field:     'owner_id',
    },
    ownerName: {
      type:      DataTypes.STRING(200),
      allowNull: true,
      field:     'owner_name',
    },
    percentage: {
      type:      DataTypes.DECIMAL(5, 2),
      allowNull: false,
      validate:  { min: 0.01, max: 100 },
    },
  },
  {
    sequelize,
    modelName:   'AssetOwnership',
    tableName:   'asset_ownership',
    timestamps:  true,
    underscored: true,
    paranoid:    false,
    deletedAt:   false,
    indexes: [
      { fields: ['asset_id'] },
      { fields: ['asset_id', 'owner_type'] },
    ],
  },
);

export default AssetOwnership;
