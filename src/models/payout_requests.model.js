import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const PayoutRequest = sequelize.define(
  "payout_request",
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
    amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
    },
    payout_method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    payout_account: {
      type: DataTypes.STRING(1024),
      allowNull: false,
    },
    customer_phone: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Redeem Requested",
      validate: {
        isIn: [[
          "Redeem Requested",
          "Under Review",
          "Approved",
          "Paid Out",
          "Rejected",
          "Failed",
          "Cancelled",
          "Expired",
        ]],
      },
    },
    tierlock_order_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tierlock_transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_event: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_status: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webhook_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    webhook_received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    raw_webhook_payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    status_history: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "payout_requests",
    timestamps: true,
  },
);

export default PayoutRequest;
