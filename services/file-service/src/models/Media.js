import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Media extends Model {}

Media.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    assetId: {
      type:      DataTypes.STRING(36),
      allowNull: false,
      field:     'asset_id',
      comment:   'UUID of the asset from asset-management-service',
    },
    fileKey: {
      type:      DataTypes.STRING(500),
      allowNull: false,
      field:     'file_key',
      comment:   'S3 object key',
    },
    fileUrl: {
      type:      DataTypes.STRING(1000),
      allowNull: false,
      field:     'file_url',
    },
    originalName: {
      type:      DataTypes.STRING(500),
      allowNull: true,
      field:     'original_name',
    },
    mimeType: {
      type:      DataTypes.STRING(100),
      allowNull: false,
      field:     'mime_type',
    },
    fileSize: {
      type:      DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field:     'file_size',
    },
    mediaType: {
      type:      DataTypes.ENUM('IMAGE', 'VIDEO', '3D_MODEL', 'DOCUMENT'),
      allowNull: false,
      field:     'media_type',
    },
    isPrimary: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
      field:        'is_primary',
    },
    displayOrder: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
      field:        'display_order',
    },
    uploadedBy: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field:     'uploaded_by',
    },
  },
  {
    sequelize,
    modelName:   'Media',
    tableName:   'media',
    paranoid:    true,
    timestamps:  true,
    underscored: true,
    indexes: [
      { fields: ['asset_id'] },
      { fields: ['asset_id', 'media_type'] },
      { fields: ['asset_id', 'is_primary'] },
      { fields: ['display_order'] },
    ],
  },
);

export default Media;
