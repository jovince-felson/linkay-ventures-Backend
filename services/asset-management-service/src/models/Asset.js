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
    custodian: {
      type:      DataTypes.STRING(300),
      allowNull: true,
    },
    ownershipEntity: {
      type:      DataTypes.STRING(300),
      allowNull: true,
      field:     'ownership_entity',
    },
    status: {
      type:         DataTypes.ENUM('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED', 'TOKENIZED'),
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
    createdByName: {
      type:      DataTypes.STRING(200),
      allowNull: true,
      field:     'created_by_name',
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

    // ── Input fields for tokenization worker ─────────────────────────────────
    historicalContext: {
      type:      DataTypes.TEXT,
      allowNull: true,
      field:     'historical_context',
    },
    totalFractions: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field:     'total_fractions',
    },
    tokenizedPercent: {
      type:      DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field:     'tokenized_percent',
    },
    retainedPercent: {
      type:      DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field:     'retained_percent',
    },
    pricePerFraction: {
      type:      DataTypes.DECIMAL(20, 2),
      allowNull: true,
      field:     'price_per_fraction',
    },
    conditionReport: {
      type:      DataTypes.TEXT,
      allowNull: true,
      field:     'condition_report',
    },
    certificationRef: {
      type:      DataTypes.STRING(200),
      allowNull: true,
      field:     'certification_ref',
    },
    royaltyPercent: {
      type:      DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field:     'royalty_percent',
    },
    royaltyWallet: {
      type:      DataTypes.STRING(42),
      allowNull: true,
      field:     'royalty_wallet',
    },

    // ── Output fields written by tokenization worker ──────────────────────────
    ipfsMetadataUri: {
      type:      DataTypes.STRING(500),
      allowNull: true,
      field:     'ipfs_metadata_uri',
    },
    nftContractAddress: {
      type:      DataTypes.STRING(42),
      allowNull: true,
      field:     'nft_contract_address',
    },
    nftTokenId: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      field:     'nft_token_id',
    },
    erc3643ContractAddress: {
      type:      DataTypes.STRING(42),
      allowNull: true,
      field:     'erc3643_contract_address',
    },
    complianceConfigured: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
      field:        'compliance_configured',
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
