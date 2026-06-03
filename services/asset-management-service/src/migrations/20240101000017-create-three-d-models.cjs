'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('three_d_models', {
      id:             { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      meshy_task_id:  { type: Sequelize.STRING(100), allowNull: false, unique: true },
      status:         { type: Sequelize.ENUM('PENDING','PROCESSING','SUCCEEDED','FAILED'), defaultValue: 'PENDING', allowNull: false },
      progress:       { type: Sequelize.INTEGER, defaultValue: 0, allowNull: false },
      glb_url:        { type: Sequelize.STRING(1000), allowNull: true },
      video_url:      { type: Sequelize.STRING(1000), allowNull: true },
      asset_id:       { type: Sequelize.UUID, allowNull: true },
      created_by:     { type: Sequelize.STRING(36), allowNull: true },
      created_at:     { type: Sequelize.DATE, allowNull: false },
      updated_at:     { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('three_d_models', ['meshy_task_id'], { unique: true });
    await queryInterface.addIndex('three_d_models', ['asset_id']);
    await queryInterface.addIndex('three_d_models', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('three_d_models');
  },
};
