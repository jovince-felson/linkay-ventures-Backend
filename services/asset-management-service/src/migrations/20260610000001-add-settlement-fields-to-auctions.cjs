'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('auctions', 'winner_address', {
      type:      Sequelize.DataTypes.STRING(42),
      allowNull: true,
    });
    await queryInterface.addColumn('auctions', 'winning_bid', {
      type:      Sequelize.DataTypes.DECIMAL(20, 6),
      allowNull: true,
    });
    await queryInterface.addColumn('auctions', 'settlement_status', {
      type:      Sequelize.DataTypes.ENUM('SETTLED', 'RESERVE_NOT_MET'),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('auctions', 'winner_address');
    await queryInterface.removeColumn('auctions', 'winning_bid');
    await queryInterface.removeColumn('auctions', 'settlement_status');
  },
};
