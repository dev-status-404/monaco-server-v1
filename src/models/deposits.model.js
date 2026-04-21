import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Deposit = sequelize.define(
  "deposit",
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

    // ⚠️ You currently have UUID here — should be STRING
    game_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    provider: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    provider_payment_id: {
      type: DataTypes.STRING,
      unique: true,
    },

    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },

    currency: {
      type: DataTypes.STRING,
      defaultValue: "USD",
    },

    status: {
      validate: {
        isIn: [["initiated", "approved", "confirmed", "failed", "refunded"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "initiated",
    },
  },
  {
    tableName: "deposits",
    timestamps: true,
  }
);

export default Deposit;