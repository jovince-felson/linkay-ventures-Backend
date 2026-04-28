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

    await queryInterface.createTable('master_apis',
      {
        id: {
          type: Sequelize.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },



        api_name: {
          type: Sequelize.STRING,
          allowNull: false,

        },

        api_category: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },

        api_credentials: {
          type: Sequelize.TEXT,
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
          defaultValue: "NO",
        },

        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },

        updated_at: {
          type: Sequelize.DATE,
          allowNull: true,
        }

      });

  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    await queryInterface.dropTable('master_apis');
  }
};
