'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('permissions', {
        id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        },
    
        key: {
            type: Sequelize.STRING,
            allowNull: false,
        },
    
        description:{
            type: Sequelize.STRING,
            allowNull: true,
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
        tableName: "permissions",
        timestamps: false,
        freezeTableName: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('permissions');
  }
};
