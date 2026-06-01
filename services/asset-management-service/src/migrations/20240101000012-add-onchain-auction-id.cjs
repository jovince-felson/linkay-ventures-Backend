'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('auctions', 'onchain_auction_id', {
      type:      Sequelize.DataTypes.STRING(78),
      allowNull: true,
      after:     'status',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('auctions', 'onchain_auction_id');
  },
};
