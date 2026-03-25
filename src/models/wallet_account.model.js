import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const WalletAccount = sequelize.define(
  "wallet_account",
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
      unique: true, // 👈 enforces 1 wallet per user (matches hasOne)
    },

    balance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },

    currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },

    status: {
      validate: { isIn: [["active", "locked"]] },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "wallet_accounts",
    timestamps: true,
  }
);

export default WalletAccount;