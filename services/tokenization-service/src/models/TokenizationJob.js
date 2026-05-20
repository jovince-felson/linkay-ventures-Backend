import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

export const INITIAL_STEPS = {
  ipfs:          { status: 'pending' },
  mintNFT:       { status: 'pending' },
  deployToken:   { status: 'pending' },
  mintFractions: { status: 'pending' },
  setCompliance: { status: 'pending' },
};

class TokenizationJob extends Model {
  async updateStep(stepName, data) {
    // Sequelize returns JSON columns as strings from MySQL — always parse first
    const current = typeof this.steps === 'string' ? JSON.parse(this.steps) : this.steps;
    const steps   = { ...current };
    steps[stepName] = { ...steps[stepName], ...data };
    await this.update({ steps });
    this.steps = steps;
  }
}

TokenizationJob.init(
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
    status: {
      type:         DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      defaultValue: 'pending',
      allowNull:    false,
    },
    steps: {
      type:         DataTypes.JSON,
      allowNull:    false,
      defaultValue: INITIAL_STEPS,
    },
    ownerWallet: {
      type:      DataTypes.STRING(42),
      allowNull: true,
      field:     'owner_wallet',
    },
    network: {
      type:         DataTypes.STRING(50),
      allowNull:    false,
      defaultValue: 'sepolia',
    },
    requestedBy: {
      type:      DataTypes.STRING(36),
      allowNull: true,
      field:     'requested_by',
    },
    imageUrl: {
      type:      DataTypes.STRING(1000),
      allowNull: true,
      field:     'image_url',
    },
    errorMessage: {
      type:      DataTypes.TEXT,
      allowNull: true,
      field:     'error_message',
    },
    completedAt: {
      type:      DataTypes.DATE,
      allowNull: true,
      field:     'completed_at',
    },
  },
  {
    sequelize,
    modelName:   'TokenizationJob',
    tableName:   'tokenization_jobs',
    timestamps:  true,
    underscored: true,
    indexes: [
      { fields: ['asset_id'], unique: true },
      { fields: ['status'] },
      { fields: ['requested_by'] },
    ],
  },
);

export default TokenizationJob;
