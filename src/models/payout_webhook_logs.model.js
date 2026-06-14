import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const PayoutWebhookLog = sequelize.define(
  "payout_webhook_log",
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
    event: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
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
    payout_request_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "payout_requests", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    headers: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    signature_header: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "payout_webhook_logs",
    timestamps: true,
    updatedAt: false,
  },
);

export default PayoutWebhookLog;
