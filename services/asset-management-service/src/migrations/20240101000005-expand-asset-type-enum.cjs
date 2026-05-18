'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('assets', 'asset_type', {
      type: Sequelize.ENUM(
        'COLLECTIBLE',
        'REAL_ESTATE',
        'FINE_ART',
        'LUXURY_ASSET',
        'LUXURY_WATCH',
        'OTHER',
      ),
      allowNull: false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('assets', 'asset_type', {
      type: Sequelize.ENUM('COLLECTIBLE', 'REAL_ESTATE'),
      allowNull: false,
    });
  },
};
