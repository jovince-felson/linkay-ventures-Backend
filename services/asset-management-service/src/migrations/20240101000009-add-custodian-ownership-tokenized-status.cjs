'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('assets', 'custodian', {
      type:      Sequelize.DataTypes.STRING(300),
      allowNull: true,
    });

    await queryInterface.addColumn('assets', 'ownership_entity', {
      type:      Sequelize.DataTypes.STRING(300),
      allowNull: true,
    });

    await queryInterface.changeColumn('assets', 'status', {
      type:         Sequelize.DataTypes.ENUM('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED', 'TOKENIZED'),
      defaultValue: 'DRAFT',
      allowNull:    false,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('assets', 'custodian');
    await queryInterface.removeColumn('assets', 'ownership_entity');
    await queryInterface.changeColumn('assets', 'status', {
      type:         Sequelize.DataTypes.ENUM('DRAFT', 'REVIEW', 'LIVE', 'ARCHIVED'),
      defaultValue: 'DRAFT',
      allowNull:    false,
    });
  },
};
