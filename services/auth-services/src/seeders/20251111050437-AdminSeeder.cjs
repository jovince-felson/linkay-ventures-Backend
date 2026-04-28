'use strict';
const bcrypt = require('bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */

    const hashedPassword = await bcrypt.hash('123Admin', 10);

    await queryInterface.bulkInsert('users', [{
      email: "admin@gmail.com",
      password: hashedPassword,
      is_tfa: 0,
      phone_number: "9344121794",
      is_locked: 0,
      failed_attempts: 0,
      locked_until: null,
      ekyc_passed: true,
      country_id: 1,
      role: "2",
      status: 1,
      trash : "NO",

    }], {});
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */

    await queryInterface.bulkDelete('users', null, {});
  }
};
