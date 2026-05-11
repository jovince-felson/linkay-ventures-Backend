import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class AssetDynamicField extends Model {}

AssetDynamicField.init(
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
    fieldKey: {
      type:      DataTypes.STRING(100),
      allowNull: false,
      field:     'field_key',
    },
    fieldLabel: {
      type:      DataTypes.STRING(200),
      allowNull: false,
      field:     'field_label',
    },
    fieldType: {
      type: DataTypes.ENUM(
        'text', 'textarea', 'number', 'dropdown',
        'multi_select', 'date', 'checkbox', 'repeatable',
      ),
      allowNull: false,
      field:     'field_type',
    },
    fieldOptions: {
      type:         DataTypes.JSON,
      allowNull:    true,
      defaultValue: null,
      field:        'field_options',
      comment:      'For dropdown/multi_select: array of {label, value} objects',
    },
    fieldValue: {
      type:         DataTypes.JSON,
      allowNull:    true,
      defaultValue: null,
      field:        'field_value',
    },
    fieldOrder: {
      type:         DataTypes.INTEGER,
      defaultValue: 0,
      field:        'field_order',
    },
    isRequired: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
      field:        'is_required',
    },
    parentId: {
      type:      DataTypes.UUID,
      allowNull: true,
      field:     'parent_id',
      comment:   'For nested repeatable fields',
    },
  },
  {
    sequelize,
    modelName:  'AssetDynamicField',
    tableName:  'asset_dynamic_fields',
    paranoid:   true,
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['asset_id'] },
      { fields: ['asset_id', 'field_key'] },
      { fields: ['field_order'] },
    ],
  },
);

export default AssetDynamicField;
