import { DataTypes } from "sequelize";
import { sequelize } from "../config/db.js";

const Notification = sequelize.define(
  "notification",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "system",
    },
    title: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_read: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
  },
);

export default Notification;
