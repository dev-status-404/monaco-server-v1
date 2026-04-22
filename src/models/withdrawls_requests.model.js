import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const WithdrawalRequest = sequelize.define(
  "withdrawal_request",
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
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },

    game_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },

    currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },

    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    destination: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },

    api_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },

    status: {
      validate: {
        isIn: [["requested", "approved", "rejected", "processing", "paid", "failed"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "requested",
    },

    reviewed_by_admin_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    admin_note: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "withdrawal_requests",
    timestamps: true,
  }
);

export default WithdrawalRequest;