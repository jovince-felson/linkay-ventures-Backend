'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bids', {
      id: {
        type:         Sequelize.DataTypes.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV4,
        primaryKey:   true,
      },
      auction_id: {
        type:       Sequelize.DataTypes.UUID,
        allowNull:  false,
        references: { model: 'auctions', key: 'id' },
        onDelete:   'CASCADE',
      },
      bidder_address: { type: Sequelize.DataTypes.STRING(42),    allowNull: false },
      amount:         { type: Sequelize.DataTypes.DECIMAL(20, 6), allowNull: false },
      tx_hash:        { type: Sequelize.DataTypes.STRING(66),    allowNull: true },
      created_at:     { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at:     { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
    });

    await queryInterface.addIndex('bids', ['auction_id']);
    await queryInterface.addIndex('bids', ['bidder_address']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('bids');
  },
};
