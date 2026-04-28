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

    await queryInterface.createTable('sessions', {

      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      ip: {
        type: Sequelize.STRING,
        allowNull: false,
      },

      is_ip_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_device_verified: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      otp_request_count:{
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },

      user_agent:{
        type: Sequelize.STRING,
        allowNull: true,
      },

      device_id:{
        type: Sequelize.STRING,
        allowNull: false, 
      },

      device_name:{
        type: Sequelize.STRING,
        allowNull: false, 
      },

      logged_in_at:{
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      logged_out_at:{
        type: Sequelize.DATE,
        allowNull: true,  
      },

      revoked:{
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      otp: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      otp_expiry: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      otp_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

})

},
      async down(queryInterface, Sequelize) {
      /**
       * Add reverting commands here.
       *
       * Example:
       * await queryInterface.dropTable('users');
       */

      await queryInterface.dropTable('sessions');
    }
};
