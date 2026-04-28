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

    await queryInterface.createTable('file_details', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      context_type: {
        type: Sequelize.ENUM("USER", "PAYMENTS", "SUPPORT", "EKYC", "ACCOUNT", "CARD"),
        allowNull: false,
      },

      context_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      file_key: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_path: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_size: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_original_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      file_extension: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      trash: {
        type: Sequelize.ENUM("NO", "YES"),
        allowNull: false,
        defaultValue: "NO"
      },

      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
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

    await queryInterface.dropTable('file_details');
  }
};
