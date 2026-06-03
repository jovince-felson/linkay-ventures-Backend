import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class ThreeDModel extends Model {}

ThreeDModel.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    meshyTaskId: {
      type:      DataTypes.STRING(100),
      allowNull: false,
      unique:    true,
      field:     'meshy_task_id',
    },
    status: {
      type:         DataTypes.ENUM('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'),
      defaultValue: 'PENDING',
      allowNull:    false,
    },
    progress: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
      allowNull:    false,
    },
    glbUrl: {
      type:      DataTypes.STRING(1000),
      allowNull: true,
      field:     'glb_url',
      comment:   'Meshy CDN URL for the GLB file',
    },
    videoUrl: {
      type:      DataTypes.STRING(1000),
      allowNull: true,
      field:     'video_url',
      comment:   'Meshy CDN URL for the preview video',
    },
    assetId: {
      type:      DataTypes.UUID,
      allowNull: true,
      field:     'asset_id',
      comment:   'Linked asset (set when user saves the asset)',
    },
    createdBy: {
      type:      DataTypes.STRING(36),
      allowNull: true,
      field:     'created_by',
    },
  },
  {
    sequelize,
    modelName:   'ThreeDModel',
    tableName:   'three_d_models',
    timestamps:  true,
    underscored: true,
    indexes: [
      { fields: ['meshy_task_id'], unique: true },
      { fields: ['asset_id'] },
      { fields: ['created_by'] },
      { fields: ['status'] },
    ],
  },
);

export default ThreeDModel;
