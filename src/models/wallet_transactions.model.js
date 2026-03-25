import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const WalletTransaction = sequelize.define(
  "wallet_transaction",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },

    wallet_account_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "wallet_accounts", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },

    type: {
      validate: {
        isIn: [["deposit", "withdrawal", "reward", "redeem", "adjustment"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
    },

    direction: {
      validate: {
        isIn: [["credit", "debit"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },

    status: {
      validate: { isIn: [["pending", "completed", "failed", "canceled"]] },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },

    api_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },

    reference_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // ⚠️ DO NOT FK this because it points to multiple tables depending on reference_type
    reference_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    game_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "games", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },

    game_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    idempotency_key: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
    },

    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "wallet_transactions",
    timestamps: true,
  }
);

export default WalletTransaction;