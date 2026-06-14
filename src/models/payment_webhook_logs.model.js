import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const PaymentWebhookLog = sequelize.define(
  "payment_webhook_log",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "tierlock",
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    transaction_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    order_id: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    signature_present: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    processing_result: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    headers: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "payment_webhook_logs",
    timestamps: true,
    updatedAt: false,
  },
);

export default PaymentWebhookLog;
