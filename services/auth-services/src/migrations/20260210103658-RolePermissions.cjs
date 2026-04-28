'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
  
    await queryInterface.createTable('role_permissions', {
    id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
    },

    role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
    },

    menu_key:{
        type: Sequelize.STRING,
        allowNull: false,
    },

    permissions:{
        type: Sequelize.JSON,
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
},{
    tableName: "role_permissions",
    timestamps: false,
    freezeTableName: true,
});
 
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('role_permissions');
  }
};
