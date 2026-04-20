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

        await queryInterface.createTable('ekyc_user_steps', {
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

            step: {
                type: Sequelize.STRING,
                allowNull: true,
            },

            step_status: {
                type: Sequelize.ENUM,
                values: ["FAILED", "PASSED", "PENDING"],
                defaultValue: "PENDING"
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
         * await queryInterface.dropTable('ekyc_user_steps');
         */
        await queryInterface.dropTable('ekyc_user_steps');
    }
};
