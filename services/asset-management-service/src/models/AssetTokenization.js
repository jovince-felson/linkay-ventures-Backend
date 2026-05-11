import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class AssetTokenization extends Model {}

AssetTokenization.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    assetId: {
      type:      DataTypes.UUID,
      allowNull: false,
      unique:    true,
      field:     'asset_id',
    },
    ipfsCid: {
      type:      DataTypes.STRING(100),
      allowNull: true,
      field:     'ipfs_cid',
    },
    metadataUrl: {
      type:      DataTypes.STRING(500),
      allowNull: true,
      field:     'metadata_url',
    },
    metadataJson: {
      type:      DataTypes.JSON,
      allowNull: true,
      field:     'metadata_json',
    },
    mintPayload: {
      type:      DataTypes.JSON,
      allowNull: true,
      field:     'mint_payload',
    },
    tokenAddress: {
      type:      DataTypes.STRING(100),
      allowNull: true,
      field:     'token_address',
    },
    tokenId: {
      type:      DataTypes.STRING(100),
      allowNull: true,
      field:     'token_id',
    },
    transactionHash: {
      type:      DataTypes.STRING(100),
      allowNull: true,
      field:     'transaction_hash',
    },
    tokenizationStatus: {
      type:         DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
      defaultValue: 'PENDING',
      field:        'tokenization_status',
    },
    blockchainNetwork: {
      type:         DataTypes.STRING(50),
      defaultValue: 'ethereum',
      field:        'blockchain_network',
    },
    requestedBy: {
      type:      DataTypes.STRING(36),
      allowNull: true,
      field:     'requested_by',
    },
    errorMessage: {
      type:      DataTypes.TEXT,
      allowNull: true,
      field:     'error_message',
    },
  },
  {
    sequelize,
    modelName:   'AssetTokenization',
    tableName:   'asset_tokenizations',
    timestamps:  true,
    underscored: true,
    paranoid:    false,
    deletedAt:   false,
    indexes: [
      { fields: ['asset_id'], unique: true },
      { fields: ['tokenization_status'] },
      { fields: ['ipfs_cid'] },
    ],
  },
);

export default AssetTokenization;
