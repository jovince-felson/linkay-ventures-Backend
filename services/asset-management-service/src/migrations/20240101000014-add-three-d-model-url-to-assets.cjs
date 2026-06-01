'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'three_d_model_url', {
      type:         Sequelize.STRING(500),
      allowNull:    true,
      defaultValue: null,
      after:        'created_by_name',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('assets', 'three_d_model_url');
  },
};
