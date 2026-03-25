import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const GameRequest = sequelize.define(
  "game_request",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    game_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "games", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    status: {
      validate: { isIn: [["pending", "approved", "rejected"]] },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },

    admin_note: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    credential_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "game_credentials", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    // ✅ REQUIRED because you have GameRequest.belongsTo(User, as: "reviewedByAdmin")
    reviewed_by_admin_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "game_requests",
    timestamps: true,
  }
);

export default GameRequest;