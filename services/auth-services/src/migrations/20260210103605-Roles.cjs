'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('roles', {
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },

            role_name: {
                type: Sequelize.STRING,
                allowNull: false,
            },

            status: {
                type: Sequelize.INTEGER,
                defaultValue: 1,
            },

            trash: {
                type: Sequelize.ENUM(["NO", "YES"]),
                allowNull: false,
                defaultValue: "NO"
            },
            data_scope: {
                type: Sequelize.ENUM(["CREATED", "ASSIGNED", "ALL"]),
                allowNull: false
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

        }, {
            tableName: "roles",
            timestamps: false,
            freezeTableName: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('roles');
    }
};
