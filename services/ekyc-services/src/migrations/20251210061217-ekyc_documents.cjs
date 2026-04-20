'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */

    await queryInterface.createTable('ekyc_documents', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      ekyc_profile_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      ekyc_step: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      ekyc_meta_data:{
        type: Sequelize.TEXT,
        allowNull: true,
      },

      file_path: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      document_type: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "1-> Passport , 2-> Driving License, 3-> Residental ID, 4-> Other, 5-> Selfie",
      },

      status: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },

      trash: {
        type: Sequelize.ENUM("NO", "YES"),
        defaultValue: "NO",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    await queryInterface.dropTable('ekyc_documents');
  }
};
