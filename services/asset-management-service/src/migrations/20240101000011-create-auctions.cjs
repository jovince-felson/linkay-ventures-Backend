'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('auctions', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
      },
      asset_id: {
        type:       Sequelize.DataTypes.UUID,
        allowNull:  false,
        references: { model: 'assets', key: 'id' },
        onDelete:   'CASCADE',
      },
      museum_id:   { type: Sequelize.DataTypes.STRING(36), allowNull: false },
      created_by:  { type: Sequelize.DataTypes.STRING(36), allowNull: false },
      updated_by:  { type: Sequelize.DataTypes.STRING(36), allowNull: true },

      // Auction Info
      title:       { type: Sequelize.DataTypes.STRING(500), allowNull: false },
      description: { type: Sequelize.DataTypes.TEXT,        allowNull: true },

      // Supply & Pricing
      fractions_allocated: { type: Sequelize.DataTypes.INTEGER.UNSIGNED, allowNull: false },
      min_purchase_qty:    { type: Sequelize.DataTypes.INTEGER.UNSIGNED, allowNull: false },
      max_purchase_qty:    { type: Sequelize.DataTypes.INTEGER.UNSIGNED, allowNull: false },
      starting_bid_price:  { type: Sequelize.DataTypes.DECIMAL(20, 2),   allowNull: false },
      reserve_price:       { type: Sequelize.DataTypes.DECIMAL(20, 2),   allowNull: false },
      min_increment:       { type: Sequelize.DataTypes.DECIMAL(20, 2),   allowNull: false },

      // Schedule
      start_date:     { type: Sequelize.DataTypes.DATEONLY, allowNull: false },
      start_time:     { type: Sequelize.DataTypes.STRING(8), allowNull: false },
      end_date:       { type: Sequelize.DataTypes.DATEONLY,  allowNull: false },
      end_time:       { type: Sequelize.DataTypes.STRING(8), allowNull: false },
      timezone:       { type: Sequelize.DataTypes.STRING(20), allowNull: false, defaultValue: 'UTC' },
      show_countdown: { type: Sequelize.DataTypes.BOOLEAN,   allowNull: false, defaultValue: true },

      // Status
      status: {
        type:         Sequelize.DataTypes.ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'),
        defaultValue: 'SCHEDULED',
        allowNull:    false,
      },

      created_at:  { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:  { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      deleted_at:  { type: Sequelize.DataTypes.DATE, allowNull: true },
    });

    await queryInterface.addIndex('auctions', ['asset_id']);
    await queryInterface.addIndex('auctions', ['museum_id']);
    await queryInterface.addIndex('auctions', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('auctions');
  },
};
