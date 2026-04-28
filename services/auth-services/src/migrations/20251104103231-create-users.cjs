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

    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      email: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      phone_number: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      country_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      password: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      is_tfa: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      is_locked: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      locked_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ekyc_passed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      role: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: "1=> Normal User, 2=> Admin",
        defaultValue: "1",
      },

      provider: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      biometric_enabling: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 1,
        comment: "1=> On , 0=> Off"
      },

      uid: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      is_private_email: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },

      status: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
      },

      trash: {
        type: Sequelize.ENUM('NO', 'YES'),
        defaultValue: 'NO',
        allowNull: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
      }
    },
    )
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    await queryInterface.dropTable('users');
  }
};
