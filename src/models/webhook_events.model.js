import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const WebhookEvent = sequelize.define(
  "webhook_event",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    provider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pointsmate",
    },
    event_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    event_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "received",
    },
    payload: {
      type: DataTypes.JSON,
      allowNull: false,
    },
  },
  {
    tableName: "webhook_events",
    timestamps: true,
  },
);

export default WebhookEvent;
