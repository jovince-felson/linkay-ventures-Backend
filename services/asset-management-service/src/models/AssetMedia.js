import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class AssetMedia extends Model {}

AssetMedia.init(
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
    filename: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    mimeType: {
      type:      DataTypes.STRING(100),
      allowNull: false,
      field:     'mime_type',
    },
    size: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    data: {
      type:      DataTypes.BLOB('long'),
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName:   'AssetMedia',
    tableName:   'asset_media',
    timestamps:  true,
    underscored: true,
  },
);

export default AssetMedia;
