'use strict';

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

    const now = new Date();

    const permissionData = [
      "List",
      "Add",
      "Edit",
      "View",
      "Delete",
      "StatusChange",
      "Approve",
    ].map((perm, index) => ({
      key: perm,
      description: `${perm} Permission`,
      status: 1,
      trash: "NO",
      created_by: 1,
      updated_by: 1,
      created_at: now,
      updated_at: now,
    }));

    await queryInterface.bulkInsert('permissions', permissionData, {});
  },

  async down(queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
  }
};
