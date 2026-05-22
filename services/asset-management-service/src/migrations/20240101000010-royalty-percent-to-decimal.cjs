'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('assets', 'royalty_percent', {
      type:      Sequelize.DataTypes.DECIMAL(5, 2),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('assets', 'royalty_percent', {
      type:      Sequelize.DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    });
  },
};
