import { DataTypes } from "sequelize";
import sequelize from "../config/database.js";

const RefreshToken = sequelize.define("refresh_tokens", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },

    session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },

    token_hash: {
        type: DataTypes.STRING,
        allowNull: false,
    },

    issued_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },

    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },

    revoked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },

    replaced_by_token_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
}, {
    underscored: true,
    tableName: 'refresh_tokens',
    timestamps: false,
});

export default RefreshToken;