'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.createTable('biometric_credentials',{
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
    
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
    
            credential_id: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
    
            public_key: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
    
            platform: {
                type: Sequelize.ENUM("ANDROID", "IOS"),
                allowNull: false,
            },
    
            device_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
    
            device_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
    
            status: {
                type: Sequelize.TINYINT,
                defaultValue: 1,
            },
    
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW,
            },
    
            last_used_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "biometric_credentials",
            timestamps: false,
            indexes: [
                {
                    unique: true,
                    fields: ["user_id", "device_id"],
                },
            ],
        });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('biometric_credentials');
  }
};
