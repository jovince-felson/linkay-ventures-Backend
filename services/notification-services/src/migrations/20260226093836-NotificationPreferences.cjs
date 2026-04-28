'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable("notification_preferences", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      notification_type: {
        type: Sequelize.ENUM("PAYMENTS", "WALLETS", "SECURITY", "CRYPTO"),
        allowNull: false,
      },

      is_enabled: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      },

      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    }, {
      tableName: "notification_preferences",
      timestamps: true,
      freezeTableName: true,
    });

  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('notification_preferences');
  }
};
