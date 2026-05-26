'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'created_by_name', {
      type:         Sequelize.STRING(200),
      allowNull:    true,
      defaultValue: null,
      after:        'created_by',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('assets', 'created_by_name');
  },
};
