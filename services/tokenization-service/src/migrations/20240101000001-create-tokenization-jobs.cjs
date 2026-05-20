'use strict';

const INITIAL_STEPS = JSON.stringify({
  ipfs:          { status: 'pending' },
  mintNFT:       { status: 'pending' },
  deployToken:   { status: 'pending' },
  mintFractions: { status: 'pending' },
  setCompliance: { status: 'pending' },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tokenization_jobs', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
        allowNull:    false,
        comment:      'jobId returned to frontend',
      },
      asset_id: {
        type:      Sequelize.DataTypes.UUID,
        allowNull: false,
        unique:    true,
        comment:   'one active job per asset',
      },
      status: {
        type:         Sequelize.DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending',
        allowNull:    false,
      },
      steps: {
        type:         Sequelize.DataTypes.JSON,
        allowNull:    false,
        defaultValue: INITIAL_STEPS,
        comment:      'per-step progress — updated by worker after each step',
      },
      owner_wallet: {
        type:      Sequelize.DataTypes.STRING(42),
        allowNull: true,
        comment:   'museum admin wallet — NFT and retained fractions recipient',
      },
      network: {
        type:         Sequelize.DataTypes.STRING(50),
        allowNull:    false,
        defaultValue: 'sepolia',
      },
      requested_by: {
        type:      Sequelize.DataTypes.STRING(36),
        allowNull: true,
        comment:   'userId from JWT',
      },
      image_url: {
        type:      Sequelize.DataTypes.STRING(1000),
        allowNull: true,
        comment:   'primary image URL fetched at request time for IPFS metadata',
      },
      error_message: {
        type:      Sequelize.DataTypes.TEXT,
        allowNull: true,
      },
      completed_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: true,
      },
      created_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type:      Sequelize.DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('tokenization_jobs', ['asset_id'],  { unique: true });
    await queryInterface.addIndex('tokenization_jobs', ['status']);
    await queryInterface.addIndex('tokenization_jobs', ['requested_by']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tokenization_jobs');
  },
};
