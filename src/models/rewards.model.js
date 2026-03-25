import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Reward = sequelize.define(
  "reward",
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

    source: {
      validate: {
        isIn: [["invite_signup", "invite_deposit", "promo", "manual"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },

    status: {
      validate: {
        isIn: [["pending", "granted", "revoked"]],
      },
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    },

    related_invite_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "invites", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  },
  {
    tableName: "rewards",
    timestamps: true,
  }
);

export default Reward;