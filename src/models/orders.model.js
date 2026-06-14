import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Order = sequelize.define(
  "order",
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
    customer_email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    game: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    game_username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payment_method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payment_provider: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [["pix_pay", "tierlock"]],
      },
    },
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    total_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    credits: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    payment_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Pending Payment",
      validate: {
        isIn: [[
          "Pending Payment",
          "Payment Approved",
          "Failed",
          "Rejected",
          "Cancelled",
        ]],
      },
    },
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tierlock_order_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    rejected_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    credits_sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payment_opened_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "orders",
    timestamps: true,
  },
);

export default Order;
