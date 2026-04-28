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

    await queryInterface.createTable("ekyc_profiles",{
      id:{
              type: Sequelize.INTEGER,
              allowNull: false,
              autoIncrement: true,
              primaryKey: true,
          },
      
          user_id:{
              type: Sequelize.INTEGER,
              allowNull: false,
              unique: true,
          },
      
          attempts:{
              type: Sequelize.INTEGER,
              defaultValue: 1,
          },
      
          ekyc_status:{
              type: Sequelize.INTEGER,
              comment: "0-> Initial Stage,1-> Verified, 2-> Rejected, 3->Failed, 4->Mannual Approval Needed",
              defaultValue: 0,
          },
      
          applicant_id:{
              type: Sequelize.STRING,
              allowNull: true,
          },
      
          inspection_id:{
              type: Sequelize.STRING,
              allowNull: true,
          },
      
          status:{
              type: Sequelize.INTEGER,
              defaultValue: 1,
              allowNull: false,
          },
      
          trash:{
              type: Sequelize.ENUM("NO","YES"),
              defaultValue: "NO",
          },
      
          created_at:{
              type: Sequelize.DATE,
              allowNull: true,
          },
      
          updated_at:{
              type: Sequelize.DATE,
              allowNull: true,
          },
      
          last_submitted_at:{
              type: Sequelize.DATE,
              allowNull: true,
          },
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */

    await queryInterface.dropTable('ekyc_profiles');
  }
};
