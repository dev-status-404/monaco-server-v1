import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const GameCredential = sequelize.define(
  "game_credential",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    game_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "games", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    login_username: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    login_password_enc: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    status: {
      validate: { isIn: [["available", "assigned", "revoked"]] },
      type: DataTypes.STRING,
      defaultValue: "available",
    },

    assigned_to_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "game_credentials",
    timestamps: true,
  }
);

export default GameCredential;