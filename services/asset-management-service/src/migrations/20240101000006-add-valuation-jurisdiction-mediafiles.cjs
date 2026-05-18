'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'valuation', {
      type: Sequelize.DECIMAL(20, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('assets', 'jurisdiction', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn('assets', 'media_files', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('assets', 'valuation');
    await queryInterface.removeColumn('assets', 'jurisdiction');
    await queryInterface.removeColumn('assets', 'media_files');
  },
};
