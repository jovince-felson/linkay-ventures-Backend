import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Asset extends Model {}

Asset.init(
  {
    id:          { type: DataTypes.UUID,         primaryKey: true },
    title:       { type: DataTypes.STRING(500) },
    description: { type: DataTypes.TEXT },
    assetType:   { type: DataTypes.STRING(50),   field: 'asset_type' },
    status:      { type: DataTypes.STRING(20) },
    valuation:   { type: DataTypes.DECIMAL(20, 2) },
    jurisdiction:{ type: DataTypes.STRING(200) },
    museumId:    { type: DataTypes.STRING(36),   field: 'museum_id' },
    createdBy:   { type: DataTypes.STRING(36),   field: 'created_by' },

    // tokenization input fields
    totalFractions:   { type: DataTypes.INTEGER.UNSIGNED,  field: 'total_fractions' },
    tokenizedPercent: { type: DataTypes.DECIMAL(5, 2),     field: 'tokenized_percent' },
    retainedPercent:  { type: DataTypes.DECIMAL(5, 2),     field: 'retained_percent' },
    certificationRef: { type: DataTypes.STRING(200),       field: 'certification_ref' },
    royaltyWallet:    { type: DataTypes.STRING(42),        field: 'royalty_wallet' },
    royaltyPercent:   { type: DataTypes.INTEGER.UNSIGNED,  field: 'royalty_percent' },

    // tokenization output fields (written by worker)
    ipfsMetadataUri:       { type: DataTypes.STRING(500), field: 'ipfs_metadata_uri' },
    nftContractAddress:    { type: DataTypes.STRING(42),  field: 'nft_contract_address' },
    nftTokenId:            { type: DataTypes.INTEGER.UNSIGNED, field: 'nft_token_id' },
    erc3643ContractAddress:{ type: DataTypes.STRING(42),  field: 'erc3643_contract_address' },
    complianceConfigured:  { type: DataTypes.BOOLEAN,     field: 'compliance_configured' },
    transactionHash:       { type: DataTypes.STRING(100), field: 'transaction_hash' },
  },
  {
    sequelize,
    modelName:   'Asset',
    tableName:   'assets',
    timestamps:  true,
    underscored: true,
    paranoid:    true,
  },
);

export default Asset;
